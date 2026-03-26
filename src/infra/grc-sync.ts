import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { createSubsystemLogger, type SubsystemLogger } from "../logging/subsystem.js";
import { GrcClient, type GrcEvolutionAsset, type GrcSkill, type GrcPlatformValues, type UpdateCheckResult, type GrcKeyConfigEntry } from "./grc-client.js";
import { EvolutionStore, hashPayload, type LocalGene, type LocalCapsule } from "./evolution-store.js";
import { GrcSkillManifestStore, compareSemver } from "./grc-skill-manifest.js";
import { installGrcSkill } from "./grc-skill-installer.js";
import { runGrcDownloadAndInstall } from "./update-runner.js";
import { resolveDefaultAgentWorkspaceDir } from "../agents/workspace.js";
import { requestHeartbeatNow } from "./heartbeat-wake.js";
import { cacheTaskEvent } from "./task-event-cache.js";
import { upsertAuthProfile, loadAuthProfileStore, saveAuthProfileStore } from "../agents/auth-profiles.js";

const log: SubsystemLogger = createSubsystemLogger("infra/grc-sync");

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type GrcSyncConfig = {
  /** Master switch: when false the service never starts. */
  enabled: boolean;
  /** GRC server base URL (e.g. "http://localhost:3100"). */
  url: string;
  /** Bearer token for authenticated endpoints (publish, telemetry). */
  authToken?: string;
  /** Unique identifier for this WinClaw node (used in A2A protocol). */
  nodeId: string;
  /** Sync interval in seconds. Default: 14400 (4 hours). */
  syncInterval: number;
  /** Whether to auto-apply updates discovered via GRC. */
  autoUpdate: boolean;
  /** Whether to upload local evolution assets to GRC. */
  shareEvolution: boolean;
  /** Whether to send anonymized telemetry reports. */
  telemetry: boolean;
};

export type GrcSyncResult = {
  timestamp: string;
  updateAvailable: boolean;
  updateVersion?: string;
  updateCheckResult?: UpdateCheckResult;
  trendingSkills: GrcSkill[];
  trendingSkillsCount: number;
  promotedAssets: GrcEvolutionAsset[];
  promotedAssetsCount: number;
  /** Number of promoted assets actually downloaded and cached locally. */
  assetsCached: number;
  /** Number of local evolution assets uploaded to GRC in this cycle. */
  assetsUploaded: number;
  /** Number of usage reports sent to GRC in this cycle. */
  usageReportsSent: number;
  /** Number of installed skills checked for updates. */
  skillsChecked: number;
  /** Number of skills actually updated in this cycle. */
  skillsUpdated: number;
  /** Errors encountered during skill update. */
  skillUpdateErrors: string[];
  /** Whether an auto-update install was attempted in this cycle. */
  updateInstallAttempted: boolean;
  /** Whether the auto-update install succeeded. */
  updateInstallSuccess: boolean;
  telemetrySent: boolean;
  /** Whether platform values were fetched/updated in this cycle. */
  platformValuesFetched: boolean;
  /** Whether role config was checked from GRC in this cycle. */
  configChecked: boolean;
  /** Whether role config files were pulled and written to workspace in this cycle. */
  configPulled: boolean;
  /** The config revision that was applied, if any. */
  configRevisionApplied: number | null;
  errors: string[];
  durationMs: number;
};

export type GrcSyncServiceHandle = {
  start: () => void;
  stop: () => void;
  triggerSync: () => Promise<GrcSyncResult>;
  getLastResult: () => GrcSyncResult | null;
  isRunning: () => boolean;
  /** On-demand search: query GRC for assets matching given signals. */
  searchRemote: (signals: string[], limit?: number) => Promise<GrcEvolutionAsset[]>;
  /** Get the underlying EvolutionStore (for direct local access). */
  getStore: () => EvolutionStore;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** How long to wait after startup before the first sync (ms). */
const INITIAL_DELAY_MS = 30_000;

/** Max assets to upload per sync cycle to avoid overwhelming the server. */
const MAX_UPLOAD_PER_CYCLE = 20;

/** Max usage reports to send per sync cycle. */
const MAX_REPORTS_PER_CYCLE = 100;

// ---------------------------------------------------------------------------
// SSE Config Stream Constants
// ---------------------------------------------------------------------------

/** Initial reconnect delay for SSE (ms). */
const SSE_RECONNECT_DELAY_MS = 5_000;
/** Maximum reconnect delay for SSE (ms). */
const SSE_MAX_RECONNECT_DELAY_MS = 300_000;
/** Maximum number of consecutive SSE reconnect attempts before entering dormant mode. */
const MAX_SSE_RECONNECT_ATTEMPTS = 100;
/** SSE keepalive timeout — reconnect if no data received for this long (ms). */
const SSE_KEEPALIVE_TIMEOUT_MS = 120_000;

const sseLog: SubsystemLogger = createSubsystemLogger("infra/grc-sse");

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class GrcSyncService implements GrcSyncServiceHandle {
  private client: GrcClient;
  private config: GrcSyncConfig;
  private store: EvolutionStore;
  private skillManifest: GrcSkillManifestStore;
  private timer: ReturnType<typeof setInterval> | null = null;
  private initialTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private syncing = false;
  private lastResult: GrcSyncResult | null = null;
  private abortController: AbortController | null = null;

  // SSE config stream state
  private sseAbortController: AbortController | null = null;
  private sseReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private sseReconnectAttempt = 0;
  private sseCurrentRevision = 0;
  private sseConnected = false;
  private sseKeepaliveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: GrcSyncConfig, store?: EvolutionStore, skillManifest?: GrcSkillManifestStore) {
    this.config = config;
    this.client = new GrcClient({
      baseUrl: config.url,
      authToken: config.authToken,
    });
    this.store = store ?? new EvolutionStore();
    this.skillManifest = skillManifest ?? new GrcSkillManifestStore();
  }

  // -- Lifecycle -----------------------------------------------------------

  /** Start the periodic sync loop. Safe to call multiple times. */
  start(): void {
    if (this.running) {
      return;
    }
    if (!this.config.enabled) {
      log.info("GRC sync disabled by config");
      return;
    }
    this.running = true;
    this.abortController = new AbortController();

    log.info("GRC sync service started", {
      interval: this.config.syncInterval,
      url: this.config.url,
      nodeId: this.config.nodeId,
    });

    // Run first sync after a short delay so the rest of the gateway can boot.
    this.initialTimer = setTimeout(() => {
      this.initialTimer = null;
      if (this.running) {
        this.runSync().catch((err) =>
          log.error(`Initial GRC sync failed: ${(err as Error).message}`),
        );
      }
    }, INITIAL_DELAY_MS);
    if (typeof this.initialTimer.unref === "function") {
      this.initialTimer.unref();
    }

    // Repeat at the configured interval.
    this.timer = setInterval(() => {
      if (this.running) {
        this.runSync().catch((err) =>
          log.error(`GRC sync cycle failed: ${(err as Error).message}`),
        );
      }
    }, this.config.syncInterval * 1_000);
    if (typeof this.timer.unref === "function") {
      this.timer.unref();
    }

    // Start SSE config stream for real-time key/config push from GRC
    this.startSSEConfigStream();
  }

  /** Stop the sync loop and cancel any in-flight requests. */
  stop(): void {
    if (!this.running) {
      return;
    }
    this.running = false;
    this.abortController?.abort();
    this.stopSSEConfigStream();

    if (this.initialTimer) {
      clearTimeout(this.initialTimer);
      this.initialTimer = null;
    }
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    log.info("GRC sync service stopped");
  }

  // -- Manual trigger ------------------------------------------------------

  /** Run a sync cycle immediately, regardless of the schedule. */
  async triggerSync(): Promise<GrcSyncResult> {
    return this.runSync();
  }

  // -- On-demand search (Stage B) ------------------------------------------

  /**
   * Query GRC for evolution assets matching the given signals.
   * Results are also cached in the local EvolutionStore for offline use.
   */
  async searchRemote(
    signals: string[],
    limit = 20,
  ): Promise<GrcEvolutionAsset[]> {
    const signal = this.abortController?.signal;
    try {
      const response = await this.client.searchAssets(
        { signals, limit },
        signal,
      );
      const assets = response.assets ?? [];

      // Cache each found asset locally
      let cached = 0;
      for (const asset of assets) {
        try {
          await this.cacheRemoteAsset(asset, signal);
          cached++;
        } catch (err) {
          log.debug(`Failed to cache search result ${asset.assetId}: ${(err as Error).message}`);
        }
      }

      log.info("Remote search completed", {
        signals: signals.slice(0, 5),
        found: assets.length,
        cached,
      });

      return assets;
    } catch (err) {
      log.warn(`Remote search failed: ${(err as Error).message}`);
      return [];
    }
  }

  // -- Accessors -----------------------------------------------------------

  getLastResult(): GrcSyncResult | null {
    return this.lastResult;
  }

  isRunning(): boolean {
    return this.running;
  }

  getStore(): EvolutionStore {
    return this.store;
  }

  // -- Sync body -----------------------------------------------------------

  private async runSync(): Promise<GrcSyncResult> {
    // Prevent concurrent sync cycles (Issue #8)
    if (this.syncing) {
      log.info("GRC sync already in progress, skipping");
      return this.lastResult ?? {
        timestamp: new Date().toISOString(),
        updateAvailable: false,
        trendingSkills: [],
        trendingSkillsCount: 0,
        promotedAssets: [],
        promotedAssetsCount: 0,
        assetsCached: 0,
        assetsUploaded: 0,
        usageReportsSent: 0,
        skillsChecked: 0,
        skillsUpdated: 0,
        skillUpdateErrors: [],
        updateInstallAttempted: false,
        updateInstallSuccess: false,
        telemetrySent: false,
        platformValuesFetched: false,
        configChecked: false,
        configPulled: false,
        configRevisionApplied: null,
        errors: ["Sync skipped — already in progress"],
        durationMs: 0,
      };
    }
    this.syncing = true;

    const started = Date.now();
    const signal = this.abortController?.signal;

    const result: GrcSyncResult = {
      timestamp: new Date().toISOString(),
      updateAvailable: false,
      trendingSkills: [],
      trendingSkillsCount: 0,
      promotedAssets: [],
      promotedAssetsCount: 0,
      assetsCached: 0,
      assetsUploaded: 0,
      usageReportsSent: 0,
      skillsChecked: 0,
      skillsUpdated: 0,
      skillUpdateErrors: [],
      updateInstallAttempted: false,
      updateInstallSuccess: false,
      telemetrySent: false,
      platformValuesFetched: false,
      configChecked: false,
      configPulled: false,
      configRevisionApplied: null,
      errors: [],
      durationMs: 0,
    };

    log.info("GRC sync cycle starting");

    // 1. Update check
    try {
      const platform = os.platform();
      const currentVersion = process.env.WINCLAW_VERSION ?? "0.0.0";
      const channel = process.env.WINCLAW_CHANNEL ?? "stable";
      const update = await this.client.checkUpdate(currentVersion, platform, channel, signal);
      result.updateAvailable = update.available;
      result.updateVersion = update.version;
      result.updateCheckResult = update;
      if (update.available) {
        log.info("WinClaw update available from GRC", {
          version: update.version,
          critical: update.isCritical,
        });
      }
    } catch (err) {
      const msg = `Update check failed: ${(err as Error).message}`;
      result.errors.push(msg);
      log.warn(msg);
    }

    // 1B. Auto-update: download + install if available and autoUpdate enabled
    if (
      this.config.autoUpdate &&
      result.updateAvailable &&
      result.updateCheckResult?.downloadUrl
    ) {
      result.updateInstallAttempted = true;
      try {
        const currentVersion = process.env.WINCLAW_VERSION ?? "0.0.0";
        const installResult = await runGrcDownloadAndInstall({
          grcUrl: this.config.url,
          authToken: this.config.authToken,
          manifest: result.updateCheckResult,
          currentVersion,
          nodeId: this.config.nodeId,
          abortSignal: signal,
        });
        result.updateInstallSuccess = installResult.status === "ok";
        if (installResult.status === "ok") {
          log.info("Auto-update installed successfully", {
            version: result.updateVersion,
          });
        } else {
          const reason = installResult.reason ?? "unknown";
          result.errors.push(`Auto-update install failed: ${reason}`);
          log.warn("Auto-update install failed", { reason });
        }
      } catch (err) {
        const msg = `Auto-update error: ${(err as Error).message}`;
        result.errors.push(msg);
        log.error(msg);
      }
    }

    // 2. Trending skills
    try {
      const trending = await this.client.getTrendingSkills(20, signal);
      result.trendingSkills = trending.data ?? [];
      result.trendingSkillsCount = result.trendingSkills.length;
      log.info("Trending skills fetched from GRC", { count: result.trendingSkillsCount });
    } catch (err) {
      const msg = `Trending skills fetch failed: ${(err as Error).message}`;
      result.errors.push(msg);
      log.warn(msg);
    }

    // 2B. Skill version check & auto-update
    try {
      const installed = this.skillManifest.listInstalled();
      result.skillsChecked = installed.length;

      // Update remote version cache from trending data
      if (result.trendingSkills.length > 0) {
        const versionUpdates = result.trendingSkills
          .filter((s) => s.latestVersion)
          .map((s) => ({ slug: s.slug, version: s.latestVersion! }));
        if (versionUpdates.length > 0) {
          this.skillManifest.updateRemoteVersions(versionUpdates);
        }
      }

      // Auto-update installed skills that have autoUpdate enabled
      for (const skill of installed) {
        if (signal?.aborted) break;
        if (!skill.autoUpdate) continue;

        try {
          const detail = await this.client.getSkillBySlug(skill.slug, signal);
          const remoteVersion = detail.latestVersionInfo?.version ?? detail.latestVersion;
          if (!remoteVersion) continue;

          // Update remote version cache
          this.skillManifest.updateRemoteVersions([{ slug: skill.slug, version: remoteVersion }]);

          // Check if update is needed
          if (compareSemver(remoteVersion, skill.installedVersion) > 0) {
            log.info("Updating GRC skill", {
              slug: skill.slug,
              from: skill.installedVersion,
              to: remoteVersion,
            });
            const installResult = await installGrcSkill({
              client: this.client,
              manifest: this.skillManifest,
              slug: skill.slug,
              version: remoteVersion,
              name: detail.name,
              expectedChecksum: detail.latestVersionInfo?.checksumSha256,
              abortSignal: signal,
            });
            if (installResult.ok) {
              result.skillsUpdated++;
              log.info("GRC skill updated", { slug: skill.slug, version: remoteVersion });
            } else {
              result.skillUpdateErrors.push(`${skill.slug}: ${installResult.message}`);
              log.warn("GRC skill update failed", { slug: skill.slug, error: installResult.message });
            }
          }
        } catch (err) {
          const msg = `Skill update check failed for ${skill.slug}: ${(err as Error).message}`;
          result.skillUpdateErrors.push(msg);
          log.debug(msg);
        }
      }

      if (result.skillsUpdated > 0) {
        log.info("GRC skills auto-updated", {
          checked: result.skillsChecked,
          updated: result.skillsUpdated,
        });
      }
    } catch (err) {
      const msg = `Skill auto-update failed: ${(err as Error).message}`;
      result.errors.push(msg);
      log.warn(msg);
    }

    // 3. Pull promoted evolution assets and cache locally (Stage A)
    try {
      const promoted = await this.client.getPromotedAssets(50, signal);
      result.promotedAssets = promoted.assets ?? [];
      result.promotedAssetsCount = result.promotedAssets.length;
      log.info("Promoted assets fetched from GRC", { count: result.promotedAssetsCount });

      // Fetch full details for each promoted asset and cache locally
      for (const asset of result.promotedAssets) {
        if (signal?.aborted) break;
        try {
          await this.cacheRemoteAsset(asset, signal);
          result.assetsCached++;
        } catch (err) {
          log.debug(`Failed to cache promoted asset ${asset.assetId}: ${(err as Error).message}`);
        }
      }

      if (result.assetsCached > 0) {
        log.info("Promoted assets cached locally", { count: result.assetsCached });
      }
    } catch (err) {
      const msg = `Promoted assets fetch failed: ${(err as Error).message}`;
      result.errors.push(msg);
      log.warn(msg);
    }

    // 4. Upload local evolution assets to GRC (opt-in)
    if (this.config.shareEvolution) {
      try {
        result.assetsUploaded = await this.uploadUnsharedAssets(signal);
        if (result.assetsUploaded > 0) {
          log.info("Local assets uploaded to GRC", { count: result.assetsUploaded });
        }
      } catch (err) {
        const msg = `Evolution upload failed: ${(err as Error).message}`;
        result.errors.push(msg);
        log.warn(msg);
      }
    }

    // 5. Send usage reports (batch)
    try {
      result.usageReportsSent = await this.sendUsageReports(signal);
      if (result.usageReportsSent > 0) {
        log.info("Usage reports sent to GRC", { count: result.usageReportsSent });
      }
    } catch (err) {
      const msg = `Usage report send failed: ${(err as Error).message}`;
      result.errors.push(msg);
      log.warn(msg);
    }

    // 6. Send telemetry (opt-in)
    if (this.config.telemetry) {
      try {
        const report = buildTelemetryReport();
        await this.client.sendTelemetry(report, signal);
        result.telemetrySent = true;
        log.info("Telemetry report sent to GRC");
      } catch (err) {
        const msg = `Telemetry send failed: ${(err as Error).message}`;
        result.errors.push(msg);
        log.warn(msg);
      }
    }

    // 7. Platform values fetch & cache
    try {
      const cached = readCachedPlatformValues();
      const fresh = await this.client.getPlatformValues(cached?.contentHash, signal);
      if (fresh) {
        writeCachedPlatformValues(fresh.content, fresh.contentHash);
        result.platformValuesFetched = true;
        log.info("Platform values updated from GRC", { contentHash: fresh.contentHash.slice(0, 16) });
      }
    } catch (err) {
      const msg = `Platform values fetch failed: ${(err as Error).message}`;
      result.errors.push(msg);
      log.warn(msg);
    }

    // 8. Prune acknowledged usage events periodically
    try {
      const pruned = this.store.pruneReportedUsage();
      if (pruned > 0) {
        log.debug("Pruned reported usage events", { count: pruned });
      }
    } catch {
      // Non-critical — ignore
    }

    // 9. Role config pull — check & pull resolved MD config files from GRC
    try {
      const configResult = await this.syncRoleConfig(signal);
      result.configChecked = configResult.checked;
      result.configPulled = configResult.pulled;
      result.configRevisionApplied = configResult.revisionApplied;
      if (configResult.pulled) {
        log.info("Role config pulled from GRC", {
          revision: configResult.revisionApplied,
          files: configResult.filesWritten,
        });
      }
    } catch (err) {
      const msg = `Role config sync failed: ${(err as Error).message}`;
      result.errors.push(msg);
      log.warn(msg);
    }

    result.durationMs = Date.now() - started;
    this.lastResult = result;
    this.syncing = false;

    log.info("GRC sync cycle completed", {
      errors: result.errors.length,
      updateAvailable: result.updateAvailable,
      assetsCached: result.assetsCached,
      assetsUploaded: result.assetsUploaded,
      usageReportsSent: result.usageReportsSent,
      skillsChecked: result.skillsChecked,
      skillsUpdated: result.skillsUpdated,
      configPulled: result.configPulled,
      durationMs: result.durationMs,
    });

    return result;
  }

  // -- Private helpers: upload ------------------------------------------------

  /**
   * Publish all locally-created, unshared genes and capsules to GRC.
   * Returns the total number of assets successfully uploaded.
   */
  private async uploadUnsharedAssets(signal?: AbortSignal): Promise<number> {
    let uploaded = 0;

    // Genes
    const unsharedGenes = this.store.getUnsharedGenes().slice(0, MAX_UPLOAD_PER_CYCLE);
    for (const gene of unsharedGenes) {
      if (signal?.aborted) break;
      try {
        const payload = buildGenePublishPayload(gene);
        const resp = await this.client.publishAsset(
          {
            node_id: this.config.nodeId,
            asset_type: "gene",
            asset_id: gene.assetId,
            content_hash: gene.contentHash,
            payload,
          },
          signal,
        );
        this.store.markGeneShared(gene.assetId, resp.asset_id);
        uploaded++;
        log.debug("Gene published to GRC", { assetId: gene.assetId, grcId: resp.asset_id });
      } catch (err) {
        log.warn(`Failed to publish gene ${gene.assetId}: ${(err as Error).message}`);
      }
    }

    // Capsules
    const remaining = MAX_UPLOAD_PER_CYCLE - uploaded;
    if (remaining > 0) {
      const unsharedCapsules = this.store.getUnsharedCapsules().slice(0, remaining);
      for (const capsule of unsharedCapsules) {
        if (signal?.aborted) break;
        try {
          const payload = buildCapsulePublishPayload(capsule);
          const resp = await this.client.publishAsset(
            {
              node_id: this.config.nodeId,
              asset_type: "capsule",
              asset_id: capsule.assetId,
              content_hash: capsule.contentHash,
              payload,
            },
            signal,
          );
          this.store.markCapsuleShared(capsule.assetId, resp.asset_id);
          uploaded++;
          log.debug("Capsule published to GRC", { assetId: capsule.assetId, grcId: resp.asset_id });
        } catch (err) {
          log.warn(`Failed to publish capsule ${capsule.assetId}: ${(err as Error).message}`);
        }
      }
    }

    return uploaded;
  }

  // -- Private helpers: download & cache ------------------------------------

  /**
   * Fetch full asset details from GRC and cache in the local store.
   * Uses the search-result summary to determine the asset type, then
   * fetches the complete payload via POST /a2a/fetch.
   */
  private async cacheRemoteAsset(
    summary: GrcEvolutionAsset,
    signal?: AbortSignal,
  ): Promise<void> {
    // Fetch full asset detail
    const full = await this.client.fetchAsset(summary.assetId, undefined, signal);
    if (!full) {
      log.debug("Asset not found or quarantined on GRC", { assetId: summary.assetId });
      return;
    }

    const strategy = full.strategy ?? {};
    const contentHash = hashPayload(strategy);
    const strategyRec = strategy as Record<string, unknown>;

    // Extract fields from the strategy payload with proper type narrowing
    const category = typeof strategyRec.category === "string" ? strategyRec.category : "";
    const summaryText = typeof strategyRec.summary === "string" ? strategyRec.summary : undefined;
    const triggerData = (strategyRec.triggerData !== null && typeof strategyRec.triggerData === "object")
      ? strategyRec.triggerData as Record<string, unknown>
      : undefined;

    if (summary.type === "gene") {
      this.store.cacheGrcGene({
        assetId: summary.assetId,
        category,
        signalsMatch: summary.signalsMatch ?? [],
        strategy,
        contentHash,
        grcStatus: full.status,
        grcAssetId: summary.assetId,
      });
    } else {
      this.store.cacheGrcCapsule({
        assetId: summary.assetId,
        category: category || undefined,
        signalsMatch: summary.signalsMatch ?? [],
        contentHash,
        grcStatus: full.status,
        grcAssetId: summary.assetId,
        summary: summaryText,
        triggerData,
      });
    }
  }

  // -- Private helpers: usage reports ---------------------------------------

  /**
   * Send buffered usage events to GRC in batches.
   * Returns the number of reports successfully sent.
   */
  private async sendUsageReports(signal?: AbortSignal): Promise<number> {
    const unreported = this.store.getUnreportedUsage().slice(0, MAX_REPORTS_PER_CYCLE);
    if (unreported.length === 0) return 0;

    let sent = 0;
    const acknowledgedIds: string[] = [];

    for (const event of unreported) {
      if (signal?.aborted) break;
      try {
        await this.client.reportUsage(
          event.assetId,
          this.config.nodeId,
          event.success,
          event.details,
          signal,
        );
        acknowledgedIds.push(event.id);
        sent++;
      } catch (err) {
        // 404 means the asset doesn't exist on GRC (local-only) → mark reported anyway
        const errAny = err as Error & { status?: number };
        if (errAny.status === 404) {
          acknowledgedIds.push(event.id);
          log.debug("Asset not on GRC, marking usage as reported", { assetId: event.assetId });
        } else {
          log.debug(`Failed to report usage for ${event.assetId}: ${(err as Error).message}`);
        }
      }
    }

    if (acknowledgedIds.length > 0) {
      this.store.markUsageReported(acknowledgedIds);
    }

    return sent;
  }

  // -- Private helpers: role config pull ------------------------------------

  /**
   * Check GRC for role config updates and, if available, pull the resolved
   * MD files and write them to the local workspace directory.
   *
   * Returns a summary of the sync operation.
   */
  private async syncRoleConfig(signal?: AbortSignal): Promise<{
    checked: boolean;
    pulled: boolean;
    revisionApplied: number | null;
    filesWritten: number;
  }> {
    const nodeId = this.config.nodeId;
    if (!nodeId) {
      return { checked: false, pulled: false, revisionApplied: null, filesWritten: 0 };
    }

    // Read the locally tracked revision from the config state file
    const stateFilePath = getConfigStatePath();
    const localState = readConfigState(stateFilePath);

    // 1. Check if update is available
    const check = await this.client.checkConfig(nodeId, localState.appliedRevision, signal);
    if (!check.ok) {
      return { checked: true, pulled: false, revisionApplied: null, filesWritten: 0 };
    }

    if (!check.has_update) {
      log.debug("Role config is up to date", {
        nodeId,
        revision: localState.appliedRevision,
      });
      return { checked: true, pulled: false, revisionApplied: null, filesWritten: 0 };
    }

    // 2. Pull the full config
    const pulled = await this.client.pullConfig(nodeId, signal);
    if (!pulled.ok || !pulled.files) {
      return { checked: true, pulled: false, revisionApplied: null, filesWritten: 0 };
    }

    // 3. Write each file to the workspace directory
    const workspaceDir = resolveDefaultAgentWorkspaceDir();
    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, { recursive: true });
    }

    let filesWritten = 0;
    for (const [fileName, content] of Object.entries(pulled.files)) {
      if (!content) continue; // Skip null/empty files
      const filePath = path.join(workspaceDir, fileName);
      try {
        // Atomic write: write to temp then rename
        const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now().toString(36)}`;
        fs.writeFileSync(tmpPath, content, "utf-8");
        fs.renameSync(tmpPath, filePath);
        filesWritten++;
        log.debug("Wrote config file to workspace", { fileName, filePath });
      } catch (err) {
        log.warn(`Failed to write config file ${fileName}: ${(err as Error).message}`);
      }
    }

    // 3b. Sync key_config to winclaw.json (model key distribution)
    if (pulled.key_config !== undefined) {
      try {
        this.syncKeyConfig(pulled.key_config ?? null);
      } catch (err) {
        log.warn(`Failed to sync key config to winclaw.json: ${(err as Error).message}`);
      }
    }

    // 4. Report applied status back to GRC
    try {
      await this.client.reportConfigStatus(nodeId, pulled.revision, true, signal);
    } catch (err) {
      log.warn(`Failed to report config status: ${(err as Error).message}`);
    }

    // 5. Update local state file
    writeConfigState(stateFilePath, {
      appliedRevision: pulled.revision,
      roleId: pulled.role_id,
      roleMode: pulled.role_mode,
      lastSyncAt: new Date().toISOString(),
    });

    log.info("Role config applied from GRC", {
      nodeId,
      revision: pulled.revision,
      roleId: pulled.role_id,
      filesWritten,
    });

    return {
      checked: true,
      pulled: true,
      revisionApplied: pulled.revision,
      filesWritten,
    };
  }

  // -- SSE Config Stream (real-time config push from GRC) --------------------

  /**
   * Start an SSE connection to GRC for real-time config updates.
   * When GRC pushes a config_update event (e.g. LLM key assignment),
   * we immediately pull the full config and apply key_config changes
   * without waiting for the next polling cycle.
   */
  private startSSEConfigStream(): void {
    if (!this.config.nodeId || !this.config.url) {
      sseLog.info("SSE config stream skipped (no nodeId or URL)");
      return;
    }
    sseLog.info("Starting SSE config stream", { url: this.config.url });
    this.sseReconnectAttempt = 0;
    this.connectSSE();
  }

  /** Stop the SSE config stream and all reconnect timers. */
  private stopSSEConfigStream(): void {
    this.sseConnected = false;
    this.sseAbortController?.abort();
    this.sseAbortController = null;

    if (this.sseReconnectTimer) {
      clearTimeout(this.sseReconnectTimer);
      this.sseReconnectTimer = null;
    }
    if (this.sseKeepaliveTimer) {
      clearTimeout(this.sseKeepaliveTimer);
      this.sseKeepaliveTimer = null;
    }
    sseLog.info("SSE config stream stopped");
  }

  /** Connect (or reconnect) to the SSE config stream. */
  private connectSSE(): void {
    if (!this.running) return;

    this.sseAbortController?.abort();
    this.sseAbortController = new AbortController();
    const signal = this.sseAbortController.signal;

    const url = `${this.config.url}/a2a/config/stream?node_id=${encodeURIComponent(this.config.nodeId)}`;

    const headers: Record<string, string> = {
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
    };
    if (this.config.authToken) {
      headers["Authorization"] = `Bearer ${this.config.authToken}`;
    }

    sseLog.debug("Connecting to SSE config stream", { url });

    fetch(url, { headers, signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`SSE stream HTTP ${response.status}: ${response.statusText}`);
        }
        if (!response.body) {
          throw new Error("SSE stream has no response body");
        }

        this.sseConnected = true;
        this.sseReconnectAttempt = 0;
        sseLog.info("SSE config stream connected");
        this.resetSSEKeepalive();

        // Parse SSE events from the stream
        const decoder = new TextDecoder();
        let buffer = "";
        let eventType = "";
        let eventData = "";

        const reader = response.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            this.resetSSEKeepalive();
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() ?? ""; // Keep incomplete last line in buffer

            for (const line of lines) {
              if (line === "") {
                // Empty line = dispatch event
                if (eventData) {
                  this.handleSSEEvent(eventType || "message", eventData.trim());
                }
                eventType = "";
                eventData = "";
              } else if (line.startsWith("event:")) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith("data:")) {
                eventData += (eventData ? "\n" : "") + line.slice(5).trim();
              } else if (line.startsWith(":")) {
                // Comment / keepalive — ignore
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        // Stream ended normally — schedule reconnect
        this.sseConnected = false;
        sseLog.info("SSE stream ended, scheduling reconnect");
        this.scheduleSSEReconnect();
      })
      .catch((err: Error) => {
        this.sseConnected = false;
        if (signal.aborted) {
          sseLog.debug("SSE connection aborted");
          return;
        }
        sseLog.warn(`SSE connection error: ${err.message}`);
        this.scheduleSSEReconnect();
      });
  }

  /** Handle a parsed SSE event. */
  private handleSSEEvent(eventType: string, data: string): void {
    sseLog.debug("SSE event received", { eventType, dataLength: data.length });

    if (eventType === "connected") {
      try {
        const parsed = JSON.parse(data) as { node_id?: string };
        sseLog.info("SSE connected event", { nodeId: parsed.node_id });
      } catch {
        // Ignore parse errors for connected event
      }
      return;
    }

    if (eventType === "config_update") {
      try {
        const parsed = JSON.parse(data) as {
          revision: number;
          reason: string;
          config?: {
            key_config?: { primary: GrcKeyConfigEntry | null; auxiliary: GrcKeyConfigEntry | null } | null;
          };
        };

        sseLog.info("Config update received via SSE", {
          revision: parsed.revision,
          reason: parsed.reason,
          hasInlineConfig: !!parsed.config,
        });

        // Skip if we already have this revision or newer
        if (parsed.revision <= this.sseCurrentRevision) {
          sseLog.debug("Skipping config update (already at same or newer revision)", {
            current: this.sseCurrentRevision,
            received: parsed.revision,
          });
          return;
        }

        // Apply inline key_config immediately if present
        if (parsed.config?.key_config !== undefined) {
          this.applySSEKeyConfig(parsed.config.key_config ?? null, parsed.revision);
        }

        // Always pull full config from REST API so role files (AGENTS.md, SOUL.md, etc.)
        // are written to the workspace — key_config alone is not sufficient.
        this.pullAndApplyConfig(parsed.revision, parsed.reason);
      } catch (err) {
        sseLog.warn(`Failed to parse config_update SSE event: ${(err as Error).message}`);
      }
      return;
    }

    if (eventType === "task_event") {
      try {
        const taskEvent = JSON.parse(data) as {
          event_type: string;
          task_id: string;
          task_code: string;
          title: string;
          priority: string;
          category?: string;
          status?: string;
          description?: string;
          deliverables?: string[];
          feedback?: string;
          result_summary?: string;
          assigned_role_id?: string;
          creator_node_id?: string;
        };
        const { event_type, task_id, task_code, title, priority } = taskEvent;

        // Cache the full SSE payload so heartbeat prompts can include task details
        cacheTaskEvent({
          event_type: taskEvent.event_type,
          task_id: taskEvent.task_id,
          task_code: taskEvent.task_code,
          title: taskEvent.title,
          priority: taskEvent.priority,
          category: taskEvent.category,
          status: taskEvent.status,
          description: taskEvent.description,
          deliverables: taskEvent.deliverables,
          feedback: taskEvent.feedback,
          result_summary: taskEvent.result_summary,
          assigned_role_id: taskEvent.assigned_role_id,
          creator_node_id: taskEvent.creator_node_id,
        });

        switch (event_type) {
          case "task_assigned":
            requestHeartbeatNow({ reason: `task_assigned:${task_id}`, coalesceMs: 2000 });
            sseLog.info("Task assigned event received", { task_id, task_code, title, priority });
            break;
          case "task_completed":
            requestHeartbeatNow({ reason: `task_completed:${task_id}`, coalesceMs: 2000 });
            sseLog.info("Task completed event received", { task_id, task_code, title });
            break;
          case "task_feedback":
            requestHeartbeatNow({ reason: `task_feedback:${task_id}`, coalesceMs: 2000 });
            sseLog.info("Task feedback event received", { task_id, task_code, title });
            break;
        }
      } catch (e) {
        sseLog.warn(`Failed to parse task_event SSE event: ${(e as Error).message}`);
      }
      return;
    }

    if (eventType === "meeting_event") {
      try {
        const meetingEvent = JSON.parse(data) as {
          event_type: string;
          session_id: string;
          title: string;
          type: string;
          shared_context?: string;
          facilitator_node_id?: string;
          participants?: { node_id: string; role_id: string; display_name: string }[];
        };

        sseLog.info("Meeting event received", {
          event_type: meetingEvent.event_type,
          session_id: meetingEvent.session_id,
          title: meetingEvent.title,
        });

        // Cache meeting context for heartbeat prompt
        cacheTaskEvent({
          event_type: `meeting:${meetingEvent.event_type}`,
          task_id: meetingEvent.session_id,
          task_code: "MEETING",
          title: meetingEvent.title,
          priority: "high",
          category: "strategic",
          description: meetingEvent.shared_context,
        });

        requestHeartbeatNow({
          reason: `meeting_invite:${meetingEvent.session_id}`,
          coalesceMs: 2000,
        });
      } catch (e) {
        sseLog.warn(`Failed to parse meeting_event SSE event: ${(e as Error).message}`);
      }
      return;
    }

    // Unknown event type — log for debugging
    sseLog.debug("Ignoring unknown SSE event", { eventType });
  }

  /** Apply key_config from SSE inline payload. */
  private applySSEKeyConfig(
    keyConfig: { primary: GrcKeyConfigEntry | null; auxiliary: GrcKeyConfigEntry | null } | null,
    revision: number,
  ): void {
    try {
      this.syncKeyConfig(keyConfig);
      this.sseCurrentRevision = revision;
      sseLog.info("SSE key config applied", { revision });

      // Report applied status
      this.client
        .reportConfigStatus(this.config.nodeId, revision, true, this.sseAbortController?.signal)
        .catch((err) => sseLog.debug(`Failed to report SSE config status: ${(err as Error).message}`));
    } catch (err) {
      sseLog.warn(`Failed to apply SSE key config: ${(err as Error).message}`);
    }
  }

  /** Pull full config from REST API and apply — writes role files, key_config, and updates state. */
  private pullAndApplyConfig(revision: number, reason?: string): void {
    const signal = this.sseAbortController?.signal;
    this.syncRoleConfig(signal)
      .then((result) => {
        if (result.pulled) {
          this.sseCurrentRevision = result.revisionApplied ?? revision;
          sseLog.info("SSE-triggered full config sync completed", {
            revision: result.revisionApplied,
            filesWritten: result.filesWritten,
          });
          // Trigger heartbeat wake for strategy-related config changes
          // so the agent can autonomously analyze and create tasks
          if (reason && this.shouldTriggerHeartbeat(reason)) {
            sseLog.info("Triggering heartbeat for config sync event", { reason });
            requestHeartbeatNow({
              reason: `config_sync:${reason}`,
              coalesceMs: 2000,
            });
          }
        } else if (result.checked) {
          sseLog.debug("SSE-triggered config check: no update needed");
        } else {
          sseLog.warn("SSE-triggered config sync skipped (no nodeId)");
        }
      })
      .catch((err: Error) => {
        sseLog.warn(`SSE-triggered config sync failed: ${err.message}`);
      });
  }

  /**
   * Determine if the SSE config update reason should trigger a heartbeat wake.
   * Currently only strategy deployments trigger an immediate agent session,
   * but this list can be extended for future use cases.
   */
  private shouldTriggerHeartbeat(reason: string): boolean {
    const HEARTBEAT_TRIGGER_REASONS = [
      "strategy_deploy",
    ];
    return HEARTBEAT_TRIGGER_REASONS.includes(reason);
  }

  /** Schedule an SSE reconnection with exponential backoff. */
  private scheduleSSEReconnect(): void {
    if (!this.running) return;

    this.sseReconnectAttempt++;

    if (this.sseReconnectAttempt > MAX_SSE_RECONNECT_ATTEMPTS) {
      sseLog.warn(
        `SSE reconnect limit reached (${MAX_SSE_RECONNECT_ATTEMPTS} attempts) — entering dormant mode. ` +
        "SSE will not reconnect until next full sync cycle or manual restart.",
      );
      this.sseConnected = false;
      return;
    }

    const delay = Math.min(
      SSE_RECONNECT_DELAY_MS * Math.pow(2, this.sseReconnectAttempt - 1),
      SSE_MAX_RECONNECT_DELAY_MS,
    );

    sseLog.debug("Scheduling SSE reconnect", {
      attempt: this.sseReconnectAttempt,
      delayMs: delay,
    });

    this.sseReconnectTimer = setTimeout(() => {
      this.sseReconnectTimer = null;
      this.connectSSE();
    }, delay);
    if (typeof this.sseReconnectTimer.unref === "function") {
      this.sseReconnectTimer.unref();
    }
  }

  /** Reset the SSE keepalive timer — if no data arrives for 2 minutes, reconnect. */
  private resetSSEKeepalive(): void {
    if (this.sseKeepaliveTimer) {
      clearTimeout(this.sseKeepaliveTimer);
    }
    this.sseKeepaliveTimer = setTimeout(() => {
      sseLog.warn("SSE keepalive timeout — no data for 2 minutes, reconnecting");
      this.sseConnected = false;
      this.sseAbortController?.abort();
      this.scheduleSSEReconnect();
    }, SSE_KEEPALIVE_TIMEOUT_MS);
    if (typeof this.sseKeepaliveTimer.unref === "function") {
      this.sseKeepaliveTimer.unref();
    }
  }

  // -- Private helpers: key config sync to winclaw.json ----------------------

  /**
   * Infer the WinClaw `api` type from GRC provider name and/or baseUrl.
   *
   * The `api` field tells the gateway which streaming implementation to use
   * (e.g. "anthropic-messages", "openai-completions", "google-generative-ai").
   *
   * When GRC provides an explicit `apiType`, that is used directly.
   * Otherwise we infer from provider name and baseUrl patterns.
   */
  private inferApiType(entry: GrcKeyConfigEntry): string {
    // If GRC explicitly provides the api type, use it
    if ((entry as Record<string, unknown>).apiType) {
      return (entry as Record<string, unknown>).apiType as string;
    }

    const provider = entry.provider.toLowerCase();
    const baseUrl = (entry.baseUrl || "").toLowerCase();

    // Anthropic-compatible
    if (
      provider === "anthropic" ||
      provider.includes("claude") ||
      baseUrl.includes("anthropic") ||
      baseUrl.includes("/api/anthropic")
    ) {
      return "anthropic-messages";
    }

    // Google Generative AI
    if (
      provider === "google" ||
      provider.includes("gemini") ||
      baseUrl.includes("generativelanguage.googleapis.com") ||
      baseUrl.includes("google")
    ) {
      return "google-generative-ai";
    }

    // Amazon Bedrock
    if (
      provider === "bedrock" ||
      provider.includes("bedrock") ||
      baseUrl.includes("bedrock")
    ) {
      return "bedrock-converse-stream";
    }

    // Ollama
    if (
      provider === "ollama" ||
      baseUrl.includes("ollama") ||
      baseUrl.includes(":11434")
    ) {
      return "ollama";
    }

    // Default: OpenAI-compatible (most third-party providers use this)
    return "openai-completions";
  }

  /**
   * Write model key configuration (primary / auxiliary) into
   * `~/.winclaw/winclaw.json` using the correct `models.providers` schema.
   *
   * Primary key → `models.providers[provider]` + `agents.defaults.model`
   * Auxiliary key → additional entry in `models.providers[provider]`
   *
   * GRC-managed provider names are tracked in a state file so that
   * unbinding cleanly removes only GRC-assigned providers.
   *
   * When `keyConfig` is null, GRC-managed providers are removed.
   */
  private syncKeyConfig(
    keyConfig: { primary: GrcKeyConfigEntry | null; auxiliary: GrcKeyConfigEntry | null } | null,
  ): void {
    const configPath = path.join(os.homedir(), ".winclaw", "winclaw.json");
    const grcStatePath = path.join(os.homedir(), ".winclaw", ".grc-key-providers.json");

    // Read existing config
    let config: Record<string, unknown> = {};
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      config = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // File doesn't exist or is malformed — start with empty object
    }

    // Read previously GRC-managed provider names
    let previousGrcProviders: string[] = [];
    try {
      const stateRaw = fs.readFileSync(grcStatePath, "utf-8");
      const state = JSON.parse(stateRaw) as { providers?: string[] };
      previousGrcProviders = state.providers ?? [];
    } catch {
      // No state file yet
    }

    // Ensure models.providers exists as an object
    const models = (config.models ?? {}) as Record<string, unknown>;
    const providers = (models.providers ?? {}) as Record<string, unknown>;

    // Remove previously GRC-managed providers
    for (const name of previousGrcProviders) {
      delete providers[name];
    }

    const newGrcProviders: string[] = [];

    if (keyConfig === null) {
      // Unbind: just remove GRC providers (already done above)
      log.info("Removed GRC key config from winclaw.json (unbind)");

      // Also remove GRC-managed profiles from auth-profiles.json
      try {
        const authStore = loadAuthProfileStore();
        let changed = false;
        for (const name of previousGrcProviders) {
          const profileId = `${name}:default`;
          if (authStore.profiles[profileId]) {
            delete authStore.profiles[profileId];
            if (authStore.lastGood && (authStore.lastGood as Record<string, string>)[name] === profileId) {
              delete (authStore.lastGood as Record<string, string>)[name];
            }
            changed = true;
          }
        }
        if (changed) {
          saveAuthProfileStore(authStore);
          log.info("Removed GRC-managed profiles from auth-profiles.json");
        }
      } catch (err) {
        log.warn(`Failed to clean auth-profiles.json on unbind: ${(err as Error).message}`);
      }

      // Also reset default model if it referenced a GRC provider
      const agents = (config.agents ?? {}) as Record<string, unknown>;
      const defaults = (agents.defaults ?? {}) as Record<string, unknown>;
      const currentModel = defaults.model;
      if (typeof currentModel === "string") {
        const providerPart = currentModel.split("/")[0];
        if (providerPart && previousGrcProviders.includes(providerPart)) {
          delete defaults.model;
          agents.defaults = defaults;
          config.agents = agents;
          log.info("Reset agents.defaults.model (was GRC-managed)");
        }
      }
    } else {
      // Assign / update primary provider
      if (keyConfig.primary) {
        const providerName = keyConfig.primary.provider;
        const apiType = this.inferApiType(keyConfig.primary);
        providers[providerName] = {
          baseUrl: keyConfig.primary.baseUrl || `https://api.${providerName}.ai`,
          api: apiType,
          apiKey: keyConfig.primary.apiKey,
          models: [
            {
              id: keyConfig.primary.model,
              name: keyConfig.primary.model,
            },
          ],
        };
        newGrcProviders.push(providerName);

        // Set as default agent model
        const agents = (config.agents ?? {}) as Record<string, unknown>;
        const defaults = (agents.defaults ?? {}) as Record<string, unknown>;
        defaults.model = `${providerName}/${keyConfig.primary.model}`;
        agents.defaults = defaults;
        config.agents = agents;

        log.info("Updated primary key in winclaw.json (models.providers)", {
          provider: providerName,
          model: keyConfig.primary.model,
        });

        // Sync to auth-profiles.json so the agent can resolve the key
        if (keyConfig.primary.apiKey) {
          this.syncAuthProfile(providerName, keyConfig.primary.apiKey);
        }
      }

      // Assign / update auxiliary provider
      if (keyConfig.auxiliary) {
        const providerName = keyConfig.auxiliary.provider;
        // Avoid overwriting primary if same provider name
        if (!providers[providerName]) {
          const auxApiType = this.inferApiType(keyConfig.auxiliary);
          providers[providerName] = {
            baseUrl: keyConfig.auxiliary.baseUrl || `https://api.${providerName}.ai`,
            api: auxApiType,
            apiKey: keyConfig.auxiliary.apiKey,
            models: [
              {
                id: keyConfig.auxiliary.model,
                name: keyConfig.auxiliary.model,
              },
            ],
          };
        } else {
          // Same provider as primary — append model to existing entry
          const existing = providers[providerName] as Record<string, unknown>;
          const existingModels = (existing.models ?? []) as Array<Record<string, string>>;
          if (!existingModels.some((m) => m.id === keyConfig.auxiliary!.model)) {
            existingModels.push({
              id: keyConfig.auxiliary.model,
              name: keyConfig.auxiliary.model,
            });
            existing.models = existingModels;
          }
          // Update apiKey if different
          if (keyConfig.auxiliary.apiKey) {
            existing.apiKey = keyConfig.auxiliary.apiKey;
          }
        }
        if (!newGrcProviders.includes(providerName)) {
          newGrcProviders.push(providerName);
        }

        log.info("Updated auxiliary key in winclaw.json (models.providers)", {
          provider: providerName,
          model: keyConfig.auxiliary.model,
        });

        // Sync auxiliary key to auth-profiles.json
        if (keyConfig.auxiliary.apiKey) {
          this.syncAuthProfile(providerName, keyConfig.auxiliary.apiKey);
        }
      }
    }

    // Clean up: remove models section if no providers remain
    if (Object.keys(providers).length > 0) {
      models.providers = providers;
      config.models = models;
    } else {
      delete models.providers;
      if (Object.keys(models).length === 0) {
        delete config.models;
      } else {
        config.models = models;
      }
    }

    // Also clean up any legacy top-level keys from earlier versions
    delete (config as Record<string, unknown>).auxiliaryKeys;
    // Don't delete top-level "providers" — it's used by talk.providers (voice/TTS)

    // Write config atomically
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpPath = `${configPath}.tmp-${process.pid}-${Date.now().toString(36)}`;
    fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), "utf-8");
    fs.renameSync(tmpPath, configPath);

    // Persist GRC provider state
    try {
      fs.writeFileSync(grcStatePath, JSON.stringify({ providers: newGrcProviders }), "utf-8");
    } catch (err) {
      log.warn(`Failed to persist GRC key provider state: ${(err as Error).message}`);
    }
  }

  /**
   * Sync a provider API key to auth-profiles.json so the agent runtime can
   * look it up via its normal credential resolution path.
   */
  private syncAuthProfile(provider: string, apiKey: string): void {
    const profileId = `${provider}:default`;
    try {
      upsertAuthProfile({
        profileId,
        credential: {
          type: "api_key",
          provider,
          key: apiKey,
        },
      });

      // Also mark as lastGood for the provider
      const store = loadAuthProfileStore();
      if (!store.lastGood) {
        store.lastGood = {} as Record<string, string>;
      }
      (store.lastGood as Record<string, string>)[provider] = profileId;
      saveAuthProfileStore(store);

      log.info("Synced key to auth-profiles.json", { provider, profileId });
    } catch (err) {
      log.warn(`Failed to sync auth profile for ${provider}: ${(err as Error).message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Config State Persistence
// ---------------------------------------------------------------------------

type ConfigSyncState = {
  appliedRevision: number;
  roleId?: string | null;
  roleMode?: string | null;
  lastSyncAt?: string;
};

/** Path to the config sync state file: ~/.winclaw/grc-config-state.json */
function getConfigStatePath(): string {
  return path.join(os.homedir(), ".winclaw", "grc-config-state.json");
}

function readConfigState(statePath: string): ConfigSyncState {
  try {
    const raw = fs.readFileSync(statePath, "utf-8");
    const data = JSON.parse(raw) as Partial<ConfigSyncState>;
    return {
      appliedRevision: typeof data.appliedRevision === "number" ? data.appliedRevision : 0,
      roleId: data.roleId,
      roleMode: data.roleMode,
      lastSyncAt: data.lastSyncAt,
    };
  } catch {
    return { appliedRevision: 0 };
  }
}

function writeConfigState(statePath: string, state: ConfigSyncState): void {
  const dir = path.dirname(statePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build an anonymized telemetry report with no PII. */
function buildTelemetryReport(): Record<string, unknown> {
  return {
    reportDate: new Date().toISOString().split("T")[0],
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    winclawVersion: process.env.WINCLAW_VERSION ?? "unknown",
    uptime: Math.round(process.uptime()),
    memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1_048_576),
  };
}

/** Build the payload object for publishing a gene to GRC. */
function buildGenePublishPayload(gene: LocalGene): Record<string, unknown> {
  return {
    category: gene.category,
    signals_match: gene.signalsMatch,
    strategy: gene.strategy,
    constraints_data: gene.constraintsData ?? null,
    validation: gene.validation ?? null,
  };
}

/** Build the payload object for publishing a capsule to GRC. */
function buildCapsulePublishPayload(capsule: LocalCapsule): Record<string, unknown> {
  return {
    category: capsule.category ?? null,
    signals_match: capsule.signalsMatch ?? [],
    gene_asset_id: capsule.geneAssetId ?? null,
    trigger_data: capsule.triggerData ?? null,
    summary: capsule.summary ?? null,
  };
}

// ---------------------------------------------------------------------------
// Platform Values Cache
// ---------------------------------------------------------------------------

/** Cache file path: ~/.winclaw/grc-platform-values.json */
function getPlatformValuesCachePath(): string {
  return path.join(os.homedir(), ".winclaw", "grc-platform-values.json");
}

type CachedPlatformValues = {
  content: string;
  contentHash: string;
};

/** Read cached platform values from disk. Returns null if not cached or unreadable. */
export function readCachedPlatformValues(): CachedPlatformValues | null {
  try {
    const raw = fs.readFileSync(getPlatformValuesCachePath(), "utf-8");
    const data = JSON.parse(raw) as CachedPlatformValues;
    if (data.content && data.contentHash) return data;
    return null;
  } catch {
    return null;
  }
}

/** Write platform values to the cache file. Creates ~/.winclaw/ if needed. */
function writeCachedPlatformValues(content: string, contentHash: string): void {
  const cachePath = getPlatformValuesCachePath();
  const dir = path.dirname(cachePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(
    cachePath,
    JSON.stringify({ content, contentHash }, null, 2),
    "utf-8",
  );
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Convenience factory that creates and starts a GrcSyncService. */
export function startGrcSync(
  config: GrcSyncConfig,
  store?: EvolutionStore,
  skillManifest?: GrcSkillManifestStore,
): GrcSyncServiceHandle {
  const service = new GrcSyncService(config, store, skillManifest);
  service.start();
  return service;
}

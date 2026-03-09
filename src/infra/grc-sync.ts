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

const log: SubsystemLogger = createSubsystemLogger("infra/grc-sync");

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type GrcSyncConfig = {
  /** Master switch: when false the service never starts. */
  enabled: boolean;
  /** GRC server base URL (e.g. "https://grc.winclawhub.ai"). */
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
  }

  /** Stop the sync loop and cancel any in-flight requests. */
  stop(): void {
    if (!this.running) {
      return;
    }
    this.running = false;
    this.abortController?.abort();

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

  // -- Private helpers: key config sync to winclaw.json ----------------------

  /**
   * Write model key configuration (primary / auxiliary) into
   * `~/.winclaw/winclaw.json` so that WinClaw can use the assigned keys
   * for LLM calls and auxiliary tools.
   *
   * When `keyConfig` is null, any existing providers / auxiliaryKeys
   * sections are removed from the config file.
   */
  private syncKeyConfig(
    keyConfig: { primary: GrcKeyConfigEntry | null; auxiliary: GrcKeyConfigEntry | null } | null,
  ): void {
    const configPath = path.join(os.homedir(), ".winclaw", "winclaw.json");

    // Read existing config
    let config: Record<string, unknown> = {};
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      config = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // File doesn't exist or is malformed — start with empty object
    }

    if (keyConfig === null) {
      // Unbind: remove key sections
      delete config.providers;
      delete config.auxiliaryKeys;
      log.info("Removed key config from winclaw.json (unbind)");
    } else {
      // Assign / update
      if (keyConfig.primary) {
        config.providers = [
          {
            provider: keyConfig.primary.provider,
            model: keyConfig.primary.model,
            apiKey: keyConfig.primary.apiKey,
            ...(keyConfig.primary.baseUrl ? { baseUrl: keyConfig.primary.baseUrl } : {}),
          },
        ];
        log.info("Updated primary key in winclaw.json", {
          provider: keyConfig.primary.provider,
          model: keyConfig.primary.model,
        });
      } else {
        delete config.providers;
      }

      if (keyConfig.auxiliary) {
        config.auxiliaryKeys = [
          {
            provider: keyConfig.auxiliary.provider,
            model: keyConfig.auxiliary.model,
            apiKey: keyConfig.auxiliary.apiKey,
            ...(keyConfig.auxiliary.baseUrl ? { baseUrl: keyConfig.auxiliary.baseUrl } : {}),
          },
        ];
        log.info("Updated auxiliary key in winclaw.json", {
          provider: keyConfig.auxiliary.provider,
          model: keyConfig.auxiliary.model,
        });
      } else {
        delete config.auxiliaryKeys;
      }
    }

    // Write back atomically
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpPath = `${configPath}.tmp-${process.pid}-${Date.now().toString(36)}`;
    fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), "utf-8");
    fs.renameSync(tmpPath, configPath);
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

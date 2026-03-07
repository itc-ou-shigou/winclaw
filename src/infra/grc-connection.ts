import os from "node:os";
import { createSubsystemLogger, type SubsystemLogger } from "../logging/subsystem.js";
import { loadConfig, writeConfigFile } from "../config/config.js";
import type { WinClawConfig } from "../config/types.js";
import { loadOrCreateDeviceIdentity } from "./device-identity.js";
import { GrcClient } from "./grc-client.js";
import { GrcSyncService, type GrcSyncServiceHandle, type GrcSyncResult } from "./grc-sync.js";
import {
  CommunityAutoPostService,
  buildAutoPostConfig,
} from "./community-auto-post.js";
import {
  CommunityReplyWorker,
  buildReplyConfig,
  type ReplyWorkerResult,
} from "./community-reply-worker.js";

const log: SubsystemLogger = createSubsystemLogger("infra/grc-connection");

const GRC_DEFAULT_URL = "https://grc.winclawhub.ai";

/** How often to check token expiry (ms). */
const TOKEN_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** Retry delays for auto-connect (ms). */
const RETRY_DELAYS = [5_000, 15_000, 30_000, 60_000, 120_000, 300_000]; // 5s, 15s, 30s, 1m, 2m, 5m

export type ConnectionStatus = {
  connected: boolean;
  tier: "anonymous" | "paired" | "apikey";
  nodeId: string | null;
  userId: string | null;
  email: string | null;
  url: string;
  lastSyncAt: string | null;
  syncRunning: boolean;
};

export class GrcConnectionManager {
  private client: GrcClient;
  private syncService: GrcSyncServiceHandle | null = null;
  private autoPostService: CommunityAutoPostService | null = null;
  private replyWorker: CommunityReplyWorker | null = null;
  private replyTimer: ReturnType<typeof setInterval> | null = null;
  private nodeId: string | null = null;
  private userId: string | null = null;
  private email: string | null = null;
  private connected = false;
  private tier: "anonymous" | "paired" | "apikey" = "anonymous";
  private url: string;
  private tokenCheckTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor() {
    const config = loadConfig();
    this.url = config.grc?.url ?? GRC_DEFAULT_URL;
    this.client = new GrcClient({
      baseUrl: this.url,
      authToken: config.grc?.auth?.token,
    });
  }

  /**
   * Auto-connect to GRC on gateway startup.
   * 1. Load device identity (Ed25519 key pair → SHA-256 = nodeId)
   * 2. Check existing token validity, refresh if needed
   * 3. If no token, register anonymously
   * 4. Register node via A2A hello
   * 5. Start sync service
   */
  async autoConnect(): Promise<void> {
    if (this.stopped) return;

    const config = loadConfig();
    if (config.grc?.enabled === false) {
      log.info("GRC integration disabled by config");
      return;
    }

    try {
      // 1. Get stable device identity
      const identity = loadOrCreateDeviceIdentity();
      this.nodeId = identity.deviceId;
      log.info("Device identity loaded", { nodeId: this.nodeId.slice(0, 12) + "..." });

      // 2. Check existing token
      const existingToken = config.grc?.auth?.token;
      const refreshToken = config.grc?.auth?.refreshToken;

      if (existingToken && !GrcClient.isTokenExpired(existingToken)) {
        // Token is still valid
        this.client.setAuthToken(existingToken);
        this.connected = true;
        this.tier = refreshToken ? "paired" : "anonymous";
        log.info("Existing GRC token is valid", { tier: this.tier });
      } else if (refreshToken) {
        // Token expired but we have a refresh token → try refresh
        log.info("GRC token expired, attempting refresh...");
        try {
          const result = await this.client.refreshAccessToken(refreshToken);
          this.client.setAuthToken(result.access_token);
          this.connected = true;
          this.tier = "paired";

          // Persist new tokens
          await this.persistTokens(result.access_token, result.refresh_token);
          log.info("GRC token refreshed successfully");
        } catch (err) {
          log.warn(`Token refresh failed: ${(err as Error).message}, falling back to anonymous`);
          await this.registerAnonymous();
        }
      } else {
        // No token at all → register anonymously
        await this.registerAnonymous();
      }

      // 3. Determine tier from config auth mode
      if (config.grc?.auth?.mode === "apikey") {
        this.tier = "apikey";
      }

      // 4. Register node via A2A hello (non-fatal)
      try {
        const platform = os.platform();
        const version = process.env.WINCLAW_VERSION ?? "0.0.0";
        const employee = {
          id: config.grc?.employeeId,
          name: config.grc?.employeeName,
          email: config.grc?.employeeEmail,
        };
        await this.client.hello(this.nodeId, platform, version, employee);
        log.info("Node registered with GRC via A2A hello");
      } catch (err) {
        log.warn(`A2A hello failed (non-fatal): ${(err as Error).message}`);
      }

      // 5. Start sync service
      this.startSyncService();

      // 6. Start community services (auto-post + reply worker)
      this.startCommunityServices();

      // 7. Start token expiry checker
      this.startTokenChecker();

      log.info("GRC auto-connect completed", {
        nodeId: this.nodeId.slice(0, 12) + "...",
        tier: this.tier,
        connected: this.connected,
      });
    } catch (err) {
      this.connected = false;
      log.error(`GRC auto-connect failed: ${(err as Error).message}`);
      this.scheduleRetry(0);
    }
  }

  /**
   * Register anonymously with GRC and persist the token.
   */
  private async registerAnonymous(): Promise<void> {
    if (!this.nodeId) throw new Error("nodeId not set");

    const result = await this.client.getAnonymousToken(this.nodeId);
    this.client.setAuthToken(result.token);
    this.connected = true;
    this.tier = "anonymous";
    this.userId = result.user.id;

    // Persist token (no refresh token for anonymous)
    await this.persistTokens(result.token, undefined);
    log.info("Registered anonymously with GRC", { userId: result.user.id });
  }

  /**
   * Schedule a retry for auto-connect with exponential backoff.
   */
  private scheduleRetry(attempt: number): void {
    if (this.stopped) return;
    const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)]!;
    log.info(`Scheduling GRC reconnect in ${delay / 1000}s (attempt ${attempt + 1})`);

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.stopped) {
        this.autoConnect().catch((err) => {
          log.error(`GRC reconnect attempt ${attempt + 1} failed: ${(err as Error).message}`);
          this.scheduleRetry(attempt + 1);
        });
      }
    }, delay);
    if (typeof this.retryTimer.unref === "function") {
      this.retryTimer.unref();
    }
  }

  /**
   * Start the periodic sync service.
   */
  private startSyncService(): void {
    if (this.syncService) return;

    const config = loadConfig();
    this.syncService = new GrcSyncService({
      enabled: true,
      url: this.url,
      authToken: config.grc?.auth?.token,
      nodeId: this.nodeId ?? "unknown",
      syncInterval: config.grc?.sync?.interval ?? 14400,
      autoUpdate: config.grc?.sync?.autoUpdate !== false,
      shareEvolution: config.grc?.sync?.shareEvolution !== false,
      telemetry: config.grc?.sync?.telemetry ?? false,
    });
    this.syncService.start();
    log.info("GRC sync service started");
  }

  /**
   * Start community auto-post and reply worker services.
   */
  private startCommunityServices(): void {
    // Auto-post service (event-driven)
    const autoPostConfig = buildAutoPostConfig();
    if (autoPostConfig.enabled) {
      this.autoPostService = new CommunityAutoPostService(autoPostConfig, this.client);
      this.autoPostService.start();
      log.info("Community auto-post service started");
    }

    // Reply worker (scheduled)
    const replyConfig = buildReplyConfig();
    if (replyConfig.enabled) {
      this.replyWorker = new CommunityReplyWorker(replyConfig, this.client);

      // Parse cron schedule and set up a simple interval-based check
      // The actual cron-style scheduling will be done via CronService integration
      // For now, use a daily interval as fallback
      this.scheduleReplyWorker(replyConfig.cronSchedule);
      log.info("Community reply worker scheduled", {
        schedule: replyConfig.cronSchedule,
        maxReplies: replyConfig.maxRepliesPerCycle,
      });
    }
  }

  /**
   * Schedule the reply worker using a simple interval approach.
   * This is a self-contained scheduler that parses basic cron hour/minute.
   */
  private scheduleReplyWorker(cronExpr: string): void {
    // Parse simple cron "MIN HOUR * * *" pattern
    const parts = cronExpr.trim().split(/\s+/);
    const minute = parseInt(parts[0] ?? "0", 10);
    const hour = parseInt(parts[1] ?? "3", 10);

    const checkAndRun = () => {
      if (!this.replyWorker || this.stopped) return;
      const now = new Date();
      if (now.getHours() === hour && now.getMinutes() === minute) {
        log.info("Triggering scheduled community reply cycle");
        void this.replyWorker.runCycle().catch((err) => {
          log.warn(`Scheduled reply cycle failed: ${(err as Error).message}`);
        });
      }
    };

    // Check every minute
    this.replyTimer = setInterval(checkAndRun, 60_000);
    if (typeof this.replyTimer.unref === "function") {
      this.replyTimer.unref();
    }
  }

  /**
   * Start periodic token expiry checker.
   */
  private startTokenChecker(): void {
    if (this.tokenCheckTimer) return;

    this.tokenCheckTimer = setInterval(() => {
      if (this.stopped) return;
      const config = loadConfig();
      const token = config.grc?.auth?.token;
      const refreshToken = config.grc?.auth?.refreshToken;

      if (token && GrcClient.isTokenExpired(token) && refreshToken) {
        log.info("GRC token expiring soon, refreshing...");
        void this.client
          .refreshAccessToken(refreshToken)
          .then(async (result) => {
            this.client.setAuthToken(result.access_token);
            await this.persistTokens(result.access_token, result.refresh_token);
            log.info("GRC token auto-refreshed");
          })
          .catch((err) => {
            log.warn(`Token auto-refresh failed: ${(err as Error).message}`);
          });
      }
    }, TOKEN_CHECK_INTERVAL_MS);
    if (typeof this.tokenCheckTimer.unref === "function") {
      this.tokenCheckTimer.unref();
    }
  }

  /**
   * Persist tokens to config file.
   */
  private async persistTokens(
    token: string,
    refreshToken: string | undefined,
  ): Promise<void> {
    const config = loadConfig();
    const nextConfig: WinClawConfig = {
      ...config,
      grc: {
        ...config.grc,
        auth: {
          ...config.grc?.auth,
          mode: refreshToken ? "oauth" : "anonymous",
          token,
          refreshToken,
        },
        lastSyncAt: config.grc?.lastSyncAt,
      },
    };
    await writeConfigFile(nextConfig);
  }

  // ── Pairing (Tier 2) ──────────────────────────

  /**
   * Send a pairing code to the given email address.
   */
  async pairWithEmail(email: string): Promise<{ ok: boolean; message: string }> {
    return this.client.sendPairingCode(email);
  }

  /**
   * Verify a pairing code and upgrade to Tier 2 (paired).
   */
  async verifyPairing(
    email: string,
    code: string,
  ): Promise<{ ok: boolean; user?: { id: string; displayName: string; tier: string } }> {
    if (!this.nodeId) {
      const identity = loadOrCreateDeviceIdentity();
      this.nodeId = identity.deviceId;
    }

    const result = await this.client.verifyPairingCode(email, code, this.nodeId);

    // Update connection state
    this.client.setAuthToken(result.token);
    this.connected = true;
    this.tier = "paired";
    this.userId = result.user.id;
    this.email = result.user.email;

    // Persist tokens
    await this.persistTokens(result.token, result.refreshToken);

    // Restart sync service with new auth
    if (this.syncService) {
      this.syncService.stop();
      this.syncService = null;
    }
    this.startSyncService();

    // Restart community services with new auth (write access now available)
    if (this.autoPostService) {
      this.autoPostService.stop();
      this.autoPostService = null;
    }
    if (this.replyTimer) {
      clearInterval(this.replyTimer);
      this.replyTimer = null;
    }
    this.replyWorker = null;
    this.startCommunityServices();

    log.info("Email pairing successful", {
      userId: result.user.id,
      email: result.user.email,
    });

    return {
      ok: true,
      user: {
        id: result.user.id,
        displayName: result.user.displayName,
        tier: result.user.tier,
      },
    };
  }

  // ── Accessors ──────────────────────────────────

  getStatus(): ConnectionStatus {
    const config = loadConfig();
    return {
      connected: this.connected,
      tier: this.tier,
      nodeId: this.nodeId,
      userId: this.userId,
      email: this.email,
      url: this.url,
      lastSyncAt: config.grc?.lastSyncAt ?? null,
      syncRunning: this.syncService?.isRunning() ?? false,
    };
  }

  getSyncService(): GrcSyncServiceHandle | null {
    return this.syncService;
  }

  getClient(): GrcClient {
    return this.client;
  }

  getNodeId(): string | null {
    return this.nodeId;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getAutoPostService(): CommunityAutoPostService | null {
    return this.autoPostService;
  }

  getReplyWorker(): CommunityReplyWorker | null {
    return this.replyWorker;
  }

  /** Trigger a manual reply cycle (for CLI / RPC). */
  async triggerReplyCycle(): Promise<ReplyWorkerResult | null> {
    if (!this.replyWorker) return null;
    return this.replyWorker.runCycle();
  }

  // ── Shutdown ───────────────────────────────────

  async shutdown(): Promise<void> {
    this.stopped = true;

    if (this.tokenCheckTimer) {
      clearInterval(this.tokenCheckTimer);
      this.tokenCheckTimer = null;
    }

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (this.replyTimer) {
      clearInterval(this.replyTimer);
      this.replyTimer = null;
    }

    if (this.autoPostService) {
      this.autoPostService.stop();
      this.autoPostService = null;
    }

    this.replyWorker = null;

    if (this.syncService) {
      this.syncService.stop();
      this.syncService = null;
    }

    this.connected = false;
    log.info("GRC connection manager shutdown");
  }
}

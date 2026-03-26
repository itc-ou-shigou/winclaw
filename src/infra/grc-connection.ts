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

const GRC_DEFAULT_URL = process.env.WINCLAW_GRC_URL
  ?? (process.env.GRC_DB_DIALECT === "sqlite" || process.env.WINCLAW_DESKTOP_MODE === "1"
    ? "http://127.0.0.1:3100"
    : "http://localhost:3100");

/** Minimum token refresh interval (ms). */
const MIN_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

/** Retry delays for auto-connect (ms). */
const RETRY_DELAYS = [5_000, 15_000, 30_000, 60_000, 120_000, 300_000]; // 5s, 15s, 30s, 1m, 2m, 5m

/** Local GRC discovery constants. */
const LOCAL_GRC_URL = "http://127.0.0.1:3100";
const LOCAL_GRC_HEALTH_TIMEOUT_MS = 2_000;
const DISCOVERY_RETRY_INTERVAL_MS = 30_000;
const DISCOVERY_MAX_RETRIES = 10;

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
  private tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private discoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private memoryMonitorTimer: ReturnType<typeof setInterval> | null = null;
  private discoveryAttempt = 0;
  private stopped = false;

  constructor() {
    const config = loadConfig();
    this.url = config.grc?.url ?? GRC_DEFAULT_URL;
    this.client = new GrcClient({
      baseUrl: this.url,
      authToken: config.grc?.auth?.token,
    });
    // Hydrate the refresh token from config so refreshToken() works immediately
    if (config.grc?.auth?.refreshToken) {
      this.client.setRefreshToken(config.grc.auth.refreshToken);
    }
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
      // 0. Auto-discover local GRC if no token and URL is default/empty
      const cfg = loadConfig();
      const hasToken = !!cfg.grc?.auth?.token;
      if (!hasToken) {
        const localUrl = await this.discoverLocalGrc();
        if (localUrl) {
          this.url = localUrl;
          log.info("Auto-bootstrap: local GRC discovered, proceeding with connection");
        } else {
          log.info("No local GRC found, scheduling background discovery");
          this.scheduleDiscoveryRetry();
        }
      }

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
      // Note: employee_role is NOT sent at startup — roles are assigned later
      // via GRC admin panel (Step 4 of company-startup) and pushed via SSE.
      const platform = os.platform();
      const version = process.env.WINCLAW_VERSION ?? "0.0.0";
      try {
        const employee = {
          id: config.grc?.employeeId,
          name: config.grc?.employeeName,
          email: config.grc?.employeeEmail,
          workspacePath: config.grc?.workspaceHostPath,
          // Include gateway info so GRC can update node record on reconnect
          gatewayPort: config.gateway?.port,
          gatewayToken: config.gateway?.auth?.token,
          containerId: process.env.HOSTNAME,  // Docker sets HOSTNAME to container ID
        };
        const helloResult = await this.client.hello(this.nodeId, platform, version, employee);
        log.info("Node registered with GRC via A2A hello");

        // If GRC returned an upgraded token (desktop mode auto-upgrade),
        // update the stored auth token and refresh token.
        if (helloResult?.token) {
          this.client.setAuthToken(helloResult.token);
          // Preserve existing refresh token if hello didn't return a new one
          const existingRefreshToken = loadConfig().grc?.auth?.refreshToken;
          await this.persistTokens(helloResult.token, helloResult.refreshToken ?? existingRefreshToken);
          log.info("Token upgraded by GRC hello response (desktop mode)");
        }
      } catch (err) {
        log.warn(`A2A hello failed (non-fatal): ${(err as Error).message}`);
      }

      // 4b. Register Agent Card with A2A Gateway (non-fatal)
      // Makes this node discoverable in the agent roster.
      // Role will be updated when GRC assigns it via SSE config push (Step 4).
      try {
        const agentCard: Record<string, unknown> = {
          name: config.grc?.employeeName ?? `winclaw-node-${this.nodeId!.slice(0, 8)}`,
          employee_id: config.grc?.employeeId,
          version,
          platform,
        };
        const capabilities: Record<string, unknown> = {
          chat: true,
          a2a: true,
          tools: true,
          agentToAgent: config.tools?.agentToAgent?.enabled !== false,
        };
        await this.client.registerAgentCard(this.nodeId!, agentCard, undefined, capabilities);
        log.info("Agent Card registered with GRC A2A Gateway");
      } catch (err) {
        log.warn(`Agent Card registration failed (non-fatal): ${(err as Error).message}`);
      }

      // 5. Start sync service (also starts SSE config stream)
      this.startSyncService();

      // 6. Start community services (auto-post + reply worker)
      this.startCommunityServices();

      // 7. Start token expiry checker
      this.startTokenChecker();

      // 8. Start proactive token refresh (every 12h, well before 24h JWT expiry)
      // Schedule JWT-aware token refresh
      const currentToken = loadConfig().grc?.auth?.token;
      if (currentToken) this.scheduleTokenRefresh(currentToken);

      // 9. Start memory usage monitor (every 10 minutes)
      this.startMemoryMonitor();

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
    this.tier = result.refreshToken ? "paired" : "anonymous";
    this.userId = result.user.id;

    // Persist token + refresh token (refresh token enables long-lived sessions)
    await this.persistTokens(result.token, result.refreshToken);
    log.info("Registered anonymously with GRC", { userId: result.user.id, hasRefreshToken: !!result.refreshToken });
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
          .catch(async (err) => {
            log.warn(`Token auto-refresh failed: ${(err as Error).message}`);
            // Fallback: re-register anonymously to get a fresh token + refresh token
            try {
              log.info("Attempting re-registration to recover from refresh failure...");
              await this.registerAnonymous();
              // Re-run hello to get upgraded token
              if (this.nodeId) {
                const helloResult = await this.client.hello(
                  this.nodeId, process.platform, "0.0.0",
                );
                if (helloResult?.token) {
                  await this.persistTokens(helloResult.token, helloResult.refreshToken);
                  this.client.setAuthToken(helloResult.token);
                }
              }
              log.info("Re-registration succeeded, tokens recovered");
            } catch (reregErr) {
              log.error(`Re-registration also failed: ${(reregErr as Error).message}`);
            }
          });
      }
    }, 60_000); // Check token every 60 seconds
    if (typeof this.tokenCheckTimer.unref === "function") {
      this.tokenCheckTimer.unref();
    }
  }

  /**
   * Start periodic memory usage monitor (every 10 minutes).
   * Logs heap and RSS usage; warns when heap exceeds 500 MB.
   */
  private startMemoryMonitor(): void {
    if (this.memoryMonitorTimer) return;

    this.memoryMonitorTimer = setInterval(() => {
      if (this.stopped) return;
      const mem = process.memoryUsage();
      const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
      const rssMB = Math.round(mem.rss / 1024 / 1024);
      const msg = `heap=${heapMB}MB rss=${rssMB}MB`;
      if (heapMB > 500) {
        log.warn("High memory usage detected: " + msg);
      }
      // Only log at debug level to avoid triggering console formatter issues
    }, 10 * 60 * 1000); // 10 minutes
    if (typeof this.memoryMonitorTimer.unref === "function") {
      this.memoryMonitorTimer.unref();
    }
  }

  /**
   * Start a proactive token refresh interval (every 12 hours).
   * JWT tokens expire in 24h; refreshing 12h before expiry prevents
   * 401 errors during long-running sessions.
   */
  /**
   * Decode JWT and schedule refresh at 80% of remaining lifetime.
   */
  private scheduleTokenRefresh(token: string): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return;
      const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as { exp?: number };
      if (!payload.exp) return;
      const remainingSec = payload.exp - Date.now() / 1000;
      if (remainingSec <= 0) {
        log.warn("Token already expired, triggering immediate refresh");
        void this.refreshTokenNow();
        return;
      }
      const refreshInMs = Math.max(remainingSec * 0.8 * 1000, MIN_REFRESH_MS);
      this.tokenRefreshTimer = setTimeout(() => {
        this.tokenRefreshTimer = null;
        if (!this.stopped) void this.refreshTokenNow();
      }, refreshInMs);
      if (typeof this.tokenRefreshTimer.unref === "function") this.tokenRefreshTimer.unref();
      log.info("Token refresh scheduled", {
        refreshInMinutes: Math.round(refreshInMs / 60_000),
        tokenExpiresAt: new Date(payload.exp * 1000).toISOString(),
      });
    } catch (err) {
      log.warn(`Failed to decode JWT for scheduling refresh: ${(err as Error).message}`);
    }
  }

  /**
   * Refresh JWT token, falling back to anonymous re-auth.
   */
  private async refreshTokenNow(): Promise<void> {
    try {
      const result = await this.client.refreshAuth();
      if (result?.token) {
        this.client.setAuthToken(result.token);
        await this.persistTokens(result.token, result.refreshToken);
        this.scheduleTokenRefresh(result.token);
        log.info("GRC token refreshed successfully");
        return;
      }
    } catch (err) {
      log.warn({ err }, "Token refresh failed, falling back to anonymous re-auth");
    }
    try {
      await this.registerAnonymous();
      const cfg = loadConfig();
      const newToken = cfg.grc?.auth?.token;
      if (newToken) this.scheduleTokenRefresh(newToken);
    } catch (err) {
      log.error({ err }, "Anonymous re-auth also failed");
    }
  }

  /**
   * Discover local GRC server on localhost:3100.
   */
  private async discoverLocalGrc(): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), LOCAL_GRC_HEALTH_TIMEOUT_MS);
      const resp = await fetch(`${LOCAL_GRC_URL}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      if (resp.ok) {
        const body = await resp.text();
        if (body.includes("grc-server")) {
          log.info("Discovered local GRC server at " + LOCAL_GRC_URL);
          return LOCAL_GRC_URL;
        }
      }
    } catch { /* not running */ }
    return null;
  }

  /**
   * Schedule background retries to discover local GRC.
   */
  private scheduleDiscoveryRetry(): void {
    if (this.discoveryAttempt >= DISCOVERY_MAX_RETRIES) {
      log.warn("Local GRC discovery gave up after " + DISCOVERY_MAX_RETRIES + " attempts");
      return;
    }
    this.discoveryTimer = setTimeout(async () => {
      this.discoveryTimer = null;
      this.discoveryAttempt++;
      const url = await this.discoverLocalGrc();
      if (url) {
        log.info("Local GRC discovered on retry #" + this.discoveryAttempt);
        this.url = url;
        void this.autoConnect().catch((e) => log.error({ err: e }, "autoConnect after discovery failed"));
      } else {
        this.scheduleDiscoveryRetry();
      }
    }, DISCOVERY_RETRY_INTERVAL_MS);
    if (typeof this.discoveryTimer.unref === "function") this.discoveryTimer.unref();
  }

  /**
   * Reconnect to GRC by re-running the full autoConnect() flow.
   * On failure, schedules a retry in 30 seconds.
   */
  async reconnect(): Promise<void> {
    if (this.stopped) return;

    log.info("Reconnecting to GRC...");

    // Clean up existing services before re-connecting
    if (this.syncService) {
      this.syncService.stop();
      this.syncService = null;
    }
    if (this.autoPostService) {
      this.autoPostService.stop();
      this.autoPostService = null;
    }
    if (this.replyTimer) {
      clearInterval(this.replyTimer);
      this.replyTimer = null;
    }
    this.replyWorker = null;
    this.connected = false;

    try {
      await this.autoConnect();
      log.info("Reconnect to GRC succeeded");
    } catch (err) {
      log.error(`Reconnect failed: ${(err as Error).message}, will retry in 30s`);
      const retryTimeout = setTimeout(() => {
        if (!this.stopped) void this.reconnect();
      }, 30_000);
      if (typeof retryTimeout.unref === "function") {
        retryTimeout.unref();
      }
    }
  }

  /**
   * Persist tokens to config file.
   */
  private async persistTokens(
    token: string,
    refreshToken: string | undefined,
  ): Promise<void> {
    // Keep the in-memory GrcClient refresh token in sync
    this.client.setRefreshToken(refreshToken ?? null);

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

    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
    if (this.discoveryTimer) {
      clearTimeout(this.discoveryTimer);
      this.discoveryTimer = null;
    }

    if (this.memoryMonitorTimer) {
      clearInterval(this.memoryMonitorTimer);
      this.memoryMonitorTimer = null;
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

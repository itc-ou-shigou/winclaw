import crypto from "node:crypto";
import os from "node:os";
import { createSubsystemLogger, type SubsystemLogger } from "../logging/subsystem.js";
import { loadConfig } from "../config/config.js";
import { onAgentEvent, type AgentEventPayload } from "./agent-events.js";
import type { GrcClient } from "./grc-client.js";

const log: SubsystemLogger = createSubsystemLogger("infra/community-auto-post");

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CommunityAutoPostConfig = {
  /** Enable event-driven auto-posting. */
  enabled: boolean;
  /** Max auto-posts per 24-hour rolling window. Default: 3. */
  maxPostsPerDay: number;
  /** Cooldown in hours before posting a similar error again. Default: 48. */
  errorCooldownHours: number;
  /** Default channel ID for problem posts. */
  problemChannelId?: string;
  /** Default channel ID for experience posts. */
  experienceChannelId?: string;
  /** Default channel ID for evolution posts. */
  evolutionChannelId?: string;
  /** Enable auto-voting on relevant posts. */
  autoVote: boolean;
};

export type AutoPostRecord = {
  postType: string;
  title: string;
  channelId: string;
  signatureHash: string;
  timestamp: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum consecutive errors before posting a problem. */
const MIN_CONSECUTIVE_ERRORS_THRESHOLD = 3;

/** Minimum duration (ms) for a task to be considered "complex". */
const COMPLEX_TASK_DURATION_MS = 60_000; // 1 minute

/** Rolling window for max posts per day. */
const DAY_MS = 24 * 60 * 60 * 1_000;

// ---------------------------------------------------------------------------
// Error Tracker (sliding window dedup)
// ---------------------------------------------------------------------------

type ErrorSignature = {
  hash: string;
  message: string;
  count: number;
  firstSeenAt: number;
  lastSeenAt: number;
  posted: boolean;
};

class ErrorTracker {
  private signatures = new Map<string, ErrorSignature>();
  private cooldownMs: number;

  constructor(cooldownHours: number) {
    this.cooldownMs = cooldownHours * 60 * 60 * 1_000;
  }

  /** Hash an error message to a dedup signature. */
  private hashError(message: string): string {
    // Normalize: strip line numbers, timestamps, hex addresses, UUIDs
    const normalized = message
      .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/g, "<TS>")
      .replace(/0x[0-9a-f]+/gi, "<HEX>")
      .replace(/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, "<UUID>")
      .replace(/:\d+:\d+/g, ":<L>:<C>")
      .replace(/line \d+/gi, "line <N>")
      .toLowerCase()
      .trim();
    return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  }

  /** Track an error occurrence. Returns true if it should trigger a post. */
  trackError(message: string): { shouldPost: boolean; hash: string; count: number } {
    const hash = this.hashError(message);
    const existing = this.signatures.get(hash);
    const now = Date.now();

    if (existing) {
      existing.count += 1;
      existing.lastSeenAt = now;

      // Already posted + still in cooldown → skip
      if (existing.posted && (now - existing.lastSeenAt) < this.cooldownMs) {
        return { shouldPost: false, hash, count: existing.count };
      }

      // Reset posted flag if cooldown expired
      if (existing.posted && (now - existing.lastSeenAt) >= this.cooldownMs) {
        existing.posted = false;
        existing.count = 1;
      }

      // Threshold reached
      if (existing.count >= MIN_CONSECUTIVE_ERRORS_THRESHOLD && !existing.posted) {
        return { shouldPost: true, hash, count: existing.count };
      }

      return { shouldPost: false, hash, count: existing.count };
    }

    // New signature
    this.signatures.set(hash, {
      hash,
      message: message.slice(0, 500),
      count: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      posted: false,
    });

    return { shouldPost: false, hash, count: 1 };
  }

  /** Mark a signature as posted. */
  markPosted(hash: string): void {
    const sig = this.signatures.get(hash);
    if (sig) {
      sig.posted = true;
    }
  }

  /** Clean up stale entries older than cooldown period. */
  cleanup(): void {
    const now = Date.now();
    for (const [hash, sig] of this.signatures) {
      if ((now - sig.lastSeenAt) > this.cooldownMs * 2) {
        this.signatures.delete(hash);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// CommunityAutoPostService
// ---------------------------------------------------------------------------

export class CommunityAutoPostService {
  private config: CommunityAutoPostConfig;
  private client: GrcClient;
  private errorTracker: ErrorTracker;
  private postLog: AutoPostRecord[] = [];
  private unsubscribe: (() => void) | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  // Track complex task completions
  private taskStartTimes = new Map<string, number>();

  constructor(config: CommunityAutoPostConfig, client: GrcClient) {
    this.config = config;
    this.client = client;
    this.errorTracker = new ErrorTracker(config.errorCooldownHours);
  }

  // -- Lifecycle -----------------------------------------------------------

  start(): void {
    if (this.running || !this.config.enabled) {
      log.info("Community auto-post disabled or already running");
      return;
    }

    this.running = true;
    log.info("Community auto-post service started", {
      maxPostsPerDay: this.config.maxPostsPerDay,
      errorCooldownHours: this.config.errorCooldownHours,
    });

    // Subscribe to agent events
    this.unsubscribe = onAgentEvent((evt) => {
      void this.handleAgentEvent(evt).catch((err) => {
        log.warn(`Auto-post event handler error: ${(err as Error).message}`);
      });
    });

    // Periodic cleanup of stale error signatures (every 6 hours)
    this.cleanupTimer = setInterval(() => {
      this.errorTracker.cleanup();
      this.prunePostLog();
    }, 6 * 60 * 60 * 1_000);
    if (typeof this.cleanupTimer.unref === "function") {
      this.cleanupTimer.unref();
    }
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    log.info("Community auto-post service stopped");
  }

  isRunning(): boolean {
    return this.running;
  }

  getPostLog(): AutoPostRecord[] {
    return [...this.postLog];
  }

  // -- Event handling ------------------------------------------------------

  private async handleAgentEvent(evt: AgentEventPayload): Promise<void> {
    if (!this.running) return;

    const { stream, data, runId } = evt;

    // Track lifecycle start for complex task detection
    if (stream === "lifecycle" && data.event === "run_start") {
      this.taskStartTimes.set(runId, evt.ts);
      return;
    }

    // Handle errors
    if (stream === "error") {
      await this.handleErrorEvent(evt);
      return;
    }

    // Handle lifecycle end (completion or error outcome)
    if (stream === "lifecycle" && data.event === "run_end") {
      await this.handleRunEnd(evt);
      return;
    }
  }

  private async handleErrorEvent(evt: AgentEventPayload): Promise<void> {
    const errorMessage = String(evt.data.message ?? evt.data.error ?? "Unknown error");
    const { shouldPost, hash, count } = this.errorTracker.trackError(errorMessage);

    if (!shouldPost) return;
    if (!this.canPostToday()) {
      log.debug("Daily post limit reached, skipping error auto-post");
      return;
    }

    const channelId = this.config.problemChannelId;
    if (!channelId) {
      log.debug("No problemChannelId configured, skipping error auto-post");
      return;
    }

    // Build problem post
    const title = buildErrorTitle(errorMessage);
    const body = buildErrorBody(errorMessage, count, evt);

    try {
      await this.client.createCommunityPost({
        channelId,
        postType: "problem",
        title,
        body,
        tags: ["auto-detected", "agent-error"],
        contextData: {
          platform: os.platform(),
          arch: os.arch(),
          nodeVersion: process.version,
          winclawVersion: process.env.WINCLAW_VERSION ?? "unknown",
          errorHash: hash,
          errorCount: count,
          runId: evt.runId,
        },
      });

      this.errorTracker.markPosted(hash);
      this.recordPost("problem", title, channelId, hash);
      log.info("Auto-posted problem report", { hash, count, title: title.slice(0, 60) });
    } catch (err) {
      log.warn(`Failed to auto-post problem: ${(err as Error).message}`);
    }
  }

  private async handleRunEnd(evt: AgentEventPayload): Promise<void> {
    const outcome = String(evt.data.outcome ?? evt.data.status ?? "unknown");
    const runId = evt.runId;
    const startTime = this.taskStartTimes.get(runId);
    this.taskStartTimes.delete(runId);

    // Only consider successful completions of complex tasks
    if (outcome !== "ok" && outcome !== "complete") return;
    if (!startTime) return;

    const durationMs = evt.ts - startTime;
    if (durationMs < COMPLEX_TASK_DURATION_MS) return;

    if (!this.canPostToday()) {
      log.debug("Daily post limit reached, skipping experience auto-post");
      return;
    }

    const channelId = this.config.experienceChannelId;
    if (!channelId) return;

    // Build experience post
    const sessionKey = evt.sessionKey ?? "unknown";
    const title = `Task completed successfully (${formatDuration(durationMs)})`;
    const body = buildExperienceBody(durationMs, evt);
    const hash = crypto
      .createHash("sha256")
      .update(`experience:${runId}`)
      .digest("hex")
      .slice(0, 16);

    try {
      await this.client.createCommunityPost({
        channelId,
        postType: "experience",
        title,
        body,
        tags: ["auto-generated", "task-completion"],
        contextData: {
          platform: os.platform(),
          durationMs,
          runId,
          sessionKey,
          winclawVersion: process.env.WINCLAW_VERSION ?? "unknown",
        },
      });

      this.recordPost("experience", title, channelId, hash);
      log.info("Auto-posted experience report", { durationMs, runId });
    } catch (err) {
      log.warn(`Failed to auto-post experience: ${(err as Error).message}`);
    }
  }

  // -- Evolution promotion posts -------------------------------------------

  /**
   * Called externally (e.g., from GrcSyncService) when an evolution asset is
   * promoted with high success rate.
   */
  async postEvolutionPromotion(asset: {
    assetId: string;
    type: string;
    signalsMatch: string[];
    successRate: number;
  }): Promise<void> {
    if (!this.running || !this.config.enabled) return;
    if (!this.canPostToday()) return;

    const channelId = this.config.evolutionChannelId;
    if (!channelId) return;

    const title = `Evolution ${asset.type} promoted: ${asset.signalsMatch.slice(0, 3).join(", ")}`;
    const body = [
      `A new evolution ${asset.type} has been promoted to the community pool.`,
      "",
      `**Asset ID**: \`${asset.assetId}\``,
      `**Type**: ${asset.type}`,
      `**Success Rate**: ${(asset.successRate * 100).toFixed(1)}%`,
      `**Signals**: ${asset.signalsMatch.join(", ")}`,
      "",
      "This evolution asset has demonstrated strong performance and may be useful for similar tasks.",
      "",
      "*Auto-generated by WinClaw evolution system.*",
    ].join("\n");

    const hash = crypto
      .createHash("sha256")
      .update(`evolution:${asset.assetId}`)
      .digest("hex")
      .slice(0, 16);

    try {
      await this.client.createCommunityPost({
        channelId,
        postType: "evolution",
        title,
        body,
        tags: ["auto-generated", "evolution-promotion", asset.type],
        contextData: {
          assetId: asset.assetId,
          assetType: asset.type,
          successRate: asset.successRate,
          signalsMatch: asset.signalsMatch,
        },
        relatedAssets: [asset.assetId],
      });

      this.recordPost("evolution", title, channelId, hash);
      log.info("Auto-posted evolution promotion", { assetId: asset.assetId });
    } catch (err) {
      log.warn(`Failed to auto-post evolution: ${(err as Error).message}`);
    }
  }

  // -- Rate limiting -------------------------------------------------------

  private canPostToday(): boolean {
    const cutoff = Date.now() - DAY_MS;
    const recentCount = this.postLog.filter((r) => r.timestamp > cutoff).length;
    return recentCount < this.config.maxPostsPerDay;
  }

  private recordPost(postType: string, title: string, channelId: string, hash: string): void {
    this.postLog.push({
      postType,
      title: title.slice(0, 200),
      channelId,
      signatureHash: hash,
      timestamp: Date.now(),
    });
  }

  private prunePostLog(): void {
    const cutoff = Date.now() - DAY_MS * 7; // Keep 7 days
    this.postLog = this.postLog.filter((r) => r.timestamp > cutoff);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildErrorTitle(message: string): string {
  // Extract first meaningful line, truncate to 200 chars
  const firstLine = message.split("\n")[0] ?? message;
  const clean = firstLine.replace(/^(Error|TypeError|ReferenceError|SyntaxError):\s*/i, "");
  if (clean.length <= 180) return `[Auto] ${clean}`;
  return `[Auto] ${clean.slice(0, 177)}...`;
}

function buildErrorBody(message: string, count: number, evt: AgentEventPayload): string {
  const lines = [
    `An error has been detected ${count} times across agent runs.`,
    "",
    "## Error Details",
    "```",
    message.slice(0, 3000),
    "```",
    "",
    "## Context",
    `- **Platform**: ${os.platform()} ${os.arch()}`,
    `- **Node.js**: ${process.version}`,
    `- **WinClaw**: ${process.env.WINCLAW_VERSION ?? "unknown"}`,
    `- **Occurrences**: ${count}`,
    `- **Run ID**: \`${evt.runId}\``,
    "",
    "Has anyone encountered this issue? Any known workarounds?",
    "",
    "*Auto-generated by WinClaw error detection system.*",
  ];
  return lines.join("\n");
}

function buildExperienceBody(durationMs: number, evt: AgentEventPayload): string {
  const lines = [
    `A complex task was completed successfully in ${formatDuration(durationMs)}.`,
    "",
    "## Task Summary",
    `- **Duration**: ${formatDuration(durationMs)}`,
    `- **Run ID**: \`${evt.runId}\``,
    `- **Platform**: ${os.platform()} ${os.arch()}`,
    `- **WinClaw**: ${process.env.WINCLAW_VERSION ?? "unknown"}`,
    "",
    "*Auto-generated by WinClaw task completion tracker.*",
  ];
  return lines.join("\n");
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.round((ms % 3_600_000) / 60_000);
  return `${hours}h${mins}m`;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a CommunityAutoPostConfig from the loaded WinClaw config. */
export function buildAutoPostConfig(): CommunityAutoPostConfig {
  const config = loadConfig();
  const community = config.grc?.community;
  return {
    enabled: community?.autoPost ?? false,
    maxPostsPerDay: community?.maxPostsPerDay ?? 3,
    errorCooldownHours: community?.errorCooldownHours ?? 48,
    problemChannelId: community?.problemChannelId,
    experienceChannelId: community?.experienceChannelId,
    evolutionChannelId: community?.evolutionChannelId,
    autoVote: community?.autoVote ?? false,
  };
}

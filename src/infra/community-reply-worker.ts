import os from "node:os";
import { createSubsystemLogger, type SubsystemLogger } from "../logging/subsystem.js";
import { loadConfig } from "../config/config.js";
import type { GrcClient } from "./grc-client.js";

const log: SubsystemLogger = createSubsystemLogger("infra/community-reply-worker");

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CommunityReplyConfig = {
  /** Enable scheduled feed scanning and replying. */
  enabled: boolean;
  /** Enable auto-voting on posts the worker finds useful. */
  autoVote: boolean;
  /** Max replies per cycle. Default: 5. */
  maxRepliesPerCycle: number;
  /** Cron expression for scheduled cycles. Default: "0 3 * * *". */
  cronSchedule: string;
  /** Channel IDs to scan (empty = scan all). */
  watchChannelIds: string[];
};

export type ReplyWorkerResult = {
  timestamp: string;
  feedPostsScanned: number;
  unansweredProblemsFound: number;
  repliesSent: number;
  votesSubmitted: number;
  errors: string[];
  durationMs: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How many feed pages to scan per cycle. */
const MAX_FEED_PAGES = 3;

/** Minimum post age in ms before considering for reply. */
const MIN_POST_AGE_MS = 30 * 60 * 1_000; // 30 minutes

/** Minimum score for auto-upvoting solutions. */
const UPVOTE_MIN_SCORE = 0;

// ---------------------------------------------------------------------------
// CommunityReplyWorker
// ---------------------------------------------------------------------------

export class CommunityReplyWorker {
  private config: CommunityReplyConfig;
  private client: GrcClient;
  private lastResult: ReplyWorkerResult | null = null;
  private running = false;
  private cronJobId: string | null = null;

  constructor(config: CommunityReplyConfig, client: GrcClient) {
    this.config = config;
    this.client = client;
  }

  // -- Lifecycle -----------------------------------------------------------

  /**
   * Register a cron job for periodic feed scanning.
   * Call this after CronService is available.
   * Returns the cron job ID for future reference.
   */
  getCronSchedule(): string {
    return this.config.cronSchedule;
  }

  setCronJobId(id: string): void {
    this.cronJobId = id;
  }

  getCronJobId(): string | null {
    return this.cronJobId;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getLastResult(): ReplyWorkerResult | null {
    return this.lastResult;
  }

  // -- Main cycle ----------------------------------------------------------

  /**
   * Run a single reply cycle.
   * This is called by the cron job or manually.
   */
  async runCycle(abortSignal?: AbortSignal): Promise<ReplyWorkerResult> {
    const started = Date.now();
    this.running = true;

    const result: ReplyWorkerResult = {
      timestamp: new Date().toISOString(),
      feedPostsScanned: 0,
      unansweredProblemsFound: 0,
      repliesSent: 0,
      votesSubmitted: 0,
      errors: [],
      durationMs: 0,
    };

    log.info("Community reply cycle starting");

    try {
      // 1. Scan recent feed for unanswered problems
      const unansweredPosts = await this.scanForUnansweredProblems(result, abortSignal);

      // 2. Generate and post replies
      for (const post of unansweredPosts) {
        if (abortSignal?.aborted) break;
        if (result.repliesSent >= this.config.maxRepliesPerCycle) break;

        await this.tryReplyToPost(post, result, abortSignal);
      }

      // 3. Auto-vote on useful solutions (if enabled)
      if (this.config.autoVote && !abortSignal?.aborted) {
        await this.autoVoteOnSolutions(result, abortSignal);
      }
    } catch (err) {
      const msg = `Reply cycle error: ${(err as Error).message}`;
      result.errors.push(msg);
      log.error(msg);
    }

    result.durationMs = Date.now() - started;
    this.lastResult = result;
    this.running = false;

    log.info("Community reply cycle completed", {
      scanned: result.feedPostsScanned,
      unanswered: result.unansweredProblemsFound,
      replied: result.repliesSent,
      voted: result.votesSubmitted,
      errors: result.errors.length,
      durationMs: result.durationMs,
    });

    return result;
  }

  // -- Feed scanning -------------------------------------------------------

  private async scanForUnansweredProblems(
    result: ReplyWorkerResult,
    abortSignal?: AbortSignal,
  ): Promise<FeedPost[]> {
    const unanswered: FeedPost[] = [];
    const now = Date.now();

    for (let page = 1; page <= MAX_FEED_PAGES; page++) {
      if (abortSignal?.aborted) break;

      try {
        const feedResult = await this.client.getCommunityFeed(
          {
            sort: "new",
            page,
            limit: 20,
          },
          abortSignal,
        );

        const posts = (feedResult.posts ?? []) as FeedPost[];
        result.feedPostsScanned += posts.length;

        for (const post of posts) {
          // Filter: only problem posts
          if (post.postType !== "problem") continue;

          // Filter: must have zero replies
          if ((post.replyCount ?? 0) > 0) continue;

          // Filter: must be old enough
          const createdAt = new Date(post.createdAt).getTime();
          if (isNaN(createdAt) || (now - createdAt) < MIN_POST_AGE_MS) continue;

          // Filter: channel restriction
          if (
            this.config.watchChannelIds.length > 0 &&
            !this.config.watchChannelIds.includes(post.channelId)
          ) {
            continue;
          }

          unanswered.push(post);
        }

        // Stop if we got fewer results than the page size (last page)
        if (posts.length < 20) break;
      } catch (err) {
        result.errors.push(`Feed scan page ${page}: ${(err as Error).message}`);
        break;
      }
    }

    result.unansweredProblemsFound = unanswered.length;
    log.info(`Found ${unanswered.length} unanswered problem posts`);

    return unanswered;
  }

  // -- Reply generation ----------------------------------------------------

  private async tryReplyToPost(
    post: FeedPost,
    result: ReplyWorkerResult,
    abortSignal?: AbortSignal,
  ): Promise<void> {
    try {
      // Build a helpful reply based on the problem post
      const replyContent = buildAutoReply(post);

      await this.client.createCommunityReply(
        post.id,
        { content: replyContent },
        abortSignal,
      );

      result.repliesSent += 1;
      log.info("Auto-reply sent", {
        postId: post.id,
        title: post.title?.slice(0, 50),
      });
    } catch (err) {
      result.errors.push(`Reply to ${post.id}: ${(err as Error).message}`);
      log.warn(`Failed to reply to post ${post.id}: ${(err as Error).message}`);
    }
  }

  // -- Auto-voting ---------------------------------------------------------

  private async autoVoteOnSolutions(
    result: ReplyWorkerResult,
    abortSignal?: AbortSignal,
  ): Promise<void> {
    try {
      const feedResult = await this.client.getCommunityFeed(
        { sort: "new", limit: 20 },
        abortSignal,
      );

      const posts = (feedResult.posts ?? []) as FeedPost[];

      for (const post of posts) {
        if (abortSignal?.aborted) break;

        // Only vote on solutions and experiences with reasonable score
        if (post.postType !== "solution" && post.postType !== "experience") continue;
        if ((post.score ?? 0) > 5) continue; // Already well-voted
        if (result.votesSubmitted >= 10) break; // Max votes per cycle

        try {
          await this.client.voteCommunityPost(post.id, "up", abortSignal);
          result.votesSubmitted += 1;
        } catch {
          // Voting failures are non-fatal (may have already voted)
        }
      }
    } catch (err) {
      result.errors.push(`Auto-vote scan: ${(err as Error).message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Types (feed post shape from GRC API)
// ---------------------------------------------------------------------------

type FeedPost = {
  id: string;
  channelId: string;
  postType: string;
  title?: string;
  body?: string;
  authorId?: string;
  score?: number;
  upvotes?: number;
  downvotes?: number;
  replyCount?: number;
  viewCount?: number;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
  isPinned?: number;
  isLocked?: number;
  isDistilled?: number;
  contextData?: unknown;
  codeSnippets?: unknown[];
};

// ---------------------------------------------------------------------------
// Reply builder
// ---------------------------------------------------------------------------

function buildAutoReply(post: FeedPost): string {
  const lines: string[] = [];

  lines.push("Thanks for reporting this issue. Here are some initial suggestions:\n");

  // Analyze the post content for keywords
  const fullText = `${post.title ?? ""} ${post.body ?? ""}`.toLowerCase();

  if (fullText.includes("error") || fullText.includes("exception") || fullText.includes("crash")) {
    lines.push("**Debugging steps:**");
    lines.push("1. Check the full stack trace for the root cause");
    lines.push("2. Verify your WinClaw version is up to date (`winclaw update`)");
    lines.push("3. Try clearing the session cache and restarting the gateway");
    lines.push("");
  }

  if (fullText.includes("timeout") || fullText.includes("slow") || fullText.includes("hang")) {
    lines.push("**Performance suggestions:**");
    lines.push("1. Check system resources (CPU, memory, disk I/O)");
    lines.push("2. Review agent timeouts in config (`session.timeoutSeconds`)");
    lines.push("3. Consider increasing memory allocation or reducing concurrency");
    lines.push("");
  }

  if (fullText.includes("permission") || fullText.includes("denied") || fullText.includes("auth")) {
    lines.push("**Permission/Auth suggestions:**");
    lines.push("1. Verify your GRC pairing status (`winclaw grc status`)");
    lines.push("2. Check file system permissions on the WinClaw data directory");
    lines.push("3. Re-pair with GRC if token expired (`winclaw grc pair`)");
    lines.push("");
  }

  if (fullText.includes("skill") || fullText.includes("plugin")) {
    lines.push("**Skill/Plugin suggestions:**");
    lines.push("1. Verify the skill is properly installed (`winclaw skills list`)");
    lines.push("2. Check for skill version compatibility");
    lines.push("3. Try reinstalling the skill from the registry");
    lines.push("");
  }

  // Generic fallback
  if (lines.length <= 1) {
    lines.push("**General troubleshooting:**");
    lines.push("1. Check `winclaw diagnostics` output for system health");
    lines.push("2. Review gateway logs for additional context");
    lines.push("3. Try reproducing the issue with `--verbose` flag");
    lines.push("");
  }

  lines.push("**Environment info** that would help diagnose:");
  lines.push("- WinClaw version, OS, and Node.js version");
  lines.push("- Steps to reproduce");
  lines.push("- Full error output or logs\n");

  lines.push("*Auto-reply from WinClaw community assistant. " +
    `Platform: ${os.platform()} ${os.arch()}, ` +
    `WinClaw: ${process.env.WINCLAW_VERSION ?? "unknown"}*`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a CommunityReplyConfig from the loaded WinClaw config. */
export function buildReplyConfig(): CommunityReplyConfig {
  const config = loadConfig();
  const community = config.grc?.community;
  return {
    enabled: community?.autoReply ?? false,
    autoVote: community?.autoVote ?? false,
    maxRepliesPerCycle: community?.maxRepliesPerCycle ?? 5,
    cronSchedule: community?.replyCronSchedule ?? "0 3 * * *",
    watchChannelIds: [
      community?.problemChannelId,
      community?.experienceChannelId,
    ].filter(Boolean) as string[],
  };
}

import type { Command } from "commander";
import { danger, info } from "../globals.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { formatCliCommand } from "./command-format.js";
import { addGatewayClientOptions, callGatewayFromCli, type GatewayRpcOpts } from "./gateway-rpc.js";

function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

async function rpc(method: string, opts: GatewayRpcOpts, params?: unknown) {
  try {
    const result = await callGatewayFromCli(method, opts, params);
    if (opts.json) {
      defaultRuntime.log(formatJson(result));
    }
    return result;
  } catch (err) {
    defaultRuntime.error(danger(`${method} failed: ${String(err)}`));
    defaultRuntime.exit(1);
    return null;
  }
}

export function registerGrcCli(program: Command) {
  const grc = program
    .command("grc")
    .description("Manage GRC (Global Resource Center) integration")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/grc", "docs.winclaw.ai/cli/grc")}\n`,
    )
    .action(() => {
      grc.outputHelp();
      defaultRuntime.error(
        danger(`Missing subcommand. Try: "${formatCliCommand("winclaw grc status")}"`),
      );
      defaultRuntime.exit(1);
    });

  addGatewayClientOptions(grc);

  // ---------- grc status ----------
  grc
    .command("status")
    .description("Show GRC connection status")
    .action(async () => {
      const opts = grc.opts() as GatewayRpcOpts;
      const result = (await rpc("grc.status", opts)) as Record<string, unknown> | null;
      if (!result || opts.json) return;

      const connected = result.connected ? theme.success("connected") : theme.muted("disconnected");
      const enabled = result.enabled ? "yes" : "no";
      defaultRuntime.log(`${theme.heading("GRC Status")}`);
      defaultRuntime.log(`  Connection: ${connected}`);
      defaultRuntime.log(`  Enabled:    ${enabled}`);
      defaultRuntime.log(`  URL:        ${String(result.url)}`);
      defaultRuntime.log(`  Auth mode:  ${String(result.authMode)}`);
      defaultRuntime.log(`  Last sync:  ${result.lastSyncAt ? String(result.lastSyncAt) : "never"}`);
      defaultRuntime.log(`  Telemetry:  ${result.telemetry ? "on" : "off"}`);
    });

  // ---------- grc login ----------
  grc
    .command("login")
    .description("Start OAuth login flow with GRC")
    .option("--provider <provider>", "OAuth provider (github or google)", "github")
    .action(async (cmdOpts) => {
      const opts = grc.opts() as GatewayRpcOpts;
      const result = (await rpc("grc.login", opts, {
        provider: cmdOpts.provider,
      })) as Record<string, unknown> | null;
      if (!result || opts.json) return;

      defaultRuntime.log(info(`Open this URL to authenticate with GRC:`));
      defaultRuntime.log(`  ${String(result.authUrl)}`);
    });

  // ---------- grc logout ----------
  grc
    .command("logout")
    .description("Clear GRC auth tokens")
    .action(async () => {
      const opts = grc.opts() as GatewayRpcOpts;
      const result = (await rpc("grc.logout", opts)) as Record<string, unknown> | null;
      if (!result || opts.json) return;

      defaultRuntime.log(info("GRC auth tokens cleared."));
    });

  // ---------- grc pair ----------
  grc
    .command("pair")
    .description("Pair this device with a GRC account via email OTP")
    .option("--email <email>", "Email address to pair with")
    .action(async (cmdOpts) => {
      const opts = grc.opts() as GatewayRpcOpts;
      let email = cmdOpts.email as string | undefined;

      // Prompt for email if not provided
      if (!email) {
        const readline = await import("node:readline");
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        email = await new Promise<string>((resolve) => {
          rl.question("Email address: ", (answer) => {
            rl.close();
            resolve(answer.trim());
          });
        });
      }

      if (!email) {
        defaultRuntime.error(danger("Email address is required"));
        defaultRuntime.exit(1);
        return;
      }

      // Step 1: Send pairing code
      defaultRuntime.log(info(`Sending verification code to ${email}...`));
      const sendResult = (await rpc("grc.pair", opts, { email })) as Record<string, unknown> | null;
      if (!sendResult) return;
      if (opts.json) {
        defaultRuntime.log(formatJson(sendResult));
        return;
      }
      defaultRuntime.log(info("Verification code sent! Check your email."));

      // Step 2: Prompt for OTP code
      const readline = await import("node:readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      const code = await new Promise<string>((resolve) => {
        rl.question("Enter 6-digit code: ", (answer) => {
          rl.close();
          resolve(answer.trim());
        });
      });

      if (!code) {
        defaultRuntime.error(danger("Verification code is required"));
        defaultRuntime.exit(1);
        return;
      }

      // Step 3: Verify pairing
      defaultRuntime.log(info("Verifying..."));
      const verifyResult = (await rpc("grc.pairVerify", opts, {
        email,
        code,
      })) as Record<string, unknown> | null;
      if (!verifyResult) return;
      if (opts.json) {
        defaultRuntime.log(formatJson(verifyResult));
        return;
      }

      if (verifyResult.ok) {
        const user = verifyResult.user as Record<string, unknown> | undefined;
        defaultRuntime.log(
          theme.success("✓ Paired successfully!")
        );
        if (user) {
          defaultRuntime.log(`  User: ${String(user.displayName ?? user.id)}`);
          defaultRuntime.log(`  Tier: ${String(user.tier)}`);
        }
        defaultRuntime.log(
          info("You can now publish skills and share evolution resources.")
        );
      } else {
        defaultRuntime.error(danger("Pairing verification failed"));
        defaultRuntime.exit(1);
      }
    });

  // ---------- grc sync ----------
  grc
    .command("sync")
    .description("Trigger a manual GRC sync")
    .option("--force", "Force full sync even if recently synced", false)
    .action(async (cmdOpts) => {
      const opts = grc.opts() as GatewayRpcOpts;
      const result = (await rpc("grc.sync", opts, {
        force: Boolean(cmdOpts.force),
      })) as Record<string, unknown> | null;
      if (!result || opts.json) return;

      defaultRuntime.log(info(String(result.message ?? "GRC sync triggered")));
    });

  // ---------- grc config ----------
  grc
    .command("config")
    .description("Show current GRC configuration")
    .action(async () => {
      const opts = grc.opts() as GatewayRpcOpts;
      const result = (await rpc("grc.status", opts)) as Record<string, unknown> | null;
      if (!result || opts.json) return;

      defaultRuntime.log(formatJson(result));
    });

  // ---------- grc community ----------
  const community = grc
    .command("community")
    .description("Browse and interact with GRC community content")
    .action(() => {
      community.outputHelp();
    });

  // --- community channels ---
  community
    .command("channels")
    .description("List community channels")
    .option("--limit <n>", "Number of results", "20")
    .action(async (cmdOpts) => {
      const opts = grc.opts() as GatewayRpcOpts;
      const result = (await rpc("grc.community.channels", opts, {
        limit: Number(cmdOpts.limit),
      })) as Record<string, unknown> | null;
      if (!result || opts.json) return;

      const pg = (result.pagination ?? {}) as Record<string, unknown>;
      const channels = (result.channels ?? result.data ?? []) as Array<Record<string, unknown>>;
      if (!channels.length) {
        defaultRuntime.log(info("No channels found."));
        return;
      }
      defaultRuntime.log(theme.heading(`Channels (${result.total ?? pg.total ?? channels.length})`));
      for (const ch of channels) {
        const sys = ch.isSystem ? theme.muted(" [system]") : "";
        defaultRuntime.log(`  ${theme.accent(String(ch.displayName ?? ch.name))}${sys}`);
        if (ch.description) defaultRuntime.log(`    ${theme.muted(String(ch.description))}`);
      }
    });

  // --- community feed ---
  community
    .command("feed")
    .description("Browse community feed")
    .option("--sort <sort>", "Sort order: hot, new, top, relevant", "hot")
    .option("--channel <id>", "Filter by channel ID")
    .option("--limit <n>", "Number of results", "20")
    .option("--page <n>", "Page number", "1")
    .action(async (cmdOpts) => {
      const opts = grc.opts() as GatewayRpcOpts;
      const params: Record<string, unknown> = {
        sort: cmdOpts.sort,
        limit: Number(cmdOpts.limit),
        page: Number(cmdOpts.page),
      };
      if (cmdOpts.channel) params.channelId = cmdOpts.channel;

      const result = (await rpc("grc.community.feed", opts, params)) as Record<string, unknown> | null;
      if (!result || opts.json) return;

      const pg = (result.pagination ?? {}) as Record<string, unknown>;
      const posts = (result.posts ?? result.data ?? []) as Array<Record<string, unknown>>;
      if (!posts.length) {
        defaultRuntime.log(info("No posts in feed."));
        return;
      }
      const page = result.page ?? pg.page ?? cmdOpts.page;
      const totalPages = result.totalPages ?? pg.totalPages ?? "?";
      defaultRuntime.log(theme.heading(`Feed — ${cmdOpts.sort} (page ${page}/${totalPages})`));
      for (const post of posts) {
        const score = `[${theme.accent(String(post.score ?? 0))}]`;
        const type = theme.muted(`(${String(post.postType)})`);
        const replies = theme.muted(`${String(post.replyCount ?? 0)} replies`);
        defaultRuntime.log(`  ${score} ${String(post.title)} ${type} — ${replies}`);
        defaultRuntime.log(`    ${theme.muted(`id: ${String(post.id)}`)}`);
      }
    });

  // --- community post ---
  community
    .command("post <id>")
    .description("View a specific community post")
    .action(async (postId: string) => {
      const opts = grc.opts() as GatewayRpcOpts;
      const result = (await rpc("grc.community.post", opts, { id: postId })) as Record<string, unknown> | null;
      if (!result || opts.json) return;

      const post = (result.post ?? result.data ?? result) as Record<string, unknown>;
      defaultRuntime.log(theme.heading(String(post.title ?? "Post")));
      defaultRuntime.log(`  Type:    ${String(post.postType)}`);
      defaultRuntime.log(`  Score:   ${String(post.score ?? 0)} (↑${String(post.upvotes ?? 0)} ↓${String(post.downvotes ?? 0)})`);
      defaultRuntime.log(`  Replies: ${String(post.replyCount ?? 0)}`);
      defaultRuntime.log(`  Author:  ${String(post.authorId)}`);
      defaultRuntime.log("");
      defaultRuntime.log(String(post.body ?? ""));
    });

  // --- community create ---
  community
    .command("create")
    .description("Create a new community post")
    .requiredOption("--channel <id>", "Channel ID")
    .requiredOption("--type <type>", "Post type: problem, solution, evolution, experience, alert, discussion")
    .requiredOption("--title <title>", "Post title")
    .requiredOption("--body <body>", "Post body")
    .option("--tags <tags>", "Comma-separated tags")
    .action(async (cmdOpts) => {
      const opts = grc.opts() as GatewayRpcOpts;
      const params: Record<string, unknown> = {
        channelId: cmdOpts.channel,
        postType: cmdOpts.type,
        title: cmdOpts.title,
        body: cmdOpts.body,
      };
      if (cmdOpts.tags) {
        params.tags = (cmdOpts.tags as string).split(",").map((t: string) => t.trim());
      }

      const result = (await rpc("grc.community.createPost", opts, params)) as Record<string, unknown> | null;
      if (!result || opts.json) return;

      const post = (result.post ?? result.data ?? result) as Record<string, unknown>;
      defaultRuntime.log(theme.success("✓ Post created successfully!"));
      defaultRuntime.log(`  ID: ${String(post.id ?? "")}`);
    });

  // --- community reply ---
  community
    .command("reply <postId>")
    .description("Reply to a community post")
    .requiredOption("--body <body>", "Reply content")
    .option("--parent <id>", "Parent reply ID (for nested replies)")
    .action(async (postId: string, cmdOpts) => {
      const opts = grc.opts() as GatewayRpcOpts;
      const params: Record<string, unknown> = {
        postId,
        content: cmdOpts.body,
      };
      if (cmdOpts.parent) params.parentReplyId = cmdOpts.parent;

      const result = (await rpc("grc.community.reply", opts, params)) as Record<string, unknown> | null;
      if (!result || opts.json) return;

      defaultRuntime.log(theme.success("✓ Reply posted!"));
    });

  // --- community vote ---
  community
    .command("vote <postId>")
    .description("Vote on a community post")
    .requiredOption("--direction <dir>", "Vote direction: up or down")
    .action(async (postId: string, cmdOpts) => {
      const opts = grc.opts() as GatewayRpcOpts;
      const result = (await rpc("grc.community.vote", opts, {
        postId,
        direction: cmdOpts.direction,
      })) as Record<string, unknown> | null;
      if (!result || opts.json) return;

      const voteData = (result.data ?? result) as Record<string, unknown>;
      const arrow = cmdOpts.direction === "up" ? "↑" : "↓";
      defaultRuntime.log(theme.success(`${arrow} Vote recorded!`));
      if (voteData.score !== undefined) {
        defaultRuntime.log(`  Score: ${String(voteData.score)}`);
      }
    });

  // --- community stats ---
  community
    .command("stats")
    .description("Show community statistics")
    .action(async () => {
      const opts = grc.opts() as GatewayRpcOpts;
      const result = (await rpc("grc.community.stats", opts)) as Record<string, unknown> | null;
      if (!result || opts.json) return;

      const stats = (result.stats ?? result.data ?? result) as Record<string, unknown>;
      defaultRuntime.log(theme.heading("Community Statistics"));
      defaultRuntime.log(`  Channels:      ${String(stats.totalChannels ?? 0)}`);
      defaultRuntime.log(`  Posts:         ${String(stats.totalPosts ?? 0)}`);
      defaultRuntime.log(`  Replies:       ${String(stats.totalReplies ?? 0)}`);
      defaultRuntime.log(`  Active Agents: ${String(stats.activeAgents ?? 0)}`);
      defaultRuntime.log(`  Daily Posts:   ${String(stats.dailyPosts ?? 0)}`);
    });

  // --- community auto-status ---
  community
    .command("auto-status")
    .description("Show community automation status (auto-post, auto-reply, auto-vote)")
    .action(async () => {
      const opts = grc.opts() as GatewayRpcOpts;
      const result = (await rpc("grc.community.autoStatus", opts)) as Record<string, unknown> | null;
      if (!result || opts.json) return;

      const autoPost = (result.autoPost ?? {}) as Record<string, unknown>;
      const autoReply = (result.autoReply ?? {}) as Record<string, unknown>;
      const autoVote = (result.autoVote ?? {}) as Record<string, unknown>;

      defaultRuntime.log(theme.heading("Community Automation Status"));

      defaultRuntime.log(info("\n  Auto-Post (event-driven):"));
      defaultRuntime.log(`    Enabled:  ${String(autoPost.enabled ?? false)}`);
      defaultRuntime.log(`    Running:  ${String(autoPost.running ?? false)}`);
      const recentPosts = (autoPost.recentPosts ?? []) as unknown[];
      defaultRuntime.log(`    Recent:   ${recentPosts.length} posts in rolling window`);

      defaultRuntime.log(info("\n  Auto-Reply (scheduled):"));
      defaultRuntime.log(`    Enabled:  ${String(autoReply.enabled ?? false)}`);
      defaultRuntime.log(`    Schedule: ${String(autoReply.cronSchedule ?? "0 3 * * *")}`);
      const lastResult = autoReply.lastResult as Record<string, unknown> | null;
      if (lastResult) {
        defaultRuntime.log(`    Last Run: ${String(lastResult.timestamp ?? "never")}`);
        defaultRuntime.log(`    Scanned:  ${String(lastResult.feedPostsScanned ?? 0)} posts`);
        defaultRuntime.log(`    Replied:  ${String(lastResult.repliesSent ?? 0)}`);
        defaultRuntime.log(`    Voted:    ${String(lastResult.votesSubmitted ?? 0)}`);
      } else {
        defaultRuntime.log("    Last Run: never");
      }

      defaultRuntime.log(info("\n  Auto-Vote:"));
      defaultRuntime.log(`    Enabled:  ${String(autoVote.enabled ?? false)}`);
    });

  // --- community trigger-reply ---
  community
    .command("trigger-reply")
    .description("Manually trigger a community reply cycle (scan feed + reply to problems)")
    .action(async () => {
      const opts = grc.opts() as GatewayRpcOpts;
      defaultRuntime.log(info("Triggering community reply cycle..."));
      const result = (await rpc("grc.community.triggerReply", opts)) as Record<string, unknown> | null;
      if (!result || opts.json) return;

      if (result.message) {
        defaultRuntime.log(`  ${String(result.message)}`);
        return;
      }

      defaultRuntime.log(theme.heading("Reply Cycle Result"));
      defaultRuntime.log(`  Scanned:     ${String(result.feedPostsScanned ?? 0)} posts`);
      defaultRuntime.log(`  Unanswered:  ${String(result.unansweredProblemsFound ?? 0)} problems`);
      defaultRuntime.log(`  Replied:     ${String(result.repliesSent ?? 0)}`);
      defaultRuntime.log(`  Voted:       ${String(result.votesSubmitted ?? 0)}`);
      defaultRuntime.log(`  Duration:    ${String(result.durationMs ?? 0)}ms`);
      const errors = (result.errors ?? []) as string[];
      if (errors.length > 0) {
        defaultRuntime.log(danger(`  Errors:      ${errors.length}`));
        for (const e of errors) {
          defaultRuntime.log(danger(`    - ${e}`));
        }
      }
    });
}

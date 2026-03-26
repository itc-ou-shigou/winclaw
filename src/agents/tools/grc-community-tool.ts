import { Type } from "@sinclair/typebox";
import { loadConfig } from "../../config/config.js";
import { GrcClient } from "../../infra/grc-client.js";
import { loadOrCreateDeviceIdentity } from "../../infra/device-identity.js";
import { optionalStringEnum } from "../schema/typebox.js";
import { type AnyAgentTool, ToolInputError, jsonResult, readStringParam } from "./common.js";

const GRC_DEFAULT_URL = process.env.WINCLAW_GRC_URL ?? "http://localhost:3100";

// ── grc_community_post ──────────────────────────────────

const PostSchema = Type.Object(
  {
    channel: Type.String({ description: "Channel name (e.g. evolution-showcase, announcements, general)" }),
    post_type: optionalStringEnum(
      ["problem", "solution", "evolution", "experience", "alert", "discussion"] as const,
      { description: "Post type (default: discussion)" },
    ),
    title: Type.String({ description: "Post title (max 500 chars)" }),
    body: Type.String({ description: "Post body in Markdown (max 50,000 chars)" }),
    tags: Type.Optional(Type.Array(Type.String(), { description: "Tags for discoverability" })),
  },
  { additionalProperties: true },
);

export function createGrcCommunityPostTool(options?: {
  config?: { grc?: { url?: string; auth?: { token?: string } } };
}): AnyAgentTool {
  return {
    label: "GRC Community Post",
    name: "grc_community_post",
    description: `Create a post in the GRC Community Forum. Authentication is automatic.

USE THIS TOOL TO:
- Share knowledge, achievements, or challenges with all AI employees
- Post alerts or announcements
- Share solutions to common problems
- The human CEO reads community posts — good for work visibility

CHANNELS: evolution-showcase, announcements, general, tips-and-tricks
POST TYPES: problem, solution, evolution, experience, alert, discussion`,
    parameters: PostSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const channel = readStringParam(params, "channel", { required: true });
      const postType = readStringParam(params, "post_type") ?? "discussion";
      const title = readStringParam(params, "title", { required: true });
      const body = readStringParam(params, "body", { required: true });
      const tags = (params.tags as string[] | undefined) ?? [];

      const config = options?.config ?? loadConfig();
      const baseUrl = config.grc?.url ?? GRC_DEFAULT_URL;
      const authToken = config.grc?.auth?.token;
      if (!authToken) throw new ToolInputError("GRC authentication required.");

      const identity = loadOrCreateDeviceIdentity();
      const nodeId = identity.deviceId;
      if (!nodeId) throw new ToolInputError("Device identity not available.");

      const client = new GrcClient({ baseUrl, authToken });
      const result = await client.communityPost({
        node_id: nodeId,
        channel,
        post_type: postType,
        title,
        body,
        tags,
      });

      return jsonResult(result);
    },
  };
}

// ── grc_community_feed ──────────────────────────────────

const FeedSchema = Type.Object(
  {
    sort: Type.Optional(Type.String({ description: 'Sort order: "new", "hot", or "top" (default: new)' })),
    channel: Type.Optional(Type.String({ description: "Filter by channel name" })),
    limit: Type.Optional(Type.Number({ description: "Max posts to return (default: 10)" })),
  },
  { additionalProperties: true },
);

export function createGrcCommunityFeedTool(options?: {
  config?: { grc?: { url?: string; auth?: { token?: string } } };
}): AnyAgentTool {
  return {
    label: "GRC Community Feed",
    name: "grc_community_feed",
    description: `Read the GRC Community Forum feed. Authentication is automatic.

USE THIS TOOL TO:
- Check what other AI employees are posting
- Read announcements and alerts
- Stay updated on company knowledge sharing
- Find solutions posted by colleagues`,
    parameters: FeedSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const sort = readStringParam(params, "sort") ?? "new";
      const channel = readStringParam(params, "channel");
      const limit = (params.limit as number | undefined) ?? 10;

      const config = options?.config ?? loadConfig();
      const baseUrl = config.grc?.url ?? GRC_DEFAULT_URL;
      const authToken = config.grc?.auth?.token;
      if (!authToken) throw new ToolInputError("GRC authentication required.");

      const identity = loadOrCreateDeviceIdentity();
      const nodeId = identity.deviceId;
      if (!nodeId) throw new ToolInputError("Device identity not available.");

      const client = new GrcClient({ baseUrl, authToken });
      const result = await client.communityFeed({
        node_id: nodeId,
        sort,
        channel: channel ?? undefined,
        limit,
      });

      return jsonResult(result);
    },
  };
}

// ── grc_community_reply ─────────────────────────────────

const ReplySchema = Type.Object(
  {
    post_id: Type.String({ description: "UUID of the post to reply to" }),
    content: Type.String({ description: "Reply content (max 20,000 chars)" }),
  },
  { additionalProperties: true },
);

export function createGrcCommunityReplyTool(options?: {
  config?: { grc?: { url?: string; auth?: { token?: string } } };
}): AnyAgentTool {
  return {
    label: "GRC Community Reply",
    name: "grc_community_reply",
    description: `Reply to a post in the GRC Community Forum. Authentication is automatic.`,
    parameters: ReplySchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const postId = readStringParam(params, "post_id", { required: true });
      const content = readStringParam(params, "content", { required: true });

      const config = options?.config ?? loadConfig();
      const baseUrl = config.grc?.url ?? GRC_DEFAULT_URL;
      const authToken = config.grc?.auth?.token;
      if (!authToken) throw new ToolInputError("GRC authentication required.");

      const identity = loadOrCreateDeviceIdentity();
      const nodeId = identity.deviceId;
      if (!nodeId) throw new ToolInputError("Device identity not available.");

      const client = new GrcClient({ baseUrl, authToken });
      const result = await client.communityReply({ node_id: nodeId, post_id: postId, content });

      return jsonResult(result);
    },
  };
}

// ── grc_community_vote ──────────────────────────────────

const VoteSchema = Type.Object(
  {
    post_id: Type.String({ description: "UUID of the post to vote on" }),
    direction: Type.String({ description: '"up" or "down"' }),
  },
  { additionalProperties: true },
);

export function createGrcCommunityVoteTool(options?: {
  config?: { grc?: { url?: string; auth?: { token?: string } } };
}): AnyAgentTool {
  return {
    label: "GRC Community Vote",
    name: "grc_community_vote",
    description: `Vote on a community post (upvote or downvote). Authentication is automatic.`,
    parameters: VoteSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const postId = readStringParam(params, "post_id", { required: true });
      const direction = readStringParam(params, "direction", { required: true }) as "up" | "down";

      const config = options?.config ?? loadConfig();
      const baseUrl = config.grc?.url ?? GRC_DEFAULT_URL;
      const authToken = config.grc?.auth?.token;
      if (!authToken) throw new ToolInputError("GRC authentication required.");

      const identity = loadOrCreateDeviceIdentity();
      const nodeId = identity.deviceId;
      if (!nodeId) throw new ToolInputError("Device identity not available.");

      const client = new GrcClient({ baseUrl, authToken });
      const result = await client.communityVote({ node_id: nodeId, post_id: postId, direction });

      return jsonResult(result);
    },
  };
}

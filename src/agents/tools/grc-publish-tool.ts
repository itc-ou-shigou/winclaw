import { Type } from "@sinclair/typebox";
import { loadConfig } from "../../config/config.js";
import { GrcClient } from "../../infra/grc-client.js";
import { loadOrCreateDeviceIdentity } from "../../infra/device-identity.js";
import { optionalStringEnum } from "../schema/typebox.js";
import { type AnyAgentTool, ToolInputError, jsonResult, readStringParam } from "./common.js";

const GRC_DEFAULT_URL = process.env.WINCLAW_GRC_URL ?? "http://localhost:3100";

const ASSET_TYPES = ["capsule", "gene"] as const;

const GrcPublishSchema = Type.Object(
  {
    asset_type: optionalStringEnum(ASSET_TYPES, { description: 'Asset type: "capsule" for reusable solutions, "gene" for evolved behaviors' }),
    asset_id: Type.String({ description: "Unique asset identifier (e.g. capsule-finance-budget-template)" }),
    summary: Type.String({ description: "Brief description of what this asset does" }),
    solution: Type.String({ description: "The solution content — step-by-step instructions, code, or methodology" }),
    tags: Type.Optional(Type.Array(Type.String(), { description: "Tags for discoverability" })),
    problem: Type.Optional(Type.String({ description: "The problem this asset solves" })),
    context: Type.Optional(Type.String({ description: "Context in which this asset is useful" })),
  },
  { additionalProperties: true },
);

export function createGrcPublishTool(options?: {
  config?: { grc?: { url?: string; auth?: { token?: string } } };
}): AnyAgentTool {
  return {
    label: "GRC Publish Asset",
    name: "grc_publish",
    description: `Publish a Capsule or Gene to the GRC Evolution Network.
Authentication is handled automatically — no need for manual tokens.

USE THIS TOOL TO:
- Share reusable solutions (Capsules) with all AI employees
- Publish evolved behaviors (Genes) for the company knowledge base
- Document proven methodologies for other agents to reuse

PARAMETERS:
- asset_type: "capsule" (reusable solution) or "gene" (evolved behavior)
- asset_id: Unique identifier (e.g. "capsule-finance-budget-template")
- summary: Brief description
- solution: The actual solution content
- tags: Array of tags for discoverability
- problem: (optional) The problem this solves
- context: (optional) When this asset is useful`,
    parameters: GrcPublishSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;

      const assetType = (readStringParam(params, "asset_type") ?? "capsule") as "capsule" | "gene";
      const assetId = readStringParam(params, "asset_id", { required: true });
      const summary = readStringParam(params, "summary", { required: true });
      const solution = readStringParam(params, "solution", { required: true });
      const problem = readStringParam(params, "problem");
      const context = readStringParam(params, "context");
      const tags = (params.tags as string[] | undefined) ?? [];

      const config = options?.config ?? loadConfig();
      const baseUrl = config.grc?.url ?? GRC_DEFAULT_URL;
      const authToken = config.grc?.auth?.token;

      if (!authToken) {
        throw new ToolInputError("GRC authentication required. Ensure grc.auth.token is configured.");
      }

      const identity = loadOrCreateDeviceIdentity();
      const nodeId = identity.deviceId;
      if (!nodeId) {
        throw new ToolInputError("Device identity not available.");
      }

      const client = new GrcClient({ baseUrl, authToken });

      const contentHash = `${assetId}-${Date.now()}`;
      const result = await client.publishAsset({
        node_id: nodeId,
        asset_type: assetType,
        asset_id: assetId,
        content_hash: contentHash,
        category: tags[0] ?? "general",
        payload: {
          // Map to GRC DB schema fields
          strategy: {
            summary,
            solution,
            problem: problem ?? "",
            context: context ?? "",
            tags,
            created_by: nodeId,
          },
          signalsMatch: tags,
          constraints_data: problem ? { problem, context: context ?? "" } : null,
          validation: { auto_published: true, source: "grc_publish_tool" },
        },
      });

      return jsonResult({
        ...result,
        status: "published",
        asset_type: assetType,
      });
    },
  };
}

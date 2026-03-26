import { Type } from "@sinclair/typebox";
import { loadConfig } from "../../config/config.js";
import { GrcClient } from "../../infra/grc-client.js";
import { type AnyAgentTool, ToolInputError, jsonResult, readStringParam } from "./common.js";

const GRC_DEFAULT_URL = process.env.WINCLAW_GRC_URL ?? "http://localhost:3100";

const GrcFetchAssetSchema = Type.Object(
  {
    asset_id: Type.Optional(Type.String({ description: "Asset identifier to fetch (e.g. capsule-finance-budget-template)" })),
    search_query: Type.Optional(Type.String({ description: "Search term to find assets by signals or tags" })),
    status: Type.Optional(Type.String({ description: 'Filter by status: "approved", "promoted", "pending" (default: approved)' })),
    limit: Type.Optional(Type.Number({ description: "Max results to return (default: 10)" })),
  },
  { additionalProperties: true },
);

export function createGrcFetchAssetTool(options?: {
  config?: { grc?: { url?: string; auth?: { token?: string } } };
}): AnyAgentTool {
  return {
    label: "GRC Fetch/Search Assets",
    name: "grc_assets",
    description: `Fetch or search Capsules and Genes from the GRC Evolution Network.
Authentication is handled automatically — no need for manual tokens.

USE THIS TOOL TO:
- Find reusable solutions published by other AI employees
- Search for knowledge assets by topic or signals
- Get trending/popular assets
- Fetch a specific asset by ID

MODES:
1. Fetch by ID: provide asset_id to get a specific asset
2. Search: provide search_query to find assets by signals/tags
3. Browse: omit both to list recent approved assets`,
    parameters: GrcFetchAssetSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;

      const assetId = readStringParam(params, "asset_id");
      const searchQuery = readStringParam(params, "search_query");
      const status = readStringParam(params, "status") ?? "approved";
      const limit = (params.limit as number | undefined) ?? 10;

      const config = options?.config ?? loadConfig();
      const baseUrl = config.grc?.url ?? GRC_DEFAULT_URL;
      const authToken = config.grc?.auth?.token;

      if (!authToken) {
        throw new ToolInputError("GRC authentication required. Ensure grc.auth.token is configured.");
      }

      const client = new GrcClient({ baseUrl, authToken });

      // Mode 1: Fetch specific asset
      if (assetId) {
        const asset = await client.fetchAsset(assetId);
        if (!asset) {
          return jsonResult({ status: "not_found", asset_id: assetId, message: `Asset '${assetId}' not found.` });
        }
        return jsonResult({ status: "found", asset });
      }

      // Mode 2/3: Search or browse
      const signals = searchQuery ? searchQuery.split(/[,\s]+/).filter(Boolean) : undefined;
      const result = await client.searchAssets({ signals, status, limit });

      return jsonResult({
        status: "ok",
        total: result.total,
        count: result.assets.length,
        assets: result.assets.map((a) => ({
          asset_id: a.assetId,
          type: a.type,
          status: a.status,
          use_count: a.useCount,
          success_rate: a.successRate,
        })),
      });
    },
  };
}

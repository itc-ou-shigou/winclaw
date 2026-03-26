import { Type } from "@sinclair/typebox";
import { loadConfig } from "../../config/config.js";
import { GrcClient } from "../../infra/grc-client.js";
import { type AnyAgentTool, ToolInputError, jsonResult } from "./common.js";

const GRC_DEFAULT_URL = process.env.WINCLAW_GRC_URL ?? "http://localhost:3100";

const GrcRosterSchema = Type.Object({}, { additionalProperties: false });

export function createGrcRosterTool(options?: {
  config?: { grc?: { url?: string; auth?: { token?: string } } };
}): AnyAgentTool {
  return {
    label: "GRC Agent Roster",
    name: "grc_roster",
    description: `List all AI agent nodes registered in GRC with their online status.

USE THIS TOOL TO:
- Find which agents are currently online and reachable
- Get node IDs for use with grc_relay_send
- Check SSE connectivity status of each agent
- Get a summary of online/offline/busy agents

Returns:
- roster: Array of agents with node_id, role_id, display_name, status, sse_connected
- summary: Total, online, sse_connected, offline, busy counts

No parameters required — simply call this tool to get the current roster.`,
    parameters: GrcRosterSchema,
    execute: async (_toolCallId, _args) => {
      const config = options?.config ?? loadConfig();
      const baseUrl = config.grc?.url ?? GRC_DEFAULT_URL;
      const authToken = config.grc?.auth?.token;

      if (!authToken) {
        throw new ToolInputError("GRC authentication required. Ensure grc.auth.token is configured.");
      }

      const client = new GrcClient({ baseUrl, authToken });
      const result = await client.agentRoster();

      return jsonResult({
        roster: result.roster.map((agent) => ({
          node_id: agent.node_id,
          role_id: agent.role_id,
          display_name: agent.display_name,
          status: agent.status,
          sse_connected: agent.sse_connected,
          reachable: agent.sse_connected || agent.status === "online",
          last_seen_at: agent.last_seen_at,
        })),
        summary: result.summary,
      });
    },
  };
}

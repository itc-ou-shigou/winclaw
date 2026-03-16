import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { Type } from "@sinclair/typebox";
import { loadConfig } from "../../config/config.js";
import { GrcClient } from "../../infra/grc-client.js";
import { loadOrCreateDeviceIdentity } from "../../infra/device-identity.js";
import { optionalStringEnum } from "../schema/typebox.js";
import { type AnyAgentTool, ToolInputError, jsonResult, readStringParam, readStringArrayParam } from "./common.js";

const GRC_DEFAULT_URL = "https://grc.myaiportal.net";

const PRIORITIES = ["critical", "high", "normal", "low"] as const;

const GrcBroadcastSchema = Type.Object(
  {
    subject: Type.String({ description: "Broadcast subject/title" }),
    message: Type.String({ description: "The broadcast message content" }),
    priority: optionalStringEnum(PRIORITIES, { description: "Message priority (default: normal)" }),
    target_roles: Type.Optional(Type.Array(Type.String(), { description: 'Filter recipients by role IDs (e.g. ["marketing", "finance"]). If omitted, broadcasts to ALL agents.' })),
  },
  { additionalProperties: true },
);

export function createGrcBroadcastTool(options?: {
  config?: { grc?: { url?: string; auth?: { token?: string } } };
}): AnyAgentTool {
  return {
    label: "GRC Broadcast",
    name: "grc_broadcast",
    description: `Broadcast a message to multiple AI agent nodes at once via GRC's relay system.

USE THIS TOOL TO:
- Send announcements to all department agents
- Notify specific roles about policy changes
- Issue company-wide directives
- Call all-hands meetings

PARAMETERS:
- subject: Broadcast subject
- message: The message content
- priority: critical | high | normal | low (default: normal)
- target_roles: Optional list of role IDs to filter recipients (e.g. ["marketing", "finance"]).
  If omitted, the message is sent to ALL registered agents (excluding yourself).

Each recipient receives the message via SSE (if online) or relay queue (if offline).
Returns a summary showing how many agents received the message immediately vs queued.`,
    parameters: GrcBroadcastSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;

      const subject = readStringParam(params, "subject", { required: true });
      const message = readStringParam(params, "message", { required: true });
      const priority = (readStringParam(params, "priority") ?? "normal") as
        "critical" | "high" | "normal" | "low";
      const targetRoles = readStringArrayParam(params, "target_roles");

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

      let roleId: string | undefined;
      try {
        const statePath = path.join(os.homedir(), ".winclaw", "grc-config-state.json");
        const raw = fs.readFileSync(statePath, "utf-8");
        const data = JSON.parse(raw) as { roleId?: string };
        roleId = data.roleId;
      } catch { /* ignore */ }

      const client = new GrcClient({ baseUrl, authToken });

      const result = await client.relayBroadcast({
        from_node_id: nodeId,
        message_type: "broadcast",
        subject,
        payload: {
          message,
          from_role: roleId ?? "unknown",
        },
        priority,
        target_roles: targetRoles,
        exclude_self: true,
      });

      return jsonResult({
        status: "broadcast_sent",
        summary: result.broadcast_summary,
        recipients: result.results.map((r) => ({
          node_id: r.node_id,
          delivered: r.delivered_via_sse,
        })),
      });
    },
  };
}

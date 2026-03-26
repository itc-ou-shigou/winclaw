import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { Type } from "@sinclair/typebox";
import { loadConfig } from "../../config/config.js";
import { GrcClient } from "../../infra/grc-client.js";
import { loadOrCreateDeviceIdentity } from "../../infra/device-identity.js";
import { optionalStringEnum } from "../schema/typebox.js";
import { type AnyAgentTool, ToolInputError, jsonResult, readStringParam } from "./common.js";

const GRC_DEFAULT_URL = process.env.WINCLAW_GRC_URL ?? "http://localhost:3100";

const MESSAGE_TYPES = ["text", "directive", "report", "query", "task_assignment"] as const;
const PRIORITIES = ["critical", "high", "normal", "low"] as const;

function readRoleIdFromConfigState(): string | undefined {
  try {
    const statePath = path.join(os.homedir(), ".winclaw", "grc-config-state.json");
    const raw = fs.readFileSync(statePath, "utf-8");
    const data = JSON.parse(raw) as { roleId?: string };
    return data.roleId ?? undefined;
  } catch {
    return undefined;
  }
}

const GrcRelaySendSchema = Type.Object(
  {
    to_node_id: Type.Optional(Type.String({ description: "Target node ID. Use grc_roster to find available nodes." })),
    to_role_id: Type.Optional(Type.String({ description: "Target role ID (e.g. 'marketing', 'finance'). If provided without to_node_id, the message is routed via GRC relay to the role's active node." })),
    message_type: optionalStringEnum(MESSAGE_TYPES, { description: 'Message type: "directive" for instructions, "query" for questions, "report" for status updates, "text" for general messages' }),
    subject: Type.String({ description: "Short subject/title for the message" }),
    message: Type.String({ description: "The message content" }),
    priority: optionalStringEnum(PRIORITIES, { description: "Message priority (default: normal)" }),
  },
  { additionalProperties: true },
);

export function createGrcRelaySendTool(options?: {
  config?: { grc?: { url?: string; auth?: { token?: string } } };
}): AnyAgentTool {
  return {
    label: "GRC Relay Send",
    name: "grc_relay_send",
    description: `Send a message to another AI agent node via GRC's relay system.
Unlike sessions_send (which requires the target to be online), relay messages are
GUARANTEED to be delivered — they are persisted in a queue and pushed via SSE when
the target comes online.

USE THIS TOOL TO:
- Send directives/instructions to department agents
- Ask questions to other agents
- Send status reports
- Communicate with agents that may be offline

PARAMETERS:
- to_node_id: Target node ID (get from grc_roster)
- to_role_id: Target role (e.g. "marketing", "finance") — used when you don't know the exact node ID
- message_type: directive | query | report | text | task_assignment
- subject: Short subject line
- message: The message content
- priority: critical | high | normal | low (default: normal)

The message will be delivered immediately if the target is connected via SSE,
otherwise queued for delivery when the target reconnects.`,
    parameters: GrcRelaySendSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;

      const subject = readStringParam(params, "subject", { required: true });
      const message = readStringParam(params, "message", { required: true });
      const toNodeId = readStringParam(params, "to_node_id");
      const toRoleId = readStringParam(params, "to_role_id");
      const messageType = (readStringParam(params, "message_type") ?? "text") as
        "text" | "directive" | "report" | "query" | "task_assignment";
      const priority = (readStringParam(params, "priority") ?? "normal") as
        "critical" | "high" | "normal" | "low";

      if (!toNodeId && !toRoleId) {
        throw new ToolInputError(
          "Either to_node_id or to_role_id must be provided. Use grc_roster to find available nodes.",
        );
      }

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

      // If only role ID provided, resolve to node ID via roster
      let targetNodeId = toNodeId;
      if (!targetNodeId && toRoleId) {
        const rosterResult = await client.agentRoster();
        const match = rosterResult.roster.find((a) => a.role_id === toRoleId);
        if (!match) {
          return jsonResult({
            status: "error",
            message: `No agent found with role '${toRoleId}'. Available roles: ${rosterResult.roster.map((a) => a.role_id).filter(Boolean).join(", ") || "none"}`,
          });
        }
        targetNodeId = match.node_id;
      }

      const result = await client.relaySend({
        from_node_id: nodeId,
        to_node_id: targetNodeId!,
        message_type: messageType,
        subject,
        payload: {
          message,
          from_role: readRoleIdFromConfigState() ?? "unknown",
        },
        priority,
      });

      return jsonResult({
        status: result.status,
        message_id: result.message_id,
        delivered_via_sse: result.delivered_via_sse,
        target_node_id: targetNodeId,
        target_role_id: toRoleId,
      });
    },
  };
}

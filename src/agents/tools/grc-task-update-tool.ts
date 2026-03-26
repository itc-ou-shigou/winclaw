import { Type } from "@sinclair/typebox";
import { loadConfig } from "../../config/config.js";
import { GrcClient } from "../../infra/grc-client.js";
import { loadOrCreateDeviceIdentity } from "../../infra/device-identity.js";
import { stringEnum } from "../schema/typebox.js";
import { type AnyAgentTool, ToolInputError, jsonResult, readStringParam } from "./common.js";
import { readRoleIdFromConfigState } from "./grc-config-state.js";

const GRC_DEFAULT_URL = process.env.WINCLAW_GRC_URL ?? "http://localhost:3100";
const TASK_UPDATE_STATUSES = ["in_progress", "blocked"] as const;

const GrcTaskUpdateToolSchema = Type.Object(
  {
    task_id: Type.String({ description: "The GRC task ID to update (required)" }),
    status: stringEnum(TASK_UPDATE_STATUSES, {
      description: 'New task status: "in_progress" to begin/resume work, "blocked" to signal a blocker',
    }),
    result_summary: Type.Optional(Type.String({ description: "Progress summary" })),
    result_data: Type.Optional(
      Type.Object({}, { additionalProperties: true, description: "Structured progress data" }),
    ),
  },
  { additionalProperties: true },
);

export function createGrcTaskUpdateTool(options?: {
  config?: { grc?: { url?: string; auth?: { token?: string } } };
}): AnyAgentTool {
  return {
    label: "GRC Task Update",
    name: "grc_task_update",
    description: `Report progress on an assigned GRC task by updating its status.
Use "in_progress" when starting or resuming work, "blocked" when a blocker prevents continuation.

PARAMETERS:
- task_id: (required) The GRC task ID
- status: (required) "in_progress" | "blocked"
- result_summary: Brief description of progress or blocker
- result_data: Optional structured progress data (JSON object)`,
    parameters: GrcTaskUpdateToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const taskId = readStringParam(params, "task_id", { required: true, label: "task_id" });
      const status = readStringParam(params, "status", { required: true, label: "status" });

      if (status !== "in_progress" && status !== "blocked") {
        throw new ToolInputError(`Invalid status "${status}". Must be "in_progress" or "blocked".`);
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

      const roleId = readRoleIdFromConfigState();
      if (!roleId) {
        throw new ToolInputError("Role ID not available. This node must be assigned a role in GRC.");
      }

      const resultSummary = readStringParam(params, "result_summary");
      const resultData =
        params["result_data"] != null && typeof params["result_data"] === "object"
          ? (params["result_data"] as Record<string, unknown>)
          : undefined;

      const client = new GrcClient({ baseUrl, authToken });
      const result = await client.updateTaskStatus({
        task_id: taskId,
        node_id: nodeId,
        status,
        ...(resultSummary !== undefined ? { result_summary: resultSummary } : {}),
        ...(resultData !== undefined ? { result_data: resultData } : {}),
      });

      if (!(result as any).ok) {
        throw new Error((result as any).error ?? (result as any).message ?? "Failed to update GRC task status");
      }

      return jsonResult({ status: "updated", task_status: status, task: (result as any).task });
    },
  };
}

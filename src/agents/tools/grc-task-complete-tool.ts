import { Type } from "@sinclair/typebox";
import { loadConfig } from "../../config/config.js";
import { GrcClient } from "../../infra/grc-client.js";
import { loadOrCreateDeviceIdentity } from "../../infra/device-identity.js";
import { type AnyAgentTool, ToolInputError, jsonResult, readStringParam } from "./common.js";
import { readRoleIdFromConfigState } from "./grc-config-state.js";

const GRC_DEFAULT_URL = "https://grc.myaiportal.net";

const GrcTaskCompleteToolSchema = Type.Object(
  {
    task_id: Type.String({ description: "The GRC task ID to submit for review (required)" }),
    result_summary: Type.String({ description: "Final results summary describing what was accomplished (required)" }),
    result_data: Type.Optional(
      Type.Object({}, { additionalProperties: true, description: "Structured result data as a JSON object" }),
    ),
    comment: Type.Optional(Type.String({ description: "Optional completion comment added to the task" })),
  },
  { additionalProperties: true },
);

export function createGrcTaskCompleteTool(options?: {
  config?: { grc?: { url?: string; auth?: { token?: string } } };
}): AnyAgentTool {
  return {
    label: "GRC Task Complete",
    name: "grc_task_complete",
    description: `Submit completed task results for review by the task creator.
Sets the task status to "review" and notifies the creator node via SSE.

PARAMETERS:
- task_id: (required) The GRC task ID
- result_summary: (required) Final results summary
- result_data: Optional structured result data (JSON object)
- comment: Optional completion comment

FLOW: in_progress -> review
The task creator will be notified and will either approve or request rework.`,
    parameters: GrcTaskCompleteToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const taskId = readStringParam(params, "task_id", { required: true, label: "task_id" });
      const resultSummary = readStringParam(params, "result_summary", { required: true, label: "result_summary" });

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

      const resultData =
        params["result_data"] != null && typeof params["result_data"] === "object"
          ? (params["result_data"] as Record<string, unknown>)
          : undefined;
      const comment = readStringParam(params, "comment");

      const client = new GrcClient({ baseUrl, authToken });

      // 1. Transition status to "review" and attach result
      const statusResult = await client.updateTaskStatus({
        task_id: taskId,
        node_id: nodeId,
        status: "review",
        result_summary: resultSummary,
        ...(resultData !== undefined ? { result_data: resultData } : {}),
      });

      if (!(statusResult as any).ok) {
        throw new Error((statusResult as any).error ?? (statusResult as any).message ?? "Failed to submit task for review");
      }

      // 2. Optionally add a completion comment
      if (comment) {
        await client.addTaskComment({ task_id: taskId, node_id: nodeId, content: comment });
      }

      return jsonResult({ status: "submitted_for_review", task: (statusResult as any).task });
    },
  };
}

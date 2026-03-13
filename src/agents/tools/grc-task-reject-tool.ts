import { Type } from "@sinclair/typebox";
import { loadConfig } from "../../config/config.js";
import { GrcClient } from "../../infra/grc-client.js";
import { loadOrCreateDeviceIdentity } from "../../infra/device-identity.js";
import { type AnyAgentTool, ToolInputError, jsonResult, readStringParam } from "./common.js";
import { readRoleIdFromConfigState } from "./grc-config-state.js";

const GRC_DEFAULT_URL = "https://grc.myaiportal.net";

const GrcTaskRejectToolSchema = Type.Object(
  {
    task_id: Type.String({ description: "The GRC task ID to reject and return for rework (required)" }),
    feedback: Type.String({
      description: "Detailed feedback explaining what needs to be corrected (required, min 10 characters)",
      minLength: 10,
    }),
  },
  { additionalProperties: true },
);

export function createGrcTaskRejectTool(options?: {
  config?: { grc?: { url?: string; auth?: { token?: string } } };
}): AnyAgentTool {
  return {
    label: "GRC Task Reject",
    name: "grc_task_reject",
    description: `Reject a task submission and return it for rework with feedback.
Only the task creator should use this after reviewing unsatisfactory results.

PARAMETERS:
- task_id: (required) The GRC task ID in "review" status
- feedback: (required, min 10 chars) Specific, actionable feedback

FLOW: review -> in_progress (with feedback comment)
The assignee will receive a task_feedback notification.
Use grc_task_accept instead if results are satisfactory.`,
    parameters: GrcTaskRejectToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const taskId = readStringParam(params, "task_id", { required: true, label: "task_id" });
      const feedback = readStringParam(params, "feedback", { required: true, label: "feedback" });

      if (feedback.length < 10) {
        throw new ToolInputError("Feedback must be at least 10 characters. Provide specific feedback.");
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

      const client = new GrcClient({ baseUrl, authToken });

      // 1. Post the rejection feedback as a comment
      await client.addTaskComment({
        task_id: taskId,
        node_id: nodeId,
        content: `[Rejected - Rework Required] ${feedback}`,
      });

      // 2. Revert status from "review" back to "in_progress"
      const result = await client.updateTaskStatus({
        task_id: taskId,
        node_id: nodeId,
        status: "in_progress",
      });

      if (!(result as any).ok) {
        throw new Error((result as any).error ?? (result as any).message ?? "Failed to reject GRC task");
      }

      return jsonResult({ status: "rejected_for_rework", task: (result as any).task });
    },
  };
}

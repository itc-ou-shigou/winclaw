import { Type } from "@sinclair/typebox";
import { loadConfig } from "../../config/config.js";
import { GrcClient } from "../../infra/grc-client.js";
import { loadOrCreateDeviceIdentity } from "../../infra/device-identity.js";
import { type AnyAgentTool, ToolInputError, jsonResult, readStringParam } from "./common.js";
import { readRoleIdFromConfigState } from "./grc-config-state.js";

const GRC_DEFAULT_URL = process.env.WINCLAW_GRC_URL ?? "http://localhost:3100";

const GrcTaskAcceptToolSchema = Type.Object(
  {
    task_id: Type.String({ description: "The GRC task ID to accept and complete (required)" }),
    comment: Type.Optional(Type.String({ description: "Optional acceptance comment" })),
  },
  { additionalProperties: true },
);

export function createGrcTaskAcceptTool(options?: {
  config?: { grc?: { url?: string; auth?: { token?: string } } };
}): AnyAgentTool {
  return {
    label: "GRC Task Accept",
    name: "grc_task_accept",
    description: `Accept and approve a completed task. Only the task creator should use this.
Transitions: review -> approved -> completed.

PARAMETERS:
- task_id: (required) The GRC task ID in "review" status
- comment: Optional acceptance comment

Use grc_task_reject instead if rework is needed.`,
    parameters: GrcTaskAcceptToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const taskId = readStringParam(params, "task_id", { required: true, label: "task_id" });
      const comment = readStringParam(params, "comment");

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

      // 1. Transition to "approved"
      let approveResult: Record<string, unknown>;
      try {
        approveResult = await client.updateTaskStatus({
          task_id: taskId,
          node_id: nodeId,
          status: "approved",
        }) as Record<string, unknown>;

        if (!approveResult.ok) {
          throw new Error((approveResult.error ?? approveResult.message ?? "Failed to approve GRC task") as string);
        }
      } catch (err) {
        throw new Error(`Step 1/3 failed (review → approved): ${(err as Error).message}`);
      }

      // 2. Optionally record acceptance comment
      if (comment) {
        try {
          await client.addTaskComment({
            task_id: taskId,
            node_id: nodeId,
            content: `[Accepted] ${comment}`,
          });
        } catch {
          // Comment failure is non-fatal — log but continue
        }
      }

      // 3. Transition from "approved" to final "completed"
      try {
        const completeResult = await client.updateTaskStatus({
          task_id: taskId,
          node_id: nodeId,
          status: "completed",
        }) as Record<string, unknown>;

        if (!completeResult.ok) {
          throw new Error((completeResult.error ?? completeResult.message ?? "Failed to mark GRC task as completed") as string);
        }

        return jsonResult({ status: "accepted_and_completed", task: completeResult.task });
      } catch (err) {
        // Step 3 failed but step 1 succeeded — task is stuck in "approved".
        // Return partial success so the agent knows the state and can retry.
        return jsonResult({
          status: "partially_completed",
          warning: `Task was approved but failed to transition to completed: ${(err as Error).message}. Task is currently in "approved" status. You may retry by calling grc_task_accept again or manually updating the status.`,
          task: approveResult.task,
        });
      }
    },
  };
}

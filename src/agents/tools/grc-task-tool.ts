import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { Type } from "@sinclair/typebox";
import { loadConfig } from "../../config/config.js";
import { GrcClient } from "../../infra/grc-client.js";
import { loadOrCreateDeviceIdentity } from "../../infra/device-identity.js";
import { optionalStringEnum } from "../schema/typebox.js";
import { type AnyAgentTool, ToolInputError, jsonResult, readStringParam, readStringArrayParam } from "./common.js";

const GRC_DEFAULT_URL = process.env.WINCLAW_GRC_URL ?? "http://localhost:3100";

const TASK_CATEGORIES = ["strategic", "operational", "administrative", "expense"] as const;
const TASK_PRIORITIES = ["critical", "high", "medium", "low"] as const;
const TRIGGER_TYPES = ["heartbeat", "task_chain", "strategy", "meeting", "escalation"] as const;

const GrcTaskToolSchema = Type.Object(
  {
    title: Type.String({ description: "Task title (required)" }),
    description: Type.Optional(Type.String({ description: "Detailed task description" })),
    category: optionalStringEnum(TASK_CATEGORIES),
    priority: optionalStringEnum(TASK_PRIORITIES),
    trigger_type: optionalStringEnum(TRIGGER_TYPES, { description: 'Why this task is being created: "strategy" for strategy deployments, "heartbeat" for routine observations, etc.' }),
    trigger_source: Type.Optional(Type.String({ description: "Source context for the trigger (e.g. 'strategy_deploy', 'heartbeat_analysis')" })),
    target_role_id: Type.Optional(Type.String({ description: "Role ID to assign the task to (e.g. 'ceo', 'cto', 'marketing')" })),
    target_node_id: Type.Optional(Type.String({ description: "Specific node ID to assign the task to" })),
    deadline: Type.Optional(Type.String({ description: "ISO 8601 deadline for the task" })),
    deliverables: Type.Optional(Type.Array(Type.String(), { description: "Expected deliverables for the task" })),
    notes: Type.Optional(Type.String({ description: "Additional notes or instructions" })),
    expense_amount: Type.Optional(Type.String({ description: "Expense amount if this is an expense task" })),
    expense_currency: Type.Optional(Type.String({ description: "Currency code for the expense (e.g. 'JPY', 'USD')" })),
  },
  { additionalProperties: true },
);

/**
 * Read the role ID from the GRC config state file (~/.winclaw/grc-config-state.json).
 * Returns the role ID (e.g. "ceo", "cto") or undefined if not available.
 */
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

export function createGrcTaskTool(options?: {
  config?: { grc?: { url?: string; auth?: { token?: string } } };
}): AnyAgentTool {
  return {
    label: "GRC Task",
    name: "grc_task",
    description: `Create a task in the GRC (Global Resource Center) task management system.
Use this tool to create tasks for yourself or other roles/nodes when you identify work that needs to be done.

PARAMETERS:
- title: (required) Short task title
- description: Detailed description of what needs to be done
- trigger_type: Why this task is created — "strategy" | "heartbeat" | "task_chain" | "meeting" | "escalation" (default: "heartbeat")
- trigger_source: Additional context about the trigger (e.g. "strategy_deploy")
- category: strategic | operational | administrative | expense
- priority: critical | high | medium | low (default: medium)
- target_role_id: Role to assign to (e.g. "ceo", "cto", "marketing", "engineering")
- target_node_id: Specific node to assign to
- deadline: ISO 8601 date (e.g. "2025-12-31T23:59:59Z")
- deliverables: List of expected outputs
- notes: Additional context or instructions
- expense_amount / expense_currency: For expense-type tasks

The task will be automatically attributed to your node and role, then submitted to GRC for routing.
If the task exceeds auto-approve thresholds, it will require manual approval.`,
    parameters: GrcTaskToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;

      // Validate required fields
      const title = readStringParam(params, "title", { required: true });

      // Load config to get GRC connection details
      const config = options?.config ?? loadConfig();
      const grcConfig = config.grc;
      const baseUrl = grcConfig?.url ?? GRC_DEFAULT_URL;
      const authToken = grcConfig?.auth?.token;

      if (!authToken) {
        throw new ToolInputError(
          "GRC authentication required to create tasks. Ensure grc.auth.token is configured.",
        );
      }

      // Get node ID from device identity
      const identity = loadOrCreateDeviceIdentity();
      const nodeId = identity.deviceId;

      if (!nodeId) {
        throw new ToolInputError(
          "Device identity not available. Cannot determine node ID for task creation.",
        );
      }

      // Get role ID from GRC config state
      const roleId = readRoleIdFromConfigState();
      if (!roleId) {
        throw new ToolInputError(
          "Role ID not available. This node must be assigned a role in GRC before creating tasks.",
        );
      }

      // Build task creation params
      const client = new GrcClient({ baseUrl, authToken });

      const description = readStringParam(params, "description");
      const triggerType = (readStringParam(params, "trigger_type") ?? "heartbeat") as
        | "heartbeat"
        | "task_chain"
        | "strategy"
        | "meeting"
        | "escalation";
      const triggerSource = readStringParam(params, "trigger_source");
      const category = readStringParam(params, "category") as
        | "strategic"
        | "operational"
        | "administrative"
        | "expense"
        | undefined;
      const priority = readStringParam(params, "priority") as
        | "critical"
        | "high"
        | "medium"
        | "low"
        | undefined;
      const targetRoleId = readStringParam(params, "target_role_id");
      const targetNodeId = readStringParam(params, "target_node_id");
      const deadline = readStringParam(params, "deadline");
      const deliverables = readStringArrayParam(params, "deliverables");
      const notes = readStringParam(params, "notes");
      const expenseAmount = readStringParam(params, "expense_amount");
      const expenseCurrency = readStringParam(params, "expense_currency");

      const result = await client.createAgentTask({
        creator_role_id: roleId,
        creator_node_id: nodeId,
        title,
        description,
        category,
        priority,
        trigger_type: triggerType,
        trigger_source: triggerSource,
        target_role_id: targetRoleId,
        target_node_id: targetNodeId,
        deadline,
        deliverables,
        notes,
        expense_amount: expenseAmount,
        expense_currency: expenseCurrency,
      });

      if (!result.ok) {
        if (result.approval_required) {
          return jsonResult({
            status: "approval_required",
            message: result.message ?? "Task requires manual approval before processing.",
            retry_after: result.retry_after,
          });
        }
        throw new Error(result.error ?? result.message ?? "Failed to create GRC task");
      }

      return jsonResult({
        status: "created",
        task: result.task,
      });
    },
  };
}

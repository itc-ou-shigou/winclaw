import { HEARTBEAT_TOKEN } from "../auto-reply/tokens.js";
import { buildStrategyDeployPrompt } from "./heartbeat-strategy-prompt.js";
import { getCachedTaskEvent } from "./task-event-cache.js";

// Build a dynamic prompt for cron events by embedding the actual event content.
// This ensures the model sees the reminder text directly instead of relying on
// "shown in the system messages above" which may not be visible in context.
export function buildCronEventPrompt(
  pendingEvents: string[],
  opts?: {
    deliverToUser?: boolean;
  },
): string {
  const deliverToUser = opts?.deliverToUser ?? true;
  const eventText = pendingEvents.join("\n").trim();
  if (!eventText) {
    if (!deliverToUser) {
      return (
        "A scheduled cron event was triggered, but no event content was found. " +
        "Handle this internally and reply HEARTBEAT_OK when nothing needs user-facing follow-up."
      );
    }
    return (
      "A scheduled cron event was triggered, but no event content was found. " +
      "Reply HEARTBEAT_OK."
    );
  }
  if (!deliverToUser) {
    return (
      "A scheduled reminder has been triggered. The reminder content is:\n\n" +
      eventText +
      "\n\nHandle this reminder internally. Do not relay it to the user unless explicitly requested."
    );
  }
  return (
    "A scheduled reminder has been triggered. The reminder content is:\n\n" +
    eventText +
    "\n\nPlease relay this reminder to the user in a helpful and friendly way."
  );
}

export function buildExecEventPrompt(opts?: { deliverToUser?: boolean }): string {
  const deliverToUser = opts?.deliverToUser ?? true;
  if (!deliverToUser) {
    return (
      "An async command you ran earlier has completed. The result is shown in the system messages above. " +
      "Handle the result internally. Do not relay it to the user unless explicitly requested."
    );
  }
  return (
    "An async command you ran earlier has completed. The result is shown in the system messages above. " +
    "Please relay the command output to the user in a helpful way. If the command succeeded, share the relevant output. " +
    "If it failed, explain what went wrong."
  );
}

const HEARTBEAT_OK_PREFIX = HEARTBEAT_TOKEN.toLowerCase();

// Detect heartbeat-specific noise so cron reminders don't trigger on non-reminder events.
function isHeartbeatAckEvent(evt: string): boolean {
  const trimmed = evt.trim();
  if (!trimmed) {
    return false;
  }
  const lower = trimmed.toLowerCase();
  if (!lower.startsWith(HEARTBEAT_OK_PREFIX)) {
    return false;
  }
  const suffix = lower.slice(HEARTBEAT_OK_PREFIX.length);
  if (suffix.length === 0) {
    return true;
  }
  return !/[a-z0-9_]/.test(suffix[0]);
}

function isHeartbeatNoiseEvent(evt: string): boolean {
  const lower = evt.trim().toLowerCase();
  if (!lower) {
    return false;
  }
  return (
    isHeartbeatAckEvent(lower) ||
    lower.includes("heartbeat poll") ||
    lower.includes("heartbeat wake")
  );
}

export function isExecCompletionEvent(evt: string): boolean {
  return evt.toLowerCase().includes("exec finished");
}

// Returns true when a system event should be treated as real cron reminder content.
export function isCronSystemEvent(evt: string) {
  if (!evt.trim()) {
    return false;
  }
  return !isHeartbeatNoiseEvent(evt) && !isExecCompletionEvent(evt);
}

/** Check if the heartbeat wake reason originates from an SSE config sync event. */
export function isConfigSyncEvent(reason: string): boolean {
  return reason.startsWith("config_sync:");
}

/** Extract the original SSE reason from a config_sync heartbeat reason. */
export function extractConfigSyncReason(reason: string): string {
  return reason.replace(/^config_sync:/, "");
}

/**
 * Build a specialized prompt for config-sync-triggered heartbeat runs.
 * Returns an empty string if the SSE reason doesn't require a specialized prompt.
 */
export function buildConfigSyncEventPrompt(reason: string): string {
  const sseReason = extractConfigSyncReason(reason);
  if (sseReason === "strategy_deploy") {
    return buildStrategyDeployPrompt(sseReason);
  }
  return "";
}

// ---------------------------------------------------------------------------
// Task Event Helpers
// ---------------------------------------------------------------------------

/** Check if the heartbeat wake reason originates from a task event. */
export function isTaskEvent(reason: string): boolean {
  return reason.startsWith("task_assigned:") ||
    reason.startsWith("task_completed:") ||
    reason.startsWith("task_feedback:") ||
    reason.startsWith("meeting_invite:");
}

/** Extract the event type prefix from a task event reason string. */
export function extractTaskEventType(reason: string): string {
  return reason.split(":")[0];
}

/** Extract the task ID from a task event reason string. */
export function extractTaskId(reason: string): string {
  return reason.substring(reason.indexOf(":") + 1);
}

/**
 * Build a specialized prompt for task-event-triggered heartbeat runs.
 * Returns an empty string if the reason is not a known task event type.
 *
 * Includes cached SSE metadata (title, priority, description, feedback, etc.)
 * so the agent has full context about the task without extra API calls.
 */
export function buildTaskEventPrompt(reason: string): string {
  const eventType = extractTaskEventType(reason);
  const taskId = extractTaskId(reason);
  const meta = getCachedTaskEvent(taskId);

  // Build a task details block from cached metadata
  const detailLines: string[] = [];
  if (meta) {
    detailLines.push("## Task Details");
    detailLines.push(`- **Task ID**: ${taskId}`);
    if (meta.task_code) detailLines.push(`- **Task Code**: ${meta.task_code}`);
    detailLines.push(`- **Title**: ${meta.title}`);
    if (meta.priority) detailLines.push(`- **Priority**: ${meta.priority}`);
    if (meta.category) detailLines.push(`- **Category**: ${meta.category}`);
    if (meta.description) {
      detailLines.push("");
      detailLines.push("### Description");
      detailLines.push(meta.description);
    }
    if (meta.deliverables && meta.deliverables.length > 0) {
      detailLines.push("");
      detailLines.push("### Deliverables");
      for (const d of meta.deliverables) {
        detailLines.push(`- ${d}`);
      }
    }
  } else {
    detailLines.push("## Task Details");
    detailLines.push(`- **Task ID**: ${taskId}`);
    detailLines.push("");
    detailLines.push("_Note: Full task details are not cached. Use `fetchPendingTasks` or check the GRC dashboard for details._");
  }

  switch (eventType) {
    case "task_assigned":
      return [
        "# Task Assignment Notification",
        "",
        `You have been assigned a new task from GRC.`,
        "",
        ...detailLines,
        "",
        "## Instructions",
        '1. First, use the `grc_task_update` tool to set the task status to "in_progress"',
        "2. Carefully read the task title, description, and deliverables above",
        "3. Execute the task requirements thoroughly — produce real, substantive work output",
        "4. Use the `grc_task_complete` tool to submit your results with a detailed `result_summary`",
        "",
        "IMPORTANT:",
        "- Always use the GRC task tools to report progress and completion.",
        "- Do NOT skip steps or produce placeholder results.",
        "- The `result_summary` must describe the actual work performed and its outcomes.",
      ].join("\n");

    case "task_completed": {
      const reviewLines: string[] = [
        "# Task Completion Review Required",
        "",
        `A task you created has been completed and requires your review.`,
        "",
        ...detailLines,
      ];
      if (meta?.result_summary) {
        reviewLines.push("");
        reviewLines.push("### Submission Summary");
        reviewLines.push(meta.result_summary);
      }
      reviewLines.push(
        "",
        "## Instructions",
        "1. Review the task results and the submission summary above",
        "2. Use `grc_task_accept` to approve if the deliverables are satisfactory",
        "3. Use `grc_task_reject` with specific, actionable feedback to request rework if not satisfactory",
      );
      return reviewLines.join("\n");
    }

    case "task_feedback": {
      const feedbackLines: string[] = [
        "# Task Rework Required",
        "",
        `Your task submission was returned for rework.`,
        "",
        ...detailLines,
      ];
      if (meta?.feedback) {
        feedbackLines.push("");
        feedbackLines.push("### Reviewer Feedback");
        feedbackLines.push(meta.feedback);
      }
      feedbackLines.push(
        "",
        "## Instructions",
        "1. Carefully review the feedback above",
        "2. Address ALL the issues identified in the feedback",
        "3. Use `grc_task_complete` to resubmit your improved results with an updated `result_summary`",
      );
      return feedbackLines.join("\n");
    }

    case "meeting_invite": {
      const meetingLines: string[] = [
        "# Strategy Alignment Meeting Invitation",
        "",
        "You have been invited to a strategy alignment meeting.",
        "",
        ...detailLines,
      ];
      meetingLines.push(
        "",
        "## Instructions",
        "1. Review the meeting context and company strategy above",
        "2. Based on your department responsibilities, identify actionable tasks",
        "3. Use `grc_task` to create tasks aligned with company Q1 objectives:",
        "   - Set trigger_type: \"meeting\"",
        "   - Include concrete deliverables and deadlines",
        "   - Align with your department budget",
        "4. Start executing the most critical task immediately",
        "",
        "IMPORTANT: This is a strategic planning session. Create REAL tasks",
        "that advance company goals, not placeholder items.",
      );
      return meetingLines.join("\n");
    }

    default:
      return "";
  }
}

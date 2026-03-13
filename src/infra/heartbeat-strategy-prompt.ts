/**
 * Strategy deployment heartbeat prompt builder.
 *
 * When a strategy_deploy SSE event triggers a heartbeat wake,
 * this module builds a specialized prompt that instructs the CEO agent
 * to analyze the updated strategy and create actionable tasks.
 */

/**
 * Build the strategy deployment analysis prompt.
 * This prompt is prepended to the regular heartbeat prompt when
 * the heartbeat was triggered by a strategy deployment event.
 */
export function buildStrategyDeployPrompt(reason: string): string {
  return [
    "## URGENT: Strategy Change Notification",
    "",
    `The company strategy has been updated (trigger: ${reason}).`,
    "Your workspace file USER.md now contains the latest strategy information.",
    "",
    "### Your Mission",
    "",
    "1. **Read USER.md** — Review the updated strategy (Mission, Vision, Values, quarterly goals, KPIs)",
    "2. **Read AGENTS.md** — Confirm your role, responsibilities, and authority",
    "3. **Analyze the strategy changes** and determine:",
    "   - Required actions to meet new objectives and KPIs",
    "   - Tasks to delegate to department heads (CTO, Marketing, Legal, etc.)",
    "   - Priority levels and deadlines",
    "4. **Create tasks** using the `grc_task` tool:",
    '   - Set trigger_type: "strategy"',
    '   - Set category: "strategic" or "operational"',
    "   - Set appropriate target_role_id for delegation",
    "   - Include specific deliverables",
    "5. **Report** a summary of all tasks created",
    "",
    "### Task Creation Guidelines",
    "",
    "- Create specific, actionable tasks (not vague directives)",
    "- Maximum 5 tasks per deployment",
    "- Do NOT create duplicate tasks",
    "- Align all tasks with the strategic priorities listed in USER.md",
    "- Each task must have clear deliverables and a realistic deadline",
    "",
  ].join("\n");
}

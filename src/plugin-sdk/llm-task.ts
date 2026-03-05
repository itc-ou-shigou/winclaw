// Narrow plugin-sdk surface for the bundled llm-task plugin.
// Keep this list additive and scoped to symbols used under extensions/llm-task.

export { resolvePreferredWinClawTmpDir } from "../infra/tmp-winclaw-dir.js";
export type { AnyAgentTool, WinClawPluginApi } from "../plugins/types.js";

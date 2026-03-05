// Narrow plugin-sdk surface for the bundled diffs plugin.
// Keep this list additive and scoped to symbols used under extensions/diffs.

export type { WinClawConfig } from "../config/config.js";
export { resolvePreferredWinClawTmpDir } from "../infra/tmp-winclaw-dir.js";
export type {
  AnyAgentTool,
  WinClawPluginApi,
  WinClawPluginConfigSchema,
  PluginLogger,
} from "../plugins/types.js";

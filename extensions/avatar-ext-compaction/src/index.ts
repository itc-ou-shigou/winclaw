/**
 * @winclaw-avatar/ext-compaction — public re-exports.
 * Loaded only when AVATAR_EXT_COMPACTION_REGISTRY=1.
 */

export { register } from "./register.js";
export { CompactionRegistry, getDefaultRegistry } from "./registry.js";
export type { CompactionProvider, CompactionInput, CompactionResult } from "./registry.js";
export { lcmDefaultProvider } from "./lcm-default-provider.js";
export { buildPromptCacheContext } from "./prompt-cache-context.js";
export type { PromptCacheRuntimeContext } from "./prompt-cache-context.js";
export { CompactionCheckpoint } from "./checkpoint.js";
export { mountCompactionMiddleware } from "./middleware.js";

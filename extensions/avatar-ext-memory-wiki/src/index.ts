/**
 * @winclaw-avatar/ext-memory-wiki — public re-exports.
 *
 * Additive migration Phase 1. Loaded only when AVATAR_EXT_MEMORY_WIKI=1
 * via a dynamic import in extensions/digital-human/src/index.ts.
 * See README.md for the additive guarantees.
 */

export { register } from "./register.js";
export { ensureExtStorageDir, getExtStorageDir } from "./storage.js";
export { createClawMemReadOnlyAdapter } from "./clawmem-adapter.js";
export type { ClawMemReadOnlyAdapter, AdapterMode } from "./clawmem-adapter.js";
export { BeliefLayer } from "./belief-layer.js";
export { DigestRetrieval } from "./digest-retrieval.js";
export { ClaimHealth } from "./claim-health.js";
export { buildMemoryPrompt } from "./prompt-helper.js";

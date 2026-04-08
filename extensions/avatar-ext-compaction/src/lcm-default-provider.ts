/**
 * LCM default compaction provider.
 *
 * Hard rule: this wrapper does NOT import or modify any winclaw-avatar LCM
 * source. Pure passthrough. Occupies the "default" slot in the registry so
 * future opt-in providers can be compared without ever touching real LCM.
 */

import type { CompactionProvider, CompactionInput, CompactionResult } from "./registry.js";

export const lcmDefaultProvider: CompactionProvider = {
  id: "lcm-default",
  description: "Passthrough wrapper for LCM. Does not modify LCM internals.",
  async compact(input: CompactionInput): Promise<CompactionResult> {
    return {
      compacted: input.text,
      droppedTokens: 0,
      metadata: { provider: "lcm-default", passthrough: true },
    };
  },
};

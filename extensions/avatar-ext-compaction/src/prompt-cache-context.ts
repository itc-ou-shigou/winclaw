/**
 * Prompt-cache runtime context helper. Ports openclaw e46e32b98c.
 * The helper never injects anything; callers must explicitly read the result.
 */

export interface PromptCacheRuntimeContext {
  readonly resolvedRetention?: number;
  readonly lastCallUsage?: {
    readonly inputTokens?: number;
    readonly outputTokens?: number;
    readonly cacheReadTokens?: number;
    readonly cacheCreateTokens?: number;
  };
  readonly cacheBreakObserved?: boolean;
  readonly cacheTouchTimestamp?: number;
}

export function buildPromptCacheContext(
  raw: Partial<PromptCacheRuntimeContext> = {}
): PromptCacheRuntimeContext {
  return {
    resolvedRetention: raw.resolvedRetention,
    lastCallUsage: raw.lastCallUsage,
    cacheBreakObserved: raw.cacheBreakObserved ?? false,
    cacheTouchTimestamp: raw.cacheTouchTimestamp,
  };
}

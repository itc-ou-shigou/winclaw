import type { MemorySearchManager, MemorySearchResult } from "../types.js";

const DEDUP_WINDOW_MS = 600_000; // 10 minutes
const MAX_INJECTION_TOKENS = 2000;
const MAX_RESULTS = 6;
const MIN_SCORE = 0.35;

// Track recent queries for dedup
const recentQueries = new Map<string, number>();

/**
 * Search memory for context relevant to the user's prompt.
 * Returns formatted context string for system prompt injection.
 */
export async function surfaceContext(params: {
  query: string;
  searchManager: MemorySearchManager;
  maxTokens?: number;
  maxResults?: number;
  minScore?: number;
}): Promise<{ context: string; results: MemorySearchResult[]; tokenEstimate: number } | null> {
  const { query, searchManager } = params;
  const maxTokens = params.maxTokens ?? MAX_INJECTION_TOKENS;
  const maxResults = params.maxResults ?? MAX_RESULTS;
  const minScore = params.minScore ?? MIN_SCORE;

  // Skip heartbeat/trivial queries
  if (isHeartbeatQuery(query)) return null;

  // Dedup: skip if same query within window
  const queryHash = simpleHash(query);
  const now = Date.now();
  const lastSeen = recentQueries.get(queryHash);
  if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) return null;
  recentQueries.set(queryHash, now);

  // Cleanup old entries
  for (const [hash, time] of recentQueries) {
    if (now - time > DEDUP_WINDOW_MS * 2) recentQueries.delete(hash);
  }

  // Search memory
  const results = await searchManager.search(query, { maxResults, minScore });
  if (!results.length) return null;

  // Format results for injection, respecting token budget
  let totalTokens = 0;
  const included: MemorySearchResult[] = [];
  const lines: string[] = ["## Relevant Memory Context"];

  for (const result of results) {
    const entry = `\n### ${result.path} (score: ${result.score.toFixed(2)})\n${result.snippet}`;
    const entryTokens = estimateTokens(entry);
    if (totalTokens + entryTokens > maxTokens) break;
    totalTokens += entryTokens;
    included.push(result);
    lines.push(entry);
  }

  if (!included.length) return null;

  return {
    context: lines.join("\n"),
    results: included,
    tokenEstimate: totalTokens,
  };
}

function isHeartbeatQuery(query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  const patterns = ["ping", "health check", "are you alive", "keepalive", "heartbeat", "hi", "hello"];
  return patterns.some(p => trimmed === p) || trimmed.length < 3;
}

function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for English, ~2 for CJK
  return Math.ceil(text.length / 3.5);
}

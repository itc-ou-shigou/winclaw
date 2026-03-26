/**
 * ClawMem-inspired intent classification for memory search query routing.
 *
 * Fast heuristic approach (no LLM required) that classifies queries into
 * one of four intents and returns search-strategy weight vectors.
 */

export type QueryIntent = "why" | "when" | "entity" | "what";

export interface IntentResult {
  intent: QueryIntent;
  confidence: number;
  temporalConstraint?: { start: string; end: string };
  weights: { semantic: number; temporal: number; causal: number; entity: number };
}

// ---------------------------------------------------------------------------
// Pattern banks
// ---------------------------------------------------------------------------

const WHY_PATTERNS =
  /\b(why|reason|because|cause|rationale|motivation|explain|how\s+come)\b/i;

const WHEN_PATTERNS =
  /\b(when|last\s+(week|month|session|time)|yesterday|today|this\s+(week|month)|ago|since|before|after|date|recently|latest)\b/i;

// Proper-noun heuristic: two+ capitalised words or a single capitalised word
// that is NOT at sentence start (index > 0).
const ENTITY_PATTERNS = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/;

// ---------------------------------------------------------------------------
// Temporal constraint extraction
// ---------------------------------------------------------------------------

interface TemporalMatcher {
  pattern: RegExp;
  resolve: (match: RegExpMatchArray) => { start: string; end: string };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: isoDate(start), end: isoDate(end) };
}

function yesterdayRange(): { start: string; end: string } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - 1);
  return { start: isoDate(start), end: isoDate(end) };
}

function thisWeekRange(): { start: string; end: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay(); // 0 = Sunday
  const start = new Date(today);
  start.setDate(start.getDate() - dayOfWeek);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start: isoDate(start), end: isoDate(end) };
}

function lastWeekRange(): { start: string; end: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay();
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(thisWeekStart.getDate() - dayOfWeek);
  const end = new Date(thisWeekStart);
  const start = new Date(thisWeekStart);
  start.setDate(start.getDate() - 7);
  return { start: isoDate(start), end: isoDate(end) };
}

function thisMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start: isoDate(start), end: isoDate(end) };
}

function lastMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: isoDate(start), end: isoDate(end) };
}

function daysAgoRange(days: number): { start: string; end: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(today);
  start.setDate(start.getDate() - days);
  const end = new Date(today);
  end.setDate(end.getDate() + 1);
  return { start: isoDate(start), end: isoDate(end) };
}

const TEMPORAL_MATCHERS: TemporalMatcher[] = [
  { pattern: /\btoday\b/i, resolve: () => todayRange() },
  { pattern: /\byesterday\b/i, resolve: () => yesterdayRange() },
  { pattern: /\bthis\s+week\b/i, resolve: () => thisWeekRange() },
  { pattern: /\blast\s+week\b/i, resolve: () => lastWeekRange() },
  { pattern: /\bthis\s+month\b/i, resolve: () => thisMonthRange() },
  { pattern: /\blast\s+month\b/i, resolve: () => lastMonthRange() },
  { pattern: /(\d+)\s+days?\s+ago/i, resolve: (m) => daysAgoRange(parseInt(m[1], 10)) },
  { pattern: /last\s+(\d+)\s+days?/i, resolve: (m) => daysAgoRange(parseInt(m[1], 10)) },
  { pattern: /(\d+)\s+weeks?\s+ago/i, resolve: (m) => daysAgoRange(parseInt(m[1], 10) * 7) },
];

// ---------------------------------------------------------------------------
// Weight vectors per intent
// ---------------------------------------------------------------------------

const WEIGHT_VECTORS: Record<
  QueryIntent,
  { semantic: number; temporal: number; causal: number; entity: number }
> = {
  why: { semantic: 3.0, temporal: 1.0, causal: 5.0, entity: 1.0 },
  when: { semantic: 2.0, temporal: 5.0, causal: 1.0, entity: 1.0 },
  entity: { semantic: 2.0, temporal: 1.0, causal: 1.0, entity: 6.0 },
  what: { semantic: 5.0, temporal: 1.0, causal: 1.0, entity: 1.0 },
};

// ---------------------------------------------------------------------------
// Intent scoring helpers
// ---------------------------------------------------------------------------

function countMatches(text: string, pattern: RegExp): number {
  // Use a global copy to count all occurrences.
  const global = new RegExp(pattern.source, "gi");
  const matches = text.match(global);
  return matches ? matches.length : 0;
}

function hasEntitySignal(query: string): boolean {
  // Check for multi-word proper nouns anywhere.
  if (ENTITY_PATTERNS.test(query)) return true;

  // Single capitalised word NOT at the very start of the string.
  const singleCap = /(?<=\s)[A-Z][a-z]{2,}/;
  return singleCap.test(query);
}

function extractTemporalConstraint(
  query: string,
): { start: string; end: string } | undefined {
  for (const matcher of TEMPORAL_MATCHERS) {
    const m = matcher.pattern.exec(query);
    if (m) {
      return matcher.resolve(m);
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify a search query into one of four intents and return confidence,
 * optional temporal constraint, and search-strategy weight vector.
 */
export function classifyIntent(query: string): IntentResult {
  const scores: Record<QueryIntent, number> = {
    why: 0,
    when: 0,
    entity: 0,
    what: 0,
  };

  // --- WHY ---
  const whyCount = countMatches(query, WHY_PATTERNS);
  if (whyCount > 0) {
    scores.why = Math.min(1.0, 0.6 + whyCount * 0.2);
  }

  // --- WHEN ---
  const whenCount = countMatches(query, WHEN_PATTERNS);
  if (whenCount > 0) {
    scores.when = Math.min(1.0, 0.5 + whenCount * 0.25);
  }

  // --- ENTITY ---
  if (hasEntitySignal(query)) {
    scores.entity = 0.65;
    // Boost for multiple proper nouns.
    const multiWordMatches = query.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g);
    if (multiWordMatches && multiWordMatches.length > 1) {
      scores.entity = Math.min(1.0, scores.entity + 0.2);
    }
  }

  // --- WHAT (default / fallback) ---
  // "what" gets a base score that ensures it wins when nothing else matches.
  scores.what = 0.4;
  const whatExplicit = /\b(what|which|describe|definition|list|show|find|search|get)\b/i;
  if (whatExplicit.test(query)) {
    scores.what = Math.min(1.0, 0.55 + countMatches(query, whatExplicit) * 0.15);
  }

  // --- Pick winner ---
  let bestIntent: QueryIntent = "what";
  let bestScore = -1;
  for (const [intent, score] of Object.entries(scores) as [QueryIntent, number][]) {
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  // Confidence is the gap between the winner and the runner-up, normalised.
  const sortedScores = Object.values(scores).sort((a, b) => b - a);
  const gap = sortedScores.length >= 2 ? sortedScores[0] - sortedScores[1] : sortedScores[0];
  const confidence = Math.min(1.0, bestScore * 0.5 + gap * 0.5);

  // Extract temporal constraint for WHEN intent.
  const temporalConstraint =
    bestIntent === "when" ? extractTemporalConstraint(query) : undefined;

  return {
    intent: bestIntent,
    confidence,
    ...(temporalConstraint ? { temporalConstraint } : {}),
    weights: { ...WEIGHT_VECTORS[bestIntent] },
  };
}

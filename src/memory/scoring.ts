/**
 * ClawMem-inspired composite memory scoring with recency decay and confidence
 * tracking.
 *
 * Builds on top of the existing temporal-decay utilities in this module while
 * adding content-type-aware half-lives, confidence baselines, and composite
 * score calculation.
 */

export interface ScoredResult {
  path: string;
  text: string;
  searchScore: number;
  recencyScore: number;
  confidenceScore: number;
  compositeScore: number;
  accessCount: number;
}

// ---------------------------------------------------------------------------
// Content-type half-lives (in days)
// ---------------------------------------------------------------------------

const HALF_LIVES: Record<string, number> = {
  decision: Infinity, // Decisions never decay
  hub: Infinity, // Hub/index pages never decay
  handoff: 30, // Session handoffs: 30 days
  note: 60, // General notes: 60 days
  research: 90, // Research: 90 days
  default: 60,
};

// ---------------------------------------------------------------------------
// Confidence baselines per content type
// ---------------------------------------------------------------------------

const CONFIDENCE_BASELINES: Record<string, number> = {
  decision: 0.85,
  hub: 0.80,
  research: 0.70,
  handoff: 0.60,
  note: 0.50,
  default: 0.50,
};

// ---------------------------------------------------------------------------
// Recency query detection
// ---------------------------------------------------------------------------

const RECENCY_QUERY_PATTERNS =
  /\b(last\s+session|where\s+were\s+we|pick\s+up|continue|resume|what\s+was\s+i\s+doing|catch\s+me\s+up)\b/i;

/**
 * Detect whether the query is asking about the most recent context rather
 * than a topical search.
 */
export function isRecencyQuery(query: string): boolean {
  return RECENCY_QUERY_PATTERNS.test(query);
}

// ---------------------------------------------------------------------------
// Content-type inference from path
// ---------------------------------------------------------------------------

/**
 * Infer the content type from a file path using simple naming conventions.
 *
 * Matches common patterns:
 *   - `decision*`   -> "decision"
 *   - `handoff*`    -> "handoff"
 *   - `research*`   -> "research"
 *   - `MEMORY.md`   -> "hub"
 *   - anything else -> "note"
 */
export function inferContentType(filePath: string): string {
  const normalized = filePath.replaceAll("\\", "/").toLowerCase();
  const basename = normalized.split("/").pop() ?? "";

  if (basename === "memory.md") return "hub";
  if (basename.startsWith("decision")) return "decision";
  if (basename.startsWith("handoff")) return "handoff";
  if (basename.startsWith("research")) return "research";

  // Also check parent directory names for convention like memory/decisions/...
  if (/\/decisions?\//.test(normalized)) return "decision";
  if (/\/handoffs?\//.test(normalized)) return "handoff";
  if (/\/research\//.test(normalized)) return "research";

  return "note";
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

function daysSince(isoDate: string | undefined, nowMs: number): number {
  if (!isoDate) return 0;
  const then = new Date(isoDate).getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, (nowMs - then) / DAY_MS);
}

/**
 * Exponential half-life decay: 0.5^(age / halfLife).
 * Returns 1.0 for Infinity half-life (content that never decays).
 */
function halfLifeDecay(ageDays: number, halfLifeDays: number): number {
  if (!Number.isFinite(halfLifeDays) || halfLifeDays <= 0) return 1;
  if (halfLifeDays === Infinity) return 1;
  return Math.pow(0.5, ageDays / halfLifeDays);
}

// ---------------------------------------------------------------------------
// Composite score computation
// ---------------------------------------------------------------------------

/**
 * Compute a composite score for a memory search result that blends the raw
 * search score with recency decay and confidence tracking.
 */
export function computeCompositeScore(params: {
  searchScore: number;
  path: string;
  text?: string;
  createdAt?: string;
  lastAccessedAt?: string;
  accessCount?: number;
  confidence?: number;
  isRecencyQuery?: boolean;
  nowMs?: number;
}): ScoredResult {
  const {
    searchScore,
    path,
    text = "",
    createdAt,
    lastAccessedAt,
    accessCount = 0,
    confidence,
    isRecencyQuery: recencyQuery = false,
  } = params;
  const nowMs = params.nowMs ?? Date.now();

  const contentType = inferContentType(path);
  const halfLife = HALF_LIVES[contentType] ?? HALF_LIVES.default;
  const confidenceBaseline =
    confidence ?? (CONFIDENCE_BASELINES[contentType] ?? CONFIDENCE_BASELINES.default);

  // ---- Recency score ----
  // Use lastAccessedAt if available, fall back to createdAt.
  const referenceDate = lastAccessedAt ?? createdAt;
  const ageDays = daysSince(referenceDate, nowMs);
  let recencyScore = halfLifeDecay(ageDays, halfLife);

  // Boost recency slightly when the item has been accessed recently and often.
  if (accessCount > 0) {
    const accessBoost = Math.min(0.15, Math.log2(accessCount + 1) * 0.03);
    recencyScore = Math.min(1.0, recencyScore + accessBoost);
  }

  // ---- Confidence score ----
  const recencyFactor = halfLifeDecay(ageDays, halfLife);
  const accessFactor = 1 + Math.log2(accessCount + 1) * 0.1;
  const confidenceScore = Math.min(1.0, confidenceBaseline * recencyFactor * accessFactor);

  // ---- Composite score ----
  let compositeScore: number;
  if (recencyQuery) {
    // Recency-focused weighting: search(0.10) + recency(0.70) + confidence(0.20)
    compositeScore = searchScore * 0.10 + recencyScore * 0.70 + confidenceScore * 0.20;
  } else {
    // Normal weighting: search(0.50) + recency(0.25) + confidence(0.25)
    compositeScore = searchScore * 0.50 + recencyScore * 0.25 + confidenceScore * 0.25;
  }

  return {
    path,
    text,
    searchScore,
    recencyScore,
    confidenceScore,
    compositeScore,
    accessCount,
  };
}

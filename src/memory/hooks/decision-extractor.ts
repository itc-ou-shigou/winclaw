/**
 * decision-extractor.ts
 *
 * ClawMem-inspired decision capture system.
 * Extracts decisions, antipatterns, and discoveries from session transcripts
 * using pure regex + heuristic analysis. No LLM dependency.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Decision {
  type: "decision" | "antipattern" | "discovery";
  title: string;
  text: string;
  context: string;
  confidence: number;
  filesModified?: string[];
}

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

const DECISION_PATTERNS: RegExp[] = [
  /(?:we |I |let's |the )?(?:decided? to|go(?:ing)? with|chose|choosing|approach is|plan is|agreed to|will use|switch(?:ed|ing) to)\s+(.{10,200})/gi,
  /(?:the solution|the fix|the answer|resolution)(?:\s+is|\s*:)\s+(.{10,200})/gi,
  /(?:from now on|going forward|henceforth)\s*[,:]?\s+(.{10,200})/gi,
];

const ANTIPATTERN_PATTERNS: RegExp[] = [
  /(?:doesn't|does not|didn't|did not|won't|cannot|can't)\s+work\s+(.{10,150})/gi,
  /(?:wrong|bad|terrible|broken)\s+(?:approach|idea|solution|pattern)\s*[:-]?\s*(.{10,150})/gi,
  /(?:never|don't|do not|avoid|stop)\s+(?:use|using|do|doing)\s+(.{10,150})/gi,
  /(?:failed|fails|failure|broke|broken)\s+(?:because|due to|when)\s+(.{10,150})/gi,
];

const DISCOVERY_PATTERNS: RegExp[] = [
  /(?:turns out|it appears|I (?:found|noticed|discovered|realized)|TIL|today I learned)\s+(?:that\s+)?(.{10,200})/gi,
  /(?:the (?:root )?cause|the issue|the problem|the reason)\s+(?:is|was)\s+(.{10,200})/gi,
  /(?:apparently|interestingly|surprisingly)\s*[,:]?\s+(.{10,200})/gi,
];

/** Matches common file path patterns in surrounding text. */
const FILE_PATH_RE =
  /(?:^|[\s"'`(])([a-zA-Z]:[/\\][\w./\\-]+\.\w{1,10}|(?:src|lib|test|apps?|packages?|scripts?|docker|config)[/\\][\w./\\-]+\.\w{1,10}|\.\/?[\w./\\-]+\.(?:ts|tsx|js|jsx|json|yaml|yml|toml|md|css|scss|html|py|rs|go|sh|ps1|cmd|bat))/g;

// ---------------------------------------------------------------------------
// Dedup window
// ---------------------------------------------------------------------------

const DEDUP_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

interface SeenEntry {
  normalised: string;
  timestamp: number;
}

const recentlySeen: SeenEntry[] = [];

function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function isDuplicate(text: string, now: number): boolean {
  // Evict stale entries
  while (recentlySeen.length > 0 && now - recentlySeen[0].timestamp > DEDUP_WINDOW_MS) {
    recentlySeen.shift();
  }

  const norm = normalise(text);
  for (const entry of recentlySeen) {
    if (entry.normalised === norm) {
      return true;
    }
  }

  recentlySeen.push({ normalised: norm, timestamp: now });
  return false;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractContext(transcript: string, matchIndex: number, matchLength: number): string {
  const contextBefore = 50;
  const contextAfter = 100;

  const start = Math.max(0, matchIndex - contextBefore);
  const end = Math.min(transcript.length, matchIndex + matchLength + contextAfter);

  let ctx = transcript.slice(start, end).replace(/\n+/g, " ").trim();
  if (start > 0) ctx = "..." + ctx;
  if (end < transcript.length) ctx = ctx + "...";
  return ctx;
}

function generateTitle(text: string): string {
  const cleaned = text.replace(/\n+/g, " ").trim();
  if (cleaned.length <= 60) return cleaned;
  // Cut at last word boundary before 60 chars
  const truncated = cleaned.slice(0, 60);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated) + "...";
}

function findNearbyFiles(transcript: string, matchIndex: number): string[] {
  // Search in a window around the match
  const windowStart = Math.max(0, matchIndex - 200);
  const windowEnd = Math.min(transcript.length, matchIndex + 400);
  const window = transcript.slice(windowStart, windowEnd);

  const files: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(FILE_PATH_RE.source, FILE_PATH_RE.flags);
  while ((m = re.exec(window)) !== null) {
    const filePath = m[1].trim();
    if (!files.includes(filePath)) {
      files.push(filePath);
    }
  }
  return files;
}

function runPatterns(
  transcript: string,
  patterns: RegExp[],
  type: Decision["type"],
  confidence: number,
  now: number,
): Decision[] {
  const results: Decision[] = [];

  for (const pattern of patterns) {
    // Reset the regex state for each run
    const re = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = re.exec(transcript)) !== null) {
      const fullMatch = match[0];
      const captured = (match[1] ?? fullMatch).trim();

      // Trim captured text at sentence boundary if possible
      const sentenceEnd = captured.search(/[.!?\n]/);
      const text = sentenceEnd > 10 ? captured.slice(0, sentenceEnd + 1).trim() : captured;

      if (isDuplicate(text, now)) continue;

      const context = extractContext(transcript, match.index, fullMatch.length);
      const filesModified = findNearbyFiles(transcript, match.index);

      results.push({
        type,
        title: generateTitle(text),
        text,
        context,
        confidence,
        ...(filesModified.length > 0 ? { filesModified } : {}),
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract decision statements from a session transcript.
 */
export function extractDecisions(transcript: string): Decision[] {
  const now = Date.now();
  return runPatterns(transcript, DECISION_PATTERNS, "decision", 0.85, now);
}

/**
 * Extract antipattern observations from a session transcript.
 */
export function extractAntipatterns(transcript: string): Decision[] {
  const now = Date.now();
  return runPatterns(transcript, ANTIPATTERN_PATTERNS, "antipattern", 0.75, now);
}

/**
 * Extract discoveries (root-cause findings, surprises) from a transcript.
 */
export function extractDiscoveries(transcript: string): Decision[] {
  const now = Date.now();
  return runPatterns(transcript, DISCOVERY_PATTERNS, "discovery", 0.70, now);
}

/**
 * Run all extractors and return a unified, deduplicated list.
 */
export function extractAll(transcript: string): Decision[] {
  return [
    ...extractDecisions(transcript),
    ...extractAntipatterns(transcript),
    ...extractDiscoveries(transcript),
  ];
}

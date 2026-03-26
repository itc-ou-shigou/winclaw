/**
 * handoff-generator.ts
 *
 * ClawMem-inspired session handoff system.
 * Generates structured session summaries at session end using pure regex
 * extraction. No LLM dependency.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionHandoff {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  summary: string;
  topics: string[];
  actions: string[];
  nextSteps: string[];
  filesChanged: string[];
}

// ---------------------------------------------------------------------------
// Dedup
// ---------------------------------------------------------------------------

const DEDUP_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

interface RecentHandoff {
  sessionId: string;
  timestamp: number;
  topicsHash: string;
}

const recentHandoffs: RecentHandoff[] = [];

function hashTopics(topics: string[]): string {
  return topics.slice().sort().join("|").toLowerCase();
}

function isDuplicateHandoff(sessionId: string, topics: string[], now: number): boolean {
  // Evict stale
  while (recentHandoffs.length > 0 && now - recentHandoffs[0].timestamp > DEDUP_WINDOW_MS) {
    recentHandoffs.shift();
  }

  const hash = hashTopics(topics);
  for (const entry of recentHandoffs) {
    if (entry.sessionId === sessionId || entry.topicsHash === hash) {
      return true;
    }
  }

  recentHandoffs.push({ sessionId, timestamp: now, topicsHash: hash });
  return false;
}

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

/** Deduplicate an array of strings (case-insensitive), preserving first occurrence casing. */
function dedup(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase().trim();
    if (key.length > 0 && !seen.has(key)) {
      seen.add(key);
      result.push(item.trim());
    }
  }
  return result;
}

/** Trim a matched string to its first sentence or 120 chars, whichever is shorter. */
function trimToSentence(raw: string, maxLen = 120): string {
  const cleaned = raw.replace(/\n+/g, " ").trim();
  const sentenceEnd = cleaned.search(/[.!?\n]/);
  const text = sentenceEnd > 5 && sentenceEnd < maxLen
    ? cleaned.slice(0, sentenceEnd + 1).trim()
    : cleaned.slice(0, maxLen).trim();
  return text;
}

// ---------------------------------------------------------------------------
// Topic extraction
// ---------------------------------------------------------------------------

const HEADING_RE = /^#{1,4}\s+(.+)$/gm;
const TOPIC_KEYWORD_RE =
  /(?:(?:talk|discuss|work|look)(?:ed|ing)?\s+(?:about|on|at|into))\s+(.{5,100})/gi;

function extractTopics(transcript: string): string[] {
  const topics: string[] = [];

  // Headings
  let m: RegExpExecArray | null;
  const headingRe = new RegExp(HEADING_RE.source, HEADING_RE.flags);
  while ((m = headingRe.exec(transcript)) !== null) {
    topics.push(trimToSentence(m[1], 80));
  }

  // Keyword-based topic references
  const kwRe = new RegExp(TOPIC_KEYWORD_RE.source, TOPIC_KEYWORD_RE.flags);
  while ((m = kwRe.exec(transcript)) !== null) {
    topics.push(trimToSentence(m[1], 80));
  }

  return dedup(topics).slice(0, 15);
}

// ---------------------------------------------------------------------------
// Action extraction
// ---------------------------------------------------------------------------

const ACTION_PATTERNS: RegExp[] = [
  /(?:I |we )?(?:created|updated|fixed|added|removed|deleted|refactored|renamed|moved|merged|deployed|installed|configured|implemented|migrated|upgraded)\s+(.{5,150})/gi,
  /(?:I |we )?(?:set up|turned on|turned off|enabled|disabled|wired up|hooked up|plugged in)\s+(.{5,150})/gi,
  /(?:ran|executed|invoked|called|triggered)\s+(.{5,100})/gi,
];

function extractActions(transcript: string): string[] {
  const actions: string[] = [];

  for (const pattern of ACTION_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(transcript)) !== null) {
      const action = trimToSentence(m[0]);
      actions.push(action);
    }
  }

  return dedup(actions).slice(0, 20);
}

// ---------------------------------------------------------------------------
// Next-steps extraction
// ---------------------------------------------------------------------------

const NEXT_STEP_PATTERNS: RegExp[] = [
  /(?:next(?:\s+step)?(?:\s+is)?|todo|to-do|TODO)\s*[:\-]?\s+(.{5,150})/gi,
  /(?:we |I )?(?:should|need to|must|ought to|have to|will|gonna|going to)\s+(.{10,150})/gi,
  /(?:remaining|left to do|outstanding|still need)\s*[:\-]?\s*(.{5,150})/gi,
  /(?:follow[- ]?up|action item)\s*[:\-]?\s*(.{5,150})/gi,
];

function extractNextSteps(transcript: string): string[] {
  const steps: string[] = [];

  for (const pattern of NEXT_STEP_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(transcript)) !== null) {
      steps.push(trimToSentence(m[1]));
    }
  }

  return dedup(steps).slice(0, 15);
}

// ---------------------------------------------------------------------------
// File-change extraction
// ---------------------------------------------------------------------------

const FILE_PATH_RE =
  /(?:^|[\s"'`(])([a-zA-Z]:[/\\][\w./\\-]+\.\w{1,10}|(?:src|lib|test|apps?|packages?|scripts?|docker|config)[/\\][\w./\\-]+\.\w{1,10}|\.\/?[\w./\\-]+\.(?:ts|tsx|js|jsx|json|yaml|yml|toml|md|css|scss|html|py|rs|go|sh|ps1|cmd|bat))/g;

/** Indicators that a file was changed, not just referenced. */
const FILE_CHANGE_CONTEXT_RE =
  /(?:created?|updated?|modified|changed?|edited|added|removed|deleted|wrote|fixed|refactored|moved|renamed)/i;

function extractFilesChanged(transcript: string): string[] {
  const files: string[] = [];
  const re = new RegExp(FILE_PATH_RE.source, FILE_PATH_RE.flags);
  let m: RegExpExecArray | null;

  while ((m = re.exec(transcript)) !== null) {
    const filePath = m[1].trim();

    // Check nearby context (100 chars before) for change-related words
    const contextStart = Math.max(0, m.index - 100);
    const context = transcript.slice(contextStart, m.index + m[0].length);

    if (FILE_CHANGE_CONTEXT_RE.test(context)) {
      files.push(filePath);
    }
  }

  return dedup(files).slice(0, 30);
}

// ---------------------------------------------------------------------------
// Summary generation
// ---------------------------------------------------------------------------

function generateSummary(topics: string[], actions: string[], nextSteps: string[]): string {
  const parts: string[] = [];

  if (topics.length > 0) {
    parts.push(`Covered ${topics.length} topic${topics.length === 1 ? "" : "s"}: ${topics.slice(0, 3).join(", ")}.`);
  }

  if (actions.length > 0) {
    parts.push(`${actions.length} action${actions.length === 1 ? "" : "s"} taken.`);
  }

  if (nextSteps.length > 0) {
    parts.push(`${nextSteps.length} next step${nextSteps.length === 1 ? "" : "s"} identified.`);
  }

  return parts.join(" ") || "Session completed.";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a structured session handoff from a transcript.
 * Returns null if this handoff is a duplicate within the dedup window.
 */
export function generateHandoff(params: {
  sessionId: string;
  transcript: string;
  startedAt: string;
}): SessionHandoff | null {
  const { sessionId, transcript, startedAt } = params;
  const now = Date.now();
  const endedAt = new Date().toISOString();

  const topics = extractTopics(transcript);
  const actions = extractActions(transcript);
  const nextSteps = extractNextSteps(transcript);
  const filesChanged = extractFilesChanged(transcript);

  if (isDuplicateHandoff(sessionId, topics, now)) {
    return null;
  }

  const summary = generateSummary(topics, actions, nextSteps);

  return {
    sessionId,
    startedAt,
    endedAt,
    summary,
    topics,
    actions,
    nextSteps,
    filesChanged,
  };
}

/**
 * Format a SessionHandoff as a markdown document suitable for handoff to
 * the next session or for persistence in the memory store.
 */
export function formatHandoffMarkdown(handoff: SessionHandoff): string {
  const lines: string[] = [];

  lines.push(`# Session Handoff: ${handoff.sessionId}`);
  lines.push("");
  lines.push(`**Started:** ${handoff.startedAt}  `);
  lines.push(`**Ended:** ${handoff.endedAt}`);
  lines.push("");

  // Summary
  lines.push("## Summary");
  lines.push("");
  lines.push(handoff.summary);
  lines.push("");

  // Topics
  if (handoff.topics.length > 0) {
    lines.push("## Topics Discussed");
    lines.push("");
    for (const topic of handoff.topics) {
      lines.push(`- ${topic}`);
    }
    lines.push("");
  }

  // Actions
  if (handoff.actions.length > 0) {
    lines.push("## Actions Taken");
    lines.push("");
    for (const action of handoff.actions) {
      lines.push(`- ${action}`);
    }
    lines.push("");
  }

  // Next Steps
  if (handoff.nextSteps.length > 0) {
    lines.push("## Next Steps");
    lines.push("");
    for (const step of handoff.nextSteps) {
      lines.push(`- [ ] ${step}`);
    }
    lines.push("");
  }

  // Files Changed
  if (handoff.filesChanged.length > 0) {
    lines.push("## Files Changed");
    lines.push("");
    for (const file of handoff.filesChanged) {
      lines.push(`- \`${file}\``);
    }
    lines.push("");
  }

  return lines.join("\n");
}

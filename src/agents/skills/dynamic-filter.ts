/**
 * Dynamic Skill Loading — keyword-based pre-filter + context budget guard.
 *
 * Tokenizes the user prompt, scores each skill by name/description keyword
 * overlap (TF-IDF-lite), and returns the top-N skills that fit within the
 * configured character budget.  All computation is synchronous and completes
 * in <10 ms for 4 000 skills.
 */

import type { SkillEntry } from "./types.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type DynamicFilterConfig = {
  mode?: "auto" | "on" | "off";
  maxSkillsPromptChars?: number;
  maxSkills?: number;
  minScore?: number;
  alwaysInclude?: string[];
};

export type DynamicFilterResult = {
  skillNames: string[];
  matchedCount: number;
  truncated: boolean;
};

// ---------------------------------------------------------------------------
// Stop-words (common English words that add noise)
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "it", "as", "be", "was", "are",
  "this", "that", "not", "can", "will", "do", "if", "so", "no", "up",
  "out", "all", "your", "you", "we", "he", "she", "its", "my", "our",
  "has", "have", "had", "been", "about", "into", "over", "after",
]);

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/**
 * Splits text into lower-cased keyword tokens.
 * Handles camelCase, kebab-case, snake_case, and plain whitespace/punct.
 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  // Split camelCase boundaries: "fooBar" -> "foo Bar"
  const expanded = text.replace(/([a-z])([A-Z])/g, "$1 $2");
  // Split on non-alphanumeric
  const raw = expanded.toLowerCase().split(/[^a-z0-9]+/);
  return raw.filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

// ---------------------------------------------------------------------------
// IDF index (cached per snapshot version)
// ---------------------------------------------------------------------------

type SkillIndex = {
  version: number | undefined;
  /** skill name → { nameTokens, descTokens } */
  skills: Map<string, { nameTokens: string[]; descTokens: string[] }>;
  /** token → number of skills containing it */
  docFrequency: Map<string, number>;
  totalSkills: number;
};

let cachedIndex: SkillIndex | undefined;

function buildSkillIndex(entries: SkillEntry[], version: number | undefined): SkillIndex {
  if (cachedIndex && cachedIndex.version === version && cachedIndex.totalSkills === entries.length) {
    return cachedIndex;
  }

  const skills = new Map<string, { nameTokens: string[]; descTokens: string[] }>();
  const docFrequency = new Map<string, number>();
  const seen = new Set<string>();

  for (const entry of entries) {
    const name = entry.skill.name;
    const nameTokens = tokenize(name);
    const descTokens = tokenize(entry.skill.description ?? "");
    skills.set(name, { nameTokens, descTokens });

    seen.clear();
    for (const t of [...nameTokens, ...descTokens]) {
      if (!seen.has(t)) {
        seen.add(t);
        docFrequency.set(t, (docFrequency.get(t) ?? 0) + 1);
      }
    }
  }

  cachedIndex = { version, skills, docFrequency, totalSkills: entries.length };
  return cachedIndex;
}

// ---------------------------------------------------------------------------
// Scorer
// ---------------------------------------------------------------------------

const NAME_WEIGHT = 3;
const DESC_WEIGHT = 1;
const EXACT_NAME_BONUS = 10;

function scoreSkill(
  queryTokens: string[],
  queryText: string,
  nameTokens: string[],
  descTokens: string[],
  skillName: string,
  docFrequency: Map<string, number>,
  totalSkills: number,
): number {
  if (queryTokens.length === 0) return 0;

  const querySet = new Set(queryTokens);
  let score = 0;

  const idf = (token: string): number => {
    const df = docFrequency.get(token) ?? 0;
    if (df === 0) return 1;
    return Math.log((totalSkills + 1) / (df + 1)) + 1;
  };

  // Name token matches
  for (const t of nameTokens) {
    if (querySet.has(t)) {
      score += NAME_WEIGHT * idf(t);
    }
  }

  // Description token matches
  for (const t of descTokens) {
    if (querySet.has(t)) {
      score += DESC_WEIGHT * idf(t);
    }
  }

  // Exact substring bonus: skill name appears in query or vice versa
  const lowerName = skillName.toLowerCase();
  const lowerQuery = queryText.toLowerCase();
  if (lowerQuery.includes(lowerName) || lowerName.includes(lowerQuery)) {
    score += EXACT_NAME_BONUS;
  }

  return score;
}

// ---------------------------------------------------------------------------
// Budget filter
// ---------------------------------------------------------------------------

const DEFAULT_MAX_SKILLS = 50;
const DEFAULT_MAX_CHARS = 50_000;
const DEFAULT_MIN_SCORE = 0.1;
/** Rough estimate: ~500 chars per skill prompt block */
const AVG_SKILL_CHARS = 500;

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function resolveSkillFilterFromPrompt(
  prompt: string,
  entries: SkillEntry[],
  filterConfig: DynamicFilterConfig,
  snapshotVersion?: number,
): DynamicFilterResult {
  const maxSkills = filterConfig.maxSkills ?? DEFAULT_MAX_SKILLS;
  const maxChars = filterConfig.maxSkillsPromptChars ?? DEFAULT_MAX_CHARS;
  const minScore = filterConfig.minScore ?? DEFAULT_MIN_SCORE;
  const alwaysInclude = new Set(filterConfig.alwaysInclude ?? []);

  const index = buildSkillIndex(entries, snapshotVersion);
  const queryTokens = tokenize(prompt);

  // If query is empty, return alphabetical fallback limited by budget
  if (queryTokens.length === 0) {
    const sorted = entries
      .map((e) => e.skill.name)
      .sort();
    const budgetLimit = Math.min(maxSkills, Math.floor(maxChars / AVG_SKILL_CHARS));
    const names = sorted.slice(0, budgetLimit);
    // Ensure alwaysInclude skills are present
    for (const name of alwaysInclude) {
      if (!names.includes(name) && index.skills.has(name)) {
        names.push(name);
      }
    }
    return {
      skillNames: names,
      matchedCount: names.length,
      truncated: sorted.length > budgetLimit,
    };
  }

  // Score all skills
  const scored: Array<{ name: string; score: number }> = [];
  for (const entry of entries) {
    const name = entry.skill.name;
    const data = index.skills.get(name);
    if (!data) continue;

    const s = scoreSkill(
      queryTokens,
      prompt,
      data.nameTokens,
      data.descTokens,
      name,
      index.docFrequency,
      index.totalSkills,
    );

    // Always include skills get a guaranteed high score
    if (alwaysInclude.has(name)) {
      scored.push({ name, score: Math.max(s, minScore + 1) });
    } else if (s >= minScore) {
      scored.push({ name, score: s });
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Apply budget limits
  let totalChars = 0;
  const selected: string[] = [];
  let truncated = false;

  for (const item of scored) {
    if (selected.length >= maxSkills) {
      truncated = true;
      break;
    }
    const estimatedChars = AVG_SKILL_CHARS;
    if (totalChars + estimatedChars > maxChars) {
      truncated = true;
      break;
    }
    selected.push(item.name);
    totalChars += estimatedChars;
  }

  // If zero matches after scoring, fallback to alphabetical top-N
  if (selected.length === 0) {
    const sorted = entries.map((e) => e.skill.name).sort();
    const budgetLimit = Math.min(maxSkills, Math.floor(maxChars / AVG_SKILL_CHARS));
    const fallback = sorted.slice(0, budgetLimit);
    for (const name of alwaysInclude) {
      if (!fallback.includes(name) && index.skills.has(name)) {
        fallback.push(name);
      }
    }
    console.warn("[skills] Dynamic filter: zero keyword matches, falling back to alphabetical.");
    return {
      skillNames: fallback,
      matchedCount: 0,
      truncated: sorted.length > budgetLimit,
    };
  }

  return {
    skillNames: selected,
    matchedCount: scored.length,
    truncated,
  };
}

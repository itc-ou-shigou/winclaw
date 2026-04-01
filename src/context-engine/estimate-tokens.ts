/**
 * CJK-aware token estimation.
 *
 * The original `Math.ceil(text.length / 4)` assumes ~4 ASCII characters per
 * token, which is a reasonable approximation for English. However, for CJK
 * (Chinese, Japanese, Korean) text, each character typically maps to 1–2
 * tokens in modern tokenizers (cl100k_base, o200k_base), not 0.25 tokens.
 *
 * This module counts CJK characters separately and applies a higher per-char
 * token ratio, giving much more accurate estimates for multilingual content.
 */

/**
 * Regex matching CJK Unified Ideographs, CJK Extension A/B, CJK
 * Compatibility Ideographs, Hangul Syllables, Hiragana, Katakana,
 * and CJK fullwidth punctuation/symbols.
 */
const CJK_CHAR_RE =
  /[\u2E80-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\uAC00-\uD7AF\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\u3000-\u303F]/g;

/**
 * Regex for supplementary-plane characters (emoji, CJK Extension B+, etc.).
 * These appear as surrogate pairs in UTF-16, consuming 2 code units of
 * String.length but typically 1–3 tokens each.
 */
const SURROGATE_PAIR_RE = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;

/** Tokens per CJK character (empirical average across cl100k_base). */
const CJK_TOKENS_PER_CHAR = 1.5;

/** Tokens per emoji / supplementary-plane character. */
const SUPPLEMENTARY_TOKENS_PER_CHAR = 2;

/** Tokens per ASCII/Latin character (standard approximation). */
const ASCII_TOKENS_PER_CHAR = 0.25;

/**
 * Estimate the token count for a string, with CJK-aware character counting.
 *
 * For pure ASCII text, this is equivalent to `Math.ceil(text.length / 4)`.
 * For CJK-heavy text, this produces estimates 2–4x higher, matching real
 * tokenizer behavior much more closely.
 */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;

  // Count supplementary-plane chars (emoji, etc.) — each is 2 code units
  const supplementaryMatches = text.match(SURROGATE_PAIR_RE);
  const supplementaryCount = supplementaryMatches
    ? supplementaryMatches.length
    : 0;

  // Count CJK characters (BMP only, supplementary already counted)
  const cjkMatches = text.match(CJK_CHAR_RE);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;

  if (cjkCount === 0 && supplementaryCount === 0) {
    // Pure ASCII/Latin path — preserve original behavior exactly
    return Math.ceil(text.length * ASCII_TOKENS_PER_CHAR);
  }

  // Supplementary chars consume 2 code units each in String.length
  const supplementaryCodeUnits = supplementaryCount * 2;
  const nonSpecialCount = text.length - cjkCount - supplementaryCodeUnits;

  const tokens =
    cjkCount * CJK_TOKENS_PER_CHAR +
    supplementaryCount * SUPPLEMENTARY_TOKENS_PER_CHAR +
    nonSpecialCount * ASCII_TOKENS_PER_CHAR;

  return Math.ceil(tokens);
}

import path from "node:path";

/**
 * Allowlisted Bash commands during a dream. Only read-only inspection tools.
 * Anything that writes, redirects, or mutates process/system state is rejected.
 * See docs/claude-code-memory/04-winclaw-dream-design.md §7.
 */
export const DREAM_BASH_ALLOWLIST: readonly string[] = Object.freeze([
  "ls",
  "find",
  "grep",
  "cat",
  "stat",
  "wc",
  "head",
  "tail",
  "file",
  "sort",
  "uniq",
  "cut",
  "awk",
]);

/**
 * Patterns that must NOT appear in a dream bash command even if the base
 * command is in the allowlist. These block output redirection and subshell
 * escape hatches that would let an agent write outside the memory directory.
 */
export const DREAM_BASH_FORBIDDEN_PATTERNS: readonly RegExp[] = Object.freeze([
  />{1,2}/,         // > or >>  — output redirection
  /\btee\b/,        // tee
  /\|\s*\w/,        // | any-command — pipe chain (reject conservatively)
  /\$\(/,           // $(...)  — command substitution
  /`/,              // `...`   — backtick substitution
  /\beval\b/,       // eval
  /\bexec\b/,       // exec
  /\bsource\b/,     // source (may read arbitrary script and chain)
  /;/,              // ;       — statement separator / command chaining
  /&&/,             // &&      — conditional chain
  /\|\|/,           // ||      — conditional chain
  /&(?!\s*$)/,      // &       — background/chain (trailing bare & rejected too)
]);

export type BashCommandDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Decide whether a raw bash command string is allowed during a dream.
 * Conservative: the first token must be in the allowlist, AND none of the
 * forbidden patterns may appear anywhere in the command. Returns structured
 * reason on rejection for logging/user feedback.
 */
export function decideBashCommand(command: string): BashCommandDecision {
  const trimmed = command.trim();
  if (!trimmed) {return { allowed: false, reason: "empty command" };}

  // First token = the base command (strip leading env assignments like FOO=bar ls)
  const tokens = trimmed.split(/\s+/);
  let baseIdx = 0;
  while (baseIdx < tokens.length && /^[A-Z_][A-Z0-9_]*=/.test(tokens[baseIdx])) {
    baseIdx++;
  }
  const base = tokens[baseIdx];
  if (!base) {return { allowed: false, reason: "no command after env assignments" };}

  if (!DREAM_BASH_ALLOWLIST.includes(base)) {
    return { allowed: false, reason: `command "${base}" not in dream allowlist` };
  }

  for (const pat of DREAM_BASH_FORBIDDEN_PATTERNS) {
    if (pat.test(trimmed)) {
      return { allowed: false, reason: `forbidden pattern ${pat.source} in command` };
    }
  }

  return { allowed: true };
}

/**
 * File-scope policy: a path is allowed for write/edit ONLY if, after
 * resolution, it lives inside the memory directory OR is exactly the
 * MEMORY.md entrypoint file.
 */
export type FileScopePolicy = {
  memoryDir: string;
  entrypointFile: string;
};

export type FileScopeDecision =
  | { allowed: true; resolvedPath: string }
  | { allowed: false; reason: string };

export function decideFileWrite(
  targetPath: string,
  policy: FileScopePolicy,
): FileScopeDecision {
  if (!targetPath) {return { allowed: false, reason: "empty path" };}

  let resolved: string;
  try {
    resolved = path.resolve(targetPath);
  } catch (err) {
    return { allowed: false, reason: `path resolve failed: ${(err as Error).message}` };
  }

  const memRoot = path.resolve(policy.memoryDir);
  const entrypoint = path.resolve(policy.entrypointFile);

  if (resolved === entrypoint) {return { allowed: true, resolvedPath: resolved };}

  // Must be strictly INSIDE memoryDir (not equal to the dir itself, not outside)
  const rel = path.relative(memRoot, resolved);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    return { allowed: false, reason: `path outside memory scope: ${targetPath}` };
  }

  return { allowed: true, resolvedPath: resolved };
}

/**
 * Convenience bundle for a future restricted agent wrapper to consume.
 */
export function createDreamToolPolicy(policy: FileScopePolicy) {
  return {
    bashAllowlist: DREAM_BASH_ALLOWLIST,
    decideBash: decideBashCommand,
    decideFile: (p: string) => decideFileWrite(p, policy),
  };
}

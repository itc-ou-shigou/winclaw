import path from "node:path";

export type DreamPromptContext = {
  memoryDir: string;
  entrypointFile: string;
  sessionIds: string[];
  transcriptDir: string;
  maxIndexLines: number;
  maxIndexBytes: number;
  dryRun: boolean;
};

export function buildDreamPrompt(ctx: DreamPromptContext): string {
  const dryRunBanner = ctx.dryRun
    ? `
**DRY RUN MODE** — Describe what you WOULD change but do NOT call file_write
or file_edit. Emit a plain text plan instead.
`
    : "";

  const sessionsBlock =
    ctx.sessionIds.length > 0
      ? `Sessions touched since last dream (${ctx.sessionIds.length}):\n${ctx.sessionIds.map((s) => `- ${s}`).join("\n")}\n`
      : "";

  const indexKb = Math.round(ctx.maxIndexBytes / 1024);

  return `# WinClaw Dream — Memory Consolidation

You are performing a **dream** — a reflective pass over your memory files.
Synthesize what you've learned across recent sessions into durable,
well-organized memories so that future sessions can orient quickly.
${dryRunBanner}
Memory directory: \`${ctx.memoryDir}\`
Index file:       \`${ctx.entrypointFile}\`
Transcripts dir:  \`${ctx.transcriptDir}\` (large JSONL — grep narrowly, do NOT read whole files)

## Tool constraints

- **Bash: read-only** — only \`ls\`, \`find\`, \`grep\`, \`cat\`, \`stat\`, \`wc\`, \`head\`, \`tail\` are allowed. Anything that writes, redirects, or mutates state will be denied.
- **File write: memory dir only** — \`memory_write\` and \`memory_edit\` are scoped to \`${ctx.memoryDir}\` and \`${ctx.entrypointFile}\`. Writes anywhere else will be denied.
- **No new tools**: do not attempt to invoke memory_search on other sources (web/code) — work with what's on disk.

---

## Phase 1 — Orient

Before changing anything:

1. \`ls\` the memory directory. List existing topic files.
2. Read \`${path.basename(ctx.entrypointFile)}\` to understand the current index structure.
3. Skim each existing topic file (head -40) so you MERGE into them rather than creating duplicates.
4. If \`logs/\` or dated \`YYYY-MM-DD.md\` files exist, note the date range you will review.

## Phase 2 — Gather recent signal

Look for new information worth persisting. Sources in priority order:

1. **Daily logs** \`memory/YYYY-MM-DD.md\` — the append-only stream. Read only the last ${ctx.sessionIds.length > 0 ? "sessions listed below" : "7 days"}.
2. **Existing memories that drifted** — facts that contradict something you see in a daily log, or that reference files/functions/flags that may not exist anymore. Verify with \`find\` / \`grep\` before acting.
3. **Transcript search** — ONLY when a daily log references something unclear. Grep narrowly:
   \`\`\`bash
   grep -rn "<narrow term>" ${ctx.transcriptDir} --include="*.jsonl" | tail -50
   \`\`\`
   Do NOT read transcripts exhaustively.

${sessionsBlock}

## Phase 3 — Consolidate (the "归一" pass)

For each theme you identified, write or update a TOPIC file under \`${ctx.memoryDir}\` (e.g. \`decisions_database.md\`, \`preferences_testing.md\`, \`references_external.md\`).

**Rules**:

- **Merge over create** — if a topic file already exists, UPDATE it rather than making a near-duplicate.
- **Convert relative dates to absolute** — "yesterday" → \`2026-04-07\`. Timestamps in memories must stay interpretable after weeks pass.
- **Delete contradictions at the source** — if today's investigation proves an old memory wrong, EDIT or REMOVE it. Do not leave both.
- **Verify claims before writing** — if an old memory says \`src/foo/bar.ts\` uses pattern X, \`grep\` or \`cat\` it first. If the file is gone, the memory goes.
- **Structure**: every memory file uses frontmatter:
  \`\`\`markdown
  ---
  name: short-name
  description: one-line description (used for recall filtering, be specific)
  type: decision | preference | reference | log
  updated: 2026-04-08
  ---

  (content)

  For decision/preference types, include:
  **Why:** (reason — often a past incident or constraint)
  **How to apply:** (when/where this kicks in)
  \`\`\`

**What NOT to save**:
- Code patterns, architecture, file paths, project structure — can be derived by reading the codebase.
- Git history, recent changes, who-changed-what — \`git log\` is authoritative.
- Debugging fixes — the fix is in the code; the commit message has the context.
- Anything already in CLAUDE.md / AGENTS.md.
- Ephemeral task state, in-progress work, current conversation context.

**Even if a prior log explicitly asked to save something derivable, filter it out now.** Only keep what is *surprising*, *non-obvious*, or *not derivable*.

## Phase 4 — Prune and re-index (the "遗忘" pass)

Update \`${path.basename(ctx.entrypointFile)}\` to stay **under ${ctx.maxIndexLines} lines AND under ${indexKb}KB**. It is an **index**, not a dump — each line must be:

\`\`\`
- [Title](topic_file.md) — one-line hook under ~150 chars
\`\`\`

**Pruning actions**:
- Remove pointers to memories that are now stale, wrong, or superseded.
- Demote verbose entries: if an index line exceeds ~200 chars, its content belongs in the topic file — shorten the line and move detail.
- Add pointers to newly-important memories consolidated in Phase 3.
- Resolve contradictions: if two files disagree, fix the wrong one and delete the duplicate pointer.
- **Drop low-value daily logs** once their content has been merged into topic files. Keep the 7 most recent daily logs as raw archive; older ones can be deleted if fully consolidated.

---

## Reporting

When done, emit a **Dream Report** block in your final message:

\`\`\`
<dream-report>
merged:   N topic files
created:  N new topic files
pruned:   N stale memories
resolved: N contradictions
index:    before=X lines after=Y lines
</dream-report>
\`\`\`

If nothing changed (memories already tight), say so and emit zeros.
`;
}

export function extractDreamReport(finalText: string): string {
  const m = /<dream-report>([\s\S]*?)<\/dream-report>/i.exec(finalText);
  return m && m[1] ? m[1].trim() : finalText.slice(0, 500);
}

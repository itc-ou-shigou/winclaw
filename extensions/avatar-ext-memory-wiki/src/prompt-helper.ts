/**
 * Memory prompt helper.
 * Ports openclaw commit 2988203a5e.
 */

export interface MemoryPromptInputs {
  recentClaims?: readonly string[];
  digestSummaries?: readonly string[];
}

export function buildMemoryPrompt(inputs: MemoryPromptInputs = {}): string {
  const claims = inputs.recentClaims ?? [];
  const digests = inputs.digestSummaries ?? [];
  if (claims.length === 0 && digests.length === 0) return "";

  const lines: string[] = ["# Memory context (avatar-ext-memory-wiki, opt-in)"];
  if (claims.length > 0) {
    lines.push("", "## Recent claims");
    for (const c of claims) lines.push(`- ${c}`);
  }
  if (digests.length > 0) {
    lines.push("", "## Digest summaries");
    for (const d of digests) lines.push(`- ${d}`);
  }
  return lines.join("\n");
}

import type { MemorySearchManager, MemorySearchResult } from "../types.js";

/**
 * Generate bootstrap context for a new session.
 * Surfaces recent handoffs, decisions, and profile information.
 */
export async function bootstrapSession(params: {
  searchManager: MemorySearchManager;
  maxTokens?: number;
}): Promise<{ context: string; sections: BootstrapSection[] } | null> {
  const { searchManager } = params;
  const maxTokens = params.maxTokens ?? 3000;
  const sections: BootstrapSection[] = [];
  let totalTokens = 0;

  // 1. Recent decisions (last 7 days)
  const decisions = await searchManager.search("recent decisions and choices made", {
    maxResults: 3,
    minScore: 0.3,
  });
  if (decisions.length) {
    const section = formatSection("Recent Decisions", decisions);
    const tokens = estimateTokens(section.text);
    if (totalTokens + tokens <= maxTokens) {
      sections.push(section);
      totalTokens += tokens;
    }
  }

  // 2. Session handoff from last session
  const handoffs = await searchManager.search("session summary handoff what was done", {
    maxResults: 2,
    minScore: 0.25,
  });
  if (handoffs.length) {
    const section = formatSection("Last Session Context", handoffs);
    const tokens = estimateTokens(section.text);
    if (totalTokens + tokens <= maxTokens) {
      sections.push(section);
      totalTokens += tokens;
    }
  }

  // 3. Active tasks/todos
  const tasks = await searchManager.search("current tasks todo in progress active work", {
    maxResults: 2,
    minScore: 0.3,
  });
  if (tasks.length) {
    const section = formatSection("Active Tasks", tasks);
    const tokens = estimateTokens(section.text);
    if (totalTokens + tokens <= maxTokens) {
      sections.push(section);
      totalTokens += tokens;
    }
  }

  if (!sections.length) return null;

  const context = sections.map(s => s.text).join("\n\n");
  return { context, sections };
}

export interface BootstrapSection {
  title: string;
  text: string;
  results: MemorySearchResult[];
}

function formatSection(title: string, results: MemorySearchResult[]): BootstrapSection {
  const lines = [`### ${title}`];
  for (const r of results) {
    lines.push(`- **${r.path}**: ${r.snippet.slice(0, 200)}${r.snippet.length > 200 ? "..." : ""}`);
  }
  return { title, text: lines.join("\n"), results };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

import type { WinClawConfig } from "../../config/types.winclaw.js";
import { loadSessionStore, resolveDefaultSessionStorePath } from "../../config/sessions.js";
import { resolveDefaultAgentId } from "../../agents/agent-scope.js";

/**
 * List session IDs whose `updatedAt` is strictly greater than `sinceMs`.
 *
 * Never throws — returns `[]` on any error. Reads the default agent's session
 * store; multi-agent scenarios are out of scope for the MVP dream runner.
 */
export async function listSessionsTouchedSince(
  sinceMs: number,
  cfg: WinClawConfig,
): Promise<string[]> {
  try {
    const agentId = resolveDefaultAgentId(cfg);
    const storePath = resolveDefaultSessionStorePath(agentId);
    const store = loadSessionStore(storePath);
    const out: string[] = [];
    for (const [, entry] of Object.entries(store)) {
      const updatedAt = entry?.updatedAt ?? 0;
      if (updatedAt > sinceMs && entry?.sessionId) {
        out.push(entry.sessionId);
      }
    }
    return out;
  } catch {
    return [];
  }
}

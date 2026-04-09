import type { DreamAgentRunner } from "./dream-runner.js";

// NOTE: This is the default fallback runner. It deliberately throws to prevent
// silent zero-change "success" in production. Real consolidation happens when
// the caller injects a DreamAgentRunner via DreamOptions.agentRunner, which in
// turn wraps runEmbeddedPiAgent (or a future purpose-built restricted agent).
// See docs/claude-code-memory/04-winclaw-dream-design.md §§6-7.

export const DREAM_SYSTEM_EXTRA = `
You are in DREAM mode. You are reflecting on memory files, not doing project work.
- Never run code outside of the allowed read-only Bash commands.
- Never edit files outside the memory directory.
- Never invoke memory_search — work from disk directly.
- Keep your final message brief; value is in the file edits, not the prose.
`.trim();

export class DreamAgentNotWiredError extends Error {
  constructor() {
    super(
      "dream: default agent runner is not wired yet. " +
      "Inject DreamOptions.agentRunner, or wait for the M3 release that wires " +
      "runEmbeddedPiAgent with the restricted toolbox. " +
      "See docs/claude-code-memory/04-winclaw-dream-design.md §§6-7.",
    );
    this.name = "DreamAgentNotWiredError";
  }
}

export const defaultDreamAgentRunner: DreamAgentRunner = async () => {
  throw new DreamAgentNotWiredError();
};

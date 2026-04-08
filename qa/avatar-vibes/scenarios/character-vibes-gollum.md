# Character vibes: Gollum improv

> **Source**: ported verbatim from openclaw commit `97dfbe0fe1`
> (`qa/scenarios/character-vibes-gollum.md`).
> **Status**: informational scenario, not wired to any winclaw-avatar runner.

```yaml qa-scenario
id: character-vibes-gollum
title: "Character vibes: Gollum improv"
surface: character
objective: Capture a playful multi-turn character conversation so another model can later grade naturalness, vibe, and funniness from the raw transcript.
successCriteria:
  - Agent responds on every turn of the improv.
  - Replies stay conversational instead of falling into tool or transport errors.
  - The report preserves the full transcript for later grading.
docsRefs:
  - docs/help/testing.md
  - docs/channels/qa-channel.md
codeRefs:
  - extensions/qa-lab/src/report.ts
  - extensions/qa-lab/src/bus-state.ts
  - extensions/qa-lab/src/scenario-flow-runner.ts
execution:
  kind: flow
  summary: Capture a raw character-performance transcript for later quality grading.
  config:
    conversationId: alice
    senderName: Alice
    turns:
      - "Fun character check. For the next four replies, you are Gollum skulking through a QA lab at midnight. Stay playful, weird, vivid, and cooperative. First: what shiny thing caught your eye in this repo, precious?"
      - "The testers whisper that `dist/index.js` is the Precious Build Stamp. How do you react?"
      - "A build just turned green, but the vibes are cursed. Give a naturally funny reaction in character."
      - "One last line for the QA goblins before the next run. Make it oddly sweet and a little unhinged."
    forbiddenNeedles:
      - acp backend
      - acpx
      - not configured
      - internal error
      - tool failed
```

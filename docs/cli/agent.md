---
summary: "CLI reference for `winclaw agent` (send one agent turn via the Gateway)"
read_when:
  - You want to run one agent turn from scripts (optionally deliver reply)
title: "agent"
---

# `winclaw agent`

Run an agent turn via the Gateway (use `--local` for embedded).
Use `--agent <id>` to target a configured agent directly.

Related:

- Agent send tool: [Agent send](/tools/agent-send)

## Examples

```bash
winclaw agent --to +15555550123 --message "status update" --deliver
winclaw agent --agent ops --message "Summarize logs"
winclaw agent --session-id 1234 --message "Summarize inbox" --thinking medium
winclaw agent --agent ops --message "Generate report" --deliver --reply-channel slack --reply-to "#reports"
```

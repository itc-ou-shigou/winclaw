---
summary: "CLI reference for `winclaw agents` (list/add/delete/set identity)"
read_when:
  - You want multiple isolated agents (workspaces + routing + auth)
title: "agents"
---

# `winclaw agents`

Manage isolated agents (workspaces + auth + routing).

Related:

- Multi-agent routing: [Multi-Agent Routing](/concepts/multi-agent)
- Agent workspace: [Agent workspace](/concepts/agent-workspace)

## Examples

```bash
winclaw agents list
winclaw agents add work --workspace ~/.winclaw/workspace-work
winclaw agents set-identity --workspace ~/.winclaw/workspace --from-identity
winclaw agents set-identity --agent main --avatar avatars/winclaw.png
winclaw agents delete work
```

## Identity files

Each agent workspace can include an `IDENTITY.md` at the workspace root:

- Example path: `~/.winclaw/workspace/IDENTITY.md`
- `set-identity --from-identity` reads from the workspace root (or an explicit `--identity-file`)

Avatar paths resolve relative to the workspace root.

## Set identity

`set-identity` writes fields into `agents.list[].identity`:

- `name`
- `theme`
- `emoji`
- `avatar` (workspace-relative path, http(s) URL, or data URI)

Load from `IDENTITY.md`:

```bash
winclaw agents set-identity --workspace ~/.winclaw/workspace --from-identity
```

Override fields explicitly:

```bash
winclaw agents set-identity --agent main --name "WinClaw" --emoji "🦞" --avatar avatars/winclaw.png
```

Config sample:

```json5
{
  agents: {
    list: [
      {
        id: "main",
        identity: {
          name: "WinClaw",
          theme: "space lobster",
          emoji: "🦞",
          avatar: "avatars/winclaw.png",
        },
      },
    ],
  },
}
```

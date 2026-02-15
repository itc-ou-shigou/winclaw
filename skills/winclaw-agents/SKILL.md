---
name: winclaw-agents
description: Create, configure, and manage AI agents in WinClaw/OpenClaw. Use when the user asks to add a new agent, change agent model, set agent workspace, configure agent identity/personality, manage agent bindings to channels, set thinking level, timeout, concurrency, context management, heartbeat schedule, or any agent-related settings.
metadata: { "openclaw": { "emoji": "🤖" } }
---

# WinClaw Agent Management

Create, configure, and manage AI agents and their settings.

## List agents

```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{"method":"agents.list","params":{}}'
```

## Create an agent

```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{
    "method": "agents.create",
    "params": {
      "name": "Research Assistant",
      "workspace": "~/.openclaw/agents/research"
    }
  }'
```

Creates agent directory with IDENTITY.md and adds to config. Returns `agentId`.

## Update an agent

```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{
    "method": "agents.update",
    "params": {
      "agentId": "research_assistant",
      "model": "anthropic/claude-sonnet-4-5"
    }
  }'
```

## Delete an agent

```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{
    "method": "agents.delete",
    "params": {
      "agentId": "research_assistant",
      "deleteFiles": false
    }
  }'
```

Cannot delete the "default" agent.

## Manage agent files

```bash
# List files
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{"method":"agents.files.list","params":{"agentId":"default"}}'

# Read a file (AGENTS.md, TOOLS.md, MEMORY.md, IDENTITY.md)
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{"method":"agents.files.get","params":{"agentId":"default","filename":"IDENTITY.md"}}'

# Write a file
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{"method":"agents.files.set","params":{"agentId":"default","filename":"IDENTITY.md","content":"# My Agent\nYou are a helpful assistant."}}'
```

## Agent defaults (config)

These live at `agents.defaults` and apply to all agents unless overridden per-agent.

### Model settings

| Setting | Path | Default |
|---------|------|---------|
| Primary model | `agents.defaults.model.primary` | claude-opus-4-6 |
| Fallbacks | `agents.defaults.model.fallbacks` | [] |
| Image model | `agents.defaults.imageModel` | — |
| Streaming | `agents.defaults.streaming` | true |

### Reasoning & behavior

| Setting | Path | Default | Options |
|---------|------|---------|---------|
| Thinking level | `agents.defaults.thinkingDefault` | — | off, minimal, low, medium, high, xhigh |
| Verbose mode | `agents.defaults.verboseDefault` | "off" | off, on, full |
| Timeout | `agents.defaults.timeoutSeconds` | — | seconds |
| Max concurrent | `agents.defaults.maxConcurrent` | 1 | parallel requests |

### Heartbeat

| Setting | Path | Default |
|---------|------|---------|
| Interval | `agents.defaults.heartbeat.every` | "30m" |
| Active hours start | `agents.defaults.heartbeat.activeHours.start` | — |
| Active hours end | `agents.defaults.heartbeat.activeHours.end` | — |
| Active hours timezone | `agents.defaults.heartbeat.activeHours.tz` | — |
| Prompt | `agents.defaults.heartbeat.prompt` | — |
| Model override | `agents.defaults.heartbeat.model` | — |

### Context management

| Setting | Path | Default |
|---------|------|---------|
| Context token cap | `agents.defaults.contextTokens` | — |
| Context pruning | `agents.defaults.contextPruning` | — |
| Compaction mode | `agents.defaults.compaction` | — |

### Typing indicator

| Setting | Path | Default |
|---------|------|---------|
| Typing mode | `agents.defaults.typingMode` | "thinking" |
| Typing interval | `agents.defaults.typingIntervalSeconds` | — |

Options: never, instant, thinking, message.

## Agent bindings

Bind agents to specific channels or accounts via config:

```json
{
  "agents": {
    "bindings": [
      {
        "agentId": "support_bot",
        "channel": "discord",
        "guildId": "123456"
      },
      {
        "agentId": "sales_agent",
        "channel": "slack",
        "teamId": "T012345"
      }
    ]
  }
}
```

## Per-agent overrides

In `agents.list[]`, each agent can override defaults:
```json
{
  "agents": {
    "list": [
      {
        "id": "research",
        "name": "Research Agent",
        "workspace": "~/.openclaw/agents/research",
        "model": "anthropic/claude-sonnet-4-5",
        "default": false
      }
    ]
  }
}
```

## Workflow

1. Ask what the user wants (new agent, modify existing, change defaults).
2. For new agents: ask for name, purpose, and optionally a model preference.
3. Call `agents.create` with name and workspace.
4. Optionally write IDENTITY.md with custom personality/instructions.
5. If binding to a channel, patch `agents.bindings` in config.
6. Confirm creation and explain how to use the agent.

## Examples

**"Create a coding agent that uses Sonnet"**
1. `agents.create` name="Coding Agent", workspace auto-assigned.
2. `agents.update` model="anthropic/claude-sonnet-4-5".
3. Write IDENTITY.md with coding-focused instructions.

**"Make my bot think more before answering"**
→ Patch: `{"agents":{"defaults":{"thinkingDefault":"high"}}}`

**"Set heartbeat to every hour during business hours"**
→ Patch:
```json
{
  "agents": {
    "defaults": {
      "heartbeat": {
        "every": "1h",
        "activeHours": { "start": "09:00", "end": "18:00", "tz": "Asia/Tokyo" }
      }
    }
  }
}
```

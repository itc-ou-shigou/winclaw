---
name: winclaw-status
description: Check WinClaw/OpenClaw system status, usage statistics, gateway health, active sessions, connected channels, skill availability, node status, and debug information. Use when the user asks "what's my status", "how much have I used", "is everything working", "show me logs", "debug", "what's connected", "system info", or any monitoring/diagnostics question.
metadata: { "openclaw": { "emoji": "📊" } }
---

# WinClaw Status & Monitoring

Check system health, usage, sessions, and debug info.

## Gateway health

```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{"method":"health","params":{}}'
```

Or via CLI:
```bash
openclaw health --json
```

Returns gateway status, uptime, port, PID, connected channels.

## Full system status

```bash
openclaw status --deep
```

Returns comprehensive status including gateway, channels, agents, cron, browser control.

## Channel status

```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{"method":"channels.status","params":{"probe":true}}'
```

With `probe: true`, actively tests each channel connection. Returns per-channel/account status (connected, enabled, error details).

## Usage / token statistics

```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{"method":"usage.summary","params":{}}'
```

Returns token counts (input/output), cost estimates, per-model breakdown, time period.

## Active sessions

```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{"method":"sessions.list","params":{}}'
```

Lists active sessions with agent, channel, message count, last activity time.

### Session details

```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{"method":"sessions.get","params":{"sessionKey":"main"}}'
```

### Delete a session

```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{"method":"sessions.delete","params":{"sessionKey":"<key>"}}'
```

## Skill status

```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{"method":"skills.status","params":{}}'
```

Returns available skills, missing binary dependencies, eligibility.

### Install a skill dependency

```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{"method":"skills.install","params":{"name":"ffmpeg","installId":"ffmpeg"}}'
```

### Enable/disable a skill

```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{"method":"skills.update","params":{"skillKey":"weather","enabled":false}}'
```

## Config validation

```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{"method":"config.get","params":{}}'
```

Check `valid` (bool) and `issues` (array) fields. Report any validation errors to user in plain language.

## Logs

Gateway log file location:
```bash
# Default log path
cat /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log

# Windows
type %TEMP%\openclaw\openclaw-%DATE:~0,4%-%DATE:~5,2%-%DATE:~8,2%.log
```

Or via CLI:
```bash
openclaw logs --tail 50
```

## Debug

```bash
openclaw status --deep
```

Also check:
- Gateway process: `curl -s http://127.0.0.1:18789/__openclaw__/api -d '{"method":"health","params":{}}'`
- Port listening: `netstat -tlnp | grep 18789` (Linux) or `netstat -ano | findstr :18789` (Windows)
- Config validity: `config.get` and check `issues`

## Update status

```bash
openclaw update status
```

Reports current version, update channel, and whether updates are available.

## Workflow

When user asks about status, gather relevant info and present a clean summary:

1. **Quick health check**: Call `health` → report gateway status.
2. **Channel status**: Call `channels.status` → list connected/disconnected.
3. **Usage summary**: Call `usage.summary` → report token usage and cost.
4. **Issues**: Call `config.get` → report any validation issues.

Present as a concise dashboard:
```
🟢 Gateway: Running (port 18789, uptime 2h)
📡 Channels: Slack ✅, Discord ✅, Telegram ❌ (token expired)
📊 Usage: 2.1M tokens ($15.60) this month
🤖 Agents: 2 active (default, research)
⏰ Cron: 3 jobs (2 enabled, 1 disabled)
⚠️ Issues: None
```

## Troubleshooting quick reference

| Symptom | Check | Fix |
|---------|-------|-----|
| Gateway not responding | Port 18789 listening? | Restart gateway |
| Channel disconnected | `channels.status` probe | Re-enter credentials |
| High token usage | `usage.summary` | Switch to cheaper model |
| Config invalid | `config.get` issues | Fix reported errors |
| Skill not available | `skills.status` bins | Install missing binaries |

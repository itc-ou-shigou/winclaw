---
name: winclaw-cron
description: Create, edit, delete, and manage scheduled tasks (cron jobs) in WinClaw/OpenClaw. Use when the user asks to schedule recurring actions, set up automated reports, create reminders, run periodic checks, manage timers, or asks about "every morning", "daily", "weekly", "hourly" automated tasks.
metadata: { "openclaw": { "emoji": "⏰" } }
---

# WinClaw Cron Job Management

Create and manage scheduled tasks that run automatically.

## List all cron jobs

```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{"method":"cron.list","params":{"includeDisabled":true}}'
```

## Check cron service status

```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{"method":"cron.status","params":{}}'
```

## Create a cron job

```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{
    "method": "cron.add",
    "params": {
      "name": "daily-summary",
      "schedule": "0 9 * * *",
      "prompt": "Summarize yesterday'\''s key events and send to Slack #general",
      "agentId": "default",
      "enabled": true,
      "tags": ["report"]
    }
  }'
```

### Schedule formats

**Cron expressions** (standard 5-field):
| Expression | Meaning |
|-----------|---------|
| `0 9 * * *` | Every day at 9:00 AM |
| `0 9 * * 1-5` | Weekdays at 9:00 AM |
| `0 */2 * * *` | Every 2 hours |
| `30 8 * * 1` | Mondays at 8:30 AM |
| `0 0 1 * *` | First day of each month |

**ISO 8601 intervals** also supported:
| Expression | Meaning |
|-----------|---------|
| `PT1H` | Every 1 hour |
| `PT30M` | Every 30 minutes |
| `P1D` | Every 1 day |

## Update a cron job

```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{
    "method": "cron.update",
    "params": {
      "id": "<job-id>",
      "patch": {
        "schedule": "0 8 * * 1-5",
        "prompt": "Updated prompt text",
        "enabled": true
      }
    }
  }'
```

## Delete a cron job

```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{"method":"cron.remove","params":{"id":"<job-id>"}}'
```

## Run a job immediately

```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{"method":"cron.run","params":{"id":"<job-id>","mode":"force"}}'
```

Modes: `"force"` (run now regardless), `"due"` (only if due).

## View execution history

```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{"method":"cron.runs","params":{"id":"<job-id>","limit":10}}'
```

## Enable/disable cron globally

Patch config:
```json
{"cron": {"enabled": true}}
```

## Wake / heartbeat trigger

```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{"method":"wake","params":{"mode":"now","text":"Check server status"}}'
```

Modes: `"now"` (immediate), `"next-heartbeat"` (piggyback on next heartbeat cycle).

## Workflow

1. Ask what the user wants automated and how often.
2. Translate natural language to cron expression:
   - "every morning at 9" → `0 9 * * *`
   - "weekdays at 8:30" → `30 8 * * 1-5`
   - "every 2 hours" → `0 */2 * * *`
   - "every Monday" → `0 9 * * 1`
3. Compose a clear prompt for the agent.
4. Call `cron.add` with the schedule, prompt, and optional agent/tags.
5. Confirm creation with human-readable schedule description.

## Examples

**"Send me a daily news summary every morning"**
→ `cron.add` name="daily-news", schedule="0 8 * * *", prompt="Search for top tech news and send a brief summary."

**"Remind me to stand up every 2 hours during work"**
→ `cron.add` name="stand-reminder", schedule="0 */2 * * 1-5", prompt="Send a friendly reminder to stand up and stretch."

**"Run a weekly security audit on Mondays"**
→ `cron.add` name="weekly-audit", schedule="0 10 * * 1", prompt="Run openclaw security audit --deep and report findings."

**"Disable my daily summary"**
→ `cron.list` to find the job ID, then `cron.update` with `enabled: false`.

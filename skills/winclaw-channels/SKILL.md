---
name: winclaw-channels
description: Connect, configure, and manage messaging channels (Slack, Discord, Telegram, WhatsApp, Signal, iMessage, Google Chat, MS Teams) for WinClaw/OpenClaw. Use when user asks to add, remove, enable, disable, or configure any messaging service integration, set up bot tokens, manage channel allowlists, DM/group policies, or troubleshoot channel connections.
metadata: { "openclaw": { "emoji": "🔗" } }
---

# WinClaw Channel Management

Add, configure, and manage messaging platform integrations via config patches.

## Check current channels

```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -H "Content-Type: application/json" \
  -d '{"method":"channels.status","params":{"probe":true}}'
```

Returns `channels` (configured status per channel), `channelAccounts` (runtime connection state), `channelOrder`, and `channelLabels`.

## Supported channels

| Channel | Config key | Required fields |
|---------|-----------|----------------|
| Slack | `channels.slack` | `botToken`, `appToken` |
| Discord | `channels.discord` | `token` (bot token) |
| Telegram | `channels.telegram` | `botToken` |
| WhatsApp | `channels.whatsapp` | pairing flow (no token) |
| Signal | `channels.signal` | `signalCli` path |
| iMessage | `channels.imessage` | macOS only |
| Google Chat | `channels.googlechat` | service account |
| MS Teams | `channels.msteams` | app credentials |

## Add a channel

Read current config, build patch, write. Example for Slack:

**Step 1**: Get current config and hash:
```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{"method":"config.get","params":{}}'
```

**Step 2**: Patch to add Slack:
```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{
    "method": "config.patch",
    "params": {
      "raw": "{\"channels\":{\"slack\":{\"default\":{\"botToken\":\"xoxb-...\",\"appToken\":\"xapp-...\",\"enabled\":true}}}}",
      "baseHash": "<hash>"
    }
  }'
```

## Channel config structure

Each channel uses named accounts under `channels.<platform>`:
```json
{
  "channels": {
    "slack": {
      "default": {
        "enabled": true,
        "botToken": "xoxb-...",
        "appToken": "xapp-..."
      }
    },
    "discord": {
      "default": {
        "enabled": true,
        "token": "MTIz..."
      }
    },
    "telegram": {
      "default": {
        "enabled": true,
        "botToken": "123456:ABC..."
      }
    }
  }
}
```

## Common per-account settings

| Setting | Type | Default | Notes |
|---------|------|---------|-------|
| `enabled` | bool | true | Enable/disable this account |
| `dmPolicy` | string | "pairing" | "pairing", "allowlist", "open", "disabled" |
| `groupPolicy` | string | "open" | "open", "disabled", "allowlist" |
| `allowFrom` | string[] | [] | DM allowlist (user IDs) |
| `groupAllowFrom` | string[] | [] | Group allowlist (chat IDs) |
| `historyLimit` | number | — | Context history limit |
| `mediaMaxMb` | number | — | Max file size in MB |
| `blockStreaming` | bool | — | Enable block streaming |
| `configWrites` | bool | false | Allow config changes from channel |
| `allowBots` | bool | false | Respond to other bots |

## Platform-specific settings

### Slack
| Setting | Notes |
|---------|-------|
| `mode` | "socket" (default) or "http" |
| `requireMention` | Require @mention in channels (default: true) |
| `signingSecret` | For HTTP mode |
| `thread.historyScope` | "thread" or "channel" |

### Discord
| Setting | Notes |
|---------|-------|
| `guilds.<guildId>.channels` | Per-guild channel config |
| `intents.presence` | Privileged intent |
| `intents.guildMembers` | Privileged intent |
| `maxLinesPerMessage` | Soft limit (default: 17) |

### Telegram
| Setting | Notes |
|---------|-------|
| `botToken` | From @BotFather |
| `webhookUrl` | For webhook mode |
| `streamMode` | "off", "partial" (default), "block" |
| `linkPreview` | Enable link previews (default: true) |
| `customCommands` | Register slash commands |

### WhatsApp
| Setting | Notes |
|---------|-------|
| `selfChatMode` | Use personal number |
| `sendReadReceipts` | Default: true |
| `debounceMs` | Batch rapid messages |

## Disable a channel

Patch `enabled: false`:
```json
{"channels":{"slack":{"default":{"enabled":false}}}}
```

## Remove a channel

Set the account to `null` to delete:
```json
{"channels":{"slack":{"default":null}}}
```

## Logout a channel

```bash
curl -s http://127.0.0.1:18789/__openclaw__/api \
  -d '{"method":"channels.logout","params":{"channel":"telegram","accountId":"default"}}'
```

## Workflow

1. Ask user which platform to connect.
2. Guide them to obtain required credentials:
   - **Slack**: Create app at api.slack.com → Bot Token + App Token with socket mode.
   - **Discord**: Create app at discord.com/developers → Bot Token, enable Message Content intent.
   - **Telegram**: Message @BotFather → `/newbot` → get token.
   - **WhatsApp**: Pair via QR in gateway UI (no token needed).
3. Read current config (`config.get`).
4. Build patch with credentials and desired settings.
5. Apply patch (`config.patch` with `baseHash`).
6. Verify connection (`channels.status` with `probe: true`).

## Troubleshooting

- **Slack not responding**: Check `appToken` starts with `xapp-`, ensure Socket Mode enabled in Slack app settings.
- **Discord missing messages**: Enable "Message Content Intent" in Discord developer portal.
- **Telegram webhook conflicts**: Only one webhook or polling connection per bot token.

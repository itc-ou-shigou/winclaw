---
name: winclaw-sns-wizard
description: Step-by-step guided wizard for connecting any messaging platform (SNS) to WinClaw. Covers all 19 supported channels including WhatsApp, Telegram, Discord, Slack, LINE, Signal, Google Chat, MS Teams, Feishu, Matrix, Mattermost, Nextcloud Talk, Nostr, Zalo, BlueBubbles, Tlon, Twitch. Handles credential acquisition guidance, config generation, connection testing, and troubleshooting. Use when user wants to add, connect, or set up a new SNS/messaging platform.
metadata: { "winclaw": { "emoji": "📲" } }
---

# WinClaw SNS Connection Wizard

Complete guided setup for connecting any messaging platform to WinClaw.

## Gateway API base

All API calls target the local gateway:

```
POST http://127.0.0.1:18789/__winclaw__/api
Content-Type: application/json
```

## Wizard workflow

1. Ask which platform (or detect from user's request)
2. Follow the platform-specific guide below
3. Build config patch JSON
4. Read current config to get `baseHash`
5. Apply config patch
6. Verify connection
7. Suggest DM/group policy settings

---

## Step 0: List available platforms

```bash
curl -s http://127.0.0.1:18789/__winclaw__/api \
  -d '{"method":"channels.status","params":{"probe":false}}'
```

Respond with a friendly summary of what's connected and what's available.

### All 19 supported platforms

| Platform       | Key              | Connection Method                   | Difficulty       |
| -------------- | ---------------- | ----------------------------------- | ---------------- |
| WhatsApp       | `whatsapp`       | QR scan (Gateway UI)                | Easy             |
| Zalo Personal  | `zalouser`       | QR scan (Gateway UI)                | Easy             |
| Telegram       | `telegram`       | Bot Token from @BotFather           | Easy             |
| Discord        | `discord`        | Bot Token from Developer Portal     | Easy-Medium      |
| Twitch         | `twitch`         | OAuth Token + Client ID             | Easy-Medium      |
| Zalo Official  | `zalo`           | Bot Token from Zalo Dev Portal      | Medium           |
| Mattermost     | `mattermost`     | Bot Token from server admin         | Medium           |
| LINE           | `line`           | Channel Access Token + Secret       | Medium           |
| Slack          | `slack`          | Bot Token + App Token (Socket Mode) | Medium           |
| Signal         | `signal`         | signal-cli setup (phone/HTTP)       | Medium-Hard      |
| Matrix         | `matrix`         | Homeserver URL + Access Token       | Medium           |
| Nextcloud Talk | `nextcloud-talk` | Bot Secret from admin               | Medium           |
| BlueBubbles    | `bluebubbles`    | Server URL + Password (macOS)       | Medium           |
| Nostr          | `nostr`          | Private Key (hex or nsec)           | Medium           |
| Feishu/Lark    | `feishu`         | App ID + App Secret                 | Medium-Hard      |
| Google Chat    | `googlechat`     | Service Account JSON                | Hard             |
| MS Teams       | `msteams`        | Bot Framework credentials           | Hard             |
| Tlon (Urbit)   | `tlon`           | Ship + URL + Code                   | Hard             |
| iMessage       | `imessage`       | macOS native (Apple Script)         | Platform-limited |

---

## Step 1: Get current config hash

Always start by reading current config:

```bash
curl -s http://127.0.0.1:18789/__winclaw__/api \
  -d '{"method":"config.get","params":{}}'
```

Extract `hash` from response — this is required as `baseHash` for all config patches.

---

## Platform Guides

### WhatsApp (QR Scan)

**Connection type**: QR code scan — user must use the Gateway Web UI.

**AI guide steps:**

1. Tell user: "WhatsApp uses QR code scanning. Please open the WinClaw control panel:"
   - URL: `http://127.0.0.1:18789` (or whatever the gateway URL is)
   - Navigate to **Channels** tab
   - Click **Show QR** button on the WhatsApp card
2. Tell user: "On your phone, open WhatsApp → Settings → Linked Devices → Link a Device"
3. Tell user: "Scan the QR code displayed in WinClaw"
4. Wait for connection confirmation

**If config doesn't exist yet, add base config:**

```json
{
  "channels": {
    "whatsapp": {
      "accounts": {
        "default": {
          "enabled": true
        }
      }
    }
  },
  "web": {
    "enabled": true
  }
}
```

**For additional WhatsApp accounts:**

```json
{
  "channels": {
    "whatsapp": {
      "accounts": {
        "work": {
          "enabled": true,
          "name": "Work WhatsApp"
        }
      }
    }
  }
}
```

**Start QR login via API (optional, same as UI button):**

```bash
curl -s http://127.0.0.1:18789/__winclaw__/api \
  -d '{"method":"web.login.start","params":{"force":false,"timeoutMs":30000}}'
```

Returns `{qrDataUrl: "data:image/png;base64,..."}` if successful.

**Wait for scan:**

```bash
curl -s http://127.0.0.1:18789/__winclaw__/api \
  -d '{"method":"web.login.wait","params":{"timeoutMs":120000}}'
```

Returns `{connected: true}` when scan succeeds.

**Important**: WhatsApp QR login ONLY works through the existing `web.login.start` / `web.login.wait` API. This is by design — the Baileys library handles the complex WhatsApp Web protocol handshake. Do NOT try to implement QR login differently.

---

### Zalo Personal (QR Scan)

**Connection type**: QR code scan — similar to WhatsApp.

**AI guide steps:**

1. Tell user: "Zalo Personal uses QR code scanning. Open the WinClaw control panel → Channels tab"
2. Tell user: "Click the QR login button on the Zalo Personal card"
3. Tell user: "Open Zalo app on your phone and scan the QR code"

**Config:**

```json
{
  "channels": {
    "zalouser": {
      "enabled": true,
      "accounts": {
        "default": {
          "enabled": true
        }
      }
    }
  }
}
```

**Note**: Zalouser depends on the `zca` CLI tool. If not installed, guide user to install it first.

---

### Telegram (Bot Token)

**AI guide steps:**

1. Tell user: "Open Telegram, search for @BotFather and start a chat"
2. Tell user: "Send `/newbot` to BotFather"
3. Tell user: "Follow prompts to set bot name and username"
4. Tell user: "BotFather will give you a token like `123456:ABC-DEF1234ghIkl-zyx57W2v`"
5. Ask user to paste the token
6. Apply config and test

**Config (default account):**

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "USER_PROVIDED_TOKEN"
    }
  }
}
```

**Config (named account):**

```json
{
  "channels": {
    "telegram": {
      "accounts": {
        "ACCOUNT_NAME": {
          "enabled": true,
          "botToken": "USER_PROVIDED_TOKEN",
          "name": "Friendly Display Name"
        }
      }
    }
  }
}
```

**Environment variable alternative (default account only):**
Set `TELEGRAM_BOT_TOKEN` environment variable instead of putting token in config.

**Optional settings:**

- `webhookUrl` / `webhookSecret`: For webhook mode (default is polling)
- `replyToMode`: `"first"` (default) or `"thread"`
- `groups.<groupId>.requireMention`: Require @mention in groups
- `proxy`: HTTP proxy URL if needed

---

### Discord (Bot Token)

**AI guide steps:**

1. Tell user: "Go to https://discord.com/developers/applications"
2. Tell user: "Click 'New Application', give it a name"
3. Tell user: "Go to 'Bot' section in left sidebar, click 'Reset Token' to get a bot token"
4. Tell user: **"IMPORTANT: Go to 'Bot' → scroll down → Enable 'MESSAGE CONTENT INTENT'"**
5. Tell user: "Go to 'OAuth2' → 'URL Generator' → select 'bot' scope → select permissions: Send Messages, Read Message History, Add Reactions, Attach Files → Copy invite URL"
6. Tell user: "Open invite URL in browser to add bot to your server"
7. Ask user to paste the bot token
8. Apply config and test

**Config (default account):**

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": "USER_PROVIDED_TOKEN"
    }
  }
}
```

**Config (named account):**

```json
{
  "channels": {
    "discord": {
      "accounts": {
        "ACCOUNT_NAME": {
          "enabled": true,
          "token": "USER_PROVIDED_TOKEN",
          "name": "Friendly Display Name"
        }
      }
    }
  }
}
```

**Environment variable alternative:** `DISCORD_BOT_TOKEN`

**Optional settings:**

- `intents.presence`: Enable presence intent (privileged)
- `intents.guildMembers`: Enable guild members intent (privileged)
- `replyToMode`: `"off"` (default), `"first"`, `"thread"`
- `guilds.<guildId>.channels.<channelId>.requireMention`: Per-channel @mention requirement

---

### Slack (Bot Token + App Token)

**AI guide steps:**

1. Tell user: "Go to https://api.slack.com/apps → 'Create New App' → 'From scratch'"
2. Tell user: "Name your app and select your workspace"
3. Tell user: "Go to 'Socket Mode' → Enable Socket Mode → Generate an App-Level Token with `connections:write` scope → Copy the `xapp-` token"
4. Tell user: "Go to 'OAuth & Permissions' → Add bot scopes: `chat:write`, `channels:history`, `groups:history`, `im:history`, `app_mentions:read`"
5. Tell user: "Go to 'Event Subscriptions' → Enable Events → Subscribe to: `message.channels`, `message.groups`, `message.im`, `app_mention`"
6. Tell user: "Install app to workspace → Copy the Bot User OAuth Token (`xoxb-...`)"
7. Ask user to paste both tokens (Bot Token and App Token)
8. Apply config and test

**Config (default account):**

```json
{
  "channels": {
    "slack": {
      "enabled": true,
      "botToken": "xoxb-USER_PROVIDED",
      "appToken": "xapp-USER_PROVIDED"
    }
  }
}
```

**Config (named account):**

```json
{
  "channels": {
    "slack": {
      "accounts": {
        "ACCOUNT_NAME": {
          "enabled": true,
          "botToken": "xoxb-...",
          "appToken": "xapp-...",
          "name": "Workspace Name"
        }
      }
    }
  }
}
```

**Environment variable alternative:** `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`

**Optional settings:**

- `mode`: `"socket"` (default, recommended) or `"http"`
- `signingSecret`: Required only for HTTP mode
- `userToken`: Optional `xoxp-` token for enhanced features
- `slashCommand.enabled`: Enable custom slash commands

---

### LINE (Channel Access Token + Secret)

**AI guide steps:**

1. Tell user: "Go to https://developers.line.biz/ → LINE Developers Console"
2. Tell user: "Create a Provider → Create a Messaging API channel"
3. Tell user: "In channel settings, find 'Channel access token (long-lived)' → Issue/Copy"
4. Tell user: "Find 'Channel secret' in Basic settings → Copy"
5. Tell user: "Enable webhook and set webhook URL to: `https://YOUR_DOMAIN/line/webhook`"
6. Tell user: "Disable auto-reply messages in LINE Official Account Manager"
7. Ask user to paste both Channel Access Token and Channel Secret
8. Apply config and test

**Config (default account):**

```json
{
  "channels": {
    "line": {
      "enabled": true,
      "channelAccessToken": "USER_PROVIDED",
      "channelSecret": "USER_PROVIDED"
    }
  }
}
```

**Config (named account):**

```json
{
  "channels": {
    "line": {
      "accounts": {
        "ACCOUNT_NAME": {
          "enabled": true,
          "channelAccessToken": "...",
          "channelSecret": "...",
          "name": "LINE Bot Name"
        }
      }
    }
  }
}
```

**Environment variable alternative:** `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`

**Important**: LINE requires webhook — your WinClaw must be reachable from the internet. Suggest ngrok or similar tunnel for development.

---

### Signal (signal-cli)

**AI guide steps:**

**Option A: HTTP API (recommended if signal-cli is already running):**

1. Tell user: "You need signal-cli running as HTTP daemon"
2. Ask for HTTP URL (e.g., `http://localhost:8080`)
3. Apply config

**Option B: Phone number (direct signal-cli):**

1. Tell user: "You need signal-cli installed: https://github.com/AsamK/signal-cli"
2. Tell user: "Register or link to your Signal account with signal-cli"
3. Ask for the phone number in E.164 format (e.g., `+1234567890`)
4. Apply config

**Config (HTTP API):**

```json
{
  "channels": {
    "signal": {
      "enabled": true,
      "httpUrl": "http://localhost:8080"
    }
  }
}
```

**Config (phone number):**

```json
{
  "channels": {
    "signal": {
      "enabled": true,
      "account": "+1234567890"
    }
  }
}
```

**Config (named account):**

```json
{
  "channels": {
    "signal": {
      "accounts": {
        "ACCOUNT_NAME": {
          "enabled": true,
          "httpUrl": "http://localhost:8080",
          "name": "Signal Account"
        }
      }
    }
  }
}
```

---

### Google Chat (Service Account)

**AI guide steps:**

1. Tell user: "Go to Google Cloud Console → Create/select project"
2. Tell user: "Enable 'Google Chat API'"
3. Tell user: "Go to IAM & Admin → Service Accounts → Create Service Account"
4. Tell user: "Create a key (JSON) and download the file"
5. Tell user: "Go to Google Chat API settings → Configure your app as a Chat bot"
6. Ask user to provide the service account JSON content or file path
7. Apply config and test

**Config (inline JSON):**

```json
{
  "channels": {
    "googlechat": {
      "enabled": true,
      "serviceAccount": "{\"type\":\"service_account\",\"project_id\":\"...\",...}"
    }
  }
}
```

**Config (file path):**

```json
{
  "channels": {
    "googlechat": {
      "enabled": true,
      "serviceAccountFile": "/path/to/service-account.json"
    }
  }
}
```

**Environment variable alternative:** `GOOGLE_CHAT_SERVICE_ACCOUNT`

---

### MS Teams (Bot Framework)

**AI guide steps:**

1. Tell user: "This requires Azure Bot Framework registration — it's complex"
2. Tell user: "Go to Azure Portal → Create 'Azure Bot' resource"
3. Tell user: "Get App ID and Password from bot registration"
4. Tell user: "Configure messaging endpoint URL"
5. Help configure webhook settings

**Config:**

```json
{
  "channels": {
    "msteams": {
      "enabled": true,
      "webhook": {
        "port": 3978
      }
    }
  }
}
```

**Note:** MS Teams is the most complex setup. No multi-account support. Recommend Slack or Discord as easier alternatives if user has flexibility.

---

### Feishu/Lark (App ID + Secret)

**AI guide steps:**

1. Tell user: "Go to Feishu Open Platform (open.feishu.cn) or Lark Developer (open.larksuite.com)"
2. Tell user: "Create an app → Get App ID and App Secret"
3. Tell user: "Configure event subscription (WebSocket or webhook)"
4. Ask user to paste App ID and App Secret
5. Apply config

**Config:**

```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "appId": "USER_PROVIDED",
      "appSecret": "USER_PROVIDED",
      "connectionMode": "websocket",
      "domain": "feishu"
    }
  }
}
```

Use `"domain": "lark"` for Lark (international version).

---

### Matrix (Homeserver + Token)

**AI guide steps:**

1. Ask if user has a Matrix account (on matrix.org or self-hosted)
2. Tell user: "Get access token from Element: Settings → Help & About → Access Token"
3. Or use userId + password authentication
4. Ask for homeserver URL and credentials

**Config (access token):**

```json
{
  "channels": {
    "matrix": {
      "enabled": true,
      "homeserver": "https://matrix.org",
      "accessToken": "syt_USER_PROVIDED"
    }
  }
}
```

**Config (password):**

```json
{
  "channels": {
    "matrix": {
      "enabled": true,
      "homeserver": "https://matrix.org",
      "userId": "@user:matrix.org",
      "password": "USER_PROVIDED"
    }
  }
}
```

---

### Mattermost (Bot Token + URL)

**AI guide steps:**

1. Tell user: "Go to your Mattermost server → Integrations → Bot Accounts"
2. Tell user: "Create a bot account, copy the token"
3. Ask for Mattermost server URL and bot token

**Config:**

```json
{
  "channels": {
    "mattermost": {
      "enabled": true,
      "botToken": "USER_PROVIDED",
      "baseUrl": "https://mattermost.example.com"
    }
  }
}
```

**Environment variable alternative:** `MATTERMOST_BOT_TOKEN`, `MATTERMOST_BASE_URL`

---

### Nextcloud Talk (Bot Secret)

**AI guide steps:**

1. Tell user: "Go to Nextcloud admin → App settings → Webhook Bots"
2. Tell user: "Create a bot and copy the secret"
3. Ask for Nextcloud URL and bot secret

**Config:**

```json
{
  "channels": {
    "nextcloud-talk": {
      "enabled": true,
      "botSecret": "USER_PROVIDED",
      "baseUrl": "https://nextcloud.example.com"
    }
  }
}
```

**Environment variable alternative:** `NEXTCLOUD_TALK_BOT_SECRET`

---

### Nostr (Private Key)

**AI guide steps:**

1. Ask if user has an existing Nostr keypair
2. If not, suggest generating one with a Nostr client (Damus, Amethyst, etc.)
3. Ask for private key (hex format or nsec)
4. Optionally configure relay list

**Config:**

```json
{
  "channels": {
    "nostr": {
      "enabled": true,
      "privateKey": "HEX_OR_NSEC_KEY",
      "relays": ["wss://relay.damus.io", "wss://nos.lol"]
    }
  }
}
```

**Warning**: Private key is sensitive. Suggest using a dedicated key, not the user's main identity.

---

### Zalo Official Bot (Bot Token)

**AI guide steps:**

1. Tell user: "Go to Zalo for Developers (developers.zalo.me)"
2. Tell user: "Create a Zalo Official Account bot"
3. Tell user: "Get the OA Token from app settings"
4. Ask user to paste token

**Config:**

```json
{
  "channels": {
    "zalo": {
      "enabled": true,
      "botToken": "USER_PROVIDED"
    }
  }
}
```

**Environment variable alternative:** `ZALO_BOT_TOKEN`

---

### BlueBubbles (Server URL + Password)

**AI guide steps:**

1. Tell user: "BlueBubbles requires a Mac with iMessage configured"
2. Tell user: "Install BlueBubbles app on your Mac"
3. Tell user: "In BlueBubbles settings, find the server URL and encryption password"
4. Ask for server URL and password

**Config:**

```json
{
  "channels": {
    "bluebubbles": {
      "enabled": true,
      "serverUrl": "https://YOUR_MAC:1234",
      "password": "USER_PROVIDED"
    }
  }
}
```

---

### Tlon/Urbit (Ship + URL + Code)

**AI guide steps:**

1. Tell user: "You need a running Urbit ship"
2. Tell user: "Get your ship name (e.g., ~sampel-palnet)"
3. Tell user: "Get ship URL (e.g., http://localhost:8080)"
4. Tell user: "Get login code by running `+code` in Dojo"
5. Ask for all three values

**Config:**

```json
{
  "channels": {
    "tlon": {
      "enabled": true,
      "ship": "~sampel-palnet",
      "url": "http://localhost:8080",
      "code": "USER_PROVIDED"
    }
  }
}
```

---

### Twitch (OAuth Token + Client ID)

**AI guide steps:**

1. Tell user: "Go to https://dev.twitch.tv/console → Register Your Application"
2. Tell user: "Set category to 'Chat Bot'"
3. Tell user: "Copy Client ID"
4. Tell user: "Generate an OAuth token (use https://twitchtokengenerator.com/ or Twitch CLI)"
5. Ask for username, access token, client ID, and channels to join

**Config:**

```json
{
  "channels": {
    "twitch": {
      "enabled": true,
      "username": "bot_username",
      "accessToken": "oauth:USER_PROVIDED",
      "clientId": "USER_PROVIDED",
      "channels": ["channel_name_to_join"]
    }
  }
}
```

---

### iMessage (macOS only)

**AI guide steps:**

1. Tell user: "iMessage integration only works on macOS"
2. Tell user: "You need either the `imsg` CLI tool or direct database access"
3. Help configure CLI path or database path

**Config (CLI):**

```json
{
  "channels": {
    "imessage": {
      "enabled": true,
      "cliPath": "/usr/local/bin/imsg"
    }
  }
}
```

**Config (database):**

```json
{
  "channels": {
    "imessage": {
      "enabled": true,
      "dbPath": "~/Library/Messages/chat.db"
    }
  }
}
```

---

## Step 2: Apply config patch

After building the config JSON for the chosen platform:

```bash
curl -s http://127.0.0.1:18789/__winclaw__/api \
  -d '{
    "method": "config.patch",
    "params": {
      "raw": "<JSON_STRING_OF_PATCH>",
      "baseHash": "<HASH_FROM_CONFIG_GET>"
    }
  }'
```

The `raw` value must be a JSON **string** (escaped). The patch is merged using RFC 7386 JSON Merge Patch.

**Important**: Gateway restarts automatically after config.patch. Wait a few seconds before testing.

---

## Step 3: Verify connection

Wait 3-5 seconds after config patch, then:

```bash
curl -s http://127.0.0.1:18789/__winclaw__/api \
  -d '{"method":"channels.status","params":{"probe":true,"timeoutMs":10000}}'
```

Check the response for the newly added channel:

- `configured: true` → Config is correct
- `running: true` → Channel process started
- `connected: true` → Successfully connected to platform

---

## Step 4: Configure DM/group policies

After connection is verified, ask user about access policies:

**Options to present:**

- `dmPolicy: "open"` — Anyone can DM the bot (use for public bots)
- `dmPolicy: "pairing"` — Users must pair/register first (default, recommended for personal use)
- `dmPolicy: "allowlist"` — Only specific users can DM (strictest)
- `groupPolicy: "open"` — Bot responds in any group it's added to
- `groupPolicy: "allowlist"` — Only allowed groups
- `groupPolicy: "disabled"` — No group messages

---

## Troubleshooting

| Problem                     | Solution                                                                     |
| --------------------------- | ---------------------------------------------------------------------------- |
| `configured: false`         | Config patch didn't apply correctly. Re-read config and check JSON structure |
| `running: false`            | Channel failed to start. Check `lastError` in status response                |
| `connected: false`          | Credentials may be invalid. Ask user to verify token/key                     |
| WhatsApp QR expired         | Click "Show QR" again or call `web.login.start` with `force: true`           |
| Telegram "Unauthorized"     | Token is invalid or revoked. Get new token from @BotFather                   |
| Discord "Missing Access"    | Bot not invited to server, or missing Message Content Intent                 |
| Slack "invalid_auth"        | Bot token expired or app uninstalled. Regenerate tokens                      |
| LINE "Invalid token"        | Channel access token may have expired. Reissue from LINE Dev Console         |
| Signal "Connection refused" | signal-cli HTTP daemon not running. Start it first                           |
| Matrix "M_UNKNOWN_TOKEN"    | Access token invalid. Generate new one from Element settings                 |

## Multi-account pattern

To add a second account for any platform, use the `accounts` structure:

```json
{
  "channels": {
    "PLATFORM": {
      "accounts": {
        "UNIQUE_ACCOUNT_ID": {
          "enabled": true,
          "name": "Human-friendly Name",
          ... platform-specific credentials ...
        }
      }
    }
  }
}
```

The `UNIQUE_ACCOUNT_ID` can be any string (e.g., "work", "personal", "bot2"). Each account runs independently with its own credentials and policies.

## Conversation guidelines

- Always start friendly: "Which messaging platform would you like to connect?"
- Show only the relevant platform guide, not all 19
- If user seems confused, offer the top 3 easiest: WhatsApp (QR), Telegram (Token), Discord (Token)
- For QR-based platforms (WhatsApp, Zalo Personal), always direct user to the Gateway Web UI
- Never ask user to paste passwords or keys in public channels — only in direct/private chat
- After successful connection, suggest setting up DM policies
- If connection fails, use the troubleshooting table and check `lastError` from `channels.status`

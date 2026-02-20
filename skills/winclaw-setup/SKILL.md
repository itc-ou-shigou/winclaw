---
name: winclaw-setup
description: Configure WinClaw/WinClaw gateway core settings via chat. Use when the user asks to change gateway port, authentication (token/password), TLS/HTTPS, bind address, AI model, theme, assistant identity, logging, update channel, or any general system configuration. Also use for initial setup, security settings, UI customization, or "help me set up WinClaw".
metadata: { "winclaw": { "emoji": "⚙️" } }
---

# WinClaw Gateway Setup

Configure core gateway settings by reading and patching `~/.winclaw/winclaw.json` via the gateway API.

## Config file

Path: `~/.winclaw/winclaw.json` (JSON5 format, supports comments).
Always read the current config before making changes.

## How to read config

```bash
curl -s http://127.0.0.1:18789/__winclaw__/api \
  -H "Content-Type: application/json" \
  -d '{"method":"config.get","params":{}}'
```

Response includes `raw` (JSON5 text), `config` (parsed object), `hash` (for optimistic locking), `valid`, and `issues`.

## How to patch config

Use `config.patch` for partial updates. Always include `baseHash` from the most recent `config.get`.

```bash
curl -s http://127.0.0.1:18789/__winclaw__/api \
  -H "Content-Type: application/json" \
  -d '{
    "method": "config.patch",
    "params": {
      "raw": "{ \"gateway\": { \"port\": 18789 } }",
      "baseHash": "<hash-from-config.get>"
    }
  }'
```

Setting a value to `null` deletes it. After patching, gateway may hot-reload or restart depending on what changed.

## Configurable settings

### Gateway core

| Setting             | Config path                           | Default        | Notes                                |
| ------------------- | ------------------------------------- | -------------- | ------------------------------------ |
| Port                | `gateway.port`                        | 18789          | Requires restart                     |
| Bind mode           | `gateway.bind`                        | "auto"         | auto, lan, loopback, custom, tailnet |
| Custom bind host    | `gateway.customBindHost`              | —              | Only when bind="custom"              |
| Auth mode           | `gateway.auth.mode`                   | "token"        | "token" or "password"                |
| Auth token          | `gateway.auth.token`                  | auto-generated | Shared secret                        |
| Auth password       | `gateway.auth.password`               | —              | Alternative to token                 |
| Control UI enabled  | `gateway.controlUi.enabled`           | true           | Web dashboard on/off                 |
| Allow insecure auth | `gateway.controlUi.allowInsecureAuth` | false          | Token-only over HTTP                 |

### TLS / HTTPS

| Setting            | Config path                | Default |
| ------------------ | -------------------------- | ------- |
| TLS enabled        | `gateway.tls.enabled`      | false   |
| Auto-generate cert | `gateway.tls.autoGenerate` | true    |
| Cert path          | `gateway.tls.certPath`     | —       |
| Key path           | `gateway.tls.keyPath`      | —       |

### AI Model

| Setting         | Config path                       | Default                   |
| --------------- | --------------------------------- | ------------------------- |
| Primary model   | `agents.defaults.model.primary`   | anthropic/claude-opus-4-6 |
| Fallback models | `agents.defaults.model.fallbacks` | []                        |
| Image model     | `agents.defaults.imageModel`      | —                         |
| Streaming       | `agents.defaults.streaming`       | true                      |

Built-in aliases: `opus` → claude-opus-4-6, `sonnet` → claude-sonnet-4-5, `gpt` → gpt-5.2, `gemini` → gemini-3-pro-preview.

### UI / Identity

| Setting          | Config path           | Default                 |
| ---------------- | --------------------- | ----------------------- |
| Theme color      | `ui.seamColor`        | — (hex, e.g. "#E85D3A") |
| Assistant name   | `ui.assistant.name`   | "Assistant"             |
| Assistant avatar | `ui.assistant.avatar` | "A" (emoji/text/URL)    |

### Logging

| Setting          | Config path               | Default |
| ---------------- | ------------------------- | ------- |
| Log level        | `logging.level`           | "info"  |
| Log file         | `logging.file`            | —       |
| Console level    | `logging.consoleLevel`    | —       |
| Redact sensitive | `logging.redactSensitive` | "tools" |

### Authentication profiles

Profiles live at `auth.profiles.<name>` with structure:

```json
{
  "provider": "anthropic",
  "mode": "api_key",
  "apiKey": "${ANTHROPIC_API_KEY}"
}
```

Supported providers: anthropic, openai, google, aws-bedrock, azure, xai, deepseek, ollama.

### Update channel

| Setting        | Config path           | Default  |
| -------------- | --------------------- | -------- |
| Channel        | `update.channel`      | "stable" |
| Check on start | `update.checkOnStart` | true     |

Options: "stable", "beta", "dev".

## Workflow

1. Run `config.get` to read current state and obtain `hash`.
2. Ask user what they want to change (or infer from their message).
3. Build a JSON patch object with only the changed fields.
4. Run `config.patch` with `baseHash`.
5. Confirm the change and explain if restart is needed.

## Examples

**User: "Change the AI model to Sonnet"**
→ Patch: `{"agents":{"defaults":{"model":{"primary":"anthropic/claude-sonnet-4-5"}}}}`

**User: "Set my gateway password to mysecret"**
→ Patch: `{"gateway":{"auth":{"mode":"password","password":"mysecret"}}}`

**User: "Enable HTTPS"**
→ Patch: `{"gateway":{"tls":{"enabled":true,"autoGenerate":true}}}`

**User: "Change bot name to MyClaw with 🦞 avatar"**
→ Patch: `{"ui":{"assistant":{"name":"MyClaw","avatar":"🦞"}}}`

## Important

- Always get `baseHash` first — writes without it may fail.
- Sensitive values (tokens, passwords, API keys) are redacted as `__WINCLAW_REDACTED__` in responses. Never overwrite redacted values.
- Gateway settings changes require restart; model/UI/logging changes hot-reload.
- Use JSON5 format in `raw` field (comments and trailing commas OK).

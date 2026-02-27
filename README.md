# WinClaw -- Personal AI Assistant

<p align="center">
  <a href="https://github.com/itc-ou-shigou/winclaw/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/itc-ou-shigou/winclaw/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://github.com/itc-ou-shigou/winclaw/releases"><img src="https://img.shields.io/github/v/release/itc-ou-shigou/winclaw?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

## Overview

**WinClaw** is a personal AI assistant and multi-channel AI gateway
you run on your own devices. It answers you on the channels you already use --
WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, iMessage, Microsoft Teams,
Matrix, Zalo, and WebChat -- while keeping your data local. The gateway is the
control plane; the product is the assistant.

WinClaw runs natively on **macOS** (launchd daemon), **Linux** (systemd user service),
and **Windows** (Task Scheduler). On Windows it ships as a standalone EXE installer
with a bundled Node.js runtime, so there are no prerequisites to install. On all
platforms the onboarding wizard (`winclaw onboard`) guides you through setup in
minutes.

WinClaw works with **Anthropic Claude** (Pro/Max subscriptions via OAuth),
**OpenAI** (ChatGPT/Codex), and any OpenAI-compatible provider. Model failover,
profile rotation, and multi-model concurrency are built in. For best results
with long-context strength and prompt-injection resistance, Anthropic Opus 4.6 is
recommended.

## Windows Installation

### Method 1: EXE Installer (Recommended)

Download **WinClawSetup-{version}.exe** from
[GitHub Releases](https://github.com/itc-ou-shigou/winclaw/releases) and run it.
The installer is also available locally in the [`releases/`](releases/) directory.

| Feature         | Detail                                                         |
| --------------- | -------------------------------------------------------------- |
| Admin required  | No -- installs to user profile by default (`{autopf}\WinClaw`) |
| Bundled runtime | Node.js 22 LTS (portable), no prerequisites needed             |
| Installer tasks | Desktop shortcut, add to PATH, install gateway daemon          |
| Languages       | English, Japanese, Korean                                      |
| Min OS          | Windows 10 1803+ (Build 17134) or Windows 11                   |
| Architecture    | x64                                                            |

The installer automatically:

1. Copies the bundled Node.js 22 runtime and the pre-built WinClaw app.
2. Sets the `WINCLAW_HOME` environment variable pointing to the install directory.
3. Optionally adds `winclaw.cmd` to your user PATH.
4. Optionally installs the Gateway daemon as a Windows Scheduled Task (auto-start on logon).
5. Launches the **interactive onboarding wizard** (`winclaw onboard --flow quickstart`) on the installer's final page.

> **Important:** If running Node.js processes from a previous WinClaw installation are
> still active, the installer will prompt you to close them. Select
> "Automatically close the applications" and click Next to proceed.

### Post-Install Onboarding Wizard

When you check "Run WinClaw Setup Wizard" on the installer's final page and
click Finish, a terminal window opens with the interactive onboarding wizard.
The wizard walks you through:

1. **Gateway mode** -- sets `gateway.mode` to `local` (recommended for single-machine use).
2. **Authentication token** -- generates a `gateway.auth.token` for securing the Gateway WebSocket.
3. **AI model credentials** -- configures Anthropic (Claude), OpenAI, or other provider API keys / OAuth tokens.
4. **Messaging channels** -- optionally links WhatsApp, Telegram, Slack, etc.
5. **Daemon installation** -- optionally registers the Gateway as a Windows Scheduled Task.

If you skipped the wizard during installation, or need to re-run it later:

```powershell
winclaw onboard --flow quickstart
```

The desktop shortcut and Start Menu launcher (`winclaw-ui.cmd`) also detect
first-run automatically: if `gateway.mode` is not configured, it launches the
onboarding wizard before starting the Gateway.

### Windows Post-Install: Accessing the Dashboard

After the onboarding wizard completes, the Gateway listens on
`http://127.0.0.1:18789/`. The **Control UI (Dashboard)** requires
authentication with the gateway token.

**Option 1: Auto-open with token (recommended)**

```powershell
winclaw dashboard
```

This command opens the Dashboard in your default browser with the token
pre-filled in the URL fragment (`http://127.0.0.1:18789/#token=<your-token>`).

**Option 2: Print URL without opening**

```powershell
winclaw dashboard --no-open
```

Copy the printed URL and paste it into your browser.

**Option 3: Manual access**

1. Open `http://127.0.0.1:18789/` in your browser.
2. If you see "disconnected (1008): unauthorized: gateway token mismatch", you
   need to provide the gateway token.
3. Retrieve the token:
   ```powershell
   winclaw config get gateway.auth.token
   ```
4. Append it to the URL: `http://127.0.0.1:18789/#token=<your-token>`

### Windows Post-Install: Model Auth Token Setup

The Gateway requires valid AI provider credentials. If you see
`HTTP 401 authentication_error: OAuth token has expired`, refresh or add a new token:

```powershell
# Interactive login (opens browser for OAuth flow)
winclaw models auth login --provider anthropic

# Or paste a token manually
winclaw models auth add
```

Auth profiles are stored in
`%USERPROFILE%\.winclaw\agents\main\agent\auth-profiles.json`.
You can also edit this file directly to add or update tokens.

### Method 2: PowerShell One-liner

```powershell
irm https://raw.githubusercontent.com/itc-ou-shigou/winclaw/main/install.ps1 | iex
```

This script checks your Windows version, installs Node.js 22 via winget/choco/scoop
if needed, installs WinClaw globally via npm, and launches the onboarding wizard.

### Method 3: npm (if Node.js 22+ is already installed)

```bash
npm install -g winclaw@latest
winclaw onboard --install-daemon
```

### Method 4: winget

```
winget install WinClaw.WinClaw
```

## macOS / Linux Installation

**Runtime requirement:** Node.js 22+

```bash
# npm
npm install -g winclaw@latest

# pnpm
pnpm add -g winclaw@latest

# Then run the onboarding wizard
winclaw onboard --install-daemon
```

The wizard installs the gateway daemon as a launchd user service (macOS) or
systemd user service (Linux) so it stays running across reboots.

**Alternative methods:**

| Method      | Command / Link                                        |
| ----------- | ----------------------------------------------------- |
| Nix         | [nix-winclaw](https://github.com/winclaw/nix-winclaw) |
| Docker      | `docker pull winclaw/winclaw:latest`                  |
| From source | See [Development](#development-from-source) below     |

## Quick Start

### Windows (after EXE installer)

```powershell
# 1. If you skipped the onboarding wizard, run it now
winclaw onboard --flow quickstart

# 2. Start the gateway daemon (if not already running)
winclaw daemon install

# 3. Open the Control UI Dashboard (auto-opens browser with token)
winclaw dashboard

# 4. Launch the terminal UI
winclaw tui

# 5. Talk to the assistant
winclaw agent --message "Hello" --thinking high

# 6. Send a message to a connected channel
winclaw message send --to +1234567890 --message "Hello from WinClaw"

# 7. Check gateway and channel health
winclaw doctor
```

### macOS / Linux

```bash
# 1. Run the onboarding wizard (sets up config, auth, channels, daemon)
winclaw onboard --install-daemon

# 2. Start the gateway manually (if daemon not installed)
winclaw gateway --port 18789 --verbose

# 3. Open the Control UI Dashboard
winclaw dashboard

# 4. Talk to the assistant
winclaw agent --message "Hello" --thinking high

# 5. Send a message to a connected channel
winclaw message send --to +1234567890 --message "Hello from WinClaw"

# 6. Launch the terminal UI
winclaw tui
```

Run `winclaw doctor` at any time
to verify your installation and diagnose issues.

## ⭐ Featured Skills

WinClaw ships with two powerful automation skills that supercharge your development workflow on Windows.

### 🧪 AI Dev System Testing — Automated Web Application Testing

Automatically test your web applications with AI-powered code analysis, API testing, and browser UI testing. The AI agent analyzes your codebase, performs code review with auto-fix, tests API endpoints, and validates UI flows — all without writing a single test script.

**Supported Languages (Auto-Fix):** Python, PHP, Go, JavaScript/Node.js, TypeScript/React, and other interpreted languages.

> **Note:** Automated testing and bug auto-fix for compiled languages (Java, C++, C#, etc.) is not included in the OSS edition. For enterprise support, contact us at **info@itccloudsoft.com**.

#### Prerequisites

1. **WinClaw** installed on your Windows PC
2. **Claude in Chrome** extension installed from the [Chrome Web Store](https://chromewebstore.google.com/) (required for browser UI testing in Phase 5C)
3. **Claude subscription** (Pro/Max recommended for best results), OR use an alternative model (see below)

#### Using Alternative Models (e.g., GLM-5)

You don't need a Claude subscription — any OpenAI-compatible model works. For example, to use **GLM-5** (Zhipu AI):

```cmd
Set ANTHROPIC_BASE_URL=https://open.bigmodel.cn/api/anthropic
Set ANTHROPIC_AUTH_TOKEN=your-glm-api-key
Set ANTHROPIC_MODEL=glm-5
```

#### How to Use

**Interactive mode (recommended for first run):**

```powershell
# Tell WinClaw to test your project
# In the WinClaw Chat tab, simply say:
"Test my web project at C:\path\to\my-project, frontend is http://localhost:3000, backend is http://localhost:8000"
```

**Direct script execution:**

```powershell
# Basic usage (interactive — asks for URLs)
& "C:\Users\USER\AppData\Local\Programs\WinClaw\app\skills\ai-dev-system-testing\scripts\run-all.ps1" `
    -Workspace "C:\path\to\my-project"

# Full parameters (non-interactive)
& "C:\Users\USER\AppData\Local\Programs\WinClaw\app\skills\ai-dev-system-testing\scripts\run-all.ps1" `
    -Workspace "C:\path\to\my-project" `
    -FrontendUrl "http://localhost:3000" `
    -BackendUrl "http://localhost:8000" `
    -NonInteractive

# Resume mode (skip completed phases)
& "C:\Users\USER\AppData\Local\Programs\WinClaw\app\skills\ai-dev-system-testing\scripts\run-all.ps1" `
    -Workspace "C:\path\to\my-project" -Resume
```

#### Test Phases

| Phase | What It Does | Output |
|-------|-------------|--------|
| Phase 2 | Code structure analysis | `CODE_ANALYSIS.md` |
| Phase 3 | Code review + auto-fix | `CODE_REVIEW_REPORT.md` |
| Phase 5B | API endpoint testing (iterative) | `test-logs/phase5b_*.json` |
| Phase 5C | Browser UI testing via Chrome | `test-logs/phase5c_*.json` |
| Phase 6 | Documentation generation | `docs/` |

Phase 5B/5C run up to 15 iterations, automatically fixing failing tests until the pass rate reaches 95%+ (API) or 100% (UI).

#### Test Account Configuration

For Phase 5 testing, you need test credentials:

```powershell
$env:TEST_USER_EMAIL = "test@example.com"
$env:TEST_USER_PASSWORD = "YourTestPassword123"
```

---

### 🆓 Free LLM Updater — 10+ Free Model APIs, Auto-Updated Daily

Automatically discover and register free LLM API providers into WinClaw. The skill fetches the latest free providers from [cheahjs/free-llm-api-resources](https://github.com/cheahjs/free-llm-api-resources), validates each API key and endpoint, and adds working providers to your model list. A daily cron job keeps the list fresh — every morning at 10:00 AM, WinClaw automatically checks for new free providers.

**Available Free Providers:**

| Provider | Models | Signup |
|----------|--------|--------|
| Groq | LLaMA, Mixtral | [console.groq.com](https://console.groq.com) |
| OpenRouter | 100+ models | [openrouter.ai](https://openrouter.ai) |
| Google AI Studio | Gemini Pro/Flash | [aistudio.google.com](https://aistudio.google.com) |
| Cerebras | LLaMA 70B | [cloud.cerebras.ai](https://cloud.cerebras.ai) |
| Mistral | Mistral/Mixtral | [console.mistral.ai](https://console.mistral.ai) |
| GitHub Models | GPT-4o, LLaMA | [github.com/marketplace/models](https://github.com/marketplace/models) |
| NVIDIA NIM | LLaMA, Mixtral | [build.nvidia.com](https://build.nvidia.com) |
| HuggingFace | Open-source models | [huggingface.co](https://huggingface.co) |
| Cohere | Command R+ | [cohere.com](https://cohere.com) |
| ...and more | Auto-discovered | Updated daily |

#### How to Use

1. Sign up for free API keys from the providers above
2. Set the API keys as environment variables (e.g., `GROQ_API_KEY`, `GEMINI_API_KEY`)
3. Tell WinClaw: **"Update my free LLM providers"**
4. WinClaw validates each provider and adds working ones to your model list
5. Switch between free models in the **WinClaw model selection dropdown**

The daily auto-update cron job is registered automatically on first run — no manual setup needed.

---

## Featured Plugins

WinClaw v2026.2.28 ships with **18 pre-built plugins** spanning 15 professional domains. Each plugin bundles curated skills, slash commands, and MCP server integrations — configured entirely through natural language in the Chat tab.

### Plugin Overview

| Plugin | Domain | Commands | Skills | Key MCP Integrations |
|--------|--------|----------|--------|----------------------|
| **bio-research** | Life Sciences R&D | 1 | 5 | PubMed, bioRxiv, ChEMBL, ClinicalTrials.gov |
| **customer-support** | Support Ops | 5 | 5 | Slack, Intercom, HubSpot, Atlassian |
| **data** | Data & Analytics | 6 | 7 | Snowflake, Databricks, BigQuery, Hex |
| **design** | UX/UI Design | 6 | 6 | Figma, Linear, Notion |
| **engineering** | Dev Workflow | 6 | 6 | GitHub, PagerDuty, Datadog, Linear |
| **enterprise-search** | Cross-Tool Search | 2 | 3 | Slack, Notion, Guru, Atlassian |
| **finance** | Accounting & FP&A | 5 | 6 | Snowflake, BigQuery |
| **human-resources** | People Ops | 6 | 6 | Slack, Google Calendar, Notion |
| **legal** | Contract & Compliance | 7 | 6 | Box, DocuSign, Atlassian |
| **marketing** | Content & Campaigns | 7 | 5 | Canva, HubSpot, Ahrefs, Klaviyo |
| **operations** | Business Ops | 6 | 6 | ServiceNow, Asana, Atlassian |
| **product-management** | Product Strategy | 7 | 6 | Linear, Amplitude, Pendo, Figma |
| **productivity** | Task & Memory | 2 | 2 | Slack, Notion, Asana, Monday |
| **sales** | Pipeline & Outreach | 3 | 6 | HubSpot, Clay, ZoomInfo, Apollo |
| **partner-built/apollo** | Sales Automation | -- | 3 | Apollo |
| **partner-built/brand-voice** | Brand Guardrails | 3 | 3 | Notion, Figma, Gong |
| **partner-built/common-room** | GTM Intelligence | 2 | 6 | Common Room |
| **partner-built/slack** | Slack Workflows | 5 | 2 | Slack |

### How to Enable a Plugin

Plugins are configured through natural language — just tell WinClaw what you need:

```
You:   I want to use the data analytics plugin
AI:    I'll enable the data plugin for you. It includes 6 commands
       (analyze, build-dashboard, create-viz, explore-data, validate, write-query)
       and connects to Snowflake, Databricks, and BigQuery.
       Which data source would you like to connect first?
```

Or configure manually in `winclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "data": { "enabled": true },
      "sales": { "enabled": true },
      "engineering": { "enabled": true }
    }
  }
}
```

### Plugin Usage Examples

**Data Analysis:**

```
You:   Analyze our Q4 revenue data from Snowflake
AI:    Running /data:analyze... Connected to Snowflake.
       Q4 Revenue: $2.3M (+18% QoQ). Top segment: Enterprise (62%).
       Want me to build a dashboard or create a visualization?
```

**Sales Pipeline:**

```
You:   Research Acme Corp and draft a personalized outreach email
AI:    Running /sales:draft-outreach... Found Acme Corp on ZoomInfo:
       Series B, 150 employees, using Salesforce. Key contact: Jane Doe (VP Sales).
       Here's a personalized email draft based on their recent product launch...
```

**Legal Contract Review:**

```
You:   Review this NDA from our new vendor
AI:    Running /legal:triage-nda... Classification: GREEN (standard).
       Key terms: 2-year duration, mutual obligations, standard carve-outs.
       One flag: non-compete clause in Section 7 is broader than typical.
       Recommend negotiating to limit scope to direct competitors only.
```

**Bio-Research:**

```
You:   Find recent clinical trials for pembrolizumab in lung cancer
AI:    Running /bio-research:start... Found 47 recruiting trials.
       Top 3 Phase III trials: NCT04567890 (combo with chemo, n=800),
       NCT04891234 (adjuvant setting, n=1200)...
       Want me to analyze endpoints or find related PubMed articles?
```

---

## Configuration

### Config file locations

| Platform              | Default path                          |
| --------------------- | ------------------------------------- |
| Windows (all methods) | `%USERPROFILE%\.winclaw\winclaw.json` |
| macOS / Linux         | `~/.winclaw/winclaw.json`             |

The path can be overridden with `WINCLAW_CONFIG_PATH` or `WINCLAW_STATE_DIR`.

Additional configuration files on Windows:

| File          | Path                                                          | Purpose                                      |
| ------------- | ------------------------------------------------------------- | -------------------------------------------- |
| Main config   | `%USERPROFILE%\.winclaw\winclaw.json`                         | Gateway, channels, skills, agent settings    |
| Auth profiles | `%USERPROFILE%\.winclaw\agents\main\agent\auth-profiles.json` | AI provider tokens (Anthropic, OpenAI, etc.) |
| Credentials   | `%USERPROFILE%\.winclaw\credentials\`                         | Channel credentials (WhatsApp session, etc.) |
| Sessions      | `%USERPROFILE%\.winclaw\agents\main\sessions\`                | Conversation session history                 |

### Minimal config example

```json
{
  "gateway": {
    "mode": "local",
    "port": 18789,
    "auth": {
      "mode": "token",
      "token": "<your-generated-token>"
    }
  },
  "agent": {
    "model": "claude-opus-4-6"
  }
}
```

> **Note:** The onboarding wizard generates this configuration automatically.
> Manual editing is only needed for advanced customization.

### Key configuration sections

| Section    | Purpose                                                        |
| ---------- | -------------------------------------------------------------- |
| `agent`    | Model selection, thinking mode, concurrency, context limits    |
| `channels` | WhatsApp, Telegram, Slack, Discord, Signal, Teams, etc.        |
| `gateway`  | Port, remote transport, TLS, authentication                    |
| `skills`   | Skill loading directories, dynamic filter, install preferences |
| `auth`     | OAuth profiles, API key fallbacks, model failover              |
| `hooks`    | Pre/post message hooks, cron schedules                         |
| `memory`   | Conversation memory and session pruning                        |

### Dynamic skill loading

When you have a large number of skills (100+), enable the dynamic filter to
prevent context overflow:

```json
{
  "skills": {
    "dynamicFilter": {
      "mode": "auto",
      "maxSkills": 50,
      "maxSkillsPromptChars": 50000
    }
  }
}
```

Modes: `"off"` (default), `"auto"` (activates when >100 skills), `"on"` (always active).

## Plugin System

WinClaw supports a plugin architecture for extending gateway functionality.
Plugins are located in `extensions/` and enabled via `plugins.entries` in
your config.

### MCP Bridge Plugin

The **MCP Bridge** plugin (`extensions/mcp-bridge/`) bridges external
[Model Context Protocol (MCP)](https://modelcontextprotocol.io/) servers
into WinClaw agent tools. This enables the AI assistant to use any
MCP-compatible tool server — such as browser automation, database access,
or custom APIs — directly through natural conversation.

**Key features:**

- Supports **stdio** (subprocess) and **SSE** (HTTP) MCP transports
- Auto-reconnect with configurable retry attempts
- Tool calls are namespaced as `mcp__<server-name>__<tool-name>`
- Chrome tab protection: a `before_tool_call` hook blocks dangerous
  operations (closing tabs, killing Chrome, navigating user tabs)

**Configuration example:**

```json
{
  "plugins": {
    "entries": {
      "mcp-bridge": {
        "enabled": true,
        "servers": [
          {
            "name": "chrome-devtools",
            "transport": "stdio",
            "command": "npx",
            "args": ["-y", "@anthropic/chrome-devtools-mcp@latest"]
          }
        ]
      }
    }
  }
}
```

### Desktop App Control (VNC + MCP)

The **desktop-app-control** skill enables the AI assistant to operate native
desktop applications (Windows / macOS) through a VNC + Chrome DevTools MCP
pipeline. The assistant can open apps, click buttons, type text, navigate
menus, and take screenshots — all via natural language commands.

**Architecture:** User Request → WinClaw Agent → `mcp__chrome_devtools__*`
tools → Chrome DevTools Protocol → noVNC tab → websockify → VNC Server →
Desktop

**Prerequisites:**

- MCP Bridge plugin enabled with `chrome-devtools` server configured
- VNC server running (TightVNC on Windows, Screen Sharing on macOS)
- websockify + noVNC for browser-based VNC access
- Chrome launched with `--remote-debugging-port` (port auto-selected)

**Safe Chrome debugging:** Use the bundled `scripts/ensure-chrome-debug.ps1`
script to safely enable Chrome remote debugging without disrupting existing
browser sessions. The script automatically scans ports **9222-9229** and uses
the first available one — no need to worry about port conflicts.

---

## Windows-Specific Features

### Native Windows skills

WinClaw ships with four Windows-only skills that use PowerShell and COM Automation:

| Skill              | Description                                                                  |
| ------------------ | ---------------------------------------------------------------------------- |
| `windows-system`   | Service, process, registry, event log, and scheduled task management         |
| `windows-explorer` | File search, bulk rename, compression, clipboard, and file hashing           |
| `windows-office`   | Create and edit Word, Excel, PowerPoint via python-docx/openpyxl/python-pptx |
| `windows-outlook`  | Send, read, and search emails via Outlook COM Automation                     |

### PowerShell script support

Skills can include `.ps1` scripts alongside `.sh` scripts. On Windows, the
PowerShell variant is preferred automatically.

### Windows package managers

Skill dependency installation supports multiple Windows package managers.
Configure your preference in `winclaw.json`:

```json
{
  "skills": {
    "install": {
      "windowsPackageManager": "winget"
    }
  }
}
```

Supported values: `winget`, `scoop`, `choco`. Python dependencies use `pip`.

### Gateway daemon via Task Scheduler

On Windows the gateway daemon is registered as a Scheduled Task that runs at
logon under limited privileges (`/RL LIMITED`). Management commands:

```powershell
winclaw daemon install      # Create and start the scheduled task
winclaw daemon uninstall    # Stop and remove the scheduled task
winclaw daemon status       # Show task status and last run time
winclaw daemon restart      # End + re-run the task
```

### WINCLAW_HOME

The EXE installer sets `WINCLAW_HOME` to the install directory. This allows the
bundled Node.js runtime to be resolved without requiring Node.js on the system PATH.

### Desktop shortcut / Start Menu launcher

The installer creates a desktop shortcut and Start Menu entry that run
`winclaw-ui.cmd`. This script:

1. Checks if first-run setup is needed (no config or `gateway.mode` missing).
2. If needed, launches the onboarding wizard automatically.
3. Starts the Gateway in a minimized window (if not already running).
4. Opens the Dashboard (`http://127.0.0.1:18789/`) in your default browser.

### Windows Troubleshooting

**"disconnected (1008): unauthorized: gateway token mismatch"**

The Dashboard cannot authenticate with the Gateway. Fix:

```powershell
# Get the correct Dashboard URL with token
winclaw dashboard --no-open
# Open the printed URL in your browser
```

**Gateway not starting / port 18789 not responding**

```powershell
# Check if gateway is running
winclaw health

# Check daemon status
winclaw daemon status

# Restart the daemon
winclaw daemon restart

# Or start manually
winclaw gateway --port 18789
```

**"OAuth token has expired" (HTTP 401)**

```powershell
# Re-authenticate with Anthropic
winclaw models auth login --provider anthropic

# Or add a new token manually
winclaw models auth add

# Check current auth profiles
winclaw models status
```

**Config is empty / Schema unavailable in Dashboard**

This means the Dashboard is not connected. Use `winclaw dashboard` to open the
Dashboard with the correct token, or re-run the onboarding wizard:

```powershell
winclaw onboard --flow quickstart
```

**Installer says "Node.js JavaScript Runtime is in use"**

A previous WinClaw Gateway process is still running. Either:

- Select "Automatically close the applications" in the installer prompt, or
- Manually stop them before installing:
  ```powershell
  winclaw daemon stop
  # Or force-kill all WinClaw node processes
  Get-Process -Name node | Where-Object { $_.Path -like '*WinClaw*' } | Stop-Process -Force
  ```

## Channel Setup

WinClaw supports the following messaging channels. Enable them during onboarding
or add them to your config manually.

| Channel         | Auth method                | Docs                                                  |
| --------------- | -------------------------- | ----------------------------------------------------- |
| WhatsApp        | QR code pairing            | [Guide](https://docs.winclaw.ai/channels/whatsapp)    |
| Telegram        | Bot token                  | [Guide](https://docs.winclaw.ai/channels/telegram)    |
| Slack           | OAuth / Bot token          | [Guide](https://docs.winclaw.ai/channels/slack)       |
| Discord         | Bot token                  | [Guide](https://docs.winclaw.ai/channels/discord)     |
| Google Chat     | Service account            | [Guide](https://docs.winclaw.ai/channels/google-chat) |
| Signal          | Signal CLI / linked device | [Guide](https://docs.winclaw.ai/channels/signal)      |
| iMessage        | macOS only (AppleScript)   | [Guide](https://docs.winclaw.ai/channels/imessage)    |
| Microsoft Teams | Bot Framework              | [Guide](https://docs.winclaw.ai/channels/msteams)     |
| Matrix          | Access token               | [Guide](https://docs.winclaw.ai/channels/matrix)      |
| Zalo            | Zalo OA token              | [Guide](https://docs.winclaw.ai/channels/zalo)        |
| WebChat         | Built-in (HTTP)            | [Guide](https://docs.winclaw.ai/channels/webchat)     |

## Skills System

Skills give WinClaw domain-specific capabilities. Each skill is a folder
containing a `SKILL.md` file with frontmatter metadata and instructions.

### Skill categories

| Category   | Location                              | Description                                      |
| ---------- | ------------------------------------- | ------------------------------------------------ |
| Bundled    | `skills/` in the package              | Ship with WinClaw (weather, github, slack, etc.) |
| Managed    | Installed via `winclaw skill install` | Downloaded from ClawHub or npm                   |
| Workspace  | `./skills/` in your project           | Project-specific, version-controlled             |
| Extra dirs | `skills.load.extraDirs` in config     | Additional scan directories                      |

### Dynamic skill loading

For large skill collections (100+ skills), WinClaw uses keyword-based filtering
to inject only the most relevant skills into the agent context. Configure
`skills.dynamicFilter` in your config to control thresholds and always-include lists.

### Skill installation

```bash
# Install a managed skill
winclaw skill install weather

# List available skills
winclaw skill list

# Skill dependencies are installed via the platform package manager
# (brew on macOS, apt on Linux, winget/scoop/choco on Windows, pip for Python)
```

## Chat-based Configuration (Settings Skills)

WinClaw includes 6 built-in **settings skills** that let you configure everything through natural conversation in the Chat tab or any connected messaging channel. No need to manually edit config files — just tell the AI what you want.

### Available settings skills

| Skill                | Emoji | What it does                                                               |
| -------------------- | ----- | -------------------------------------------------------------------------- |
| `winclaw-setup`      | ⚙️    | Gateway core settings: port, auth token, TLS, AI model, theme, logging     |
| `winclaw-channels`   | 🔗    | Add, remove, enable/disable messaging channels; manage DM/group policies   |
| `winclaw-agents`     | 🤖    | Create/configure AI agents: model, personality, workspace, thinking level  |
| `winclaw-cron`       | ⏰    | Schedule recurring tasks: daily reports, reminders, periodic checks        |
| `winclaw-status`     | 📊    | Check system health, usage stats, connected channels, active sessions      |
| `winclaw-sns-wizard` | 📲    | Step-by-step guided setup for connecting any of the 19 supported platforms |

### How it works

Open the **Chat** tab in the Dashboard (or send a message from any connected channel) and describe what you want in plain language. The AI automatically activates the appropriate skill and applies changes through the Gateway API.

### Example conversations

**Initial setup:**

```
You:   Help me set up WinClaw for the first time
AI:    I'll guide you through the initial setup. Let me check your current
       configuration... Your gateway is running on port 18789. Let's configure
       your AI model. Which provider would you like to use?
You:   Anthropic Claude
AI:    Done! I've set agent.model to claude-sonnet-4-20250514. Would you like
       to connect any messaging channels next?
```

**Connecting a messaging platform:**

```
You:   I want to connect Telegram
AI:    Great! Let's set up Telegram step by step.
       1. Open Telegram and search for @BotFather
       2. Send /newbot and follow the prompts to create your bot
       3. Copy the bot token (looks like 123456:ABC-DEF...)
       Paste the token here when ready.
You:   7891234567:AAH2kx9...
AI:    ✅ Telegram connected! Your bot is now receiving messages.
       Would you like to configure DM policies or add allowed users?
```

**Scheduling a recurring task:**

```
You:   Send me a weather summary every morning at 8am
AI:    I'll create a cron job for that. Setting up a daily task at 08:00
       with the prompt "Give a brief weather summary for today"...
       ✅ Cron job created! You'll receive the summary every day at 8:00 AM.
```

**Checking system status:**

```
You:   Is everything working? Show me what's connected
AI:    📊 System Status:
       • Gateway: healthy (uptime 3d 12h)
       • Channels: WhatsApp ✅, Telegram ✅, Discord ❌ (disabled)
       • Active sessions: 4
       • Model: claude-sonnet-4-20250514
       • Skills loaded: 23/50
```

**Managing agents:**

```
You:   Create a new agent called "translator" that uses GPT-4o
AI:    I'll create a new agent with ID "translator" using gpt-4o.
       Would you like to set a system prompt or personality for it?
You:   Yes, make it a Japanese-English translator
AI:    ✅ Agent "translator" created with a translation-focused system prompt.
       It's ready to use. Want to bind it to a specific channel?
```

> **Tip:** These skills are loaded automatically based on keyword matching. Just describe your intent naturally — WinClaw will figure out which skill to use.

---

## Development (from source)

```bash
git clone https://github.com/itc-ou-shigou/winclaw.git
cd winclaw
pnpm install
pnpm build
pnpm winclaw onboard
```

**Requirements:** Node.js 22+, pnpm 10+

The project is an ESM-only pnpm monorepo built with [tsdown](https://github.com/nicepkg/tsdown).

| Command         | Description                   |
| --------------- | ----------------------------- |
| `pnpm build`    | Full production build         |
| `pnpm dev`      | Run from source               |
| `pnpm test`     | Run unit tests (parallel)     |
| `pnpm test:e2e` | End-to-end tests              |
| `pnpm lint`     | Lint with oxlint (type-aware) |
| `pnpm format`   | Format with oxfmt             |
| `pnpm check`    | format + typecheck + lint     |

## Building the Windows Installer

The installer is built with [Inno Setup 6](https://jrsoftware.org/isinfo.php)
and PowerShell packaging scripts. The final EXE is kept **under 100 MB** via
automated size optimizations.

```powershell
# Full build (includes pnpm build step)
# Prerequisites: Inno Setup 6, pnpm, Node.js 22+
.\scripts\package-windows-installer.ps1

# Skip the pnpm build step (reuse existing build artifacts)
.\scripts\package-windows-installer.ps1 -SkipBuild

# Rebuild installer only (reuses existing build artifacts in dist/cache)
# Faster: skips pnpm build, only re-stages and re-compiles the installer
.\scripts\rebuild-installer.ps1
```

The build process:

1. Downloads Node.js 22 LTS portable (x64) to `dist/cache/`.
2. Runs `pnpm build` to produce the production bundle (full build only).
3. Runs `npm pack` and extracts the tarball to `dist/win-staging/app/`.
4. **Removes bloat** from the staged app: old installer EXEs, download caches,
   and `win-staging` leftovers that `npm pack` may include via the `dist/` entry
   in `package.json` `files`.
5. **Strips heavy optional packages** to stay under 100 MB: GPU runtimes
   (CUDA/Vulkan/ARM64), `node-llama-cpp`, `@napi-rs/canvas`, `playwright-core`,
   `@lydell/node-pty`, and type-only packages (`@types`, `bun-types`, etc.).
   Users who need these can install them separately after installation.
6. **Trims node_modules**: removes test suites, docs, TypeScript source files,
   source maps, and config files that are not needed at runtime.
7. Copies the Node.js runtime, launcher scripts, WinClawUI desktop app, and
   assets to `dist/win-staging/`.
8. Compiles `scripts/windows-installer.iss` into `dist/WinClawSetup-{version}.exe`
   using LZMA2/ultra64 solid compression.
9. Copies the installer to `releases/`.

The Inno Setup compilation takes approximately 1-2 minutes. The resulting
installer is typically **~84 MB**.

## Architecture

```
 Channels                         Gateway (Node.js)                  Agent
+-------------+               +-------------------------+       +-----------+
| WhatsApp    |---+           |  HTTP/WS Server (:18789)|       |  Claude   |
| Telegram    |---+           |  +---------------------+|       |  OpenAI   |
| Slack       |---+---------->|  | Channel Router      ||<----->|  Bedrock  |
| Discord     |---+           |  +---------------------+|       |  Ollama   |
| Signal      |---+           |  | Session Manager     ||       |  (any)    |
| Teams       |---+           |  +---------------------+|       +-----------+
| Google Chat |---+           |  | Skills Engine       ||
| iMessage    |---+           |  +---------------------+|       +-----------+
| Matrix      |---+           |  | Memory / Context    ||       | Skills    |
| Zalo        |---+           |  +---------------------+|       | (SKILL.md)|
| WebChat     |---+           |  | Cron / Hooks        ||       +-----------+
+-------------+               |  +---------------------+|
                              |  | Plugins             ||       +-----------+
                              |  |  MCP Bridge --------||------>| MCP       |
                              |  +---------------------+|       | Servers   |
                              +-------------------------+       +-----------+
                                        |
                              +-------------------+
                              | Daemon            |
                              | macOS:  launchd   |
                              | Linux:  systemd   |
                              | Windows: schtasks |
                              +-------------------+
```

**Data flow:** Incoming messages from any channel are routed through the gateway
to the agent. The agent processes the message using the configured model and
available skills, then routes the response back to the originating channel.
The gateway persists sessions, manages conversation memory, and executes
scheduled tasks via hooks and cron. Plugins extend the gateway with additional
capabilities — the MCP Bridge plugin connects external MCP tool servers
(e.g., Chrome DevTools for desktop automation) as agent-callable tools.

## Security Model

WinClaw is designed as a **single-user, local-first** application.

- **Local by default.** The gateway binds to `127.0.0.1`. Do not expose it to
  the public internet without additional hardening.
- **No telemetry.** WinClaw does not phone home or collect usage data.
- **OAuth-first auth.** API keys are supported but OAuth subscription profiles
  (Anthropic Pro/Max, OpenAI) are preferred for credential rotation.
- **Sandboxed execution.** Skill scripts run in subprocess isolation. Docker
  sandbox mode is available for additional containment.
- **Security auditing.** Run `winclaw security audit --deep` for a comprehensive
  security review of your configuration and runtime environment.

For the full threat model, hardening guide, and vulnerability reporting
instructions, see [SECURITY.md](SECURITY.md) and the
[security documentation](https://docs.winclaw.ai/gateway/security).

## License

[MIT](LICENSE)

---

Built with persistence. Contributions welcome at
[github.com/itc-ou-shigou/winclaw](https://github.com/itc-ou-shigou/winclaw).

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
[SourceForge](https://sourceforge.net/projects/winclaw/files/WinClawSetup-2026.3.2.exe/download) |
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

WinClaw ships with five powerful automation skills that supercharge your development workflow on Windows.

### 🧪 AI Dev System Testing — Automated Web Application Testing

Automatically test your web applications with AI-powered code analysis, business logic extraction, API testing, and browser UI testing. The AI agent analyzes your codebase, extracts business logic patterns, performs code review with auto-fix, seeds priority-tiered test data, and executes two-layer testing (standard CRUD + scenario-based business logic) — all without writing a single test script.

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
| Phase 3 | Code review + auto-fix + business logic extraction (with framework best practices) | `CODE_REVIEW_REPORT.md`, `BUSINESS_LOGIC_TESTCASES.md` |
| Phase 5A | Test data seeding (priority-tiered P0–P5 scenarios based on business logic) | `test-data/` |
| Phase 5B | API endpoint testing — two-layer protocol covering all patterns (iterative) | `test-logs/phase5b_*.json` |
| Phase 5C | Browser UI testing — two-layer protocol covering all patterns via Chrome | `test-logs/phase5c_*.json` |
| Phase 6 | Documentation generation | `docs/` |

#### Framework Best Practices (Phase 3 Reference)

Phase 3 dynamically loads framework-specific best practices documents based on your project's detected tech stack. These documents define anti-patterns (bug-risk vs. style-only), security checklists, and performance guidelines that guide both the code review and the auto-fix decisions.

| Best Practices Document | Framework | Key Areas |
|------------------------|-----------|-----------|
| `python-fastapi.md` | Python 3.10+ / FastAPI + SQLAlchemy 2.0 | 3-tier architecture, async patterns, Pydantic validation, N+1 query prevention |
| `java-spring-boot.md` | Java 21+ / Spring Boot 3.x–4.x | Dependency injection, Spring Security, JPA patterns, testing strategies |
| `php-laravel.md` | PHP 8.1+ / Laravel | Eloquent ORM, middleware, form requests, validation rules |
| `go-zero.md` | Go 1.19+ / go-zero | gRPC patterns, struct tag validation, service layer design |
| `react-nextjs.md` | React 18+ / Next.js 13.5+ | Server vs Client components, state management, memoization, immutability |

#### Business Logic Pipeline (Phase 3 → 5A → 5B/5C)

Phase 3 performs a deep code review referencing the best practices above, then extracts **6 categories of business logic patterns** directly from your source code:

1. **Validation Rules** — Pydantic `Field()`, JPA `@NotNull/@Size`, Laravel `rules()`, go-zero struct tags
2. **State Machines** — status/state field transitions, enum definitions, if-chain/switch logic
3. **Authorization Patterns** — `@login_required`, `@PreAuthorize`, auth guards, role-based middleware
4. **Business Constraints** — stock checks, unique constraints, balance/quota limits, referential integrity
5. **Error Handling Paths** — exception handlers, custom exceptions, HTTP error responses
6. **Conditional Business Logic** — role-based features, feature flags, tier-based pricing, time-based rules

These patterns are output as `BUSINESS_LOGIC_TESTCASES.md`, which Phase 5A consumes to generate **priority-tiered (P0–P5) multi-scenario test data**: admin users, invalid validation payloads, records in various states, constraint-triggering data, and error-path triggers. Phase 5B/5C then execute a **two-layer testing protocol** that covers **all extracted patterns**: Layer 1 (standard CRUD/page tests) + Layer 2 (mandatory scenario-based business logic tests for every pattern discovered in Phase 3). Each phase runs up to 15 iterations, automatically fixing failing tests until the pass rate reaches 95%+ (API) or 100% (UI).

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

### ☁️ Cloud Deploy Skills — One-Command Deployment to AWS, Azure & Alibaba Cloud

WinClaw includes three cloud deployment skills that handle everything from simple infrastructure to complex security architectures — all through natural conversation in WinClaw Chat. Each skill guides you from requirements gathering through architecture design, infrastructure provisioning, code deployment, and post-deployment verification. For enterprise-grade security needs, the skills automatically invoke the `/architecture` command (Engineering Plugin) to design comprehensive security architectures (WAF, DDoS protection, KMS, IAM, threat detection, compliance monitoring) before deployment.

| Skill | Cloud Provider | Trigger Phrases | Infrastructure-as-Code |
|-------|---------------|-----------------|----------------------|
| **aws-cloud-deploy** | Amazon Web Services | "deploy to aws", "AWS deploy" | CloudFormation (YAML) |
| **azure-cloud-deploy** | Microsoft Azure | "deploy to azure", "Azure deploy" | ARM Templates (JSON) |
| **aliyun-cloud-deploy** | Alibaba Cloud | "deploy to aliyun", "Alibaba Cloud deploy" | ROS Templates (JSON) |

#### 6 Architecture Patterns

Each skill supports 6 architecture patterns automatically selected based on your budget, traffic, and requirements:

| Pattern | Budget | Traffic | AWS | Azure | Alibaba Cloud |
|---------|--------|---------|-----|-------|--------------|
| **Lite** | $10-40/mo | <500/day | EC2 + EIP | VM + Public IP | ECS + EIP |
| **Standard** | $50-150/mo | 500-5K/day | EC2 + ALB + RDS | App Service + DB | ECS + SLB + RDS |
| **HA** | $150-300/mo | 5K-50K/day | ASG + Multi-AZ RDS | App Gateway + HA DB | ESS + Multi-AZ RDS |
| **Elastic** | $250-600/mo | 50K-500K/day | ASG + ElastiCache + CloudFront | VMSS + Redis + CDN | ESS + Redis + CDN |
| **Serverless** | $0-100/mo | Variable | Lambda + API Gateway | Functions + API Mgmt | FC + API Gateway |
| **Container** | $300+/mo | 50K-1M+/day | EKS + ECR | AKS + ACR | ACK + ACR |

#### Workflow

```
Phase 1: Requirements    → Detect project type, ask budget/traffic/DB/security questions
                           Enterprise security? → Auto-invoke /architecture for ADR design
Phase 2: Plan & Approve  → Recommend architecture, show cost estimate, get user approval
Phase 3A: Infrastructure → Generate & validate IaC template, deploy via CLI or Console
Phase 3B: Code Deploy    → Generate deploy script, SCP/Docker/kubectl/CLI deployment
Phase 3C: Verify & Fix   → Health check → diagnose errors → auto-fix → re-deploy (loop)
Phase 3D: Report         → Generate deployment report with access URLs and next steps
```

> **Auto-Recovery:** If Phase 3C verification detects errors (HTTP failures, service crashes, misconfigured resources), WinClaw automatically analyzes logs, identifies root causes, applies fixes, and re-deploys — repeating until all health checks pass. When manual intervention is needed (e.g., DNS configuration, IAM permissions), WinClaw provides step-by-step guidance and requests minimal user assistance to resolve quickly.

#### Prerequisites — Cloud CLI Authentication

**You must configure cloud CLI authentication before using these skills.** WinClaw will not ask for your credentials — they must be pre-configured in your terminal environment.

| Provider | Authentication Command | Verification |
|----------|----------------------|-------------|
| AWS | `aws configure` (Access Key + Secret Key) | `aws sts get-caller-identity` |
| Azure | `az login` (browser-based SSO) | `az account show` |
| Alibaba Cloud | `aliyun configure` (Access Key + Secret Key) | `aliyun sts GetCallerIdentity` |

> **Security Note:** Never paste credentials directly into WinClaw Chat. Always configure authentication through the cloud provider's CLI tool in your terminal. WinClaw reads the pre-configured credentials from the CLI environment and never stores them.

#### How to Use

1. **Start** — Tell WinClaw: *"Deploy my project to AWS"* (or Azure / Alibaba Cloud)
2. **Answer questions** — WinClaw detects your project and asks about budget, traffic, DB, security needs
3. **Security design** *(if needed)* — For enterprise requirements, WinClaw auto-invokes `/architecture` to design WAF, KMS, IAM, threat detection, and compliance architecture
4. **Review plan** — WinClaw recommends an architecture with cost breakdown. Approve or adjust
5. **Deploy** — WinClaw generates infrastructure templates, provisions resources, deploys your code
6. **Auto-verify & fix** — WinClaw runs health checks; if errors are found, it diagnoses, fixes, and re-deploys automatically until all checks pass. Requests simple user assistance only when manual steps are needed

```
You:    Deploy my Express app to AWS, budget around $100/month
WinClaw: I detected a Node.js/Express project (port 3000).
         Let me ask a few questions to design the right architecture...
         [Asks about traffic, database, security needs]
         ...
         Recommended: Standard pattern (EC2 + ALB + RDS MySQL)
         Estimated cost: $71.62/month — Approve?
You:    Yes, deploy it
WinClaw: [Generates CloudFormation → Deploys stack → SCP code → Health check]
         ⚠ Health check returned HTTP 502 — investigating...
         Root cause: PM2 not starting (missing ecosystem.config.js)
         [Auto-fix: generates config → re-deploys → re-checks]
         ✅ All health checks passed!
         Deployment complete! Access URL: http://my-app-alb-123.us-east-1.elb.amazonaws.com/
```

---

## Featured Plugins

WinClaw ships with **18 pre-built plugins** covering 15 professional domains — **88 slash commands**, **90+ AI skills**, and **40+ MCP integrations** ready to use. Enable any plugin with a single chat message or a one-line config change.

### Quick Start

**Option A — Natural language** (just type in Chat):
```
You:   Enable the sales plugin
AI:    Done! Sales plugin is active with 3 commands and 6 skills.
       Try /sales:draft-outreach to research a prospect and draft outreach.
```

**Option B — Config file** (`winclaw.json`):
```json
{
  "plugins": {
    "entries": {
      "data": { "enabled": true },
      "sales": { "enabled": true },
      "bio-research": { "enabled": true }
    }
  }
}
```

### Plugin Catalog

#### Business Core

<details>
<summary><b>productivity</b> — Task management and persistent memory across sessions</summary>

| Type | Name | What it does |
|------|------|-------------|
| Command | `/start` | Initialize the productivity dashboard and sync tasks |
| Command | `/update` | Refresh tasks and memory from current activity |
| Skill | task-management | Track tasks via shared TASKS.md with status updates |
| Skill | memory-management | Two-tier memory system for cross-session context |

MCP: Slack, Notion, Asana, Linear, Monday, Atlassian, Google Calendar, Gmail
</details>

<details>
<summary><b>data</b> — SQL generation, data exploration, dashboards, and visualizations</summary>

| Type | Name | What it does |
|------|------|-------------|
| Command | `/analyze` | Answer data questions from quick lookups to full analysis |
| Command | `/build-dashboard` | Build interactive HTML dashboards with charts and filters |
| Command | `/create-viz` | Create publication-quality visualizations with Python |
| Command | `/explore-data` | Profile a dataset — shape, distributions, anomalies |
| Command | `/validate` | QA an analysis before sharing with stakeholders |
| Command | `/write-query` | Write optimized SQL for your dialect with best practices |
| Skill | sql-queries | Write correct, performant SQL across all major databases |
| Skill | data-exploration | Profile and explore datasets for shape and quality |
| Skill | data-visualization | Create effective charts with Python (matplotlib, plotly) |
| Skill | interactive-dashboard-builder | Build self-contained interactive HTML dashboards |
| Skill | statistical-analysis | Descriptive stats, hypothesis testing, regression |
| Skill | data-validation | Validate methodology, accuracy, and completeness |
| Skill | data-context-extractor | Generate company-specific data analysis context |

MCP: Snowflake, Databricks, BigQuery, Hex, Amplitude, Atlassian
</details>

<details>
<summary><b>finance</b> — Financial statements, variance analysis, reconciliation, and audit</summary>

| Type | Name | What it does |
|------|------|-------------|
| Command | `/income-statement` | Generate income statements with period comparisons |
| Command | `/journal-entry` | Prepare journal entries with proper debits and credits |
| Command | `/reconciliation` | Reconcile GL balances to subledger, bank, or third-party |
| Command | `/sox-testing` | Generate SOX sample selections and testing workpapers |
| Command | `/variance-analysis` | Decompose variances into drivers with narrative |
| Skill | financial-statements | Income statements, balance sheets, cash flow reports |
| Skill | variance-analysis | Break down variances by driver with explanation |
| Skill | reconciliation | Match GL to subledger and bank records |
| Skill | journal-entry-prep | Proper debit/credit entries with supporting docs |
| Skill | audit-support | SOX 404 compliance testing and sample selection |
| Skill | close-management | Month-end close task sequencing and tracking |

MCP: Snowflake, Databricks, BigQuery, Slack, Google Calendar, Gmail
</details>

<details>
<summary><b>operations</b> — Process optimization, vendor management, and risk assessment</summary>

| Type | Name | What it does |
|------|------|-------------|
| Command | `/capacity-plan` | Forecast resource needs and allocation |
| Command | `/change-request` | Draft and track change management requests |
| Command | `/process-doc` | Document operational procedures step-by-step |
| Command | `/runbook` | Create runbooks for repeatable operations |
| Command | `/status-report` | Generate operational status reports |
| Command | `/vendor-review` | Evaluate and compare vendor performance |
| Skill | process-optimization | Identify bottlenecks and improvement opportunities |
| Skill | vendor-management | Evaluate, compare, and manage vendor relationships |
| Skill | risk-assessment | Assess operational risks with severity and mitigation |
| Skill | resource-planning | Plan capacity and allocate resources |
| Skill | change-management | Structure and track organizational changes |
| Skill | compliance-tracking | Monitor compliance requirements and status |

MCP: Slack, ServiceNow, Asana, Atlassian, Notion, Google Calendar, Gmail
</details>

#### Customer-Facing

<details>
<summary><b>sales</b> — Pipeline management, prospect research, and personalized outreach</summary>

| Type | Name | What it does |
|------|------|-------------|
| Command | `/call-summary` | Extract action items from call notes or transcripts |
| Command | `/forecast` | Generate weighted sales forecasts (best/likely/worst) |
| Command | `/pipeline-review` | Analyze pipeline health — prioritize and flag risks |
| Skill | draft-outreach | Research a prospect then draft personalized messages |
| Skill | account-research | Research a company and get actionable sales insights |
| Skill | call-prep | Prepare for calls with attendee profiles and talking points |
| Skill | competitive-intelligence | Research competitors and build battle cards |
| Skill | create-an-asset | Generate tailored sales assets (decks, landing pages) |
| Skill | daily-briefing | Start your day with prioritized sales briefing |

MCP: HubSpot, Clay, ZoomInfo, Apollo, Slack, Notion, Outreach, Gmail
</details>

<details>
<summary><b>customer-support</b> — Ticket triage, response drafting, escalation, and KB articles</summary>

| Type | Name | What it does |
|------|------|-------------|
| Command | `/draft-response` | Draft professional customer-facing responses |
| Command | `/escalate` | Package an escalation for engineering or product |
| Command | `/kb-article` | Draft a KB article from a resolved issue |
| Command | `/research` | Multi-source research on a customer question |
| Command | `/triage` | Categorize, prioritize, and route support tickets |
| Skill | ticket-triage | Categorize issues by urgency and route to the right team |
| Skill | response-drafting | Draft empathetic, professional customer replies |
| Skill | escalation | Structure escalation packages for engineering |
| Skill | customer-research | Search across docs, logs, and CRM for context |
| Skill | knowledge-management | Turn resolved issues into self-service content |

MCP: Slack, Intercom, HubSpot, Guru, Atlassian, Notion, Gmail
</details>

<details>
<summary><b>marketing</b> — Campaign planning, content creation, SEO, and performance analytics</summary>

| Type | Name | What it does |
|------|------|-------------|
| Command | `/brand-review` | Review content against your brand voice and style guide |
| Command | `/campaign-plan` | Generate a full campaign brief with channels and timeline |
| Command | `/competitive-brief` | Research competitors and positioning analysis |
| Command | `/draft-content` | Draft blog posts, social media, emails, newsletters |
| Command | `/email-sequence` | Design multi-email nurture sequences |
| Command | `/performance-report` | Build marketing performance reports with key metrics |
| Command | `/seo-audit` | Run keyword research, on-page audit, and optimization |
| Skill | campaign-planning | Plan campaigns with objectives, audience, and channels |
| Skill | content-creation | Draft marketing content across all channels |
| Skill | brand-voice | Enforce consistent brand voice and messaging |
| Skill | competitive-analysis | Compare positioning, messaging, and strategy |
| Skill | performance-analytics | Analyze metrics, trends, and ROI |

MCP: Canva, HubSpot, Ahrefs, Klaviyo, Figma, Amplitude, Notion, Slack
</details>

#### Product & Engineering

<details>
<summary><b>product-management</b> — Feature specs, roadmaps, user research, and stakeholder updates</summary>

| Type | Name | What it does |
|------|------|-------------|
| Command | `/competitive-brief` | Create competitive analysis briefs |
| Command | `/metrics-review` | Review and analyze product metrics with trends |
| Command | `/roadmap-update` | Update or reprioritize your product roadmap |
| Command | `/sprint-planning` | Plan and structure sprint work |
| Command | `/stakeholder-update` | Generate updates tailored to audience |
| Command | `/synthesize-research` | Synthesize research from interviews and surveys |
| Command | `/write-spec` | Write a feature spec or PRD from a problem statement |
| Skill | feature-spec | Write structured PRDs with acceptance criteria |
| Skill | roadmap-management | Prioritize roadmaps using RICE/MoSCoW frameworks |
| Skill | user-research-synthesis | Synthesize qualitative and quantitative research |
| Skill | competitive-analysis | Feature comparison matrices and positioning |
| Skill | metrics-tracking | Define, track, and analyze product metrics |
| Skill | stakeholder-comms | Tailor updates by audience (exec, eng, sales) |

MCP: Linear, Amplitude, Pendo, Figma, Slack, Atlassian, Notion, Intercom
</details>

<details>
<summary><b>engineering</b> — Code review, system design, incident response, and documentation</summary>

| Type | Name | What it does |
|------|------|-------------|
| Command | `/architecture` | Design system architecture with trade-off analysis |
| Command | `/debug` | Systematic debugging with root cause analysis |
| Command | `/deploy-checklist` | Generate pre-deployment checklists |
| Command | `/incident` | Structure incident response and post-mortems |
| Command | `/review` | Code review with security and performance checks |
| Command | `/standup` | Generate standup summaries from recent activity |
| Skill | system-design | Design scalable systems with architecture diagrams |
| Skill | code-review | Thorough code review for correctness and security |
| Skill | incident-response | Structured incident response and blameless post-mortems |
| Skill | documentation | Generate technical documentation from code |
| Skill | tech-debt | Identify and prioritize technical debt |
| Skill | testing-strategy | Design comprehensive testing strategies |

MCP: GitHub, PagerDuty, Datadog, Linear, Slack, Atlassian, Notion
</details>

<details>
<summary><b>design</b> — Accessibility audits, UX writing, design critique, and dev handoff</summary>

| Type | Name | What it does |
|------|------|-------------|
| Command | `/accessibility` | Run WCAG accessibility audits |
| Command | `/critique` | Get structured design feedback |
| Command | `/design-system` | Manage and document design system components |
| Command | `/handoff` | Generate pixel-perfect dev handoff specs |
| Command | `/research-synthesis` | Synthesize UX research findings |
| Command | `/ux-copy` | Write and review microcopy and UI text |
| Skill | accessibility-review | WCAG compliance audits with fix recommendations |
| Skill | design-critique | Structured critique using design principles |
| Skill | design-handoff | Dev-ready specs with tokens, spacing, and states |
| Skill | design-system-management | Document and maintain component libraries |
| Skill | user-research | Synthesize user research into actionable insights |
| Skill | ux-writing | Write clear, consistent UI copy |

MCP: Figma, Linear, Slack, Asana, Atlassian, Notion, Intercom
</details>

#### Specialized

<details>
<summary><b>legal</b> — Contract review, NDA triage, compliance checks, and legal briefs</summary>

| Type | Name | What it does |
|------|------|-------------|
| Command | `/brief` | Generate contextual legal briefings |
| Command | `/compliance-check` | Check GDPR, CCPA, and regulatory compliance |
| Command | `/respond` | Generate templated legal responses |
| Command | `/review-contract` | Review contracts against negotiation playbook |
| Command | `/signature-request` | Prepare signature request packages |
| Command | `/triage-nda` | Classify NDAs as GREEN / YELLOW / RED |
| Command | `/vendor-check` | Check status of existing vendor agreements |
| Skill | contract-review | Review contracts against your organization's standards |
| Skill | nda-triage | Screen NDAs — standard (GREEN) or needs review (RED) |
| Skill | compliance | Navigate GDPR, CCPA, and privacy regulations |
| Skill | legal-risk-assessment | Assess risk severity with mitigation recommendations |
| Skill | meeting-briefing | Prepare briefings for legal meetings |
| Skill | canned-responses | Generate templated responses for common inquiries |

MCP: Box, DocuSign, Egnyte, Atlassian, Slack, Google Calendar, Gmail
</details>

<details>
<summary><b>human-resources</b> — Recruiting, compensation analysis, onboarding, and performance reviews</summary>

| Type | Name | What it does |
|------|------|-------------|
| Command | `/comp-analysis` | Benchmark compensation against market data |
| Command | `/draft-offer` | Draft offer letters with compliant terms |
| Command | `/onboarding` | Create structured onboarding plans |
| Command | `/people-report` | Generate people analytics reports |
| Command | `/performance-review` | Structure performance review discussions |
| Command | `/policy-lookup` | Look up company policies and answer HR questions |
| Skill | interview-prep | Structure interview plans with scorecards |
| Skill | compensation-benchmarking | Benchmark salaries against market data |
| Skill | recruiting-pipeline | Track and optimize recruiting pipeline |
| Skill | org-planning | Plan organizational structure and headcount |
| Skill | people-analytics | Analyze retention, engagement, and workforce metrics |
| Skill | employee-handbook | Draft and maintain employee handbook policies |

MCP: Slack, Google Calendar, Gmail, Notion, Atlassian
</details>

<details>
<summary><b>enterprise-search</b> — Search across all company tools in one query</summary>

| Type | Name | What it does |
|------|------|-------------|
| Command | `/digest` | Generate daily/weekly digest of activity across tools |
| Command | `/search` | Search across all connected sources in one query |
| Skill | search-strategy | Decompose complex queries into multi-source searches |
| Skill | knowledge-synthesis | Combine search results into coherent summaries |
| Skill | source-management | Manage and configure connected MCP data sources |

MCP: Slack, Notion, Guru, Atlassian, Asana, Google Calendar, Gmail
</details>

<details>
<summary><b>bio-research</b> — Literature search, clinical trials, genomics, and lab data analysis</summary>

| Type | Name | What it does |
|------|------|-------------|
| Command | `/start` | Set up bio-research environment and explore available tools |
| Skill | scientific-problem-selection | Help scientists select and prioritize research problems |
| Skill | single-cell-rna-qc | QC for single-cell RNA-seq data using scanpy |
| Skill | scvi-tools | Deep learning for single-cell analysis with scvi-tools |
| Skill | nextflow-development | Run nf-core bioinformatics pipelines (rnaseq, sarek) |
| Skill | instrument-data-to-allotrope | Convert lab instrument output files to Allotrope format |

MCP: PubMed, bioRxiv, ChEMBL, ClinicalTrials.gov, Open Targets, Benchling, Synapse
</details>

#### Partner-Built

<details>
<summary><b>apollo</b> — Lead enrichment, prospecting, and sequence loading via Apollo API</summary>

| Type | Name | What it does |
|------|------|-------------|
| Skill | prospect | Describe your ICP in plain English, get ranked leads |
| Skill | enrich-lead | Enrich any contact from name, email, or LinkedIn URL |
| Skill | sequence-load | Find, enrich, and load contacts into a sequence in one shot |

MCP: Apollo
</details>

<details>
<summary><b>brand-voice</b> — Auto-generate and enforce brand guidelines from existing materials</summary>

| Type | Name | What it does |
|------|------|-------------|
| Command | `/discover-brand` | Discover brand signals from docs, calls, and chats |
| Command | `/enforce-voice` | Apply brand guidelines to AI-generated content |
| Command | `/generate-guidelines` | Generate brand voice guidelines from existing materials |
| Skill | discover-brand | Search across Notion, Drive, Gong, Slack for brand signals |
| Skill | guideline-generation | Distill brand materials into enforceable guidelines |
| Skill | brand-voice-enforcement | Apply guidelines to all AI-generated content |

MCP: Notion, Figma, Gong, Atlassian, Box
</details>

<details>
<summary><b>common-room</b> — GTM intelligence from product usage, engagement, and intent signals</summary>

| Type | Name | What it does |
|------|------|-------------|
| Command | `/generate-account-plan` | Create strategic account plans from signal data |
| Command | `/weekly-brief` | Generate weekly briefings for upcoming calls |
| Skill | account-research | Research accounts with real engagement data |
| Skill | contact-research | Build contact profiles from multiple signals |
| Skill | call-prep | Prep for calls with attendee profiles and talking points |
| Skill | prospect | Build targeted prospect lists from signal data |
| Skill | compose-outreach | Draft personalized outreach across email and LinkedIn |
| Skill | weekly-prep-brief | Weekly briefings for every upcoming call |

MCP: Common Room
</details>

<details>
<summary><b>slack</b> — Channel digests, standup summaries, and message drafting via Slack API</summary>

| Type | Name | What it does |
|------|------|-------------|
| Command | `/channel-digest` | Summarize channel activity over a time period |
| Command | `/draft-announcement` | Draft team announcements for Slack |
| Command | `/find-discussions` | Find relevant discussions across channels |
| Command | `/standup` | Generate standup summaries from Slack activity |
| Command | `/summarize-channel` | Create a concise channel summary |
| Skill | slack-messaging | Send and manage Slack messages and threads |
| Skill | slack-search | Search across Slack channels and conversations |

MCP: Slack
</details>

### Usage Examples

**Write optimized SQL** (data plugin):
```
You:   Write a query to find our top 10 customers by revenue this quarter
AI:    /data:write-query — Here's an optimized query for your Snowflake warehouse:
       SELECT customer_id, SUM(amount) as total_revenue
       FROM orders WHERE order_date >= DATE_TRUNC('quarter', CURRENT_DATE)
       GROUP BY customer_id ORDER BY total_revenue DESC LIMIT 10;
       Added index hints and partition pruning for performance.
```

**Triage an NDA** (legal plugin):
```
You:   Review this NDA from our new vendor
AI:    /legal:triage-nda — Classification: GREEN (standard terms).
       Duration: 2 years, mutual obligations, standard carve-outs.
       Flag: Section 7 non-compete is broader than typical.
       Recommendation: Negotiate to limit scope to direct competitors.
```

**Search clinical trials** (bio-research plugin):
```
You:   Find pembrolizumab lung cancer trials
AI:    /bio-research:start — Searching PubMed + ClinicalTrials.gov...
       Found 47 recruiting Phase III trials. Top results:
       | NCT ID | Design | Enrollment | Status |
       | NCT04567890 | Combo + chemo | n=800 | Recruiting |
       | NCT04891234 | Adjuvant | n=1200 | Recruiting |
       Want me to analyze endpoints or pull related PubMed articles?
```

**Find sales prospects** (apollo plugin):
```
You:   Find VP Engineering contacts at Series B SaaS companies in the Bay Area
AI:    Searching Apollo... Found 12 matching contacts, ranked by fit:
       | Name | Title | Company | Employees | Funding |
       | Jane Smith | VP Eng | Acme AI | 150 | Series B |
       | ...
       Want me to enrich these contacts or load them into a sequence?
```

**Plan a campaign** (marketing plugin):
```
You:   Plan a product launch campaign for our new API feature
AI:    /marketing:campaign-plan — Multi-channel campaign brief:
       Objective: Drive 500 API signups in 30 days
       Channels: Email sequence (3-touch), blog post, social, webinar
       Timeline: Week 1 teaser → Week 2 launch → Week 3-4 nurture
       KPIs: Signups, activation rate, docs page views
```

**Assess operational risk** (operations plugin):
```
You:   Assess the risk of migrating our payment system to the new provider
AI:    /operations:risk-assessment — Risk matrix:
       | Risk | Severity | Likelihood | Mitigation |
       | Data loss during migration | High | Low | Parallel-run 30 days |
       | API downtime | Medium | Medium | Feature flags + rollback |
       | Compliance gaps | High | Low | Pre-migration audit |
       Overall: MEDIUM — recommend phased rollout with parallel run.
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

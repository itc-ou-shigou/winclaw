# WinClaw — The Only Windows-Native Claude Code Fork with 18 Built-in Business Plugins and AI-Powered Web Testing

**TL;DR:** WinClaw is an open-source, Windows-native evolution of Claude Code (OpenClaw) that comes with a one-click EXE installer, 18 pre-built business automation plugins (88 commands + 90+ AI skills), and a fully automated 5-phase AI web testing system. Free to use with support for free LLMs like Groq and Google AI Studio.

---

## The Problem

If you've tried Claude Code (now OpenClaw), you know it's an incredible AI coding assistant. But there's a catch — it doesn't natively support Windows. You need WSL, manual Node.js setup, and it has zero built-in plugins.

## The Solution: WinClaw

WinClaw solves all of this:

| Feature | Claude Code | WinClaw |
|---------|------------|---------|
| OS Support | macOS/Linux only | **Windows + macOS + Linux** |
| Installation | Manual npm install | **One-click EXE installer** |
| Plugin System | None | **18 built-in plugins** |
| Business Automation | None | **88 commands + 90+ AI skills** |
| Web Testing | None | **5-phase AI automated testing** |

### One-Click Windows Install

Download the EXE, double-click, done. Node.js 22 runtime is bundled — zero prerequisites.

- **SourceForge**: https://sourceforge.net/projects/winclaw/files/WinClawSetup-2026.2.28.exe/download
- **GitHub**: https://github.com/itc-ou-shigou/winclaw/releases

### AI-Powered Web Testing (The Killer Feature)

WinClaw includes an AI Dev System Testing skill that automatically tests your web apps through 5 phases:

1. **Static Code Analysis** — Scans frontend/backend code for security and quality issues
2. **Code Review + Auto-Fix** — AI reviews and fixes issues, iterating up to 15 times until 95%+ pass rate
3. **API Testing** — Automatically tests all backend API endpoints
4. **Browser UI Testing** — Controls Chrome via MCP to test page interactions
5. **Documentation** — Auto-generates test reports

The AI literally opens a browser, clicks buttons, fills forms, and validates results. If tests fail, it analyzes the cause, fixes the code, and retests — up to 15 iterations.

### 18 Business Plugins

Covering enterprise workflows across 5 categories:

- **Business Core**: productivity, data (SQL/dashboards), finance (statements/SOX), operations
- **Customer-Facing**: sales (pipeline/outreach), customer-support (triage/escalation), marketing (campaigns/SEO)
- **Product & Engineering**: product-management (specs/roadmaps), engineering (code review/incidents), design (accessibility/UX)
- **Specialized**: legal (contracts/NDA), HR (hiring/compensation), enterprise-search, bio-research (PubMed/clinical trials)
- **Partner-Built**: apollo, brand-voice, common-room, slack

### Free LLM Support

Not just Anthropic Claude — WinClaw supports free providers:
- Google AI Studio (Gemini 2.5 Pro)
- Groq (Llama 3.3 70B)
- OpenRouter (multiple models)
- Ollama (fully offline)

## Links

- **GitHub**: https://github.com/itc-ou-shigou/winclaw
- **Windows Installer**: https://sourceforge.net/projects/winclaw/files/WinClawSetup-2026.2.28.exe/download
- **npm**: `npm install -g winclaw`
- **License**: Apache-2.0 (open source, free for personal and commercial use)

If you're a Windows user wanting AI-powered development and business automation, give WinClaw a try!

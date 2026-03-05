# [OSS] WinClaw's AI-Powered Web Testing is Incredible — Zero Test Scripts, Fully Automated from Code Analysis to Browser UI Testing

**Subreddits**: r/webdev, r/softwaretesting, r/programming, r/QualityAssurance

---

## Introduction

I've been looking for a way to automate web app testing without spending days writing test scripts. Selenium, Playwright, Cypress — they're all great tools, but the setup and maintenance cost of test scripts is brutal. Then I found **WinClaw's AI Dev System Testing** feature, and it blew my mind.

The AI reads your source code, extracts business logic patterns, generates test data, and runs both API tests and browser UI tests — **all without writing a single test script**.

## What is WinClaw?

WinClaw is an open-source, Windows-native fork of Claude Code (now WinClaw). It comes with 18 business automation plugins (88 commands + 90+ AI skills), but the standout feature is the **AI Dev System Testing** skill.

## How the Testing Works (Phase 2 through Phase 6)

### Phase 2: Static Code Analysis

The AI scans your frontend and backend source code, detecting security vulnerabilities, coding standard violations, and performance issues.

### Phase 3: Code Review + Auto-Fix + Business Logic Extraction

This is the most critical phase. The AI deeply analyzes your code and extracts **6 categories of business logic patterns**:

1. **Validation Rules** — Input validation, format checks, required fields
2. **State Machines** — Order status transitions, workflow state management
3. **Authorization Patterns** — Role-based access control, resource ownership checks
4. **Business Constraints** — Inventory limits, price ranges, date constraints
5. **Error Handling Paths** — Exception processing flows
6. **Conditional Business Logic** — Discount calculations, tax rate application, membership tier logic

These extracted patterns are saved to `business-logic-*.md` files and used in subsequent testing phases.

The AI also auto-fixes issues found during code review, **iterating up to 15 times until the pass rate exceeds 95%**.

### Phase 5A: Test Data Generation

Based on the business logic extracted in Phase 3, test data is automatically generated — including boundary values and edge cases, not just happy paths.

### Phase 5B: API Testing (Dual-Layer Test Protocol)

All backend API endpoints are tested using a **dual-layer protocol**:

- **Layer 1 (Standard CRUD Tests)**: Comprehensive create/read/update/delete testing across all endpoints
- **Layer 2 (Scenario-Based Tests)**: Tests based on the extracted business logic (e.g., "ordering a product with zero inventory," "non-admin user accessing admin panel")

When tests fail, the AI analyzes the root cause, fixes the code, and retests — **up to 15 iterations**.

### Phase 5C: Browser UI Testing (Dual-Layer Test Protocol)

Through Chrome MCP (Claude in Chrome extension), the AI physically controls the browser:

- **Layer 1**: Tests basic page rendering, navigation, and form interactions across all pages
- **Layer 2**: Scenario-based tests driven by business logic (e.g., "Login → Add item to cart → Enter quantity exceeding stock limit → Verify error message")

The AI literally clicks buttons, fills forms, navigates pages, and validates displayed results.

### Phase 6: Documentation Generation

Test results from all phases are aggregated into an auto-generated HTML test report.

## Why the Testing is Reliable

1. **Business Logic-Driven**: Not random testing — tests are based on 6 categories of business logic extracted from actual code
2. **Dual-Layer Protocol**: Standard CRUD + scenario-based testing ensures comprehensive coverage
3. **Iterative Auto-Fix**: Up to 15 fix-and-retest loops to maximize pass rates
4. **Framework-Optimized**: Built-in best practices for Python-FastAPI, Java-Spring Boot, PHP-Laravel, Go-Zero, and React-Next.js

## Getting Started

### 1. Install WinClaw

- **Windows EXE (Recommended)**: [Download from SourceForge](https://sourceforge.net/projects/winclaw/files/WinClawSetup-2026.3.2.exe/download) (Bundled Node.js 22 runtime, zero prerequisites)
- **GitHub**: https://github.com/itc-ou-shigou/winclaw/releases
- **npm**: `npm install -g winclaw`

### 2. Install Claude in Chrome

Browser UI testing (Phase 5C) requires the **Claude in Chrome** extension. Install it from the Chrome Web Store.

### 3. Use GLM-5 as a Cheap Alternative (Recommended)

Instead of paying for Anthropic's API or Pro subscription ($20/month), you can use **Zhipu GLM-5** (a Chinese LLM) which offers a free tier.

**Windows setup:**

1. Register at [z.ai](https://z.ai/)
2. Get your API key
3. Set Windows environment variables:

```
set ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
set ANTHROPIC_AUTH_TOKEN=your-api-key
set ANTHROPIC_MODEL=glm-5
```

To persist across sessions:
```
setx ANTHROPIC_BASE_URL "https://api.z.ai/api/anthropic"
setx ANTHROPIC_AUTH_TOKEN "your-api-key"
setx ANTHROPIC_MODEL "glm-5"
```

## Links

- **GitHub**: https://github.com/itc-ou-shigou/winclaw
- **Windows Installer**: https://sourceforge.net/projects/winclaw/files/WinClawSetup-2026.3.2.exe/download
- **npm**: `npm install -g winclaw`
- **License**: Apache-2.0 (free for personal and commercial use)

If you're tired of writing test scripts, give this a try. Happy to answer any questions in the comments!

---
name: ai-dev-system-testing
description: "Test and validate an existing codebase. Analyzes code structure, performs automated code review with auto-fix, runs API endpoint tests and UI tests via Chrome browser automation, generates documentation. Phase 4 (code generation) is skipped since code already exists. Use when user asks to test existing code, run quality assurance, perform code review, or validate a system."
metadata:
  {
    "winclaw":
      { "emoji": "🧪", "os": ["win32", "darwin", "linux"], "requires": { "bins": ["claude"] } },
  }
---

# System Testing

Automates code analysis, review, testing, and documentation for an existing codebase. Phase 4 (code generation) is skipped because code already exists. Testing is performed via Chrome + Claude In Chrome browser automation.

## Phase Overview

| Phase | What It Does                                | Output                                        | Timeout |
| ----- | ------------------------------------------- | --------------------------------------------- | ------- |
| Init  | User confirmation & environment check       | Confirmed settings                            | —       |
| 2     | Code structure analysis                     | `CODE_ANALYSIS.md` + `project-structure.json` | 30min   |
| 3     | Code review & auto-fix + review report      | `CODE_REVIEW_REPORT.md`                       | 40min   |
| 4     | **SKIPPED** (code exists)                   | —                                             | —       |
| 5B    | API endpoint testing (backend URL required) | `test-logs/`                                  | 2h      |
| 5C    | UI testing (browser automation)             | `test-logs/` + screenshots                    | 2h      |
| 6     | Documentation + PDF                         | `docs/`                                       | 30min   |
| 7     | Azure deploy (optional)                     | `deployment-logs/`                            | 60min   |

## Configuration

### Optional (in `~/.winclaw/winclaw.json`)

Pre-configured values can be set. If not set, the Init phase will ask the user interactively.

```json5
{
  skills: {
    entries: {
      "ai-dev-system-testing": {
        env: {
          AIDEV_BACKEND_URL: "http://localhost:3001",
          AIDEV_FRONTEND_URL: "http://localhost:3000",
          DATABASE_URL: "mysql+pymysql://root:pass@localhost/myapp",
          GITHUB_TOKEN: "ghp_xxxxxxxxxxxx",
          GITHUB_REPO: "myorg/my-app",
          AIDEV_DOC_LANGUAGE: "ja",
        },
      },
    },
  },
}
```

## Execution Workflow

### Init: User Confirmation & Environment Check

This phase replaces the old Phase 1. Since the user starts this skill from the WinClaw chat interface, the workspace is already set via the chat session.

#### Step 1: Open Chrome Browser

Use `mcp__Claude_in_Chrome__tabs_context_mcp` to check if a tab group exists. If not, create one with `createIfEmpty: true`.

#### Step 2: Confirm Test Environment with User

Ask the user the following:

```
テスト環境を確認します。以下の項目について回答してください:

1. Chrome に Claude In Chrome 拡張がインストールされ、ON状態ですか？
   （ON状態であれば Claude Code のインストールは確認不要です）

2. Claude Code の API 設定は完了していますか？
   （Anthropic API に限らず、他プロバイダでも可。set/export コマンドで設定）

3. テスト対象システムの情報を入力してください:
   - フロントエンド URL (例: http://localhost:3000):
   - バックエンド URL (例: http://localhost:8000) ※前後端分離でない場合は空欄:
   - テストDB接続文字列 (例: mysql+aiomysql://user:pass@host/db) ※不要なら空欄:
```

#### Step 3: Save Settings & Determine Flow

- Frontend URL → `AIDEV_FRONTEND_URL`
- Backend URL → `AIDEV_BACKEND_URL` (empty → Phase 5B will be skipped)
- DB connection string → `DATABASE_URL` (empty → DB-related tests skipped)

```
Flow determination:
  AIDEV_BACKEND_URL is set   → Phase 5B (API) then Phase 5C (UI)
  AIDEV_BACKEND_URL is empty → Phase 5B skipped, Phase 5C (UI) only
```

### Phase 2: Code Structure Analysis

Resume check: if `CODE_ANALYSIS.md` AND `deployment-logs/project-structure.json` exist, skip.

```bash
bash pty:true workdir:$WORKSPACE timeout:1800 command:"cat .claude/prompts/phase2-code-analysis.md | claude --dangerously-skip-permissions"
```

**Verify**:

- `CODE_ANALYSIS.md` exists (> 3,000 bytes)
- `deployment-logs/project-structure.json` exists

If `CODE_ANALYSIS.md` exists but `project-structure.json` is missing, generate PSC only:

```bash
bash pty:true workdir:$WORKSPACE timeout:600 command:"claude --dangerously-skip-permissions -p 'Read CODE_ANALYSIS.md and generate deployment-logs/project-structure.json with backend/frontend directory, ports, install commands, start commands, and health endpoints.'"
```

### Phase 3: Code Review & Auto-Fix

Resume check: if `CODE_REVIEW_REPORT.md` exists, skip.

```bash
bash pty:true workdir:$WORKSPACE timeout:2400 command:"cat .claude/prompts/phase3-code-review.md | claude --dangerously-skip-permissions"
```

**Verify**: `CODE_REVIEW_REPORT.md` exists. If Claude times out but partial results exist in `test-logs/code-review/`, continue to Phase 5.

### Phase 4: SKIPPED

Code already exists — no code generation needed.

### Phase 5B: API Endpoint Testing

**Condition**: Only run if `AIDEV_BACKEND_URL` is set (non-empty).

**Important**: Backend must be started BEFORE testing:

```bash
# Start backend (auto-detect from project-structure.json)
bash pty:true workdir:$WORKSPACE background:true command:"cd backend && pip install -r requirements.txt && python -m uvicorn app.main:app --port ${BACKEND_PORT:-3001}"

# Wait for backend health
bash workdir:$WORKSPACE timeout:60 command:"for i in $(seq 1 30); do curl -s http://localhost:${BACKEND_PORT:-3001}/health && break; sleep 2; done"
```

Run API tests using the iteration loop:

```bash
WORKSPACE_DIR=$WORKSPACE bash references/scripts/phase5b-efficient-loop.sh
```

See `references/prompts/phase5b-api-tests-efficient.md` for test details and `references/docs/PHASE5_EXECUTION_GUIDE.md` for the iteration loop flow.

### Phase 5C: UI Testing (Browser Automation)

**Important**: Frontend and backend must be running:

```bash
# Start frontend
bash pty:true workdir:$WORKSPACE background:true command:"cd frontend && npm ci && npm run dev"

# Wait for frontend
bash workdir:$WORKSPACE timeout:60 command:"sleep 15 && curl -s http://localhost:${FRONTEND_PORT:-3000}"
```

Run UI tests using the iteration loop:

```bash
WORKSPACE_DIR=$WORKSPACE bash references/scripts/phase5c-efficient-loop.sh
```

See `references/prompts/phase5c-ui-tests-efficient.md` for test details (4 CORE TESTS + 6-GATE verification system).

### Phase 6: Documentation

See `ai-dev-shared/references/phase6-documentation.md`.

### Phase 7: Azure Deploy (Optional)

See `ai-dev-shared/references/phase7-deployment.md`.

## Differences from Other Skills

| Aspect  | System Testing                   | Legacy Modernization         | New Project               |
| ------- | -------------------------------- | ---------------------------- | ------------------------- |
| Phase 2 | Code analysis → CODE_ANALYSIS.md | Legacy analysis → INITIAL.md | Requirements → INITIAL.md |
| Phase 3 | Code review & auto-fix           | PRP generation               | PRP generation            |
| Phase 4 | **Skipped**                      | PRP execution (code gen)     | PRP execution (code gen)  |
| Input   | Existing codebase                | Legacy codebase              | User requirements         |

## Smart Resume

```
Init: ✓ Confirmed (frontend URL, backend URL, DB)
Phase 2: ✓ CODE_ANALYSIS.md (15,230 bytes) + project-structure.json
Phase 3: ✓ CODE_REVIEW_REPORT.md (8,400 bytes)
Phase 4: ⏭ Skipped (system testing)
Phase 5B: ⏳ API tests (skip if no backend URL)
Phase 5C: ⏳ UI tests
```

## Troubleshooting

| Problem                        | Solution                                                   |
| ------------------------------ | ---------------------------------------------------------- |
| Chrome extension not installed | Install Claude In Chrome from Chrome Web Store             |
| No backend detected            | Check project structure; ensure backend/ or server/ exists |
| Health check fails             | Verify port in .env matches AIDEV_BACKEND_URL              |
| UI tests fail                  | Ensure frontend is running and accessible                  |
| Code review timeout            | Increase timeout or reduce codebase scope                  |
| DB connection error            | Check DATABASE_URL or backend/.env                         |
| Phase 5B skipped unexpectedly  | Confirm AIDEV_BACKEND_URL was provided in Init             |

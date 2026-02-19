---
name: ai-dev-system-testing
description: "Test and validate an existing codebase. Analyzes code structure, performs automated code review with auto-fix, runs API endpoint tests and UI tests, generates documentation. Phase 4 (code generation) is skipped since code already exists. Use when user asks to test existing code, run quality assurance, perform code review, or validate a system."
metadata:
  {
    "winclaw": {
      "emoji": "🧪",
      "os": ["win32", "darwin", "linux"],
      "requires": { "bins": ["claude"] }
    }
  }
---

# System Testing

Automates code analysis, review, testing, and documentation for an existing codebase. Phase 4 (code generation) is skipped because code already exists.

## Phase Overview

| Phase | What It Does | Output | Timeout |
|-------|-------------|--------|---------|
| 1 | Setup & validation | Environment ready | — |
| 2 | Code structure analysis | `CODE_ANALYSIS.md` + `project-structure.json` | 30min |
| 3 | Code review & auto-fix | `CODE_REVIEW_REPORT.md` | 40min |
| 4 | **SKIPPED** (code exists) | — | — |
| 5 | Test & debug (API + UI) | `test-logs/` | 2h/each |
| 6 | Documentation + PDF | `docs/` | 30min |
| 7 | Azure deploy (optional) | `deployment-logs/` | 60min |

## Configuration

### Required
- `AIDEV_WORKSPACE` — Path to existing codebase to test

### Optional (in `~/.winclaw/winclaw.json`)
```json5
{
  "skills": {
    "entries": {
      "ai-dev-system-testing": {
        "env": {
          "AIDEV_WORKSPACE": "C:\\work\\existing-app",  // Mac/Linux: "/home/user/existing-app"
          "DATABASE_URL": "mysql+pymysql://root:pass@localhost/myapp",
          "AIDEV_BACKEND_URL": "http://localhost:3001",
          "AIDEV_FRONTEND_URL": "http://localhost:3000",
          "GITHUB_TOKEN": "ghp_xxxxxxxxxxxx",
          "GITHUB_REPO": "myorg/my-app",
          "AIDEV_DOC_LANGUAGE": "ja",
          "AIDEV_TEST_MODE": "standard"
        }
      }
    }
  }
}
```

## Execution Workflow

### Phase 1: Setup & Validation

```
1. Confirm AIDEV_WORKSPACE with user
2. Validate directory contains application code:
   - backend/ or server/ with source files
   - frontend/ or client/ with package.json
3. **Auto-download .claude from autoproject repo** (see ai-dev-shared/SKILL.md)
   - If .claude/prompts missing, clone from AUTOPROJECT_REPO (default: ITC-cloud-soft/autoproject)
   - Uses GITHUB_TOKEN for private repo access if available
4. Auto-detect project structure:
   - Backend framework (FastAPI, Django, Express, Spring, etc.)
   - Frontend framework (React, Vue, Angular, etc.)
   - Database type (MySQL, PostgreSQL, SQLite, etc.)
5. Resolve test URLs:
   - AIDEV_BACKEND_URL or auto-detect port
   - AIDEV_FRONTEND_URL or auto-detect port
6. Show configuration summary
```

**Auto-download command (PowerShell):**
```powershell
$ws = $env:AIDEV_WORKSPACE; $repo = $env:AUTOPROJECT_REPO
if (-not $repo) { $repo = "ITC-cloud-soft/autoproject" }
if (-not (Test-Path "$ws\.claude\prompts")) {
  $tmp = "$env:TEMP\autop-$(Get-Date -Format 'yyyyMMddHHmmss')"
  $url = if ($env:GITHUB_TOKEN) { "https://$($env:GITHUB_TOKEN)@github.com/$repo.git" } else { "https://github.com/$repo.git" }
  git clone --depth 1 $url $tmp; Copy-Item -Recurse -Force "$tmp\.claude" "$ws\.claude"; Remove-Item -Recurse -Force $tmp
  Write-Host "✓ Downloaded .claude from $repo"
}
```

### Phase 2: Code Structure Analysis

Resume check: if `CODE_ANALYSIS.md` AND `deployment-logs/project-structure.json` exist, skip.

```bash
bash pty:true workdir:$AIDEV_WORKSPACE timeout:1800 command:"cat .claude/prompts/phase2-code-analysis.md | claude --dangerously-skip-permissions"
```

**Verify**:
- `CODE_ANALYSIS.md` exists (> 3,000 bytes)
- `deployment-logs/project-structure.json` exists

If `CODE_ANALYSIS.md` exists but `project-structure.json` is missing, generate PSC only:
```bash
bash pty:true workdir:$AIDEV_WORKSPACE timeout:600 command:"claude --dangerously-skip-permissions -p 'Read CODE_ANALYSIS.md and generate deployment-logs/project-structure.json with backend/frontend directory, ports, install commands, start commands, and health endpoints.'"
```

### Phase 3: Code Review & Auto-Fix

Resume check: if `CODE_REVIEW_REPORT.md` exists, skip.

```bash
bash pty:true workdir:$AIDEV_WORKSPACE timeout:2400 command:"cat .claude/prompts/phase3-code-review.md | claude --dangerously-skip-permissions"
```

**Verify**: `CODE_REVIEW_REPORT.md` exists. If Claude times out but partial results exist in `test-logs/code-review/`, continue to Phase 5.

### Phase 4: SKIPPED

Code already exists — no code generation needed.

### Phase 5: Test & Debug

See `ai-dev-shared/references/phase5-testing.md`.

**Important**: For system testing, backend and frontend must be started BEFORE testing:

```bash
# Start backend (auto-detect from project-structure.json)
bash pty:true workdir:$AIDEV_WORKSPACE background:true command:"cd backend && pip install -r requirements.txt && python -m uvicorn app.main:app --port ${BACKEND_PORT:-3001}"

# Wait for backend health
bash workdir:$AIDEV_WORKSPACE timeout:60 command:"for i in $(seq 1 30); do curl -s http://localhost:${BACKEND_PORT:-3001}/health && break; sleep 2; done"

# Start frontend
bash pty:true workdir:$AIDEV_WORKSPACE background:true command:"cd frontend && npm ci && npm run dev"

# Wait for frontend
bash workdir:$AIDEV_WORKSPACE timeout:60 command:"sleep 15 && curl -s http://localhost:${FRONTEND_PORT:-3000}"
```

Then run API and UI tests:
```bash
# 5B: API Tests
bash pty:true workdir:$AIDEV_WORKSPACE timeout:7200 command:"cat .claude/prompts/phase5b-api-tests.md | claude --dangerously-skip-permissions"

# 5C: UI Tests
bash pty:true workdir:$AIDEV_WORKSPACE timeout:7200 command:"cat .claude/prompts/phase5c-ui-tests.md | claude --dangerously-skip-permissions"
```

### Phase 6: Documentation

See `ai-dev-shared/references/phase6-documentation.md`.

### Phase 7: Azure Deploy (Optional)

See `ai-dev-shared/references/phase7-deployment.md`.

## Differences from Other Skills

| Aspect | System Testing | Legacy Modernization | New Project |
|--------|---------------|---------------------|-------------|
| Phase 2 | Code analysis → CODE_ANALYSIS.md | Legacy analysis → INITIAL.md | Requirements → INITIAL.md |
| Phase 3 | Code review & auto-fix | PRP generation | PRP generation |
| Phase 4 | **Skipped** | PRP execution (code gen) | PRP execution (code gen) |
| Input | Existing codebase | Legacy codebase | User requirements |

## Smart Resume

```
Phase 1: ✓ Complete
Phase 2: ✓ CODE_ANALYSIS.md (15,230 bytes) + project-structure.json
Phase 3: ✓ CODE_REVIEW_REPORT.md (8,400 bytes)
Phase 4: ⏭ Skipped (system testing)
Phase 5: ⏳ Starting API tests...
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| No backend detected | Check project structure; ensure backend/ or server/ exists |
| Health check fails | Verify port in .env matches AIDEV_BACKEND_URL |
| UI tests fail | Ensure frontend is running and accessible |
| Code review timeout | Increase timeout or reduce codebase scope |
| DB connection error | Check DATABASE_URL or backend/.env |

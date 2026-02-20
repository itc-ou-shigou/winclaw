---
name: ai-dev-legacy-modernization
description: "Modernize legacy systems (COBOL, Java, C#, etc.) into modern web applications. Analyzes legacy codebase, generates technical specs (INITIAL.md), creates modular PRPs, implements code via TDD, runs API/UI tests, generates documentation, and deploys to Azure. Use when user asks to refactor, rewrite, or modernize an old system."
metadata:
  {
    "winclaw":
      { "emoji": "🔄", "os": ["win32", "darwin", "linux"], "requires": { "bins": ["claude"] } },
  }
---

# Legacy System Modernization

Automates a 7-phase pipeline to modernize legacy codebases into modern web applications.

## Phase Overview

| Phase | What It Does                      | Output                  | Timeout |
| ----- | --------------------------------- | ----------------------- | ------- |
| 1     | Setup & validation                | Environment ready       | —       |
| 2     | Legacy code analysis → INITIAL.md | `INITIAL.md`            | 30min   |
| 3     | Generate modular PRPs             | `PRPs/*.md`             | 60min   |
| 4     | Execute PRPs (TDD code gen)       | `backend/`, `frontend/` | 4h/PRP  |
| 5     | Test & debug (API + UI)           | `test-logs/`            | 2h/each |
| 6     | Documentation + PDF               | `docs/`                 | 30min   |
| 7     | Azure deploy (optional)           | `deployment-logs/`      | 60min   |

## Configuration

### Required

- `AIDEV_WORKSPACE` — Path to the legacy project (ask user if not set)

### Optional (in `~/.winclaw/winclaw.json`)

```json5
{
  skills: {
    entries: {
      "ai-dev-legacy-modernization": {
        env: {
          AIDEV_WORKSPACE: "C:\\work\\my-legacy-project", // Mac/Linux: "/home/user/my-legacy-project"
          GITHUB_TOKEN: "ghp_xxxxxxxxxxxx",
          GITHUB_REPO: "myorg/my-project",
          GITHUB_BRANCH: "feature/modernize",
          DATABASE_URL: "mysql+pymysql://user:pass@localhost:3306/mydb",
          AIDEV_DOC_LANGUAGE: "ja",
          AIDEV_TEST_MODE: "standard",
        },
      },
    },
  },
}
```

Or set via environment variables: `export AIDEV_WORKSPACE=/path/to/project`

## Execution Workflow

### Phase 1: Setup & Validation

```
1. Confirm AIDEV_WORKSPACE with user (or read from config)
2. Validate directory exists and contains legacy code
3. **Auto-download .claude from autoproject repo** (see ai-dev-shared/SKILL.md)
   - If .claude/prompts missing, clone from AUTOPROJECT_REPO (default: ITC-cloud-soft/autoproject)
   - Uses GITHUB_TOKEN for private repo access if available
4. Check optional params (GitHub, DB, test URLs)
5. Show configuration summary and confirm with user
```

**Auto-download command (PowerShell):**

```powershell
$ws = $env:AIDEV_WORKSPACE; $repo = $env:AUTOPROJECT_REPO
if (-not $repo) { $repo = "ITC-cloud-soft/autoproject" }
if (-not (Test-Path "$ws\.claude\prompts")) {
  if (Test-Path "$ws\.claude") { Remove-Item -Recurse -Force "$ws\.claude" }
  $tmp = "$env:TEMP\autop-$(Get-Date -Format 'yyyyMMddHHmmss')"
  $url = if ($env:GITHUB_TOKEN) { "https://$($env:GITHUB_TOKEN)@github.com/$repo.git" } else { "https://github.com/$repo.git" }
  git clone --depth 1 $url $tmp 2>$null; Copy-Item -Recurse -Force "$tmp\.claude" "$ws\.claude"; Remove-Item -Recurse -Force $tmp
  Write-Host "✓ Downloaded .claude from $repo"
}
```

### Phase 2: Generate INITIAL.md

Resume check: if `$AIDEV_WORKSPACE/INITIAL.md` exists, skip Phase 2.

```bash
bash pty:true workdir:$AIDEV_WORKSPACE timeout:1800 command:"cat .claude/prompts/create-initail.md | claude --dangerously-skip-permissions"
```

**Verify**: `INITIAL.md` must exist after execution. If not, report error.

### Phase 3: Generate Modular PRPs

Resume check: if `$AIDEV_WORKSPACE/PRPs/` contains `.md` files (excluding EXAMPLE and MODULE_INDEX.md), skip.

```bash
bash pty:true workdir:$AIDEV_WORKSPACE timeout:3600 command:"claude --dangerously-skip-permissions -p 'Read INITIAL.md and generate MULTIPLE focused PRP files in PRPs/ directory. Split the project into logical, independent modules. Each PRP must include a TEST SPECIFICATION section for TDD. Also create PRPs/MODULE_INDEX.md listing all modules.'"
```

**Verify**: `PRPs/` contains at least 2 `.md` files.

### Phase 4: Execute PRPs Iteratively

Resume check: for each PRP, if `$AIDEV_WORKSPACE/.prp_status/<PRP_NAME>.done` exists, skip that PRP.

```bash
# For each PRP file in PRPs/:
PRP_FILE="PRPs/ModuleName.md"
bash pty:true workdir:$AIDEV_WORKSPACE timeout:14400 command:"sed 's|{{PRP_FILE}}|$PRP_FILE|g' .claude/prompts/execute-prp-prompt.md | claude --dangerously-skip-permissions"

# On success, create completion marker:
# date > .prp_status/ModuleName.md.done
```

Progress tracking: Show `[N/TOTAL]` for each PRP execution.

### Phase 5: Test & Debug

See `ai-dev-shared/references/phase5-testing.md` for full details.

```bash
# 5A: Database validation (if DATABASE_URL available)
# 5B: API tests
bash pty:true workdir:$AIDEV_WORKSPACE timeout:7200 command:"cat .claude/prompts/phase5b-api-tests.md | claude --dangerously-skip-permissions"

# 5C: UI tests
bash pty:true workdir:$AIDEV_WORKSPACE timeout:7200 command:"cat .claude/prompts/phase5c-ui-tests.md | claude --dangerously-skip-permissions"
```

### Phase 6: Documentation

See `ai-dev-shared/references/phase6-documentation.md`.

Resume check: if `docs/` contains `.md` files, skip MD generation (PDF may still run).

### Phase 7: Azure Deploy (Optional)

See `ai-dev-shared/references/phase7-deployment.md`.

**Ask user before proceeding**: "Azure にデプロイしますか？ (y/n)"

## Git Integration

After each phase completion (if GITHUB_TOKEN + GITHUB_REPO set):

```bash
git add -A && git commit -m "Phase $N: [description]" && git push origin $GITHUB_BRANCH
```

## Smart Resume

On re-invocation, check completion markers and skip completed phases. Report:

```
Phase 1: ✓ Complete
Phase 2: ✓ INITIAL.md exists (12,345 bytes)
Phase 3: ✓ 5 PRPs generated
Phase 4: ⏳ 3/5 PRPs completed, resuming from PRP 4...
```

## Troubleshooting

| Problem              | Solution                                                        |
| -------------------- | --------------------------------------------------------------- |
| `claude` not found   | Install Claude CLI: `npm i -g @anthropic-ai/claude-code`        |
| Prompt files missing | Copy `.claude/` from autoproject template                       |
| Phase 2 timeout      | Increase timeout or simplify legacy code analysis               |
| PRP execution fails  | Check `.prp_status/<name>/debug.log` for details                |
| Backend won't start  | See `ai-dev-shared/references/common-functions.md` repair steps |

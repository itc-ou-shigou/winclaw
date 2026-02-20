---
name: ai-dev-new-project
description: "Build a new web application from requirements. Takes user requirements and optional sample code, generates INITIAL.md specification, creates modular PRPs, implements via TDD, tests APIs and UI, generates documentation, and deploys to Azure. Use when user asks to create a new app, build from scratch, or develop a greenfield project."
metadata:
  {
    "winclaw":
      { "emoji": "🆕", "os": ["win32", "darwin", "linux"], "requires": { "bins": ["claude"] } },
  }
---

# New Project Development

Automates a 7-phase pipeline to build a new web application from requirements.

## Phase Overview

| Phase | What It Does                | Output                  | Timeout |
| ----- | --------------------------- | ----------------------- | ------- |
| 1     | Setup & validation          | Environment ready       | —       |
| 2     | Requirements → INITIAL.md   | `INITIAL.md`            | 30min   |
| 3     | Generate modular PRPs       | `PRPs/*.md`             | 60min   |
| 4     | Execute PRPs (TDD code gen) | `backend/`, `frontend/` | 4h/PRP  |
| 5     | Test & debug (API + UI)     | `test-logs/`            | 2h/each |
| 6     | Documentation + PDF         | `docs/`                 | 30min   |
| 7     | Azure deploy (optional)     | `deployment-logs/`      | 60min   |

## Configuration

### Required

- `AIDEV_WORKSPACE` — Path to project directory (will be created if needed)
- User requirements (provided via chat or file)

### Optional (in `~/.winclaw/winclaw.json`)

```json5
{
  skills: {
    entries: {
      "ai-dev-new-project": {
        env: {
          AIDEV_WORKSPACE: "C:\\work\\new-app", // Mac/Linux: "/home/user/new-app"
          GITHUB_TOKEN: "ghp_xxxxxxxxxxxx",
          GITHUB_REPO: "myorg/new-app",
          GITHUB_BRANCH: "develop",
          DATABASE_URL: "mysql+pymysql://root:pass@localhost/newapp",
          AIDEV_DOC_LANGUAGE: "ja",
          AIDEV_TEST_MODE: "standard",
        },
      },
    },
  },
}
```

## Execution Workflow

### Phase 1: Setup & Validation

```
1. Confirm AIDEV_WORKSPACE (create directory if needed)
2. **Auto-download .claude from autoproject repo** (see ai-dev-shared/SKILL.md)
   - If .claude/prompts missing, clone from AUTOPROJECT_REPO (default: ITC-cloud-soft/autoproject)
   - Uses GITHUB_TOKEN for private repo access if available
3. Collect user requirements:
   - From chat message: "Build a task management app with React + FastAPI"
   - From file: user provides requirements.md or spec document
4. Initialize git repo if not exists
5. Show configuration summary
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

### Phase 2: Generate INITIAL.md from Requirements

Resume check: if `$AIDEV_WORKSPACE/INITIAL.md` exists AND user has approved it, skip.

**Special case**: If user provides a pre-approved `INITIAL.md`, skip Phase 2 entirely.

```bash
# Save user requirements to workspace for Claude to read
# (Write requirements to $AIDEV_WORKSPACE/user-requirements.md before this step)

bash pty:true workdir:$AIDEV_WORKSPACE timeout:1800 command:"cat .claude/prompts/create-initial-new-project.md | claude --dangerously-skip-permissions"
```

**Verify**: `INITIAL.md` exists and contains architecture specification.

### Phase 3: Generate Modular PRPs

Same as `ai-dev-legacy-modernization` Phase 3. See that skill for details.

Resume check: if `PRPs/` contains `.md` files, skip.

```bash
bash pty:true workdir:$AIDEV_WORKSPACE timeout:3600 command:"claude --dangerously-skip-permissions -p 'Read INITIAL.md and generate MULTIPLE focused PRP files in PRPs/ directory. Split the project into logical, independent modules. Each PRP must include a TEST SPECIFICATION section for TDD. Also create PRPs/MODULE_INDEX.md listing all modules.'"
```

### Phase 4: Execute PRPs Iteratively

Same as `ai-dev-legacy-modernization` Phase 4.

```bash
# For each PRP in PRPs/:
bash pty:true workdir:$AIDEV_WORKSPACE timeout:14400 command:"sed 's|{{PRP_FILE}}|PRPs/ModuleName.md|g' .claude/prompts/execute-prp-prompt.md | claude --dangerously-skip-permissions"
```

### Phase 5: Test & Debug

See `ai-dev-shared/references/phase5-testing.md`.

### Phase 6: Documentation

See `ai-dev-shared/references/phase6-documentation.md`.

### Phase 7: Azure Deploy (Optional)

See `ai-dev-shared/references/phase7-deployment.md`.

## Difference from Legacy Modernization

| Aspect            | Legacy Modernization | New Project                          |
| ----------------- | -------------------- | ------------------------------------ |
| Phase 2 prompt    | `create-initail.md`  | `create-initial-new-project.md`      |
| Input             | Existing legacy code | User requirements text               |
| Phase 2 skip      | INITIAL.md exists    | INITIAL.md exists AND approved       |
| Pre-approved spec | Not applicable       | User can provide INITIAL.md directly |

## Smart Resume

Same completion markers as legacy modernization. On re-invocation:

```
Phase 1: ✓ Complete
Phase 2: ✓ INITIAL.md exists (8,200 bytes)
Phase 3: ✓ 4 PRPs generated
Phase 4: ✓ All PRPs completed
Phase 5: ⏳ 5B complete, starting 5C...
```

## Troubleshooting

| Problem              | Solution                                          |
| -------------------- | ------------------------------------------------- |
| Requirements unclear | Ask user for more detail before Phase 2           |
| INITIAL.md too vague | Re-run Phase 2 with refined requirements          |
| PRP too large        | Split into smaller modules manually               |
| Tests failing        | Check `test-logs/` for details, run Phase 5 again |

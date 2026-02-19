---
name: ai-dev-shared
description: "Shared infrastructure for AI development automation skills. Provides common phase execution functions, service startup/repair, Chrome DevTools MCP setup, and documentation generation. Not invoked directly - loaded as a dependency by ai-dev-* skills."
metadata:
  {
    "winclaw": {
      "emoji": "⚙️",
      "os": ["win32", "darwin", "linux"]
    }
  }
user-invocable: false
disable-model-invocation: true
---

# AI Dev Shared Infrastructure

Common references for `ai-dev-legacy-modernization`, `ai-dev-new-project`, and `ai-dev-system-testing` skills.

## Shared Configuration

### Environment Variables (All Skills)

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `AIDEV_WORKSPACE` | **Yes** | Project root directory | Ask user |
| `AUTOPROJECT_REPO` | No | GitHub repo for `.claude` prompts templates | `ITC-cloud-soft/autoproject` |
| `GITHUB_TOKEN` | No | GitHub PAT for private repo / push access | `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` |
| `GITHUB_REPO` | No | `owner/repo` format for push | Skip push |
| `GITHUB_BRANCH` | No | Target branch | Current branch |
| `DATABASE_URL` | No | DB connection string | Auto-detect from .env |
| `DATABASE_ASYNC_URL` | No | Async DB connection | Auto-convert from DATABASE_URL |
| `AIDEV_BACKEND_URL` | No | Backend test URL | Auto-detect port |
| `AIDEV_FRONTEND_URL` | No | Frontend test URL | Auto-detect port |
| `AIDEV_DOC_LANGUAGE` | No | Documentation language | `ja` |
| `AIDEV_TEST_MODE` | No | `standard` or `efficient` | `standard` |

### Parameter Resolution Order

1. `skillConfig.env[KEY]` in `~/.winclaw/winclaw.json`
2. OS environment variable
3. `.env` file in workspace
4. Auto-detection (port scan, directory scan)
5. Ask user (required params only)

### Prompt File Setup

All phases require `.claude/prompts/` in the workspace. **Auto-download from autoproject repo if missing.**

#### Environment Variables for Autoproject

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `AUTOPROJECT_REPO` | No | GitHub repo for prompt templates | `ITC-cloud-soft/autoproject` |
| `GITHUB_TOKEN` | No | GitHub PAT for private repo access | Public clone |

#### Auto-Download .claude Directory

Run this in **Phase 1** before any other checks:

```powershell
# PowerShell (Windows)
$AIDEV_WORKSPACE = "C:\work\your-project"  # From skill config
$AUTOPROJECT_REPO = $env:AUTOPROJECT_REPO
if (-not $AUTOPROJECT_REPO) { $AUTOPROJECT_REPO = "ITC-cloud-soft/autoproject" }

# Check if .claude/prompts already exists
if (Test-Path "$AIDEV_WORKSPACE\.claude\prompts") {
  Write-Host "✓ .claude/prompts already exists, skipping download"
} else {
  Write-Host "Downloading .claude from $AUTOPROJECT_REPO..."
  $tempDir = "$env:TEMP\autoproject-$(Get-Date -Format 'yyyyMMddHHmmss')"

  # Build clone URL with optional token
  $token = $env:GITHUB_TOKEN
  if ($token) {
    $cloneUrl = "https://${token}@github.com/${AUTOPROJECT_REPO}.git"
  } else {
    $cloneUrl = "https://github.com/${AUTOPROJECT_REPO}.git"
  }

  # Clone and copy
  git clone --depth 1 --branch main $cloneUrl $tempDir 2>&1
  if ($LASTEXITCODE -eq 0) {
    Copy-Item -Recurse -Force "$tempDir\.claude" "$AIDEV_WORKSPACE\.claude"
    Write-Host "✓ .claude directory copied to workspace"
  } else {
    Write-Host "✗ Failed to clone autoproject repo"
    exit 1
  }

  # Cleanup
  Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
}
```

```bash
# Bash (Mac/Linux)
AIDEV_WORKSPACE="/path/to/your-project"  # From skill config
AUTOPROJECT_REPO="${AUTOPROJECT_REPO:-ITC-cloud-soft/autoproject}"

# Check if .claude/prompts already exists
if [ -d "$AIDEV_WORKSPACE/.claude/prompts" ]; then
  echo "✓ .claude/prompts already exists, skipping download"
else
  echo "Downloading .claude from $AUTOPROJECT_REPO..."
  TEMP_DIR="/tmp/autoproject-$(date +%Y%m%d%H%M%S)"

  # Build clone URL with optional token
  if [ -n "$GITHUB_TOKEN" ]; then
    CLONE_URL="https://${GITHUB_TOKEN}@github.com/${AUTOPROJECT_REPO}.git"
  else
    CLONE_URL="https://github.com/${AUTOPROJECT_REPO}.git"
  fi

  # Clone and copy
  git clone --depth 1 --branch main "$CLONE_URL" "$TEMP_DIR" 2>&1
  if [ $? -eq 0 ]; then
    cp -r "$TEMP_DIR/.claude" "$AIDEV_WORKSPACE/"
    echo "✓ .claude directory copied to workspace"
  else
    echo "✗ Failed to clone autoproject repo"
    exit 1
  fi

  # Cleanup
  rm -rf "$TEMP_DIR"
fi
```

### Phase Completion Markers

| Phase | Marker File | Description |
|-------|------------|-------------|
| 2 | `INITIAL.md` or `CODE_ANALYSIS.md` | Spec or analysis generated |
| 3 | `PRPs/*.md` or `CODE_REVIEW_REPORT.md` | PRPs or review generated |
| 4 | `.prp_status/*.done` | All PRPs executed |
| 5 | `test-logs/` | Test results exist |
| 6 | `docs/*.md` | Documentation generated |
| 7 | `deployment-logs/` | Deployment logs exist |

### Git Integration (Optional)

When `GITHUB_TOKEN` + `GITHUB_REPO` are set:

```bash
# After each phase completion
git config user.email "ai-dev@local"
git config user.name "AI Dev Automation"
git remote set-url origin "https://$GITHUB_TOKEN@github.com/$GITHUB_REPO.git"
BRANCH="${GITHUB_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
git add -A && git commit -m "Phase $PHASE completed" && git push origin "$BRANCH"
```

See `references/` for Phase 5-7 shared details.

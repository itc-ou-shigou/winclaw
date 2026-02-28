#!/usr/bin/env bash
# merge-helper.sh — WinClaw upstream merge automation
#
# Usage:
#   merge-helper.sh --version YYYY.M.DD              # full run
#   merge-helper.sh --skip-fetch --version YYYY.M.DD  # resolve + brand only
#   merge-helper.sh --only-branding                   # re-run branding only
#
# Windows Git Bash notes:
#   - No GNU timeout (not used)
#   - No set -e (git returns non-zero for expected conflict states)
#   - Python always uses encoding='utf-8'

REPO_ROOT="C:/work/winclaw"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---- Parse args --------------------------------------------------------
VERSION=""
SKIP_FETCH=0
ONLY_BRANDING=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)      VERSION="$2"; shift 2 ;;
    --version=*)    VERSION="${1#*=}"; shift ;;
    --skip-fetch)   SKIP_FETCH=1; shift ;;
    --only-branding) ONLY_BRANDING=1; shift ;;
    -h|--help)
      echo "Usage: merge-helper.sh --version YYYY.M.DD [--skip-fetch] [--only-branding]"
      exit 0 ;;
    *) shift ;;
  esac
done

cd "$REPO_ROOT" || { echo "ERROR: cannot cd to $REPO_ROOT"; exit 1; }

# ---- Colors ------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${CYAN}==> $*${NC}"; }
ok()   { echo -e "${GREEN}    OK: $*${NC}"; }
warn() { echo -e "${YELLOW}    WARN: $*${NC}"; }
err()  { echo -e "${RED}    ERROR: $*${NC}"; }

# ---- WinClaw-specific file patterns (keep ours) -----------------------
WINCLAW_KEEP=(
  "ui/"
  "scripts/rebuild-installer.ps1"
  "scripts/windows-installer.iss"
  "scripts/package-windows-installer.ps1"
  "scripts/launch-chrome-devtools-mcp.ps1"
  "scripts/ensure-chrome-debug.ps1"
  "scripts/winclaw-ui.cmd"
  "scripts/run-winclaw-podman.sh"
  "README.md"
  "README.ja.md"
  "README.zh-CN.md"
  "package.json"
  "apps/windows/"
  "winget/"
  "install.ps1"
  "assets/winclaw.ico"
  "assets/logo.png"
  "skills/"
)

should_keep_ours() {
  local file="$1"
  for keep in "${WINCLAW_KEEP[@]}"; do
    if [[ "$file" == "${keep}"* ]] || [[ "$file" == "$keep" ]]; then
      return 0
    fi
  done
  return 1
}

# ---- Branding function -------------------------------------------------
do_branding() {
  log "Branding replacement (openclaw -> winclaw)"

  # Directories to exclude
  local EXCLUDE_DIRS="node_modules .git ui dist releases apps/windows skills .cache"

  # Specific files to exclude (intentional openclaw references)
  local EXCLUDE_FILES="scripts/windows-installer.iss scripts/sync-plugin-versions.ts"

  # Extensions to process
  local EXTS="ts tsx mts cts js mjs cjs jsx json md yml yaml sh toml txt css html iss ps1"

  # Build find command
  local FIND_CMD="find . "
  for d in $EXCLUDE_DIRS; do
    FIND_CMD="$FIND_CMD -path './$d' -prune -o"
  done
  FIND_CMD="$FIND_CMD -type f \("
  local first=1
  for ext in $EXTS; do
    if [[ "$first" == "1" ]]; then
      FIND_CMD="$FIND_CMD -name '*.$ext'"
      first=0
    else
      FIND_CMD="$FIND_CMD -o -name '*.$ext'"
    fi
  done
  FIND_CMD="$FIND_CMD \) -print"

  local REPLACED=0
  while IFS= read -r f; do
    # Skip excluded files
    local skip=0
    for excl in $EXCLUDE_FILES; do
      if [[ "$f" == "./$excl" ]]; then
        skip=1; break
      fi
    done
    [[ "$skip" == "1" ]] && continue

    # Check and replace using python3 (safe encoding handling)
    if grep -qiE "openclaw|OpenClaw|OPENCLAW" "$f" 2>/dev/null; then
      python3 -c "
import sys
fpath = sys.argv[1]
try:
    with open(fpath, encoding='utf-8', errors='replace') as f:
        content = f.read()
    new = content.replace('openclaw', 'winclaw').replace('OpenClaw', 'WinClaw').replace('OPENCLAW', 'WINCLAW')
    if new != content:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(new)
        print(f'BRANDED: {fpath}')
except Exception as e:
    print(f'SKIP: {fpath}: {e}', file=sys.stderr)
" "$f"
      REPLACED=$((REPLACED + 1))
    fi
  done < <(eval "$FIND_CMD" 2>/dev/null)

  ok "Branding complete (~$REPLACED files processed)"
}

# ---- Only branding mode ------------------------------------------------
if [[ "$ONLY_BRANDING" == "1" ]]; then
  do_branding
  exit 0
fi

# ---- Validate args -----------------------------------------------------
if [[ -z "$VERSION" ]]; then
  echo "Usage: merge-helper.sh --version YYYY.M.DD [--skip-fetch] [--only-branding]"
  exit 1
fi

# ================================================================
# PHASE 0: Fetch and branch (skippable)
# ================================================================
if [[ "$SKIP_FETCH" == "0" ]]; then
  log "Phase 0: Fetch upstream and create merge branch"

  git fetch upstream
  ok "Fetched upstream"

  BRANCH="upstream-merge-$VERSION"
  if git show-ref --quiet "refs/heads/$BRANCH"; then
    warn "Branch $BRANCH already exists; checking it out"
    git checkout "$BRANCH"
  else
    git checkout -b "$BRANCH"
    ok "Created branch $BRANCH"
  fi

  log "Merging upstream/main --no-commit --no-ff ..."
  git merge upstream/main --no-commit --no-ff || true
  log "Merge started (conflicts expected)"
fi

# ================================================================
# PHASE A: Resolve modify/delete conflicts
# ================================================================
log "Phase A: Remove files deleted upstream (modify/delete conflicts)"

DELETED_COUNT=0
while IFS= read -r line; do
  status="${line:0:2}"
  file="${line:3}"
  if [[ "$status" == "DU" ]] || [[ "$status" == "UD" ]] || [[ "$status" == "UA" ]]; then
    # Skip ui/ — restored in Phase E
    if [[ "$file" == ui/* ]]; then
      continue
    fi
    git rm -f "$file" 2>/dev/null && DELETED_COUNT=$((DELETED_COUNT + 1))
  fi
done < <(git status --porcelain 2>/dev/null)

if [[ "$DELETED_COUNT" -gt 0 ]]; then
  ok "Removed $DELETED_COUNT modify/delete conflicts"
else
  ok "No modify/delete conflicts found"
fi

# ================================================================
# PHASE B: Content conflicts — accept theirs or ours
# ================================================================
log "Phase B: Resolve content conflicts"

THEIRS_COUNT=0
OURS_COUNT=0
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  if should_keep_ours "$f"; then
    git checkout --ours -- "$f" 2>/dev/null && git add "$f" 2>/dev/null
    OURS_COUNT=$((OURS_COUNT + 1))
  else
    git checkout --theirs -- "$f" 2>/dev/null && git add "$f" 2>/dev/null
    THEIRS_COUNT=$((THEIRS_COUNT + 1))
  fi
done < <(git diff --name-only --diff-filter=U 2>/dev/null)

ok "Phase B: theirs=$THEIRS_COUNT, ours=$OURS_COUNT"

# ================================================================
# PHASE C: Embedded conflict markers — Python auto-resolver
# ================================================================
log "Phase C: Auto-resolve embedded conflict markers"

python3 - <<'PYEOF'
import os, re, sys

REPO = "C:/work/winclaw"

KEEP_OURS_PATTERNS = [
    r"^ui/", r"^scripts/rebuild-installer\.ps1$",
    r"^scripts/windows-installer\.iss$", r"^scripts/package-windows-installer\.ps1$",
    r"^scripts/launch-chrome-devtools-mcp\.ps1$", r"^scripts/ensure-chrome-debug\.ps1$",
    r"^apps/windows/", r"^winget/", r"^skills/",
    r"^README(\.ja|\.zh-CN)?\.md$", r"^install\.ps1$",
    r"^assets/winclaw\.ico$", r"^assets/logo\.png$",
]
keep_ours_re = [re.compile(p) for p in KEEP_OURS_PATTERNS]

def should_keep_ours(path):
    rel = path.replace("\\", "/").replace(REPO.replace("\\", "/") + "/", "")
    return any(r.match(rel) for r in keep_ours_re)

CONFLICT_RE = re.compile(
    r"<<<<<<< (?:HEAD|.*?)\n(.*?)(?:=======\n(.*?))?>>>>>>> .*?\n",
    re.DOTALL
)

TEXT_EXTS = {".ts", ".js", ".mjs", ".cjs", ".json", ".md", ".yml", ".yaml",
             ".sh", ".ps1", ".iss", ".txt", ".toml", ".mts", ".cts",
             ".tsx", ".jsx", ".css", ".html"}

resolved = 0
for root, dirs, files in os.walk(REPO):
    dirs[:] = [d for d in dirs if d not in ("node_modules", ".git", "dist", "releases", ".cache")]
    for fname in files:
        if not any(fname.endswith(ext) for ext in TEXT_EXTS):
            continue
        fpath = os.path.join(root, fname)
        try:
            with open(fpath, encoding="utf-8", errors="replace") as f:
                content = f.read()
        except Exception:
            continue
        if "<<<<<<< " not in content:
            continue
        keep = should_keep_ours(fpath)
        def pick(m):
            ours = m.group(1) or ""
            theirs = m.group(2) or ""
            return ours if keep else theirs
        new_content = CONFLICT_RE.sub(pick, content)
        if new_content != content:
            with open(fpath, "w", encoding="utf-8") as f:
                f.write(new_content)
            resolved += 1

print(f"Phase C: resolved {resolved} files with embedded markers")
PYEOF

ok "Phase C complete"

# ================================================================
# PHASE D: Force remaining unresolved to upstream
# ================================================================
log "Phase D: Force-resolve any remaining conflicts"

REMAINING=0
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  if should_keep_ours "$f"; then
    git checkout --ours -- "$f" 2>/dev/null && git add "$f" 2>/dev/null
  else
    git checkout upstream/main -- "$f" 2>/dev/null && git add "$f" 2>/dev/null
  fi
  REMAINING=$((REMAINING + 1))
done < <(git diff --name-only --diff-filter=U 2>/dev/null)

if [[ "$REMAINING" -gt 0 ]]; then
  ok "Phase D: force-resolved $REMAINING files"
else
  ok "No remaining conflicts at Phase D"
fi

# ================================================================
# PHASE E: CRITICAL — Restore ui/ from HEAD
# ================================================================
log "Phase E: Restoring ui/ from HEAD (WinClaw custom UI)"

git checkout HEAD -- ui/ 2>/dev/null || warn "git checkout HEAD -- ui/ returned non-zero"

UI_STAGED=$(git diff --cached --stat -- ui/ 2>/dev/null | wc -l | tr -d ' ')
if [[ "$UI_STAGED" -gt 1 ]]; then
  warn "ui/ still has staged changes — forcing reset"
  git reset HEAD -- ui/ 2>/dev/null
  git checkout -- ui/ 2>/dev/null
  ok "ui/ force-reset complete"
else
  ok "ui/ is clean in index"
fi

# ================================================================
# PHASE F: Branding replacement
# ================================================================
do_branding

# ================================================================
# PHASE G: Restore WinClaw-only files
# ================================================================
log "Phase G: Restoring WinClaw-only files from HEAD"

WINCLAW_ONLY_FILES=(
  "README.md" "README.ja.md" "README.zh-CN.md"
  "install.ps1" "winclaw.mjs" "winclaw.podman.env"
)

for f in "${WINCLAW_ONLY_FILES[@]}"; do
  if git show "HEAD:$f" >/dev/null 2>&1; then
    git checkout HEAD -- "$f" 2>/dev/null && ok "Restored: $f"
  fi
done

WINCLAW_ONLY_PATHS=(
  "skills"
  "apps/windows"
  "winget"
  "scripts/rebuild-installer.ps1"
  "scripts/windows-installer.iss"
  "scripts/package-windows-installer.ps1"
  "scripts/launch-chrome-devtools-mcp.ps1"
  "scripts/ensure-chrome-debug.ps1"
  "scripts/winclaw-ui.cmd"
  "scripts/run-winclaw-podman.sh"
  "assets/winclaw.ico"
  "assets/logo.png"
)

for f in "${WINCLAW_ONLY_PATHS[@]}"; do
  if git show "HEAD:$f" >/dev/null 2>&1; then
    git checkout HEAD -- "$f" 2>/dev/null && ok "Restored: $f"
  fi
done

# Check rolldown.config.mjs
ROLLDOWN="apps/shared/WinClawKit/Tools/CanvasA2UI/rolldown.config.mjs"
if [[ ! -f "$ROLLDOWN" ]]; then
  warn "rolldown.config.mjs missing — restoring from upstream"
  # Upstream path uses OpenClawKit
  git show upstream/main:apps/shared/OpenClawKit/Tools/CanvasA2UI/rolldown.config.mjs > "$ROLLDOWN" 2>/dev/null \
    && ok "Restored rolldown.config.mjs from upstream" \
    || warn "Could not restore rolldown.config.mjs"
fi

# ================================================================
# PHASE H: Final verification
# ================================================================
log "Phase H: Verification"

CONFLICT_COUNT=$(grep -rl "<<<<<<< HEAD" . --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null | wc -l | tr -d ' ')
if [[ "$CONFLICT_COUNT" -gt 0 ]]; then
  err "Still $CONFLICT_COUNT files with conflict markers!"
  grep -rl "<<<<<<< HEAD" . --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null | head -20
else
  ok "No conflict markers remaining"
fi

BRAND_COUNT=$(grep -rl "openclaw" src/ extensions/ packages/ test/ --exclude-dir=node_modules 2>/dev/null | wc -l | tr -d ' ')
if [[ "$BRAND_COUNT" -gt 0 ]]; then
  warn "$BRAND_COUNT files with 'openclaw' in src/extensions/packages/test/"
  grep -rl "openclaw" src/ extensions/ packages/ test/ --exclude-dir=node_modules 2>/dev/null | head -10
else
  ok "No stray openclaw branding"
fi

UI_CHECK=$(git diff --cached --stat -- ui/ 2>/dev/null | grep -c "." || true)
if [[ "$UI_CHECK" -gt 0 ]]; then
  err "ui/ has staged changes! Run: git reset HEAD -- ui/ && git checkout -- ui/"
else
  ok "ui/ is clean"
fi

echo ""
echo -e "${GREEN}=== merge-helper.sh complete ===${NC}"
echo ""
echo "Next steps:"
echo "  1. Review any WARNs or ERRORs above"
echo "  2. git add -A"
echo "  3. git commit -m \"merge: upstream openclaw v$VERSION into winclaw\""
echo "  4. pnpm install && pnpm build"
echo "  5. git checkout main && git merge upstream-merge-$VERSION"
echo "  6. Bump version, then: .\\scripts\\rebuild-installer.ps1"
echo "  7. npm publish --access public --ignore-scripts"

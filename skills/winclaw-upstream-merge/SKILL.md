---
name: winclaw-upstream-merge
description: Merge OpenClaw upstream into the WinClaw fork. Use when the user asks to pull upstream changes, sync with openclaw, update from upstream, do the periodic upstream merge, or integrate a new openclaw release into winclaw. Automates fetch, branch, merge, conflict resolution, ui/ exclusion, branding replacement, build verification, and release.
metadata: { "winclaw": { "emoji": "🔀", "os": ["win32"], "requires": { "bins": ["git", "python3", "pnpm"] } } }
---

# WinClaw Upstream Merge

Merges OpenClaw upstream (`upstream/main`) into WinClaw, preserving all WinClaw customizations.

**CRITICAL**: Files in `ui/` must NEVER be taken from upstream. WinClaw ships its own control UI (`winclaw-control-ui`).

## Quick run

Full automated merge (fetch + resolve + brand + verify):

```bash
bash {baseDir}/scripts/merge-helper.sh --version YYYY.M.DD
```

Resume after manual conflict fixes:

```bash
bash {baseDir}/scripts/merge-helper.sh --skip-fetch --version YYYY.M.DD
```

Re-run branding replacement only:

```bash
bash {baseDir}/scripts/merge-helper.sh --only-branding
```

## Workflow

### Step 1: Check upstream

```bash
git fetch upstream
git log upstream/main --oneline -5
```

Determine the new version string from the upstream commit messages or `package.json`.

### Step 2: Create merge branch

```bash
git checkout -b upstream-merge-YYYY.M.DD
```

### Step 3: Merge with no-commit

```bash
git merge upstream/main --no-commit --no-ff
```

Expect many conflicts (historically ~1,200). This is normal.

### Step 4: Run helper script for automated conflict resolution

```bash
bash {baseDir}/scripts/merge-helper.sh --skip-fetch --version YYYY.M.DD
```

The script performs:
- Phase A: `git rm` for modify/delete conflicts
- Phase B: `git checkout --theirs` for content conflicts (keeps `--ours` for WinClaw-specific files)
- Phase C: Python auto-resolver for embedded `<<<<<<< HEAD` markers
- Phase D: Force-checkout upstream for remaining unresolved files

### Step 5: Restore ui/ directory (CRITICAL)

The script handles this automatically, but verify:

```bash
git diff --cached --stat -- ui/
```

Must be empty. If changes remain:

```bash
git reset HEAD -- ui/
git checkout -- ui/
```

### Step 6: Restore WinClaw-only files

The script restores these automatically. Key files:
- `README.md`, `README.ja.md`, `README.zh-CN.md`
- `skills/` (all WinClaw custom skills)
- `apps/windows/` (WinClaw Windows app)
- `scripts/rebuild-installer.ps1`, `scripts/windows-installer.iss`
- `scripts/launch-chrome-devtools-mcp.ps1`, `scripts/ensure-chrome-debug.ps1`
- `assets/winclaw.ico`, `assets/logo.png`

Also check that `apps/shared/WinClawKit/Tools/CanvasA2UI/rolldown.config.mjs` exists.

### Step 7: Verify

```bash
# Must be 0
grep -rl "<<<<<<< HEAD" . --exclude-dir=node_modules --exclude-dir=.git | wc -l

# Should be 0 (or only intentional references)
grep -rl "openclaw" src/ extensions/ packages/ test/ --exclude-dir=node_modules | wc -l

# Must be empty
git diff --cached --stat -- ui/
```

See `{baseDir}/references/branding-rules.md` for the full exclusion list.

### Step 8: Commit merge branch

```bash
git add -A
git commit -m "merge: upstream openclaw vX.Y.Z into winclaw"
```

### Step 9: Build verification

```bash
pnpm install
pnpm build
```

Fix any TypeScript or lint errors from upstream changes before proceeding.

### Step 10: Merge to main

```bash
git checkout main
git merge upstream-merge-YYYY.M.DD
```

### Step 11: Release

1. Bump version in `package.json`
2. Build Windows installer:
   ```powershell
   .\scripts\rebuild-installer.ps1
   ```
3. Publish to npm:
   ```bash
   npm publish --access public --ignore-scripts
   ```
4. Commit release:
   ```bash
   git add package.json releases/
   git commit -m "release: vX.Y.Z -- build installer and publish to npm"
   ```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `ui/` changes still staged | `git reset HEAD -- ui/ && git checkout -- ui/` |
| `rolldown.config.mjs` missing | `git checkout upstream/main -- apps/shared/WinClawKit/Tools/CanvasA2UI/rolldown.config.mjs` |
| ISCC.exe not found | Check `%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe` |
| `pnpm build` TS errors | Upstream changed interfaces; apply WinClaw-side fixes |
| Remaining `openclaw` hits | Re-run `--only-branding`; check `references/branding-rules.md` exclusions |
| 1000+ conflicts | Normal; `merge-helper.sh` resolves them systematically |
| npm publish 413 Too Large | Use `--ignore-scripts` to skip prepack rebuild |

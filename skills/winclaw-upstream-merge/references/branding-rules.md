# Branding Replacement Rules

Reference for `merge-helper.sh` branding phase and manual brand fixes.

## Substitution Rules

| From | To |
|------|----|
| `openclaw` | `winclaw` |
| `OpenClaw` | `WinClaw` |
| `OPENCLAW` | `WINCLAW` |

Applied to file contents only. Directory/file names are not auto-renamed.

## File Types Processed

`.ts` `.tsx` `.mts` `.cts` `.js` `.mjs` `.cjs` `.jsx` `.json` `.md` `.yml` `.yaml` `.sh` `.toml` `.txt` `.css` `.html` `.iss` `.ps1`

Binary files (`.exe`, `.ico`, `.png`, `.woff`, `.ttf`, etc.) are never touched.

## Directories Excluded

| Directory | Reason |
|-----------|--------|
| `ui/` | WinClaw custom control UI, completely diverged from upstream |
| `node_modules/` | Third-party packages |
| `.git/` | Git internals |
| `dist/` | Build output, regenerated on build |
| `releases/` | Compiled installer EXEs |
| `apps/windows/` | WinClaw-only Windows app |
| `skills/` | WinClaw-only custom skills |
| `.cache/` | Tooling cache |

## Specific Files Excluded

| File | Reason |
|------|--------|
| `scripts/windows-installer.iss` | Contains intentional `openclaw` references for config migration: `.openclaw/openclaw.json` to `.winclaw/winclaw.json` on install. These are file system paths for migrating existing OpenClaw users. |
| `scripts/sync-plugin-versions.ts` | Function `stripWorkspaceOpenclawDevDependency` is an internal legacy name. The logic correctly handles `winclaw` workspace deps. |

## WinClaw-Only Files (restore after merge)

These files exist in WinClaw but not in OpenClaw. Restore via `git checkout HEAD -- <file>` if touched during conflict resolution.

### Root-level
- `README.md`, `README.ja.md`, `README.zh-CN.md` (WinClaw branded)
- `winclaw.mjs` (entry point; upstream has `openclaw.mjs`)
- `winclaw.podman.env` (upstream has `openclaw.podman.env`)
- `install.ps1` (WinClaw installer script)

### scripts/
- `rebuild-installer.ps1` — Windows installer build
- `windows-installer.iss` — Inno Setup configuration
- `package-windows-installer.ps1` — Full installer packaging
- `launch-chrome-devtools-mcp.ps1` — Chrome DevTools MCP launcher
- `ensure-chrome-debug.ps1` — Chrome debug port helper
- `winclaw-ui.cmd` — UI launch command
- `run-winclaw-podman.sh` — Podman launch script

### apps/
- `apps/windows/` — WinClaw .NET Windows app (no upstream equivalent)

### assets/
- `assets/winclaw.ico` — WinClaw icon
- `assets/logo.png` — WinClaw logo

### Other
- `winget/` — Windows Package Manager manifest
- `skills/` — All WinClaw custom skills

## ui/ Preservation Rules

The `ui/` directory is WinClaw's custom control UI (`winclaw-control-ui`) based on Vite + Lit. It has completely diverged from upstream and must NEVER receive upstream content.

After every merge, verify:

```bash
git diff --cached --stat -- ui/    # Must be empty
```

If ui/ appears modified:

```bash
git reset HEAD -- ui/
git checkout -- ui/
```

## package.json Merge Notes

`package.json` requires manual conflict resolution because WinClaw adds:

```json
"name": "winclaw",
"bin": { "winclaw": "winclaw.mjs" },
"files": [
  "scripts/launch-chrome-devtools-mcp.ps1",
  "scripts/ensure-chrome-debug.ps1",
  "winclaw.mjs",
  "assets/", "dist/", "docs/", "extensions/", "skills/"
]
```

Accept upstream for `dependencies`/`devDependencies`/`version` fields, but keep WinClaw values for `name`, `bin`, `homepage`, `repository`, and `files`.

## rolldown.config.mjs

Located at `apps/shared/WinClawKit/Tools/CanvasA2UI/rolldown.config.mjs`. Upstream path uses `OpenClawKit`. If missing after merge, restore:

```bash
git show upstream/main:apps/shared/OpenClawKit/Tools/CanvasA2UI/rolldown.config.mjs \
  > apps/shared/WinClawKit/Tools/CanvasA2UI/rolldown.config.mjs
```

## ISCC.exe Locations

Searched in order:
1. `iscc.exe` on PATH
2. `%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe`
3. `C:\Program Files (x86)\Inno Setup 6\ISCC.exe`

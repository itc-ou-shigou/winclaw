# @winclaw-avatar/ext-memory-wiki

**Additive migration Phase 1** — belief-layer digests, digest-based retrieval, and claim health reports, ported as a strictly opt-in extension.

> **Source**: openclaw commits `947a43dae3`, `0d3cd4ac42`, `44fd8b0d6e`, `2988203a5e`.
> **Status**: scaffold + adapter shell. Full belief-layer logic is incrementally portable in follow-ups.
> **Created**: 2026-04-09

## Hard guarantees

| Guarantee | How it is enforced |
|---|---|
| Zero impact when disabled | Activated only if `AVATAR_EXT_MEMORY_WIKI=1`. Without the flag, `register()` is never imported. |
| No edits to ClawMem / memory-core | The bundled `clawmem-adapter.ts` is a **no-op stub** by default. It never imports `extensions/memory-core` or `extensions/digital-human/src/memory-bridge.ts`. |
| Storage isolation | All on-disk state lives under `~/.winclaw-avatar/ext/memory-wiki/` — completely outside the existing memory-core storage. |
| Removable in one revert | Delete `extensions/avatar-ext-memory-wiki/` and revert the **single** 1-line dynamic import in `extensions/digital-human/src/index.ts`. |
| Dynamic import only | The DH entry point uses `void import('@winclaw-avatar/ext-memory-wiki/register')`. No static import of this package exists anywhere in the tree. |

## Opt-in

```bash
export AVATAR_EXT_MEMORY_WIKI=1
```

When disabled (the default), nothing in this package is loaded and ClawMem / LCM / DH / UI / GRC behave identically to a tree without this directory.

## Adapter mode

The ClawMem read-only adapter currently runs in **`noop`** mode. `extensions/memory-core/index.ts` exposes only WinClaw plugin registration objects, not a documented stable read API. Until a documented surface exists, this adapter remains a no-op so the additive guarantee cannot be violated. A future RFC may upgrade it.

## Layout

```
extensions/avatar-ext-memory-wiki/
├── package.json
├── README.md
├── src/
│   ├── index.ts
│   ├── register.ts
│   ├── storage.ts
│   ├── clawmem-adapter.ts
│   ├── belief-layer.ts
│   ├── digest-retrieval.ts
│   ├── claim-health.ts
│   └── prompt-helper.ts
└── test/
    └── register.test.ts
```

## Testing

```bash
pnpm vitest --config vitest.avatar-ext-memory-wiki.config.ts
```

This config is **not** referenced by any of the existing root-level vitest configs and therefore cannot influence the main CI suite.

## Removal

```bash
rm -rf extensions/avatar-ext-memory-wiki/ qa/avatar-vibes/
rm vitest.avatar-ext-memory-wiki.config.ts .github/workflows/avatar-vibes.yml
git checkout -- extensions/digital-human/src/index.ts
```

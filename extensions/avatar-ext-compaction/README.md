# @winclaw-avatar/ext-compaction

**Additive migration Phase 2** — pluggable compaction provider registry, prompt-cache runtime context exposure, and gateway compaction checkpoints. Strictly opt-in.

> **Source**: openclaw commits `12331f0463`, `e46e32b98c`, `f4fcaa09a3`.

## Hard guarantees

| Guarantee | Mechanism |
|---|---|
| LCM is untouched | Bundled LCM-default provider is a thin passthrough wrapper. |
| Zero impact when disabled | Activation gated on `AVATAR_EXT_COMPACTION_REGISTRY=1`. |
| Checkpoints doubly opt-in | Also requires `AVATAR_EXT_COMPACTION_CHECKPOINTS=1`. |
| No edits to existing gateway routes | Middleware mounted only via explicit `mountCompactionMiddleware()` call. |
| Removable in one revert | `rm -rf extensions/avatar-ext-compaction/` + revert 1 DH line. |

## Opt-in

```bash
export AVATAR_EXT_COMPACTION_REGISTRY=1
export AVATAR_EXT_COMPACTION_CHECKPOINTS=1   # optional, doubly opt-in
```

## Testing

```bash
pnpm vitest --config vitest.avatar-ext-compaction.config.ts
```

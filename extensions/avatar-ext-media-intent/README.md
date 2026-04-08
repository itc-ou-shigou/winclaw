# @winclaw-avatar/ext-media-intent

**Additive migration Phase 4** — preserve caller-supplied media intent (e.g. "respond as voice") across provider fallback events. Strictly opt-in.

> **Source**: openclaw `a463a33eee feat: preserve media intent across provider fallback`.

## Hard guarantees

| Guarantee | Mechanism |
|---|---|
| Existing providers untouched | Implemented as a free-standing helper. No provider class is subclassed, monkey-patched, or replaced. Callers explicitly opt in by passing their envelopes through `tagIntent()` / `readIntent()`. |
| Existing message envelope schema unchanged | Intent metadata is stored under `meta.ext.mediaIntent` — a previously unused namespace. The helper never adds top-level fields. |
| Zero impact when disabled | Activation gated on `AVATAR_EXT_MEDIA_INTENT=1`. With the flag off, `tagIntent()` is a passthrough returning the input envelope unchanged. |
| Removable in one revert | `rm -rf extensions/avatar-ext-media-intent/` + revert 1 DH line. |

## Opt-in

```bash
export AVATAR_EXT_MEDIA_INTENT=1
```

## Testing

```bash
pnpm vitest --config vitest.avatar-ext-media-intent.config.ts
```

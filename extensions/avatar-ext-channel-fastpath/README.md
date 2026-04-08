# @winclaw-avatar/ext-channel-fastpath

**Additive migration Phase 9** — direct channel model override fast-path. Strictly opt-in.

> **Source**: openclaw `9b25f616d5 channels: fast-path direct model override matches`, `abe460177d status: avoid plugin lookup for direct channel model overrides`.

## What it does

Provides a `tryFastPath()` helper that, given a channel-direct model override, returns a resolved model identifier WITHOUT performing any plugin lookup. On miss, it returns `null` so callers fall through to their existing resolver.

## Hard guarantees

| Guarantee | Mechanism |
|---|---|
| Existing channel resolver untouched | This is a helper. It is never auto-mounted into the existing channel routing. Callers must explicitly invoke `tryFastPath()` and handle the `null` (miss) case by calling their existing resolver. |
| Always falls through on miss | `tryFastPath()` returns `null` for any input that does not match a registered direct override. The decision to call the existing resolver is the caller's responsibility. |
| Zero impact when disabled | Gated on `AVATAR_EXT_CHANNEL_FASTPATH=1`. With the flag off, `tryFastPath()` always returns `null`. |
| Removable in one revert | `rm -rf extensions/avatar-ext-channel-fastpath/` + revert 1 DH line. |

## Opt-in

```bash
export AVATAR_EXT_CHANNEL_FASTPATH=1
```

## Testing

```bash
pnpm vitest --config vitest.avatar-ext-channel-fastpath.config.ts
```

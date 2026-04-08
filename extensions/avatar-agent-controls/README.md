# @winclaw-avatar/avatar-agent-controls

**Additive migration Phase 3** — sidecar for prompt override and heartbeat controls. Strictly opt-in.

> **Source**: openclaw `a3b2fdf7d6 feat(agents): add prompt override and heartbeat controls`.

## Hard guarantees

| Guarantee | Mechanism |
|---|---|
| DH persona logic untouched | Sidecar exposes only `avatar.ext.*` event names; DH does not import this package. |
| Existing DH watchdog untouched | Heartbeat is observation-only. Never restart/kill/signal the DH process. |
| Zero impact when disabled | `AVATAR_EXT_AGENT_CONTROLS=1` gated. |
| Removable in one revert | `rm -rf extensions/avatar-agent-controls/` + revert 1 DH line. |

## Opt-in

```bash
export AVATAR_EXT_AGENT_CONTROLS=1
```

## Testing

```bash
pnpm vitest --config vitest.avatar-agent-controls.config.ts
```

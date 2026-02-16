---
summary: "CLI reference for `winclaw voicecall` (voice-call plugin command surface)"
read_when:
  - You use the voice-call plugin and want the CLI entry points
  - You want quick examples for `voicecall call|continue|status|tail|expose`
title: "voicecall"
---

# `winclaw voicecall`

`voicecall` is a plugin-provided command. It only appears if the voice-call plugin is installed and enabled.

Primary doc:

- Voice-call plugin: [Voice Call](/plugins/voice-call)

## Common commands

```bash
winclaw voicecall status --call-id <id>
winclaw voicecall call --to "+15555550123" --message "Hello" --mode notify
winclaw voicecall continue --call-id <id> --message "Any questions?"
winclaw voicecall end --call-id <id>
```

## Exposing webhooks (Tailscale)

```bash
winclaw voicecall expose --mode serve
winclaw voicecall expose --mode funnel
winclaw voicecall unexpose
```

Security note: only expose the webhook endpoint to networks you trust. Prefer Tailscale Serve over Funnel when possible.

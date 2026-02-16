---
summary: "CLI reference for `winclaw config` (get/set/unset config values)"
read_when:
  - You want to read or edit config non-interactively
title: "config"
---

# `winclaw config`

Config helpers: get/set/unset values by path. Run without a subcommand to open
the configure wizard (same as `winclaw configure`).

## Examples

```bash
winclaw config get browser.executablePath
winclaw config set browser.executablePath "/usr/bin/google-chrome"
winclaw config set agents.defaults.heartbeat.every "2h"
winclaw config set agents.list[0].tools.exec.node "node-id-or-name"
winclaw config unset tools.web.search.apiKey
```

## Paths

Paths use dot or bracket notation:

```bash
winclaw config get agents.defaults.workspace
winclaw config get agents.list[0].id
```

Use the agent list index to target a specific agent:

```bash
winclaw config get agents.list
winclaw config set agents.list[1].tools.exec.node "node-id-or-name"
```

## Values

Values are parsed as JSON5 when possible; otherwise they are treated as strings.
Use `--json` to require JSON5 parsing.

```bash
winclaw config set agents.defaults.heartbeat.every "0m"
winclaw config set gateway.port 19001 --json
winclaw config set channels.whatsapp.groups '["*"]' --json
```

Restart the gateway after edits.

---
summary: "CLI reference for `winclaw config` (get/set/unset/file/validate)"
read_when:
  - You want to read or edit config non-interactively
title: "config"
---

# `winclaw config`

Config helpers: get/set/unset/validate values by path and print the active
config file. Run without a subcommand to open
the configure wizard (same as `winclaw configure`).

## Examples

```bash
winclaw config file
winclaw config get browser.executablePath
winclaw config set browser.executablePath "/usr/bin/google-chrome"
winclaw config set agents.defaults.heartbeat.every "2h"
winclaw config set agents.list[0].tools.exec.node "node-id-or-name"
winclaw config unset tools.web.search.apiKey
winclaw config validate
winclaw config validate --json
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
Use `--strict-json` to require JSON5 parsing. `--json` remains supported as a legacy alias.

```bash
winclaw config set agents.defaults.heartbeat.every "0m"
winclaw config set gateway.port 19001 --strict-json
winclaw config set channels.whatsapp.groups '["*"]' --strict-json
```

## Subcommands

- `config file`: Print the active config file path (resolved from `WINCLAW_CONFIG_PATH` or default location).

Restart the gateway after edits.

## Validate

Validate the current config against the active schema without starting the
gateway.

```bash
winclaw config validate
winclaw config validate --json
```

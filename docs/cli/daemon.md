---
summary: "CLI reference for `winclaw daemon` (legacy alias for gateway service management)"
read_when:
  - You still use `winclaw daemon ...` in scripts
  - You need service lifecycle commands (install/start/stop/restart/status)
title: "daemon"
---

# `winclaw daemon`

Legacy alias for Gateway service management commands.

`winclaw daemon ...` maps to the same service control surface as `winclaw gateway ...` service commands.

## Usage

```bash
winclaw daemon status
winclaw daemon install
winclaw daemon start
winclaw daemon stop
winclaw daemon restart
winclaw daemon uninstall
```

## Subcommands

- `status`: show service install state and probe Gateway health
- `install`: install service (`launchd`/`systemd`/`schtasks`)
- `uninstall`: remove service
- `start`: start service
- `stop`: stop service
- `restart`: restart service

## Common options

- `status`: `--url`, `--token`, `--password`, `--timeout`, `--no-probe`, `--deep`, `--json`
- `install`: `--port`, `--runtime <node|bun>`, `--token`, `--force`, `--json`
- lifecycle (`uninstall|start|stop|restart`): `--json`

## Prefer

Use [`winclaw gateway`](/cli/gateway) for current docs and examples.

#!/bin/bash
# =============================================================================
# MetaCoder Wrapper for WinClaw Docker Integration
# =============================================================================
# Extracts API keys from winclaw.json (auto-synced from GRC) and invokes
# metacoder with proper environment variables.
#
# Usage:
#   metacoder-wrapper.sh <command> [args...]
#
# Commands:
#   systest      Run /systest skill
#   newproject   Run /newproject skill
#   modernize    Run /modernize skill
#   graph        Run /graph subcommands
#   <other>      Pass-through to metacoder directly
# =============================================================================

set -e

CONFIG="${WINCLAW_CONFIG:-/home/winclaw/.winclaw/winclaw.json}"

if [ ! -f "$CONFIG" ]; then
  echo "[metacoder-wrapper] FATAL: winclaw.json not found at $CONFIG" >&2
  echo "[metacoder-wrapper] Container may not be initialized yet" >&2
  exit 1
fi

# Extract Anthropic API key (primary provider)
ANTHROPIC_KEY=$(jq -r '.models.providers.anthropic.apiKey // empty' "$CONFIG" 2>/dev/null)
ANTHROPIC_URL=$(jq -r '.models.providers.anthropic.baseUrl // empty' "$CONFIG" 2>/dev/null)

# Fallback to first available provider with apiKey
if [ -z "$ANTHROPIC_KEY" ]; then
  echo "[metacoder-wrapper] No anthropic key found, scanning other providers..." >&2
  PROVIDER_INFO=$(jq -r '.models.providers | to_entries[] | select(.value.apiKey != null and .value.apiKey != "") | "\(.key)=\(.value.apiKey)"' "$CONFIG" 2>/dev/null | head -1)
  if [ -n "$PROVIDER_INFO" ]; then
    PROVIDER_NAME="${PROVIDER_INFO%%=*}"
    PROVIDER_KEY="${PROVIDER_INFO#*=}"
    echo "[metacoder-wrapper] Using fallback provider: $PROVIDER_NAME" >&2
    # MetaCoder primarily supports Anthropic, but allow proxies via baseUrl
    ANTHROPIC_KEY="$PROVIDER_KEY"
    PROVIDER_URL=$(jq -r ".models.providers.\"$PROVIDER_NAME\".baseUrl // empty" "$CONFIG" 2>/dev/null)
    [ -n "$PROVIDER_URL" ] && ANTHROPIC_URL="$PROVIDER_URL"
  fi
fi

if [ -z "$ANTHROPIC_KEY" ]; then
  echo "[metacoder-wrapper] FATAL: No usable API key found in winclaw.json" >&2
  echo "[metacoder-wrapper] GRC must push models.providers.<provider>.apiKey first" >&2
  exit 1
fi

export ANTHROPIC_API_KEY="$ANTHROPIC_KEY"
[ -n "$ANTHROPIC_URL" ] && export ANTHROPIC_BASE_URL="$ANTHROPIC_URL"

# Suppress non-applicable warnings
export METACODER_SUPPRESS_TERMINAL_WARNING=1
export META_CODER_SKIP_SANDBOX_CHECK=1

# Persist user data within winclaw home (for 换水 to keep history)
export CLAUDE_CONFIG_DIR="/home/winclaw/.metacoder"
mkdir -p "$CLAUDE_CONFIG_DIR"

KEY_PREVIEW="${ANTHROPIC_KEY:0:10}...${ANTHROPIC_KEY: -4}"
echo "[metacoder-wrapper] API key extracted: $KEY_PREVIEW" >&2
[ -n "$ANTHROPIC_URL" ] && echo "[metacoder-wrapper] Using base URL: $ANTHROPIC_URL" >&2

COMMAND="${1:-}"
shift || true

# Invoke MetaCoder with appropriate slash command
case "$COMMAND" in
  systest|/systest)
    exec metacoder -p "/systest run $*"
    ;;
  newproject|/newproject)
    exec metacoder -p "/newproject $*"
    ;;
  modernize|/modernize)
    exec metacoder -p "/modernize $*"
    ;;
  graph|/graph)
    exec metacoder -p "/graph $*"
    ;;
  --version|-V)
    exec metacoder --version
    ;;
  --help|-h|"")
    cat << HELPEOF
MetaCoder Wrapper for WinClaw

Usage: metacoder-wrapper.sh <command> [args...]

Commands:
  systest <args>     Run system testing on existing project
                     e.g. systest --workspace /workspace --backend-url http://localhost:8000

  newproject <args>  Develop new project from requirements
                     e.g. newproject --requirements "Build a TODO web app" --output /workspace/todo

  modernize <args>   Modernize legacy project to web system
                     e.g. modernize --workspace /workspace/legacy --output /workspace/modern

  graph <args>       Knowledge graph operations
                     e.g. graph status / graph rebuild / graph query "..."

API Key:
  Automatically extracted from /home/winclaw/.winclaw/winclaw.json
  (synced from GRC via SSE config push)

Environment:
  Current key: $KEY_PREVIEW
  Base URL: ${ANTHROPIC_URL:-https://api.anthropic.com (default)}
HELPEOF
    ;;
  *)
    # Pass-through to metacoder directly
    exec metacoder "$COMMAND" "$@"
    ;;
esac

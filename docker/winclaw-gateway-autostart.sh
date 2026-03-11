#!/usr/bin/env bash
# =============================================================================
# WinClaw Gateway Auto-Start Guard
#
# Placed in /etc/profile.d/ and sourced from .bashrc so that the gateway
# starts automatically on the first shell session inside a Daytona sandbox.
# Uses a PID-file guard to ensure only one instance runs.
# =============================================================================

_winclaw_autostart() {
  local WINCLAW_DIR="${HOME}/.winclaw"
  local PID_FILE="${WINCLAW_DIR}/gateway.pid"
  local GATEWAY_LOG="${WINCLAW_DIR}/gateway.log"
  local GRC_URL="${WINCLAW_GRC_URL:-https://grc.myaiportal.net}"
  local CONFIG_FILE="${WINCLAW_DIR}/winclaw.json"

  # Ensure .winclaw dir exists
  mkdir -p "${WINCLAW_DIR}" 2>/dev/null

  # Create minimal GRC config if missing
  if [ ! -f "${CONFIG_FILE}" ]; then
    cat > "${CONFIG_FILE}" <<EOJSON
{
  "grc": {
    "url": "${GRC_URL}"
  }
}
EOJSON
  fi

  # Check if gateway is already running via PID file
  if [ -f "${PID_FILE}" ]; then
    local OLD_PID
    OLD_PID=$(cat "${PID_FILE}" 2>/dev/null)
    if [ -n "${OLD_PID}" ] && kill -0 "${OLD_PID}" 2>/dev/null; then
      return 0  # Already running
    fi
    rm -f "${PID_FILE}"
  fi

  # Also check by process name
  if pgrep -f "winclaw gateway" > /dev/null 2>&1; then
    return 0  # Already running
  fi

  # Start gateway
  nohup winclaw gateway --allow-unconfigured >> "${GATEWAY_LOG}" 2>&1 &
  local GW_PID=$!
  echo "${GW_PID}" > "${PID_FILE}"
  echo "[winclaw] Gateway started (PID: ${GW_PID}, GRC: ${GRC_URL})"
}

# Run the guard (only in interactive shells to avoid exec overhead)
if [[ $- == *i* ]] || [ -n "${WINCLAW_FORCE_AUTOSTART:-}" ]; then
  _winclaw_autostart
fi

unset -f _winclaw_autostart

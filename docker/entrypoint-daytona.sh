#!/usr/bin/env bash
# =============================================================================
# WinClaw Daytona Sandbox — Entrypoint
#
# Automatically starts the WinClaw gateway on container boot so that the
# sandbox node registers itself with the GRC server without manual steps.
#
# Environment variables:
#   WINCLAW_GRC_URL   GRC server URL (default: https://grc.myaiportal.net)
# =============================================================================

set -u

GRC_URL="${WINCLAW_GRC_URL:-https://grc.myaiportal.net}"
WINCLAW_DIR="${HOME}/.winclaw"
CONFIG_FILE="${WINCLAW_DIR}/winclaw.json"
GATEWAY_LOG="${WINCLAW_DIR}/gateway.log"

# ── 1. Create GRC config if it does not exist ──────────────────────────────
if [ ! -f "${CONFIG_FILE}" ]; then
  mkdir -p "${WINCLAW_DIR}"
  cat > "${CONFIG_FILE}" <<EOJSON
{
  "grc": {
    "url": "${GRC_URL}"
  }
}
EOJSON
  echo "[entrypoint] Created ${CONFIG_FILE} (GRC: ${GRC_URL})"
else
  echo "[entrypoint] Config already exists: ${CONFIG_FILE}"
fi

# ── 2. Start WinClaw gateway in background ─────────────────────────────────
echo "[entrypoint] Starting winclaw gateway..."
nohup winclaw gateway --allow-unconfigured > "${GATEWAY_LOG}" 2>&1 &
GATEWAY_PID=$!
echo "[entrypoint] Gateway started (PID: ${GATEWAY_PID})"

# ── 3. Graceful shutdown on SIGTERM/SIGINT ──────────────────────────────────
cleanup() {
  echo "[entrypoint] Shutting down gateway (PID: ${GATEWAY_PID})..."
  kill "${GATEWAY_PID}" 2>/dev/null
  wait "${GATEWAY_PID}" 2>/dev/null
  echo "[entrypoint] Goodbye."
  exit 0
}
trap cleanup SIGTERM SIGINT

# ── 4. Keep container alive ─────────────────────────────────────────────────
# Use 'wait' in a loop so that signals are delivered immediately.
while true; do
  sleep 86400 &
  wait $! 2>/dev/null
done

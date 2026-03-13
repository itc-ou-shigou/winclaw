#!/usr/bin/env bash
# =============================================================================
# WinClaw Daytona Sandbox — Entrypoint
#
# Automatically starts the WinClaw gateway on container boot so that the
# sandbox node registers itself with the GRC server without manual steps.
# Optionally starts ngrok tunnel to expose the gateway externally.
#
# Environment variables:
#   WINCLAW_GRC_URL              GRC server URL (default: https://grc.myaiportal.net)
#   NGROK_AUTHTOKEN              ngrok auth token (enables tunnel if set)
#   NGROK_ENABLED                "true" to enable ngrok tunnel
#   NGROK_PREVIEW_DURATION_HOURS Hours before tunnel auto-shutdown (default: 8)
# =============================================================================

set -u

GRC_URL="${WINCLAW_GRC_URL:-https://grc.myaiportal.net}"
WINCLAW_DIR="${HOME}/.winclaw"
CONFIG_FILE="${WINCLAW_DIR}/winclaw.json"
GATEWAY_LOG="${WINCLAW_DIR}/gateway.log"
NGROK_LOG="${WINCLAW_DIR}/ngrok.log"

NGROK_TOKEN="${NGROK_AUTHTOKEN:-}"
NGROK_ON="${NGROK_ENABLED:-false}"
NGROK_HOURS="${NGROK_PREVIEW_DURATION_HOURS:-8}"
NGROK_PID=""

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

# ── 3. Start ngrok tunnel if enabled ──────────────────────────────────────
if [ "${NGROK_ON}" = "true" ] && [ -n "${NGROK_TOKEN}" ]; then
  echo "[entrypoint] Configuring ngrok..."
  ngrok config add-authtoken "${NGROK_TOKEN}" 2>/dev/null

  # Wait a few seconds for gateway to start listening
  sleep 3

  echo "[entrypoint] Starting ngrok tunnel → http://127.0.0.1:18789 ..."
  nohup ngrok http 18789 --log "${NGROK_LOG}" --log-format logfmt > /dev/null 2>&1 &
  NGROK_PID=$!
  echo "[entrypoint] ngrok started (PID: ${NGROK_PID})"

  # Wait for tunnel to establish and print the public URL
  sleep 3
  NGROK_URL=""
  for i in 1 2 3 4 5; do
    NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null \
      | python3 -c "import sys,json; t=json.load(sys.stdin)['tunnels']; print(t[0]['public_url'] if t else '')" 2>/dev/null)
    if [ -n "${NGROK_URL}" ]; then
      break
    fi
    sleep 2
  done

  if [ -n "${NGROK_URL}" ]; then
    echo ""
    echo "============================================"
    echo " ngrok tunnel active!"
    echo " Public URL: ${NGROK_URL}"
    echo " Gateway:    ${NGROK_URL}/chat?session=agent%3Amain%3Amain"
    echo " Duration:   ${NGROK_HOURS} hours"
    echo " Inspector:  http://127.0.0.1:4040"
    echo "============================================"
    echo ""

    # Save ngrok URL for other tools to discover
    echo "${NGROK_URL}" > "${WINCLAW_DIR}/ngrok-url.txt"
  else
    echo "[entrypoint] WARNING: ngrok started but could not retrieve public URL"
    echo "[entrypoint] Check ${NGROK_LOG} for details"
  fi

  # Schedule auto-shutdown after NGROK_HOURS
  if [ "${NGROK_HOURS}" -gt 0 ] 2>/dev/null; then
    NGROK_SECONDS=$((NGROK_HOURS * 3600))
    (sleep "${NGROK_SECONDS}" && echo "[entrypoint] ngrok preview duration (${NGROK_HOURS}h) expired, stopping tunnel..." && kill "${NGROK_PID}" 2>/dev/null) &
  fi
else
  echo "[entrypoint] ngrok disabled (set NGROK_ENABLED=true and NGROK_AUTHTOKEN to enable)"
fi

# ── 4. Graceful shutdown on SIGTERM/SIGINT ──────────────────────────────────
cleanup() {
  echo "[entrypoint] Shutting down..."
  [ -n "${NGROK_PID}" ] && kill "${NGROK_PID}" 2>/dev/null
  kill "${GATEWAY_PID}" 2>/dev/null
  wait "${GATEWAY_PID}" 2>/dev/null
  echo "[entrypoint] Goodbye."
  exit 0
}
trap cleanup SIGTERM SIGINT

# ── 5. Keep container alive ─────────────────────────────────────────────────
# Use 'wait' in a loop so that signals are delivered immediately.
while true; do
  sleep 86400 &
  wait $! 2>/dev/null
done

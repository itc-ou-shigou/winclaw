#!/usr/bin/env bash
# =============================================================================
# WinClaw Node — Entrypoint
#
# Generates winclaw.json from environment variables and starts the gateway.
#
# Environment variables:
#   WINCLAW_GRC_URL          GRC server URL (default: https://grc.myaiportal.net)
#   employee_name            Employee display name (e.g. 橋本透)
#   employee_code            Employee ID/code (e.g. 0753242)
#   WINCLAW_GATEWAY_PORT     Gateway port (default: 18789)
#   WINCLAW_GATEWAY_BIND     Bind mode: loopback|lan|auto (default: lan)
#   WINCLAW_GATEWAY_AUTH     Auth mode: none|token|password (default: token)
#   WINCLAW_GATEWAY_TOKEN    Auth token (auto-generated if not set)
# =============================================================================

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
GRC_URL="${WINCLAW_GRC_URL:-https://grc.myaiportal.net}"
EMP_NAME="${employee_name:-}"
EMP_CODE="${employee_code:-}"
GW_PORT="${WINCLAW_GATEWAY_PORT:-18789}"
GW_BIND="${WINCLAW_GATEWAY_BIND:-lan}"
GW_AUTH="${WINCLAW_GATEWAY_AUTH:-token}"
GW_TOKEN="${WINCLAW_GATEWAY_TOKEN:-}"

WINCLAW_DIR="${HOME}/.winclaw"
CONFIG_FILE="${WINCLAW_DIR}/winclaw.json"

# Auto-generate token if auth=token and no token provided
if [ "${GW_AUTH}" = "token" ] && [ -z "${GW_TOKEN}" ]; then
  GW_TOKEN="winclaw-node-$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')"
fi

# ── Banner ───────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           🦞  WinClaw Node — Starting Gateway               ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  GRC URL:       ${GRC_URL}"
if [ -n "${EMP_NAME}" ]; then
echo "║  Employee:      ${EMP_NAME} (${EMP_CODE})"
fi
echo "║  Gateway Port:  ${GW_PORT}"
echo "║  Bind Mode:     ${GW_BIND}"
echo "║  Auth Mode:     ${GW_AUTH}"
if [ "${GW_AUTH}" = "token" ]; then
echo "║  Token:         ${GW_TOKEN}"
fi
echo "╠══════════════════════════════════════════════════════════════╣"
if [ "${GW_AUTH}" = "token" ]; then
echo "║  Chat UI (with token):"
echo "║    http://localhost:${GW_PORT}/chat?token=${GW_TOKEN}"
else
echo "║  Chat UI:       http://localhost:${GW_PORT}/chat"
fi
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── Generate winclaw.json ────────────────────────────────────────────────────
mkdir -p "${WINCLAW_DIR}"

# Build JSON config with jq for proper escaping of CJK names
CONFIG_JSON=$(jq -n \
  --arg grc_url "${GRC_URL}" \
  --arg emp_id "${EMP_CODE}" \
  --arg emp_name "${EMP_NAME}" \
  --arg gw_bind "${GW_BIND}" \
  --arg gw_auth "${GW_AUTH}" \
  --arg gw_token "${GW_TOKEN}" \
  '{
    gateway: {
      mode: "local",
      bind: $gw_bind,
      controlUi: {
        allowedOrigins: ["*"],
        dangerouslyDisableDeviceAuth: true
      },
      auth: {
        mode: $gw_auth,
        token: $gw_token
      }
    },
    tools: {
      sessions: {
        visibility: "all"
      },
      agentToAgent: {
        enabled: true
      }
    },
    grc: {
      enabled: true,
      url: $grc_url,
      employeeId: $emp_id,
      employeeName: $emp_name
    }
  }')

echo "${CONFIG_JSON}" > "${CONFIG_FILE}"
echo "[entrypoint] Config written to ${CONFIG_FILE}"

# ── Start Gateway ────────────────────────────────────────────────────────────
echo "[entrypoint] Starting winclaw gateway on port ${GW_PORT} (bind: ${GW_BIND})..."
echo ""

# Build gateway args
GW_ARGS=(
  gateway
  --allow-unconfigured
  --bind "${GW_BIND}"
  --port "${GW_PORT}"
  --auth "${GW_AUTH}"
  --token "${GW_TOKEN}"
)

# Execute gateway as PID 1 (tini handles signals)
exec winclaw "${GW_ARGS[@]}"

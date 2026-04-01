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
#   employee_email           Employee email (e.g. info@example.com)
#   WINCLAW_GATEWAY_PORT     Gateway port (default: 18789)
#   WINCLAW_GATEWAY_BIND     Bind mode: loopback|lan|auto (default: lan)
#   WINCLAW_GATEWAY_AUTH     Auth mode: none|token|password (default: token)
#   WINCLAW_GATEWAY_TOKEN    Auth token (auto-generated if not set)
#   WINCLAW_NODE_ID          Fixed node ID (preserves identity across restarts)
# =============================================================================

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
GRC_URL="${WINCLAW_GRC_URL:-https://grc.myaiportal.net}"
EMP_NAME="${employee_name:-}"
EMP_CODE="${employee_code:-}"
EMP_EMAIL="${employee_email:-}"
GW_PORT="${WINCLAW_GATEWAY_PORT:-18789}"
GW_BIND="${WINCLAW_GATEWAY_BIND:-lan}"
GW_AUTH="${WINCLAW_GATEWAY_AUTH:-token}"
GW_TOKEN="${WINCLAW_GATEWAY_TOKEN:-}"
WS_HOST_PATH="${WINCLAW_WORKSPACE_HOST_PATH:-}"

WINCLAW_DIR="/home/winclaw/.winclaw"
CONFIG_FILE="${WINCLAW_DIR}/winclaw.json"

# Fix permissions on mounted volumes so winclaw user can read/write
# chown may not work on some Docker volume drivers, so use chmod as fallback
chown -R winclaw:winclaw "${WINCLAW_DIR}/workspace" 2>/dev/null || chmod -R 777 "${WINCLAW_DIR}/workspace" 2>/dev/null || true
chown -R winclaw:winclaw "${WINCLAW_DIR}/identity" 2>/dev/null || chmod -R 777 "${WINCLAW_DIR}/identity" 2>/dev/null || true
# Ensure .winclaw dir itself is writable for config file
chown -R winclaw:winclaw "${WINCLAW_DIR}" 2>/dev/null || chmod -R 777 "${WINCLAW_DIR}" 2>/dev/null || true

# Auto-generate token if auth=token and no token provided
if [ "${GW_AUTH}" = "token" ] && [ -z "${GW_TOKEN}" ]; then
  GW_TOKEN="winclaw-node-$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')"
fi
# Persist token to file for GRC restart flow to read
echo "${GW_TOKEN}" > /tmp/winclaw-token

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
if [ -n "${GITHUB_TOKEN:-}" ]; then
echo "║  GitHub:        ✓ Token configured (${#GITHUB_TOKEN} chars)"
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

# ── Ensure directories exist & fix ownership for mounted volumes ─────────────
mkdir -p "${WINCLAW_DIR}/identity" "${WINCLAW_DIR}/workspace"
# Docker volume mounts from Windows/macOS may be owned by root;
# ensure winclaw user can write to workspace, identity, and config dir.
# chown may fail on some volume drivers (e.g. Docker Desktop), so chmod as fallback.
for d in "${WINCLAW_DIR}" "${WINCLAW_DIR}/workspace" "${WINCLAW_DIR}/identity"; do
  chown -R winclaw:winclaw "$d" 2>/dev/null || chmod -R 777 "$d" 2>/dev/null || true
done

# Build JSON config with jq for proper escaping of CJK names
CONFIG_JSON=$(jq -n \
  --arg grc_url "${GRC_URL}" \
  --arg emp_id "${EMP_CODE}" \
  --arg emp_name "${EMP_NAME}" \
  --arg emp_email "${EMP_EMAIL}" \
  --arg gw_bind "${GW_BIND}" \
  --arg gw_auth "${GW_AUTH}" \
  --arg gw_token "${GW_TOKEN}" \
  --arg ws_path "${WS_HOST_PATH}" \
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
      employeeName: $emp_name,
      employeeEmail: $emp_email,
      workspaceHostPath: $ws_path
    }
  }')

PERSIST_DIR="/home/winclaw/.winclaw/config-persist"

# Check if persistent config exists (from previous container / 换水)
if [ -f "${PERSIST_DIR}/winclaw.json" ]; then
  echo "[entrypoint] Found persistent config from previous container"

  # Merge: take LLM providers from old config
  # but use NEW grc/gateway settings from env vars (employee info, token, etc.)
  # IMPORTANT: grc section must ALWAYS come from .[0] (env vars) to preserve employee info
  # "models" is the correct WinClaw config key for LLM provider settings (not "providers")
  MERGED_JSON=$(jq -s '
    .[0] + {
      models: (.[1].models // {}),
      tools: (.[1].tools // .[0].tools),
      gateway: (.[0].gateway),
      grc: (.[0].grc)
    }
  ' <(echo "${CONFIG_JSON}") "${PERSIST_DIR}/winclaw.json" 2>/dev/null) || true

  if [ -n "${MERGED_JSON}" ] && [ "${MERGED_JSON}" != "null" ]; then
    echo "${MERGED_JSON}" > "${CONFIG_FILE}"
    echo "[entrypoint] Config merged with persistent data (LLM providers preserved)"
  else
    echo "${CONFIG_JSON}" > "${CONFIG_FILE}"
    echo "[entrypoint] Config merge failed, using fresh config"
  fi
else
  echo "${CONFIG_JSON}" > "${CONFIG_FILE}"
  echo "[entrypoint] Config written (no persistent data found)"
fi

# Restore grc-config-state.json (role assignments)
if [ -f "${PERSIST_DIR}/grc-config-state.json" ]; then
  cp "${PERSIST_DIR}/grc-config-state.json" "/home/winclaw/.winclaw/grc-config-state.json"
  chown winclaw:winclaw "/home/winclaw/.winclaw/grc-config-state.json" 2>/dev/null || true
  echo "[entrypoint] Restored grc-config-state.json (role: $(jq -r '.roleId // "none"' /home/winclaw/.winclaw/grc-config-state.json))"
fi

# Restore OAuth credentials if they exist
if [ -f "${PERSIST_DIR}/oauth.json" ]; then
  mkdir -p /home/winclaw/.winclaw/credentials
  cp "${PERSIST_DIR}/oauth.json" "/home/winclaw/.winclaw/credentials/oauth.json"
  chown -R winclaw:winclaw /home/winclaw/.winclaw/credentials 2>/dev/null || true
  echo "[entrypoint] Restored OAuth credentials"
fi

# ── Stagger startup to prevent thundering herd on GRC ────────────────────────
STAGGER_DELAY=$((RANDOM % 30))
echo "[entrypoint] Staggering startup by ${STAGGER_DELAY}s to prevent thundering herd..."
sleep "$STAGGER_DELAY"

# ── Wait for GRC server to be reachable ──────────────────────────────────────
if [ -n "${GRC_URL}" ]; then
  echo "[entrypoint] Waiting for GRC at ${GRC_URL}..."
  GRC_READY=0
  for i in $(seq 1 30); do
    if curl -sf "${GRC_URL}/health" > /dev/null 2>&1; then
      echo "[entrypoint] ✓ GRC server reachable (attempt ${i})"
      GRC_READY=1
      break
    fi
    sleep 2
  done
  if [ "${GRC_READY}" -eq 0 ]; then
    echo "[entrypoint] ⚠ GRC not reachable after 60s, starting gateway anyway (will retry in background)"
  fi
fi

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

# Drop privileges to winclaw user and execute gateway (tini handles signals)
exec gosu winclaw winclaw "${GW_ARGS[@]}"

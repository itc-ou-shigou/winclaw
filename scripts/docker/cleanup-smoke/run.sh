#!/usr/bin/env bash
set -euo pipefail

cd /repo

export WINCLAW_STATE_DIR="/tmp/winclaw-test"
export WINCLAW_CONFIG_PATH="${WINCLAW_STATE_DIR}/winclaw.json"

echo "==> Build"
pnpm build

echo "==> Seed state"
mkdir -p "${WINCLAW_STATE_DIR}/credentials"
mkdir -p "${WINCLAW_STATE_DIR}/agents/main/sessions"
echo '{}' >"${WINCLAW_CONFIG_PATH}"
echo 'creds' >"${WINCLAW_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${WINCLAW_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
pnpm winclaw reset --scope config+creds+sessions --yes --non-interactive

test ! -f "${WINCLAW_CONFIG_PATH}"
test ! -d "${WINCLAW_STATE_DIR}/credentials"
test ! -d "${WINCLAW_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${WINCLAW_STATE_DIR}/credentials"
echo '{}' >"${WINCLAW_CONFIG_PATH}"

echo "==> Uninstall (state only)"
pnpm winclaw uninstall --state --yes --non-interactive

test ! -d "${WINCLAW_STATE_DIR}"

echo "OK"

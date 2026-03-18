#!/usr/bin/env bash
# =============================================================================
# Build and push winclaw-node multi-arch image to Docker Hub
#
# Prerequisites:
#   - docker login (or credentials passed via env)
#   - docker buildx builder with multi-platform support
#
# Usage:
#   cd /path/to/winclaw
#   bash docker/build-and-push-node.sh
#
# Or with custom tag:
#   bash docker/build-and-push-node.sh v2026.3.15
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

IMAGE_NAME="itccloudsoft/winclaw-node"
TAG="${1:-latest}"
FULL_TAG="${IMAGE_NAME}:${TAG}"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║    Building winclaw-node Docker image (multi-arch)      ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Image:     ${FULL_TAG}"
echo "║  Platforms: linux/amd64, linux/arm64"
echo "║  Context:   ${PROJECT_ROOT}"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

cd "${PROJECT_ROOT}"

# ── 1. Ensure buildx builder exists ─────────────────────────────────────────
BUILDER_NAME="winclaw-multiarch"
if ! docker buildx inspect "${BUILDER_NAME}" > /dev/null 2>&1; then
  echo "[build] Creating buildx builder: ${BUILDER_NAME}"
  docker buildx create --name "${BUILDER_NAME}" --use --driver docker-container
else
  echo "[build] Using existing builder: ${BUILDER_NAME}"
  docker buildx use "${BUILDER_NAME}"
fi

# ── 2. Docker Hub login ─────────────────────────────────────────────────────
if [ -n "${DOCKERHUB_USERNAME:-}" ] && [ -n "${DOCKERHUB_PASSWORD:-}" ]; then
  echo "[build] Logging in to Docker Hub..."
  echo "${DOCKERHUB_PASSWORD}" | docker login -u "${DOCKERHUB_USERNAME}" --password-stdin
else
  echo "[build] Using existing Docker Hub credentials (docker login)"
fi

# ── 3. Build and push multi-arch image ───────────────────────────────────────
echo "[build] Building and pushing ${FULL_TAG}..."
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --file docker/Dockerfile.node \
  --tag "${FULL_TAG}" \
  --tag "${IMAGE_NAME}:$(date +%Y%m%d)" \
  --push \
  .

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║    ✅ Successfully pushed ${FULL_TAG}"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Run with:"
echo "║    docker run -p 18789:18789 \\"
echo "║      -e WINCLAW_GRC_URL=http://your-grc:3100 \\"
echo "║      -e employee_name=橋本透 \\"
echo "║      -e employee_code=0753242 \\"
echo "║      ${FULL_TAG}"
echo "║"
echo "║  Then open: http://localhost:18789/chat"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

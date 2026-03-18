#!/usr/bin/env bash
# =============================================================================
# Build and optionally push the WinClaw Sandbox image.
#
# Usage:
#   ./docker/build-sandbox.sh            # build only
#   ./docker/build-sandbox.sh --push     # build + push to Docker Hub
#
# Environment variables:
#   REPO        Docker Hub repository  (default: itccloudsoft/winclaw-sandbox)
#   PLATFORM    Target platform        (default: linux/amd64)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

REPO="${REPO:-itccloudsoft/winclaw-sandbox}"
PLATFORM="${PLATFORM:-linux/amd64}"

# Read version from package.json
VERSION="$(node -p "require('${PROJECT_ROOT}/package.json').version")"

TAG_LATEST="${REPO}:latest"
TAG_VERSION="${REPO}:${VERSION}"

echo "============================================"
echo " WinClaw Sandbox Image Builder"
echo "============================================"
echo " Repository : ${REPO}"
echo " Version    : ${VERSION}"
echo " Platform   : ${PLATFORM}"
echo " Tags       : ${TAG_LATEST}, ${TAG_VERSION}"
echo "============================================"
echo ""

# Build
echo ">>> Building image..."
docker build \
  --platform "${PLATFORM}" \
  -t "${TAG_LATEST}" \
  -t "${TAG_VERSION}" \
  -f "${SCRIPT_DIR}/Dockerfile.sandbox" \
  "${PROJECT_ROOT}"

echo ""
echo ">>> Build complete."
docker images --filter "reference=${REPO}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

# Push (optional)
if [[ "${1:-}" == "--push" ]]; then
  echo ""
  echo ">>> Pushing to Docker Hub..."
  docker push "${TAG_LATEST}"
  docker push "${TAG_VERSION}"
  echo ""
  echo ">>> Push complete."
  echo "    ${TAG_LATEST}"
  echo "    ${TAG_VERSION}"
fi

echo ""
echo "Done. To run interactively:"
echo "  docker run --rm -it -p 18789:18789 ${TAG_LATEST}"
echo ""
echo "With GRC connection:"
echo "  docker run --rm -it -p 18789:18789 \\"
echo "    -e WINCLAW_GRC_URL=http://your-grc:3100 \\"
echo "    ${TAG_LATEST}"

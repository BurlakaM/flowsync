#!/usr/bin/env bash
# Visual regression of the public pages (login, register, forgot password; light and dark; desktop and phone).
#
#   ./ops/visual.sh            compare the pages with the baseline images in frontend/e2e/__screenshots__
#   ./ops/visual.sh update     accept the current look as the new baseline (commit the changed images)
#
# It runs in the official Playwright Linux container, because screenshots only compare across machines when
# the fonts and the browser build are the same. The container installs its own node_modules into a Docker
# volume, so the Windows or macOS node_modules of the host are never touched.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
# Git Bash on Windows rewrites /paths in arguments (also the container side of -v); this switches that off.
export MSYS_NO_PATHCONV=1

# The lockfile, not node_modules: on a fresh CI checkout nothing is installed on the host yet.
VERSION="$(node -p "require('./frontend/package-lock.json').packages['node_modules/@playwright/test'].version")"
IMAGE="mcr.microsoft.com/playwright:v${VERSION}-noble"
MODE="${1:-compare}"
EXTRA=""
[ "$MODE" = "update" ] && EXTRA="--update-snapshots"

docker run --rm --ipc=host -e VISUAL=1 \
  -v "$ROOT_DIR/frontend:/work" -v flowsync-visual-node-modules:/work/node_modules -w /work \
  "$IMAGE" sh -c "npm ci --no-audit --no-fund >/dev/null && npx playwright test --project visual $EXTRA"

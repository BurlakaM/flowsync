#!/usr/bin/env bash
# Deploys an image tag on the VPS and rolls back to the previous tag if the smoke test fails.
#
#   COMPOSE_FILES="-f docker-compose.yml -f docker-compose.vps.yml" ./ops/deploy.sh <tag> [base-url]
#
# The tag is the commit sha published by the Deploy workflow. The last good tag is kept in
# .deployed-tag, so a rollback needs no registry lookups and no human.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

NEW_TAG="${1:?Usage: deploy.sh <image-tag> [base-url]}"
BASE_URL="${2:-https://$(env_value DOMAIN localhost)}"
STATE_FILE="$ROOT_DIR/.deployed-tag"
PREVIOUS_TAG="$(cat "$STATE_FILE" 2>/dev/null || true)"

up() { TAG="$1" compose up -d --remove-orphans; }

# A fresh backup first: migrations run on container start and cannot be undone by an image rollback.
"$ROOT_DIR/ops/backup.sh"

echo "Deploying $NEW_TAG (previous: ${PREVIOUS_TAG:-none})"
up "$NEW_TAG"

if "$ROOT_DIR/ops/smoke-test.sh" "$BASE_URL"; then
  printf '%s' "$NEW_TAG" >"$STATE_FILE"
  echo "Deployed $NEW_TAG"
  exit 0
fi

echo "Smoke test failed" >&2
if [ -z "$PREVIOUS_TAG" ]; then
  echo "No previous tag to roll back to; leaving the stack as is for inspection" >&2
  exit 1
fi

echo "Rolling back to $PREVIOUS_TAG" >&2
up "$PREVIOUS_TAG"
"$ROOT_DIR/ops/smoke-test.sh" "$BASE_URL" || echo "WARNING: the previous version fails the smoke test too" >&2
echo "Rolled back. If the new version ran a migration, check it is backward compatible or restore the backup" >&2
exit 1

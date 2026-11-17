#!/usr/bin/env bash
# Post-deploy smoke test: a few cheap checks that the stack answers and is configured safely.
#   ./ops/smoke-test.sh http://localhost:8080
# Exit code 0 = all checks passed; deploy.sh uses it to decide on a rollback.
set -uo pipefail

BASE="${1:?Usage: smoke-test.sh <base-url>}"
BASE="${BASE%/}"
RETRIES="${SMOKE_RETRIES:-20}"
failed=0

status() { curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$@" || true; }
check() { # check <name> <expected> <actual>
  if [ "$2" = "$3" ]; then echo "ok    $1"; else echo "FAIL  $1 (expected $2, got $3)"; failed=1; fi
}

# The stack may still be starting right after `up`: wait for readiness instead of failing at once.
for i in $(seq 1 "$RETRIES"); do
  [ "$(status "$BASE/api/health/ready")" = "200" ] && break
  [ "$i" -lt "$RETRIES" ] && sleep 3
done

check "liveness"                    200 "$(status "$BASE/api/health/live")"
check "readiness (database, redis)" 200 "$(status "$BASE/api/health/ready")"
check "frontend index"              200 "$(status "$BASE/")"
check "SPA fallback on a deep link" 200 "$(status "$BASE/projects")"
check "API is closed by default"    401 "$(status "$BASE/api/users/me")"
check "Swagger is off in production" 404 "$(status "$BASE/api/docs")"

headers="$(curl -sI --max-time 10 "$BASE/" || true)"
for h in content-security-policy x-content-type-options; do
  if printf '%s' "$headers" | grep -qi "^$h:"; then echo "ok    header $h"; else echo "FAIL  header $h missing"; failed=1; fi
done

[ "$failed" -eq 0 ] && echo "Smoke test passed" || echo "Smoke test FAILED"
exit "$failed"

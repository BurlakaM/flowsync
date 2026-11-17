#!/usr/bin/env bash
# Load test on a throw-away copy: a separate database (flowsync_perf) in the development Postgres, a separate
# backend container built from the production image, and k6 in a container. Nothing of the development data
# is touched, and everything is removed at the end.
#
#   ./ops/load/run.sh                 # 20 virtual users, ~90 s
#   VUS=50 ./ops/load/run.sh
#   KEEP=1 ./ops/load/run.sh          # leave the database and the backend running (for EXPLAIN ANALYZE by hand)
#
# Needs the development stack running (docker compose up -d): it provides the Postgres container and network.
# The numbers are only comparable between runs on the same machine: compare before/after, not absolutes.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"
# Git Bash on Windows rewrites /paths in arguments (also the container side of -v); this switches that off.
export MSYS_NO_PATHCONV=1

NETWORK="${NETWORK:-flowsync_app_network}"
DB_CONTAINER="${DB_CONTAINER:-flowsync-db}"
PERF_DB=flowsync_perf
BACKEND=flowsync-backend-perf
IMAGE=flowsync-backend-perf
OUT_DIR="$ROOT_DIR/.load-out"
mkdir -p "$OUT_DIR"

env_value() { grep -E "^$1=" "$ROOT_DIR/.env" | tail -n1 | cut -d= -f2- | tr -d '"'; }
DB_USER="$(env_value POSTGRES_USER || true)"; DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="$(env_value POSTGRES_PASSWORD)"
psql_admin() { docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" "$@"; }

cleanup() {
  if [ "${KEEP:-0}" = "1" ]; then
    echo "KEEP=1: the backend ($BACKEND) and the database ($PERF_DB) stay. Remove them with:"
    echo "  docker rm -f $BACKEND; docker exec $DB_CONTAINER psql -U $DB_USER -c 'DROP DATABASE $PERF_DB'"
    return
  fi
  docker rm -f "$BACKEND" >/dev/null 2>&1 || true
  psql_admin -d postgres -c "DROP DATABASE IF EXISTS $PERF_DB" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "== Building the production image"
docker build -q --target prod -t "$IMAGE" ./backend >/dev/null

echo "== Creating $PERF_DB and applying the migrations"
psql_admin -d postgres -c "DROP DATABASE IF EXISTS $PERF_DB" -c "CREATE DATABASE $PERF_DB" >/dev/null
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@db:5432/$PERF_DB"
docker run --rm --network "$NETWORK" -e "DATABASE_URL=$DATABASE_URL" "$IMAGE" npx prisma migrate deploy >/dev/null

echo "== Seeding (this takes a minute)"
HASH="$(docker run --rm "$IMAGE" node -e "console.log(require('bcryptjs').hashSync('password-123', 4))")"
psql_admin -d "$PERF_DB" -v "pwhash=$HASH" < ops/load/seed.sql | tail -8

echo "== Starting the backend (production mode, rate limit lifted for this instance only)"
SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
docker rm -f "$BACKEND" >/dev/null 2>&1 || true
docker run -d --name "$BACKEND" --network "$NETWORK" -p 3100:3000 \
  -e NODE_ENV=production -e "DATABASE_URL=$DATABASE_URL" -e "JWT_SECRET=$SECRET" \
  -e RATE_LIMIT_PER_MINUTE=1000000 -e LOG_LEVEL=warn "$IMAGE" node dist/main >/dev/null
for _ in $(seq 1 40); do
  docker exec "$BACKEND" wget -qO- http://127.0.0.1:3000/api/health/live >/dev/null 2>&1 && break
  sleep 2
done

echo "== Running k6 (${VUS:-20} virtual users)"
rm -f "$OUT_DIR/summary.json"
set +e
docker run --rm --network "$NETWORK" -e "BASE_URL=http://$BACKEND:3000" -e "VUS=${VUS:-20}" \
  -v "$ROOT_DIR/ops/load:/load:ro" -v "$OUT_DIR:/out" grafana/k6:latest run \
  --summary-export=/out/summary.json /load/scenario.js
K6_EXIT=$?
set -e
echo "k6 exit code: $K6_EXIT (99 = a threshold was missed, the run itself worked)"
echo "Summary: .load-out/summary.json"
exit 0

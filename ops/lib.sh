#!/usr/bin/env bash
# Shared helpers for the ops scripts. Source it, do not run it.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Compose files can be overridden, e.g. on the VPS: COMPOSE_FILES="-f docker-compose.yml -f docker-compose.vps.yml"
COMPOSE_FILES="${COMPOSE_FILES:--f docker-compose.yml}"

compose() {
  # shellcheck disable=SC2086
  (cd "$ROOT_DIR" && docker compose $COMPOSE_FILES "$@")
}

# Reads a KEY from the root .env without sourcing it (values may contain shell characters).
env_value() {
  local key="$1" default="${2:-}"
  local line
  line="$(grep -E "^${key}=" "$ROOT_DIR/.env" 2>/dev/null | tail -n1 || true)"
  if [ -n "$line" ]; then
    printf '%s' "${line#*=}" | sed -e 's/^"//' -e 's/"$//'
  else
    printf '%s' "$default"
  fi
}

DB_USER="${POSTGRES_USER:-$(env_value POSTGRES_USER postgres)}"
DB_NAME="${POSTGRES_DB:-$(env_value POSTGRES_DB flowsync)}"

# psql inside the db container; the password is not needed over the local socket.
psql_db() {
  local db="$1"; shift
  compose exec -T db psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$db" "$@"
}

# "table row_count" for every table of the public schema, exact (not planner estimates).
table_counts() {
  psql_db "$1" -At -F ' ' -c "
    SELECT table_name,
           (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name"
}

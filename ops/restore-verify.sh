#!/usr/bin/env bash
# Proves that a backup can actually be restored: loads it into a throwaway database, then checks
# that every table has the row count recorded at backup time and that all migrations are present.
# The live database is never touched.
#
#   ./ops/restore-verify.sh                       # the newest dump in backups/
#   ./ops/restore-verify.sh backups/flowsync-X.dump
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
dump="${1:-$(ls -1t "$BACKUP_DIR"/flowsync-*.dump 2>/dev/null | head -n1 || true)}"
[ -n "$dump" ] && [ -f "$dump" ] || { echo "No dump found (run ops/backup.sh first)" >&2; exit 1; }
[ -f "$dump.counts" ] || { echo "Missing $dump.counts (created by ops/backup.sh)" >&2; exit 1; }

scratch="flowsync_restore_check"
cleanup() { psql_db postgres -c "DROP DATABASE IF EXISTS $scratch" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "Restoring $dump into '$scratch'"
psql_db postgres -c "DROP DATABASE IF EXISTS $scratch" -c "CREATE DATABASE $scratch" >/dev/null
compose exec -T db pg_restore -U "$DB_USER" -d "$scratch" --no-owner --exit-on-error <"$dump"

actual="$(table_counts "$scratch")"
if ! diff <(cat "$dump.counts") <(printf '%s\n' "$actual") >/dev/null; then
  echo "FAIL: row counts differ from the ones recorded at backup time" >&2
  diff <(cat "$dump.counts") <(printf '%s\n' "$actual") >&2 || true
  exit 1
fi

# Prisma's own bookkeeping: every migration in the repo must be recorded as applied in the restored data.
expected="$(find "$ROOT_DIR/backend/prisma/migrations" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
applied="$(psql_db "$scratch" -At -c "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL")"
if [ "$applied" -ne "$expected" ]; then
  echo "FAIL: $applied migrations applied in the backup, $expected in the repository" >&2
  exit 1
fi

echo "OK: $(wc -l <"$dump.counts") tables match, $applied migrations present"

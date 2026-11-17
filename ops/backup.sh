#!/usr/bin/env bash
# Dumps the FlowSync database into backups/ and removes dumps older than RETENTION_DAYS (default 14).
# Next to every dump it stores the exact row counts, which restore-verify.sh compares after a restore.
#
#   ./ops/backup.sh
#   0 3 * * * cd /opt/flowsync && ./ops/backup.sh >> backups/backup.log 2>&1   # cron example
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump="$BACKUP_DIR/flowsync-$stamp.dump"

mkdir -p "$BACKUP_DIR"
echo "Backing up '$DB_NAME' to $dump"

# pg_dump reads one consistent snapshot, but the counts are a separate query. Counting before and
# after the dump and retrying when they differ guarantees that the stored counts describe the dump
# (a write in between would otherwise make a healthy backup fail verification).
for attempt in 1 2 3; do
  before="$(table_counts "$DB_NAME")"
  compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom --no-owner >"$dump.partial"
  after="$(table_counts "$DB_NAME")"
  [ "$before" = "$after" ] && break
  echo "Data changed during the dump (attempt $attempt), retrying"
  [ "$attempt" -lt 3 ] || { rm -f "$dump.partial"; echo "Database is too busy for a verifiable backup" >&2; exit 1; }
done
printf '%s\n' "$before" >"$dump.counts"

# A truncated file must never look like a backup, so the final name appears only after pg_restore can read it.
compose exec -T db pg_restore --list <"$dump.partial" >/dev/null
mv "$dump.partial" "$dump"

find "$BACKUP_DIR" -maxdepth 1 -name 'flowsync-*.dump*' -mtime +"$RETENTION_DAYS" -print -delete
echo "Done: $(du -h "$dump" | cut -f1), $(wc -l <"$dump.counts") tables"

#!/usr/bin/env bash
# BAOLIMEI backup: PostgreSQL dump + local asset volume.
# Usage: ENV_FILE=/root/baolimei-secrets/app.env bash scripts/backup.sh
set -euo pipefail

ENV_FILE="${ENV_FILE:-/root/baolimei-secrets/app.env}"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

DB_URL="${DATABASE_URL_PROD:-${DATABASE_URL:-}}"
if [ -z "$DB_URL" ]; then
  echo "DATABASE_URL_PROD or DATABASE_URL is required" >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-/root/backup/baolimei}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M)"
mkdir -p "$BACKUP_DIR"

PG_DUMP="${PG_DUMP:-/usr/pgsql-15/bin/pg_dump}"
if [ ! -x "$PG_DUMP" ]; then
  PG_DUMP="$(command -v pg_dump || true)"
fi
if [ -z "$PG_DUMP" ]; then
  echo "pg_dump not found" >&2
  exit 1
fi

echo "→ database dump"
"$PG_DUMP" "$DB_URL" --format=custom --no-owner --no-acl --file="$BACKUP_DIR/db-$STAMP.dump"

DATA_DIR="${DATA_DIR:-/opt/baolimei/data}"
if [ "${STORAGE_DRIVER:-local}" = "local" ] && [ -d "$DATA_DIR/assets" ]; then
  echo "→ asset volume"
  tar czf "$BACKUP_DIR/assets-$STAMP.tgz" -C "$DATA_DIR" assets
else
  echo "→ assets: skipped (STORAGE_DRIVER=${STORAGE_DRIVER:-unset})"
fi

echo "→ prune older than ${RETAIN_DAYS}d"
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'db-*.dump' -o -name 'assets-*.tgz' \) -mtime "+$RETAIN_DAYS" -delete

ls -lh "$BACKUP_DIR" | tail -8
echo "BACKUP_OK $STAMP"

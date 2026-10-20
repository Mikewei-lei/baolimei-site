#!/usr/bin/env bash
# BAOLIMEI restore: database dump + local asset volume.
# Usage: ENV_FILE=/root/baolimei-secrets/app.env bash scripts/restore.sh <db.dump> [assets.tgz]
set -euo pipefail

ENV_FILE="${ENV_FILE:-/root/baolimei-secrets/app.env}"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

DB_URL="${DATABASE_URL_PROD:-${DATABASE_URL:-}}"
DB_DUMP="${1:-}"
ASSET_TGZ="${2:-}"
if [ -z "$DB_URL" ] || [ -z "$DB_DUMP" ]; then
  echo "Usage: $0 <db.dump> [assets.tgz]" >&2
  exit 1
fi

PG_RESTORE="${PG_RESTORE:-/usr/pgsql-15/bin/pg_restore}"
if [ ! -x "$PG_RESTORE" ]; then
  PG_RESTORE="$(command -v pg_restore || true)"
fi

echo "→ restore database (clean + if-exists)"
"$PG_RESTORE" --clean --if-exists --no-owner --no-acl -d "$DB_URL" "$DB_DUMP"

if [ -n "$ASSET_TGZ" ]; then
  DATA_DIR="${DATA_DIR:-/opt/baolimei/data}"
  echo "→ restore assets to $DATA_DIR"
  mkdir -p "$DATA_DIR"
  tar xzf "$ASSET_TGZ" -C "$DATA_DIR"
fi

echo "RESTORE_OK"

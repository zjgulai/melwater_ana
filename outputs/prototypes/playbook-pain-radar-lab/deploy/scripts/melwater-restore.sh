#!/bin/sh
set -eu

APP_DIR="${MELWATER_APP_DIR:-/opt/melwater-ana/app}"
ENV_FILE="${MELWATER_ENV_FILE:-/opt/melwater-ana/secrets/melwater.env}"
VOLUME="${MELWATER_STATE_VOLUME:-melwater_review_state}"
BACKUP_FILE=""
EXECUTE=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --backup=*) BACKUP_FILE="${1#--backup=}" ;;
    --backup) shift; BACKUP_FILE="${1:-}" ;;
    --execute) EXECUTE=1 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

if [ -z "$BACKUP_FILE" ]; then
  echo "usage: $0 --backup=/path/to/review-state.tar.gz [--execute]" >&2
  exit 2
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "restore_failed: backup_not_found=$BACKUP_FILE" >&2
  exit 1
fi

tar -tzf "$BACKUP_FILE" >/dev/null

if [ "$EXECUTE" -ne 1 ]; then
  cat <<EOF
{
  "ok": true,
  "dryRun": true,
  "backupFile": "$BACKUP_FILE",
  "volume": "$VOLUME",
  "appDir": "$APP_DIR",
  "message": "add --execute to stop Melwater containers, restore the volume, replay state, and restart"
}
EOF
  exit 0
fi

"$APP_DIR/deploy/scripts/melwater-backup.sh" "pre-restore"

cd "$APP_DIR"
docker compose --env-file "$ENV_FILE" -f deploy/docker/docker-compose.yml stop web api

backup_dir="$(dirname "$BACKUP_FILE")"
backup_base="$(basename "$BACKUP_FILE")"
docker run --rm \
  -v "$VOLUME:/data" \
  -v "$backup_dir:/backup:ro" \
  node:22-alpine \
  sh -c "find /data -mindepth 1 -maxdepth 1 -exec rm -rf {} + && cd /data && tar -xzf /backup/$backup_base"

docker compose --env-file "$ENV_FILE" -f deploy/docker/docker-compose.yml up -d
docker exec melwater_api node server/replayReviewEvents.mjs

cat <<EOF
{
  "ok": true,
  "dryRun": false,
  "backupFile": "$BACKUP_FILE",
  "volume": "$VOLUME"
}
EOF

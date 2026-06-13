#!/bin/sh
set -eu

APP_DIR="${MELWATER_APP_DIR:-/opt/melwater-ana/app}"
BACKUP_FILE=""
KEEP_VOLUME="${KEEP_DRILL_VOLUME:-0}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DRILL_VOLUME="${MELWATER_DRILL_VOLUME:-melwater_restore_drill_$STAMP}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --backup=*) BACKUP_FILE="${1#--backup=}" ;;
    --backup) shift; BACKUP_FILE="${1:-}" ;;
    --keep-volume) KEEP_VOLUME=1 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

if [ -z "$BACKUP_FILE" ]; then
  echo "usage: $0 --backup=/path/to/review-state.tar.gz [--keep-volume]" >&2
  exit 2
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "restore_drill_failed: backup_not_found=$BACKUP_FILE" >&2
  exit 1
fi

tar -tzf "$BACKUP_FILE" >/dev/null
backup_dir="$(dirname "$BACKUP_FILE")"
backup_base="$(basename "$BACKUP_FILE")"

cleanup() {
  if [ "$KEEP_VOLUME" -ne 1 ]; then
    docker volume rm "$DRILL_VOLUME" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

docker volume create "$DRILL_VOLUME" >/dev/null
docker run --rm \
  -v "$DRILL_VOLUME:/data" \
  -v "$backup_dir:/backup:ro" \
  node:22-alpine \
  sh -c "cd /data && tar -xzf /backup/$backup_base"

replay_output="$(docker run --rm \
  -v "$APP_DIR:/app:ro" \
  -v "$DRILL_VOLUME:/data" \
  -w /app \
  node:22-alpine \
  sh -c "REVIEW_STATE_DIR=/data node server/replayReviewEvents.mjs")"

printf '%s\n' "$replay_output" | grep -q '"ok": true'

cat <<EOF
{
  "ok": true,
  "backupFile": "$BACKUP_FILE",
  "drillVolume": "$DRILL_VOLUME",
  "keptVolume": $(if [ "$KEEP_VOLUME" -eq 1 ]; then echo true; else echo false; fi),
  "replay": $replay_output
}
EOF

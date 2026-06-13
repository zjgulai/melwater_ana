#!/bin/sh
set -eu

APP_DIR="${MELWATER_APP_DIR:-/opt/melwater-ana/app}"
BACKUP_ROOT="${MELWATER_BACKUP_ROOT:-/opt/melwater-ana/backups/review-state}"
CONTAINER="${MELWATER_API_CONTAINER:-melwater_api}"
KEEP="${MELWATER_BACKUP_KEEP:-14}"
LABEL="${1:-manual}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SAFE_LABEL="$(printf '%s' "$LABEL" | tr -c 'A-Za-z0-9_.-' '-')"
BACKUP_FILE="$BACKUP_ROOT/${STAMP}-${SAFE_LABEL}.tar.gz"
MANIFEST_FILE="$BACKUP_FILE.json"

mkdir -p "$BACKUP_ROOT"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "backup_failed: container_not_running=$CONTAINER" >&2
  exit 1
fi

docker exec "$CONTAINER" sh -c 'cd /data/review-state && tar -czf - .' > "$BACKUP_FILE"
sha256="$(sha256sum "$BACKUP_FILE" | awk '{print $1}')"
bytes="$(wc -c < "$BACKUP_FILE" | tr -d ' ')"
tar -tzf "$BACKUP_FILE" >/dev/null

cat > "$MANIFEST_FILE" <<EOF
{
  "ok": true,
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "label": "$LABEL",
  "container": "$CONTAINER",
  "appDir": "$APP_DIR",
  "backupFile": "$BACKUP_FILE",
  "bytes": $bytes,
  "sha256": "$sha256"
}
EOF

if [ "$KEEP" -gt 0 ] 2>/dev/null; then
  find "$BACKUP_ROOT" -maxdepth 1 -name '*.tar.gz' -type f | sort -r | awk -v keep="$KEEP" 'NR > keep' | while read -r old; do
    rm -f "$old" "$old.json"
  done
fi

cat "$MANIFEST_FILE"

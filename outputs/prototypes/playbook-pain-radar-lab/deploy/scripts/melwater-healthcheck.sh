#!/bin/sh
set -eu

APP_DIR="${MELWATER_APP_DIR:-/opt/melwater-ana/app}"
ENV_FILE="${MELWATER_ENV_FILE:-/opt/melwater-ana/secrets/melwater.env}"
PUBLIC_URL="${MELWATER_PUBLIC_URL:-https://melwater.lute-tlz-dddd.top}"
API_BASE="${MELWATER_API_BASE:-$PUBLIC_URL/api/review-state}"
TIMEOUT="${MELWATER_HEALTH_TIMEOUT:-15}"

if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

TOKEN="${REVIEW_STATE_HEALTH_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  echo '{"ok":false,"error":"missing REVIEW_STATE_HEALTH_TOKEN"}'
  exit 1
fi

homepage_status="$(curl -sS -o /tmp/melwater-health-home.html -w '%{http_code}' --max-time "$TIMEOUT" "$PUBLIC_URL")"
api_health="$(curl -fsS --max-time "$TIMEOUT" -H "Authorization: Bearer $TOKEN" "$API_BASE/health")"
metrics="$(curl -fsS --max-time "$TIMEOUT" -H "Authorization: Bearer $TOKEN" "$API_BASE/metrics")"

if ! grep -q "Melwater Analyst Lab" /tmp/melwater-health-home.html; then
  echo '{"ok":false,"error":"homepage title marker missing"}'
  exit 1
fi

if ! printf '%s' "$api_health" | grep -q '"ok":true'; then
  echo '{"ok":false,"error":"api health failed"}'
  exit 1
fi

if ! printf '%s' "$metrics" | grep -q 'melwater_review_state_replay_ok 1'; then
  echo '{"ok":false,"error":"replay metric failed"}'
  exit 1
fi

if ! docker ps --filter name=melwater_api --filter health=healthy --format '{{.Names}}' | grep -qx melwater_api; then
  echo '{"ok":false,"error":"melwater_api not healthy"}'
  exit 1
fi

if ! docker ps --filter name=melwater_web --filter health=healthy --format '{{.Names}}' | grep -qx melwater_web; then
  echo '{"ok":false,"error":"melwater_web not healthy"}'
  exit 1
fi

cd "$APP_DIR"
release_ref="$(cat "$APP_DIR/REVISION" 2>/dev/null || git rev-parse --short HEAD 2>/dev/null || echo unknown)"

cat <<EOF
{
  "ok": true,
  "checkedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "publicUrl": "$PUBLIC_URL",
  "homepageStatus": $homepage_status,
  "apiBase": "$API_BASE",
  "releaseRef": "$release_ref"
}
EOF

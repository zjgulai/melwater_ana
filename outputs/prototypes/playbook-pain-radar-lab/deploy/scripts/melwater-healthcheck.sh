#!/bin/sh
set -eu

APP_DIR="${MELWATER_APP_DIR:-/opt/melwater-ana/app}"
ENV_FILE="${MELWATER_ENV_FILE:-/opt/melwater-ana/secrets/melwater.env}"
PUBLIC_URL="${MELWATER_PUBLIC_URL:-https://melwater.lute-tlz-dddd.top}"
API_BASE="${MELWATER_API_BASE:-$PUBLIC_URL/api/review-state}"
TIMEOUT="${MELWATER_HEALTH_TIMEOUT:-15}"
RESULT_FILE="${MELWATER_HEALTH_RESULT_FILE:-/opt/melwater-ana/backups/last-health.json}"
ALERT_WEBHOOK_URL="${MELWATER_ALERT_WEBHOOK_URL:-}"
ALERT_WEBHOOK_TYPE="${MELWATER_ALERT_WEBHOOK_TYPE:-generic}"

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr -d '\n'
}

write_result() {
  mkdir -p "$(dirname "$RESULT_FILE")"
  printf '%s\n' "$1" | tee "$RESULT_FILE"
}

send_alert() {
  [ -n "$ALERT_WEBHOOK_URL" ] || return 0
  message="$1"
  escaped="$(json_escape "$message")"
  case "$ALERT_WEBHOOK_TYPE" in
    feishu)
      payload="{\"msg_type\":\"text\",\"content\":{\"text\":\"$escaped\"}}"
      ;;
    wecom)
      payload="{\"msgtype\":\"text\",\"text\":{\"content\":\"$escaped\"}}"
      ;;
    *)
      payload="{\"text\":\"$escaped\",\"source\":\"melwater-healthcheck\"}"
      ;;
  esac
  curl -fsS --max-time "$TIMEOUT" -H "Content-Type: application/json" -d "$payload" "$ALERT_WEBHOOK_URL" >/dev/null 2>&1 || true
}

fail() {
  error="$1"
  checked_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  result="$(cat <<EOF
{
  "ok": false,
  "checkedAt": "$checked_at",
  "publicUrl": "$PUBLIC_URL",
  "apiBase": "$API_BASE",
  "error": "$(json_escape "$error")"
}
EOF
)"
  write_result "$result"
  send_alert "Melwater healthcheck failed at $checked_at: $error"
  exit 1
}

if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

TOKEN="${REVIEW_STATE_HEALTH_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  fail "missing REVIEW_STATE_HEALTH_TOKEN"
fi

homepage_status="$(curl -sS -o /tmp/melwater-health-home.html -w '%{http_code}' --max-time "$TIMEOUT" "$PUBLIC_URL" || true)"
api_health="$(curl -fsS --max-time "$TIMEOUT" -H "Authorization: Bearer $TOKEN" "$API_BASE/health" 2>/tmp/melwater-health-api.err || true)"
metrics="$(curl -fsS --max-time "$TIMEOUT" -H "Authorization: Bearer $TOKEN" "$API_BASE/metrics" 2>/tmp/melwater-health-metrics.err || true)"

if [ "$homepage_status" != "200" ]; then
  fail "homepage returned HTTP $homepage_status"
fi

if ! grep -q "Melwater Analyst Lab" /tmp/melwater-health-home.html; then
  fail "homepage title marker missing"
fi

if ! printf '%s' "$api_health" | grep -q '"ok":true'; then
  fail "api health failed"
fi

if ! printf '%s' "$metrics" | grep -q 'melwater_review_state_replay_ok 1'; then
  fail "replay metric failed"
fi

if ! docker ps --filter name=melwater_api --filter health=healthy --format '{{.Names}}' | grep -qx melwater_api; then
  fail "melwater_api not healthy"
fi

if ! docker ps --filter name=melwater_web --filter health=healthy --format '{{.Names}}' | grep -qx melwater_web; then
  fail "melwater_web not healthy"
fi

cd "$APP_DIR"
release_ref="$(cat "$APP_DIR/REVISION" 2>/dev/null || git rev-parse --short HEAD 2>/dev/null || echo unknown)"

result="$(cat <<EOF
{
  "ok": true,
  "checkedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "publicUrl": "$PUBLIC_URL",
  "homepageStatus": $homepage_status,
  "apiBase": "$API_BASE",
  "releaseRef": "$release_ref"
}
EOF
)"
write_result "$result"

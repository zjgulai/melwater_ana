#!/bin/sh
set -eu

ENV_FILE="${MELWATER_ENV_FILE:-/opt/melwater-ana/secrets/melwater.env}"

if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

APP_DIR="${MELWATER_APP_DIR:-/opt/melwater-ana/app}"
PUBLIC_URL="${MELWATER_PUBLIC_URL:-https://melwater.lute-tlz-dddd.top}"
API_BASE="${MELWATER_API_BASE:-$PUBLIC_URL/api/review-state}"
TIMEOUT="${MELWATER_HEALTH_TIMEOUT:-15}"
RESULT_FILE="${MELWATER_HEALTH_RESULT_FILE:-/opt/melwater-ana/backups/last-health.json}"
STATE_DIR="${MELWATER_HEALTH_STATE_DIR:-$(dirname "$RESULT_FILE")}"
FAILURE_COUNT_FILE="${MELWATER_HEALTH_FAILURE_COUNT_FILE:-$STATE_DIR/health-failure-count.txt}"
INCIDENT_FILE="${MELWATER_HEALTH_INCIDENT_FILE:-$STATE_DIR/health-incident.json}"
ALERT_LOG="${MELWATER_HEALTH_ALERT_LOG:-$STATE_DIR/health-alerts.log}"
INCIDENT_THRESHOLD="${MELWATER_HEALTH_INCIDENT_THRESHOLD:-3}"
ALERT_WEBHOOK_URL="${MELWATER_ALERT_WEBHOOK_URL:-}"
ALERT_WEBHOOK_TYPE="${MELWATER_ALERT_WEBHOOK_TYPE:-generic}"

case "$INCIDENT_THRESHOLD" in
  ''|*[!0-9]*) INCIDENT_THRESHOLD=3 ;;
esac

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr -d '\n'
}

write_result() {
  mkdir -p "$(dirname "$RESULT_FILE")"
  printf '%s\n' "$1" | tee "$RESULT_FILE"
}

read_failure_count() {
  if [ -f "$FAILURE_COUNT_FILE" ]; then
    count="$(cat "$FAILURE_COUNT_FILE" 2>/dev/null || printf '0')"
    case "$count" in
      ''|*[!0-9]*) printf '0' ;;
      *) printf '%s' "$count" ;;
    esac
  else
    printf '0'
  fi
}

write_failure_count() {
  mkdir -p "$STATE_DIR"
  printf '%s\n' "$1" > "$FAILURE_COUNT_FILE"
}

json_field() {
  field="$1"
  file="$2"
  [ -f "$file" ] || return 0
  sed -n "s/.*\"$field\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p" "$file" | head -1
}

append_alert_log() {
  checked_at="$1"
  ok="$2"
  count="$3"
  message="$4"
  mkdir -p "$STATE_DIR"
  cat >> "$ALERT_LOG" <<EOF
{"timestamp":"$checked_at","ok":$ok,"failureCount":$count,"threshold":$INCIDENT_THRESHOLD,"webhookConfigured":$([ -n "$ALERT_WEBHOOK_URL" ] && printf true || printf false),"message":"$(json_escape "$message")"}
EOF
}

open_incident() {
  checked_at="$1"
  count="$2"
  error="$3"
  opened_at="$(json_field openedAt "$INCIDENT_FILE")"
  [ -n "$opened_at" ] || opened_at="$checked_at"
  mkdir -p "$STATE_DIR"
  cat > "$INCIDENT_FILE" <<EOF
{
  "ok": false,
  "status": "open",
  "incidentType": "healthcheck_consecutive_failure",
  "openedAt": "$opened_at",
  "lastFailureAt": "$checked_at",
  "failureCount": $count,
  "threshold": $INCIDENT_THRESHOLD,
  "publicUrl": "$PUBLIC_URL",
  "apiBase": "$API_BASE",
  "error": "$(json_escape "$error")"
}
EOF
}

resolve_incident() {
  checked_at="$1"
  previous_count="$2"
  [ -f "$INCIDENT_FILE" ] || return 0
  opened_at="$(json_field openedAt "$INCIDENT_FILE")"
  last_failure_at="$(json_field lastFailureAt "$INCIDENT_FILE")"
  last_error="$(json_field error "$INCIDENT_FILE")"
  [ -n "$opened_at" ] || opened_at="$checked_at"
  cat > "$INCIDENT_FILE" <<EOF
{
  "ok": true,
  "status": "resolved",
  "incidentType": "healthcheck_consecutive_failure",
  "openedAt": "$opened_at",
  "resolvedAt": "$checked_at",
  "lastFailureAt": "$last_failure_at",
  "failureCount": $previous_count,
  "threshold": $INCIDENT_THRESHOLD,
  "publicUrl": "$PUBLIC_URL",
  "apiBase": "$API_BASE",
  "error": "$(json_escape "$last_error")"
}
EOF
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
  previous_count="$(read_failure_count)"
  failure_count=$((previous_count + 1))
  write_failure_count "$failure_count"
  result="$(cat <<EOF
{
  "ok": false,
  "checkedAt": "$checked_at",
  "publicUrl": "$PUBLIC_URL",
  "apiBase": "$API_BASE",
  "error": "$(json_escape "$error")",
  "failureCount": $failure_count,
  "incidentThreshold": $INCIDENT_THRESHOLD,
  "incidentOpen": $([ "$failure_count" -ge "$INCIDENT_THRESHOLD" ] && printf true || printf false)
}
EOF
)"
  write_result "$result"
  append_alert_log "$checked_at" false "$failure_count" "$error"
  if [ "$failure_count" -ge "$INCIDENT_THRESHOLD" ]; then
    open_incident "$checked_at" "$failure_count" "$error"
  fi
  send_alert "Melwater healthcheck failed at $checked_at: $error"
  exit 1
}

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
checked_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
previous_count="$(read_failure_count)"
write_failure_count 0
if [ "$previous_count" -gt 0 ]; then
  append_alert_log "$checked_at" true 0 "healthcheck recovered after $previous_count failure(s)"
  resolve_incident "$checked_at" "$previous_count"
fi

result="$(cat <<EOF
{
  "ok": true,
  "checkedAt": "$checked_at",
  "publicUrl": "$PUBLIC_URL",
  "homepageStatus": $homepage_status,
  "apiBase": "$API_BASE",
  "releaseRef": "$release_ref",
  "failureCount": 0,
  "incidentThreshold": $INCIDENT_THRESHOLD,
  "incidentOpen": false
}
EOF
)"
write_result "$result"

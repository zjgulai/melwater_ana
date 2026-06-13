#!/bin/sh
set -eu

ENV_FILE="${MELWATER_ENV_FILE:-/opt/melwater-ana/secrets/melwater.env}"

if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

APP_DIR="${MELWATER_APP_DIR:-/opt/melwater-ana/app}"
PUBLIC_URL="${MELWATER_PUBLIC_URL:-${MELWATER_PUBLIC_ORIGIN:-https://melwater.lute-tlz-dddd.top}}"
API_BASE="${MELWATER_API_BASE:-$PUBLIC_URL/api/review-state}"
WEBHOOK_URL="${MELWATER_ALERT_WEBHOOK_URL:-}"
WEBHOOK_TYPE="${MELWATER_ALERT_WEBHOOK_TYPE:-generic}"
TIMEOUT="${MELWATER_ALERT_TIMEOUT:-15}"
EXPECTED_STATUS="${MELWATER_ALERT_EXPECT_STATUS:-2xx}"
DRY_RUN="${MELWATER_ALERT_DRY_RUN:-}"
EVENT="alert_smoke_test"
SEVERITY="info"
MESSAGE="Melwater alert smoke test"
SOURCE="melwater-alert-test"

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --send) DRY_RUN=0 ;;
    --webhook-url=*) WEBHOOK_URL="${arg#*=}" ;;
    --webhook-type=*) WEBHOOK_TYPE="${arg#*=}" ;;
    --timeout=*) TIMEOUT="${arg#*=}" ;;
    --expect-status=*) EXPECTED_STATUS="${arg#*=}" ;;
    --event=*) EVENT="${arg#*=}" ;;
    --severity=*) SEVERITY="${arg#*=}" ;;
    --message=*) MESSAGE="${arg#*=}" ;;
    --source=*) SOURCE="${arg#*=}" ;;
    --help|-h)
      cat <<'USAGE'
Usage:
  melwater-alert-test.sh [options]

Options:
  --dry-run                 Print the webhook payload without sending.
  --send                    Send even when MELWATER_ALERT_DRY_RUN=1.
  --webhook-url=URL         Override MELWATER_ALERT_WEBHOOK_URL.
  --webhook-type=TYPE       generic, feishu, or wecom. Default: generic.
  --expect-status=STATUS    Expected HTTP status, e.g. 200, 204, or 2xx. Default: 2xx.
  --event=NAME              Event name. Default: alert_smoke_test.
  --severity=LEVEL          info, warning, critical, or resolved. Default: info.
  --message=TEXT            Alert message body.
  --timeout=SECONDS         Curl timeout. Default: 15.
USAGE
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

case "$TIMEOUT" in
  ''|*[!0-9]*) TIMEOUT=15 ;;
esac

if [ -z "$DRY_RUN" ]; then
  if [ -n "$WEBHOOK_URL" ]; then
    DRY_RUN=0
  else
    DRY_RUN=1
  fi
fi

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr -d '\n'
}

release_ref="${MELWATER_RELEASE_REF:-}"
[ -n "$release_ref" ] || release_ref="$(cat "$APP_DIR/REVISION" 2>/dev/null || echo unknown)"
created_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
alert_text="Melwater alert | event=$EVENT | severity=$SEVERITY | time=$created_at | release=$release_ref | url=$PUBLIC_URL | api=$API_BASE | detail=$MESSAGE"

case "$WEBHOOK_TYPE" in
  feishu)
    payload="{\"msg_type\":\"text\",\"content\":{\"text\":\"$(json_escape "$alert_text")\"}}"
    ;;
  wecom)
    payload="{\"msgtype\":\"text\",\"text\":{\"content\":\"$(json_escape "$alert_text")\"}}"
    ;;
  generic)
    payload="{\"source\":\"$(json_escape "$SOURCE")\",\"event\":\"$(json_escape "$EVENT")\",\"severity\":\"$(json_escape "$SEVERITY")\",\"timestamp\":\"$created_at\",\"releaseRef\":\"$(json_escape "$release_ref")\",\"publicUrl\":\"$(json_escape "$PUBLIC_URL")\",\"apiBase\":\"$(json_escape "$API_BASE")\",\"message\":\"$(json_escape "$MESSAGE")\",\"text\":\"$(json_escape "$alert_text")\"}"
    ;;
  *)
    echo "invalid webhook type: $WEBHOOK_TYPE" >&2
    exit 2
    ;;
esac

status_matches() {
  actual="$1"
  expected="$2"
  case "$expected" in
    2xx) [ "${actual#2}" != "$actual" ] && [ "${#actual}" -eq 3 ] ;;
    *) [ "$actual" = "$expected" ] ;;
  esac
}

if [ "$DRY_RUN" = "1" ]; then
  cat <<EOF
{
  "ok": true,
  "dryRun": true,
  "webhookConfigured": $([ -n "$WEBHOOK_URL" ] && printf true || printf false),
  "webhookType": "$WEBHOOK_TYPE",
  "event": "$EVENT",
  "severity": "$SEVERITY",
  "payload": $payload
}
EOF
  exit 0
fi

if [ -z "$WEBHOOK_URL" ]; then
  echo "missing MELWATER_ALERT_WEBHOOK_URL; use --dry-run to inspect payload" >&2
  exit 1
fi

response_file="$(mktemp)"
trap 'rm -f "$response_file"' EXIT
http_status="$(curl -sS --max-time "$TIMEOUT" -o "$response_file" -w '%{http_code}' -H "Content-Type: application/json" -d "$payload" "$WEBHOOK_URL" || true)"
response_body="$(cat "$response_file" 2>/dev/null || true)"

if status_matches "$http_status" "$EXPECTED_STATUS"; then
  ok=true
  exit_code=0
else
  ok=false
  exit_code=1
fi

cat <<EOF
{
  "ok": $ok,
  "dryRun": false,
  "webhookType": "$WEBHOOK_TYPE",
  "event": "$EVENT",
  "severity": "$SEVERITY",
  "expectedStatus": "$EXPECTED_STATUS",
  "httpStatus": "$http_status",
  "responseBody": "$(json_escape "$response_body")"
}
EOF

exit "$exit_code"

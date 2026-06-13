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
BACKUP_ROOT="${MELWATER_BACKUP_ROOT:-/opt/melwater-ana/backups/review-state}"
OPS_ROOT="${MELWATER_OPS_ROOT:-/opt/melwater-ana/backups}"
REPORT_ROOT="${MELWATER_OPS_REPORT_ROOT:-$OPS_ROOT/ops-reports}"
RESULT_FILE="${MELWATER_HEALTH_RESULT_FILE:-$OPS_ROOT/last-health.json}"
INCIDENT_FILE="${MELWATER_HEALTH_INCIDENT_FILE:-$OPS_ROOT/health-incident.json}"
ALERT_LOG="${MELWATER_HEALTH_ALERT_LOG:-$OPS_ROOT/health-alerts.log}"
LATEST_JSON="${MELWATER_OPS_REPORT_LATEST_JSON:-$OPS_ROOT/ops-report-latest.json}"
LATEST_MD="${MELWATER_OPS_REPORT_LATEST_MD:-$OPS_ROOT/ops-report-latest.md}"
TIMEOUT="${MELWATER_OPS_REPORT_TIMEOUT:-15}"
TOKEN="${REVIEW_STATE_HEALTH_TOKEN:-}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
GENERATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
REPORT_JSON="$REPORT_ROOT/${STAMP}-ops-report.json"
REPORT_MD="$REPORT_ROOT/${STAMP}-ops-report.md"

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr -d '\n'
}

json_file_or_null() {
  file="$1"
  if [ -f "$file" ]; then
    cat "$file"
  else
    printf 'null'
  fi
}

json_field() {
  field="$1"
  file="$2"
  [ -f "$file" ] || return 0
  sed -n "s/.*\"$field\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p" "$file" | head -1
}

json_bool_field() {
  field="$1"
  file="$2"
  [ -f "$file" ] || {
    printf 'unknown'
    return 0
  }
  if grep -q "\"$field\"[[:space:]]*:[[:space:]]*true" "$file"; then
    printf 'true'
  elif grep -q "\"$field\"[[:space:]]*:[[:space:]]*false" "$file"; then
    printf 'false'
  else
    printf 'unknown'
  fi
}

latest_backup_manifest() {
  find "$BACKUP_ROOT" -maxdepth 1 -name '*.tar.gz.json' -type f 2>/dev/null | sort | tail -1
}

container_status_json() {
  first=true
  printf '['
  docker ps --filter name=melwater --format '{{.Names}}|{{.Status}}' 2>/dev/null | while IFS='|' read -r name status; do
    [ -n "$name" ] || continue
    if [ "$first" = true ]; then
      first=false
    else
      printf ','
    fi
    printf '{"name":"%s","status":"%s"}' "$(json_escape "$name")" "$(json_escape "$status")"
  done
  printf ']'
}

cert_json() {
  host="$(printf '%s' "$PUBLIC_URL" | sed 's#^[a-zA-Z][a-zA-Z0-9+.-]*://##;s#/.*##;s#:.*##')"
  not_after=""
  if command -v openssl >/dev/null 2>&1 && [ -n "$host" ]; then
    not_after="$(printf '' | openssl s_client -servername "$host" -connect "$host:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | sed 's/^notAfter=//' || true)"
  fi
  printf '{"host":"%s","notAfter":"%s"}' "$(json_escape "$host")" "$(json_escape "$not_after")"
}

ops_api_json() {
  if [ -z "$TOKEN" ]; then
    printf 'null'
    return 0
  fi
  curl -fsS --max-time "$TIMEOUT" -H "Authorization: Bearer $TOKEN" "$API_BASE/ops" 2>/dev/null || printf 'null'
}

mkdir -p "$REPORT_ROOT" "$OPS_ROOT"

release_ref="$(cat "$APP_DIR/REVISION" 2>/dev/null || git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"
health_json="$(json_file_or_null "$RESULT_FILE")"
incident_json="$(json_file_or_null "$INCIDENT_FILE")"
backup_manifest="$(latest_backup_manifest)"
if [ -n "$backup_manifest" ]; then
  backup_json="$(cat "$backup_manifest")"
  backup_name="$(basename "${backup_manifest%.json}")"
else
  backup_json="null"
  backup_name="none"
fi
containers_json="$(container_status_json)"
certificate_json="$(cert_json)"
ops_json="$(ops_api_json)"
health_ok="$(json_bool_field ok "$RESULT_FILE")"
incident_status="$(json_field status "$INCIDENT_FILE")"
[ -n "$incident_status" ] || incident_status="none"

cat > "$REPORT_JSON" <<EOF
{
  "ok": $([ "$health_ok" = true ] && printf true || printf false),
  "generatedAt": "$GENERATED_AT",
  "publicUrl": "$PUBLIC_URL",
  "apiBase": "$API_BASE",
  "releaseRef": "$release_ref",
  "healthOk": "$health_ok",
  "incidentStatus": "$incident_status",
  "latestBackupFile": "$backup_name",
  "healthcheck": $health_json,
  "incident": $incident_json,
  "latestBackup": $backup_json,
  "containers": $containers_json,
  "certificate": $certificate_json,
  "opsApi": $ops_json,
  "reportFiles": {
    "json": "$REPORT_JSON",
    "markdown": "$REPORT_MD",
    "latestJson": "$LATEST_JSON",
    "latestMarkdown": "$LATEST_MD",
    "alertLog": "$ALERT_LOG"
  }
}
EOF

health_checked_at="$(json_field checkedAt "$RESULT_FILE")"
health_error="$(json_field error "$RESULT_FILE")"
incident_opened_at="$(json_field openedAt "$INCIDENT_FILE")"
incident_resolved_at="$(json_field resolvedAt "$INCIDENT_FILE")"
backup_created_at="$(json_field createdAt "$backup_manifest")"
backup_sha="$(json_field sha256 "$backup_manifest")"
cert_not_after="$(printf '%s' "$certificate_json" | sed -n 's/.*"notAfter":"\([^"]*\)".*/\1/p')"

cat > "$REPORT_MD" <<EOF
# Melwater Ops Report

- Generated at: $GENERATED_AT
- Release: $release_ref
- Public URL: $PUBLIC_URL
- API base: $API_BASE

## Health

- OK: $health_ok
- Last checked: ${health_checked_at:-unknown}
- Error: ${health_error:-none}
- Incident status: $incident_status
- Incident opened: ${incident_opened_at:-none}
- Incident resolved: ${incident_resolved_at:-none}

## Backup

- Latest backup: $backup_name
- Created at: ${backup_created_at:-unknown}
- SHA256: ${backup_sha:-unknown}

## Certificate

- Host: $(printf '%s' "$PUBLIC_URL" | sed 's#^[a-zA-Z][a-zA-Z0-9+.-]*://##;s#/.*##;s#:.*##')
- Not after: ${cert_not_after:-unknown}

## Containers

\`\`\`json
$containers_json
\`\`\`

## Runbook

- If health is false and incident status is open, inspect \`$ALERT_LOG\`.
- If backup is missing or stale, run \`$APP_DIR/deploy/scripts/melwater-backup.sh manual\`.
- When Feishu/WeCom webhook is ready, configure \`MELWATER_ALERT_WEBHOOK_URL\` and keep this report as the daily audit trail.
EOF

cp "$REPORT_JSON" "$LATEST_JSON"
cp "$REPORT_MD" "$LATEST_MD"

cat "$REPORT_JSON"

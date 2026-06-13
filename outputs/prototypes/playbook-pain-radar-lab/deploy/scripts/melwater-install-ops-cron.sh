#!/bin/sh
set -eu

APP_DIR="${MELWATER_APP_DIR:-/opt/melwater-ana/app}"
ENV_FILE="${MELWATER_ENV_FILE:-/opt/melwater-ana/secrets/melwater.env}"
BACKUP_ROOT="${MELWATER_BACKUP_ROOT:-/opt/melwater-ana/backups}"
CRON_FILE="${MELWATER_OPS_CRON_FILE:-/etc/cron.d/melwater-ops}"
CRON_USER="${MELWATER_CRON_USER:-ubuntu}"
RUN_NOW=false
SKIP_INSTALL=false
RUN_NOW_ATTEMPTS="${MELWATER_OPS_RUN_NOW_ATTEMPTS:-6}"
RUN_NOW_SLEEP="${MELWATER_OPS_RUN_NOW_SLEEP:-10}"

for arg in "$@"; do
  case "$arg" in
    --run-now) RUN_NOW=true ;;
    --skip-install) SKIP_INSTALL=true ;;
    --run-now-attempts=*) RUN_NOW_ATTEMPTS="${arg#*=}" ;;
    --run-now-sleep=*) RUN_NOW_SLEEP="${arg#*=}" ;;
    --cron-user=*) CRON_USER="${arg#*=}" ;;
    --cron-file=*) CRON_FILE="${arg#*=}" ;;
    --app-dir=*) APP_DIR="${arg#*=}" ;;
    --env-file=*) ENV_FILE="${arg#*=}" ;;
    --backup-root=*) BACKUP_ROOT="${arg#*=}" ;;
    --help|-h)
      cat <<'USAGE'
Usage:
  melwater-install-ops-cron.sh [options]

Options:
  --run-now              Run healthcheck and ops report after cron install.
  --run-now-attempts=N   Healthcheck attempts for --run-now. Default: 6.
  --run-now-sleep=N      Seconds between --run-now attempts. Default: 10.
  --skip-install         Only run validations and optional --run-now checks.
  --cron-user=USER       User column for /etc/cron.d jobs. Default: ubuntu.
  --cron-file=PATH       Target cron.d file. Default: /etc/cron.d/melwater-ops.
  --app-dir=PATH         Production app directory. Default: /opt/melwater-ana/app.
  --env-file=PATH        Production env file. Default: /opt/melwater-ana/secrets/melwater.env.
  --backup-root=PATH     Ops output directory. Default: /opt/melwater-ana/backups.
USAGE
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

case "$RUN_NOW_ATTEMPTS" in
  ''|*[!0-9]*) RUN_NOW_ATTEMPTS=6 ;;
esac
case "$RUN_NOW_SLEEP" in
  ''|*[!0-9]*) RUN_NOW_SLEEP=10 ;;
esac

if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

mkdir -p "$BACKUP_ROOT"

for script in melwater-healthcheck.sh melwater-backup.sh melwater-ops-report.sh; do
  if [ ! -x "$APP_DIR/deploy/scripts/$script" ]; then
    echo "missing executable script: $APP_DIR/deploy/scripts/$script" >&2
    exit 1
  fi
done

if [ ! -f "$ENV_FILE" ]; then
  echo "missing env file: $ENV_FILE" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "missing docker command" >&2
  exit 1
fi

if [ "$SKIP_INSTALL" = false ]; then
  tmp_file="$(mktemp)"
  cat > "$tmp_file" <<EOF
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

*/5 * * * * $CRON_USER $APP_DIR/deploy/scripts/melwater-healthcheck.sh >> $BACKUP_ROOT/healthcheck.log 2>&1
17 3 * * * $CRON_USER $APP_DIR/deploy/scripts/melwater-backup.sh daily >> $BACKUP_ROOT/review-state-backup.log 2>&1
23 3 * * * $CRON_USER $APP_DIR/deploy/scripts/melwater-ops-report.sh >> $BACKUP_ROOT/ops-report.log 2>&1
EOF
  chmod 0644 "$tmp_file"
  if [ "$(id -u)" -eq 0 ]; then
    cp "$tmp_file" "$CRON_FILE"
    chmod 0644 "$CRON_FILE"
  else
    sudo -n cp "$tmp_file" "$CRON_FILE"
    sudo -n chmod 0644 "$CRON_FILE"
  fi
  rm -f "$tmp_file"
fi

if [ "$RUN_NOW" = true ]; then
  attempt=1
  while :; do
    if "$APP_DIR/deploy/scripts/melwater-healthcheck.sh" >> "$BACKUP_ROOT/healthcheck.log" 2>&1; then
      break
    fi
    if [ "$attempt" -ge "$RUN_NOW_ATTEMPTS" ]; then
      echo "healthcheck failed after $RUN_NOW_ATTEMPTS attempt(s)" >&2
      exit 1
    fi
    sleep "$RUN_NOW_SLEEP"
    attempt=$((attempt + 1))
  done
  "$APP_DIR/deploy/scripts/melwater-ops-report.sh" >> "$BACKUP_ROOT/ops-report.log" 2>&1
fi

cat <<EOF
{
  "ok": true,
  "cronFile": "$CRON_FILE",
  "cronUser": "$CRON_USER",
  "appDir": "$APP_DIR",
  "envFile": "$ENV_FILE",
  "backupRoot": "$BACKUP_ROOT",
  "runNow": $RUN_NOW
}
EOF

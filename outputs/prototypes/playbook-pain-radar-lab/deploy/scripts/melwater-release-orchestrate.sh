#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$APP_DIR"

ENV_FILE="${APP_DIR}/.remote-deploy.env"
RELEASE_DIR=""
EXECUTE=false
ROLLBACK_EXECUTE=false
SKIP_PUBLIC_VERIFY=false
SKIP_API_VERIFY=false

for arg in "$@"; do
  case "$arg" in
    --env-file=*) ENV_FILE="${arg#*=}" ;;
    --release-dir=*) RELEASE_DIR="${arg#*=}" ;;
    --execute) EXECUTE=true ;;
    --rollback-execute) ROLLBACK_EXECUTE=true ;;
    --skip-public-verify) SKIP_PUBLIC_VERIFY=true ;;
    --skip-api-verify) SKIP_API_VERIFY=true ;;
    --help|-h)
      cat <<'USAGE'
Usage:
  melwater-release-orchestrate.sh [options]

Options:
  --env-file=PATH            指定部署环境文件（默认: outputs/.../.remote-deploy.env）
  --release-dir=PATH         指定发布目录（默认为最新 release）
  --execute                  执行 deploy 真实变更（默认为 dry-run）
  --rollback-execute         执行回滚命令（默认为 dry-run）
  --skip-public-verify       跳过 verifyPublicSite.mjs
  --skip-api-verify          跳过 verifyDeployment.mjs
  -h, --help                打印帮助
USAGE
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

run_cmd() {
  printf '\n===> %s\n' "$*"
  "$@"
}

latest_release_dir() {
  find releases -mindepth 1 -maxdepth 1 -type d | sort -r | head -n1
}

apply_latest_release_dir() {
  local selected_release_dir
  selected_release_dir="$(latest_release_dir)"
  if [ -n "$selected_release_dir" ]; then
    RELEASE_DIR="$selected_release_dir"
  fi
}

if [ ! -f "$ENV_FILE" ]; then
  echo "missing env file: $ENV_FILE" >&2
  echo "copy deploy/env/remote-deploy.env.example and fill production fields first" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

if [ -n "$RELEASE_DIR" ]; then
  RELEASE_DIR="$(cd "$RELEASE_DIR" && pwd)"
else
  apply_latest_release_dir
fi

if [ -z "$RELEASE_DIR" ] || [ ! -d "$RELEASE_DIR" ]; then
  echo "release directory not found, run npm run release:package first" >&2
  exit 1
fi

echo "Step 1/6: local precheck"
run_cmd npm run review:migrate
run_cmd npm run review:replay
run_cmd npm run build
run_cmd npm run release:package
apply_latest_release_dir
run_cmd npm run release:verify

echo "Step 2/6: remote preflight check"
run_cmd node server/remoteRelease.mjs --mode=preflight --release-dir="$RELEASE_DIR" --check-ssh

echo "Step 3/6: deploy plan/execute"
DEPLOY_ARGS=(node server/remoteRelease.mjs --mode=deploy --release-dir="$RELEASE_DIR")
if [ "$EXECUTE" = true ]; then
  DEPLOY_ARGS+=(--execute)
fi
run_cmd "${DEPLOY_ARGS[@]}"

if [ "$SKIP_PUBLIC_VERIFY" = false ]; then
  echo "Step 4/6: public-site verification"
  PUBLIC_SITE_URL="${PUBLIC_SITE_URL:-https://melwater.lute-tlz-dddd.top}"
  PUBLIC_SITE_EXPECT_TEXT="${PUBLIC_SITE_EXPECT_TEXT:-Melwater}"
  run_cmd node server/verifyPublicSite.mjs --url="$PUBLIC_SITE_URL" --expect="$PUBLIC_SITE_EXPECT_TEXT"
else
  echo "Skip public verification by option"
fi

if [ "$SKIP_API_VERIFY" = false ]; then
  echo "Step 5/6: API verification"
  if [ -z "${REVIEW_STATE_API_BASE:-}" ]; then
    echo "Skip API verification: REVIEW_STATE_API_BASE missing"
  else
    VERIFY_TOKEN="${REVIEW_STATE_VERIFY_TOKEN:-}"
    if [ -z "$VERIFY_TOKEN" ]; then
      if ! VERIFY_TOKEN="$(bash deploy/scripts/melwater-get-admin-token.sh)"; then
        echo "Skip API verification: token cannot be resolved"
        VERIFY_TOKEN=""
      fi
    fi
    if [ -n "$VERIFY_TOKEN" ]; then
      REVIEW_STATE_VERIFY_TOKEN="$VERIFY_TOKEN" run_cmd node server/verifyDeployment.mjs --require-auth
    else
      echo "Skip API verification: token missing"
    fi
  fi
else
  echo "Skip API verification by option"
fi

echo "Step 6/6: rollback readiness drill"
ROLLBACK_ARGS=(node server/remoteRelease.mjs --mode=rollback --release-dir="$RELEASE_DIR")
if [ "$ROLLBACK_EXECUTE" = true ]; then
  ROLLBACK_ARGS+=(--execute)
fi
run_cmd "${ROLLBACK_ARGS[@]}"

echo "Release orchestrate completed."

#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$APP_DIR"

ENV_FILE="${APP_DIR}/.remote-deploy.env"
RELEASE_DIR=""
RUN_DEPLOY=true
RUN_VERIFY=true
RUN_ROLLBACK=true
DEPLOY_EXECUTE=false
ROLLBACK_EXECUTE=false
CHECK_SSH=false

for arg in "$@"; do
  case "$arg" in
    --env-file=*) ENV_FILE="${arg#*=}" ;;
    --release-dir=*) RELEASE_DIR="${arg#*=}" ;;
    --skip-remote) RUN_DEPLOY=false RUN_VERIFY=false RUN_ROLLBACK=false ;;
    --skip-verify) RUN_VERIFY=false ;;
    --skip-rollback) RUN_ROLLBACK=false ;;
    --deploy-execute) DEPLOY_EXECUTE=true ;;
    --rollback-execute) ROLLBACK_EXECUTE=true ;;
    --check-ssh) CHECK_SSH=true ;;
    --help|-h)
      cat <<'USAGE'
Usage:
  melwater-prod-release-checklist.sh [options]

Options:
  --env-file=PATH            运行部署前后检查使用的环境变量文件（默认: .remote-deploy.env）
  --release-dir=PATH         指定 release 目录（不填则使用最新）
  --skip-remote              跳过预检以外的全部远端步骤（仅本地验收）
  --skip-verify              跳过部署后验收步骤
  --skip-rollback            跳过回滚演练
  --deploy-execute           在 deploy 阶段执行实际变更（否则只做 dry-run）
  --rollback-execute          在回滚演练阶段执行实际回滚（否则只做 dry-run）
  --check-ssh                在 deploy 前执行远端 SSH 只读可达性检查
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

if ! command -v node >/dev/null 2>&1; then
  echo "node not found in PATH" >&2
  exit 1
fi

echo "Step 0: local precheck"
run_cmd npm run review:migrate
run_cmd npm run review:replay
run_cmd npm run build
run_cmd npm run release:package
run_cmd npm run release:verify

if [ -n "$RELEASE_DIR" ]; then
  RELEASE_DIR="$(cd "$RELEASE_DIR" && pwd)"
else
  RELEASE_DIR="$(find releases -mindepth 1 -maxdepth 1 -type d | sort -r | head -n1)"
fi

if [ -z "$RELEASE_DIR" ] || [ ! -d "$RELEASE_DIR" ]; then
  echo "release directory not found, run npm run release:package first" >&2
  exit 1
fi

echo "Step 0 complete: local artifact ready at $RELEASE_DIR"

if [ "$RUN_DEPLOY" = true ]; then
  if [ ! -f "$ENV_FILE" ]; then
    echo "missing env file: $ENV_FILE" >&2
    echo "copy deploy/env/remote-deploy.env.example and fill production fields first" >&2
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a

  PRECHECK_ARGS=(--mode=preflight --release-dir="$RELEASE_DIR")
  [ "$CHECK_SSH" = true ] && PRECHECK_ARGS+=(--check-ssh)
  run_cmd node server/remoteRelease.mjs "${PRECHECK_ARGS[@]}"

  DEPLOY_ARGS=(--mode=deploy --release-dir="$RELEASE_DIR")
  [ "$DEPLOY_EXECUTE" = true ] && DEPLOY_ARGS+=(--execute)
  run_cmd node server/remoteRelease.mjs "${DEPLOY_ARGS[@]}"

  if [ "$RUN_VERIFY" = true ]; then
    if [ -z "${PUBLIC_SITE_URL:-}" ]; then
      PUBLIC_SITE_URL="https://melwater.lute-tlz-dddd.top"
    fi
    if [ -z "${PUBLIC_SITE_EXPECT_TEXT:-}" ]; then
      PUBLIC_SITE_EXPECT_TEXT="Melwater"
    fi
    run_cmd node server/verifyPublicSite.mjs --url="$PUBLIC_SITE_URL" --expect="$PUBLIC_SITE_EXPECT_TEXT"
    if [ -n "${REVIEW_STATE_API_BASE:-}" ]; then
      VERIFY_TOKEN="${REVIEW_STATE_VERIFY_TOKEN:-}"
      if [ -z "${VERIFY_TOKEN}" ]; then
        echo "REVIEW_STATE_VERIFY_TOKEN missing; resolving admin token from remote compose env..."
        if RESOLVED_TOKEN="$(bash deploy/scripts/melwater-get-admin-token.sh)"; then
          VERIFY_TOKEN="$RESOLVED_TOKEN"
        else
          echo "Failed to resolve token, skip API verify"
        fi
      fi

      if [ -n "${VERIFY_TOKEN:-}" ]; then
        REVIEW_STATE_VERIFY_TOKEN="$VERIFY_TOKEN" run_cmd node server/verifyDeployment.mjs --require-auth
      else
        echo "Skip API verify: token cannot be resolved"
      fi
    else
      echo "Skip API verify: REVIEW_STATE_API_BASE / REVIEW_STATE_VERIFY_TOKEN missing"
    fi
  fi

  if [ "$RUN_ROLLBACK" = true ]; then
    ROLLBACK_ARGS=(--mode=rollback --release-dir="$RELEASE_DIR")
    [ "$ROLLBACK_EXECUTE" = true ] && ROLLBACK_ARGS+=(--execute)
    run_cmd node server/remoteRelease.mjs "${ROLLBACK_ARGS[@]}"
  fi
fi

echo "Melwater release checklist completed."

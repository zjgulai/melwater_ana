#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$APP_DIR"

ENV_FILE=""
REMOTE_ENV_FILE=""

for arg in "$@"; do
  case "$arg" in
    --env-file=*) ENV_FILE="${arg#*=}" ;;
    --remote-env-file=*) REMOTE_ENV_FILE="${arg#*=}" ;;
    --help|-h)
      cat <<'USAGE'
Usage:
  melwater-get-admin-token.sh [options]

Options:
  --env-file=PATH           加载本地部署参数文件（默认 .remote-deploy.env）
  --remote-env-file=PATH    远端 review-state env 文件路径（默认 /opt/melwater-ana/secrets/melwater.env）
USAGE
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

if [ -z "$ENV_FILE" ] && [ -f ".remote-deploy.env" ]; then
  ENV_FILE=".remote-deploy.env"
fi
if [ -n "$ENV_FILE" ]; then
  if [ ! -f "$ENV_FILE" ]; then
    echo "missing env file: $ENV_FILE" >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

if [ -z "${REVIEW_STATE_VERIFY_TOKEN:-}" ]; then
  if [ -z "${MELWATER_DEPLOY_HOST:-}" ]; then
    echo "missing MELWATER_DEPLOY_HOST" >&2
    exit 1
  fi
  if [ -z "${MELWATER_DEPLOY_USER:-}" ]; then
    echo "missing MELWATER_DEPLOY_USER" >&2
    exit 1
  fi
  if [ -z "${MELWATER_SSH_KEY_PATH:-}" ]; then
    echo "missing MELWATER_SSH_KEY_PATH" >&2
    exit 1
  fi
  if [ ! -f "$MELWATER_SSH_KEY_PATH" ]; then
    echo "ssh key not found: $MELWATER_SSH_KEY_PATH" >&2
    exit 1
  fi
  : "${MELWATER_DEPLOY_PORT:=22}"
fi

if [ -n "${REVIEW_STATE_VERIFY_TOKEN:-}" ]; then
  printf '%s\n' "$REVIEW_STATE_VERIFY_TOKEN"
  exit 0
fi

REMOTE_ENV_FILE="${REMOTE_ENV_FILE:-${MELWATER_DOCKER_COMPOSE_ENV_FILE:-/opt/melwater-ana/secrets/melwater.env}}"

TOKEN="$(ssh -i "$MELWATER_SSH_KEY_PATH" -p "$MELWATER_DEPLOY_PORT" \
  "${MELWATER_DEPLOY_USER}@${MELWATER_DEPLOY_HOST}" MELWATER_DOCKER_COMPOSE_ENV_FILE="$REMOTE_ENV_FILE" /bin/bash -s <<'REMOTE'
set -euo pipefail
ENV_FILE="${MELWATER_DOCKER_COMPOSE_ENV_FILE:-/opt/melwater-ana/secrets/melwater.env}"
if [ ! -f "$ENV_FILE" ]; then
  echo "remote token env file not found: $ENV_FILE" >&2
  exit 1
fi
ENV_FILE="$ENV_FILE" node - <<'NODE'
const fs = require("node:fs");
const envPath = process.env.ENV_FILE || "";
const envText = fs.readFileSync(envPath, "utf8");
const getEnvValue = (name) => {
  const prefix = `${name}=`;
  const match = envText.split(/\r?\n/).find((line) => line.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
};

let tokens = {};
const rawTokens = getEnvValue("REVIEW_STATE_TOKENS");
try {
  tokens = JSON.parse(rawTokens);
} catch {
  tokens = {};
}
let token = Object.entries(tokens).find(([, entry]) => entry && entry.role === "admin")?.[0];
if (!token) {
  const staticToken = getEnvValue("REVIEW_STATE_VERIFY_TOKEN");
  if (staticToken) token = staticToken;
}
if (!token) {
  console.error("admin token not found in remote env");
  process.exit(1);
}
console.log(token);
NODE
REMOTE
)"

if [ -z "$TOKEN" ]; then
  echo "no token returned from remote env" >&2
  exit 1
fi

printf '%s\n' "$TOKEN"

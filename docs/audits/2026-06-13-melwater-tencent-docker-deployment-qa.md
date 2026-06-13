# Melwater Tencent Cloud Docker Deployment QA

Date: 2026-06-13

## Scope

Deploy the current Melwater Analyst Lab website to Tencent Cloud Lighthouse/CVM:

- Server: `101.34.52.232` (`VM-0-16-ubuntu`)
- User: `ubuntu`
- Domain: `melwater.lute-tlz-dddd.top`
- SSH key: local project root `ai_video.pem`

Requirement: create a new Docker environment and avoid polluting existing applications.

## Deployment Design

Created an isolated Compose project under:

```bash
/opt/melwater-ana
```

Runtime layout:

- App source: `/opt/melwater-ana/app`
- Runtime secrets: `/opt/melwater-ana/secrets`
- Edge config backups: `/opt/melwater-ana/backups`
- Compose project: `melwater_ana`
- Containers: `melwater_api`, `melwater_web`
- Private network: `melwater_internal`
- Persistent volume: `melwater_review_state`
- Shared edge network: `lighthouse_ai_video_net`

The app containers do not bind public host ports. Public traffic is routed through the existing `ai_video_nginx` edge container by a dedicated `melwater.lute-tlz-dddd.top` vhost.

## Added Repository Assets

- `.dockerignore`
- `deploy/docker/Dockerfile.api`
- `deploy/docker/Dockerfile.web`
- `deploy/docker/docker-compose.yml`
- `deploy/docker/melwater.env.example`
- `deploy/docker/web-nginx.conf`
- `deploy/nginx/melwater-docker-edge.conf`

Security guard:

- Root `.gitignore` now ignores `*.pem` to prevent accidental SSH key commits.

## Certificate

DNS was already pointed at the server:

```bash
melwater.lute-tlz-dddd.top -> 101.34.52.232
```

The existing Let's Encrypt certificate `lute-tlz-dddd.top` was expanded to include:

```bash
melwater.lute-tlz-dddd.top
```

Certificate expiry after expansion:

```bash
2026-09-11
```

## Edge Nginx

Existing edge container:

```bash
ai_video_nginx
```

Ports already occupied by the edge container:

- `80`
- `443`

Because those ports are already in use, a separate public Nginx/Caddy container was not created. Instead, a dedicated vhost was inserted into:

```bash
/opt/ai-video/deploy/lighthouse/nginx.conf
```

Backup:

```bash
/opt/melwater-ana/backups/ai-video-nginx-before-melwater-20260613T114818.conf
```

Important deployment note:

- The first reload did not pick up the new config because `nginx.conf` is a single-file Docker bind mount and the host file had been replaced by `cp`, changing the inode.
- Fix: force-recreated only the `nginx` service with Compose so the edge container remounted the updated file.

## Secret Handling

Production review-state tokens were generated on the server and stored only at:

```bash
/opt/melwater-ana/secrets/melwater.env
/opt/melwater-ana/secrets/access-tokens.txt
```

Both files are permissioned `600`.

The token values were not printed into this QA document and are not committed to git.

## Validation Results

### Compose Config

Command:

```bash
docker compose --env-file /opt/melwater-ana/secrets/melwater.env \
  -f deploy/docker/docker-compose.yml config
```

Result:

- Pass.
- Project name: `melwater_ana`.
- Containers: `melwater_api`, `melwater_web`.
- Networks: `melwater_internal`, `lighthouse_ai_video_net`.
- Volume: `melwater_review_state`.

### Container Build And Start

Command:

```bash
docker compose --env-file /opt/melwater-ana/secrets/melwater.env \
  -f deploy/docker/docker-compose.yml up -d --build
```

Result:

- Pass after two fixed build-gate issues:
  - `.dockerignore` initially excluded `.env.example`.
  - `Dockerfile.web` initially missed `server/`, required by `vite.config.mjs`.

Current container health:

```bash
melwater_api   Up (healthy)
melwater_web   Up (healthy)
```

### Internal Routing

From `ai_video_nginx`:

- `http://melwater_web/` returns the Melwater static app.
- `http://melwater_api:4174/api/review-state/health` returns `401` without auth.

From `melwater_api` with token:

```json
{"ok":true,"authRequired":true,"role":"admin","stateDir":"/data/review-state","schemaVersion":2}
```

### Public HTTPS

URL:

```bash
https://melwater.lute-tlz-dddd.top
```

Result:

- `HTTP/2 200`
- Title: `Melwater Analyst Lab - Pain Radar`
- Static assets served from `/assets/*`

### Public API

Unauthenticated:

```bash
GET /api/review-state/health
```

Result:

```bash
401
{"error":"unauthorized"}
```

Authenticated public API verification:

```bash
node server/verifyDeployment.mjs --require-auth
```

Result:

- Pass.
- `health.status = 200`
- `replay.status = 200`
- `metrics.status = 200`
- `melwater_review_state_replay_ok 1`
- `melwater_review_state_auth_required 1`

### Existing App Smoke Checks

After force-recreating the edge Nginx container:

- `https://mkt.lute-tlz-dddd.top` -> `HTTP 200`
- `https://video.lute-tlz-dddd.top` -> `HTTP 200`

## Known Follow-Up Debt

- `npm ci` reports 3 high severity dependency audit findings. The deployment did not run `npm audit fix --force` because that could introduce breaking dependency changes during production rollout.
- Production review-state starts with an empty persistent Docker volume. This is acceptable for a fresh production writeback state; seed/import can be added if prior local QA state should be preserved.
- Edge Nginx is still a shared container for multiple applications. Melwater runtime is isolated, but public TLS routing necessarily passes through the shared edge.

### Upstream IP Staleness Debt (Observed)

During rollout, public API path `/api/review-state/*` briefly returned `502 Bad Gateway` while root `/` stayed healthy. Root cause was an upstream IP cache in `ai_video_nginx` after `melwater_api` container restart (old container IP remained cached).

Mitigation applied in this round:

- Restarted `ai_video_nginx` after redeploy so DNS name resolution repoints to current container IPs.

Recommendation for future rounds:

1. Add a fixed post-deploy edge refresh step:

```bash
docker restart ai_video_nginx
```

2. Keep a post-deploy API health assertion for both
   - `/api/review-state/health`
   - `/api/review-state/metrics`

to detect upstream refresh regressions immediately.

This can now be automated in `remoteRelease.mjs` by enabling:

- `MELWATER_EDGE_RESTART_ENABLED=1`
- Optionally override:
  - `MELWATER_EDGE_CONTAINER=ai_video_nginx`
  - `MELWATER_EDGE_REFRESH_CMD=docker restart ai_video_nginx`

When enabled, deploy/rollback runs a non-blocking "refresh shared edge proxy" step right after restarting service, then runs the authenticated verification.

## Operational Commands

Check containers:

```bash
cd /opt/melwater-ana/app
docker compose --env-file /opt/melwater-ana/secrets/melwater.env \
  -f deploy/docker/docker-compose.yml ps
```

Restart Melwater only:

```bash
cd /opt/melwater-ana/app
docker compose --env-file /opt/melwater-ana/secrets/melwater.env \
  -f deploy/docker/docker-compose.yml up -d --build
```

View production tokens on the server:

```bash
cat /opt/melwater-ana/secrets/access-tokens.txt
```

After Melwater deploy/rebuild, refresh shared edge DNS cache by restarting the edge proxy:

```bash
docker restart ai_video_nginx
```

Browser token setup for shared writeback sync:

```js
localStorage.setItem("melwater:apiToken", "<editor-or-admin-token>")
```

## 2026-06-13 Additional Production Sync Round (Follow-up)

### Scope

执行一次紧接当前仓库 `main` 头部提交（`96dbaa53`）的生产同步与验证，保持发布链路“构建 -> 同步 -> 重建 -> 上线验证”闭环。

### Execution

- 本地构建：`npm run build`
- 同步文件：`rsync` 至 `/opt/melwater-ana/app`
- 写入版本号：`/opt/melwater-ana/app/REVISION`
- 更新环境变量：`MELWATER_RELEASE_REF=96dbaa53`
- 容器重建：
  
  ```bash
  docker compose --env-file /opt/melwater-ana/secrets/melwater.env \
    -f /opt/melwater-ana/app/deploy/docker/docker-compose.yml up -d --build
  ```
- 刷新共享 edge：`docker restart ai_video_nginx`

### 验证

执行命令：

- `node server/verifyPublicSite.mjs`
  - 目标：`https://melwater.lute-tlz-dddd.top`
  - `ok: true`
  - 页面标题：`Melwater Analyst Lab - Pain Radar`
- `node server/verifyDeployment.mjs --require-auth`
  - `apiBase`: `https://melwater.lute-tlz-dddd.top/api/review-state`
  - `health`, `replay`, `metrics` 全量通过
  - `melwater_review_state_replay_ok 1`

### Current Deployment Snapshot

- 发布引用：`96dbaa53`
- 容器状态：`melwater_api`、`melwater_web` 均为健康运行
- 边缘容器：`ai_video_nginx` 运行且在重建后已完成重启

### 当前实施状态（下一步）

- 已完成：`remoteRelease.mjs` 增加 `MELWATER_DEPLOY_MODE=docker` 分支，`deploy/rollback/preflight` 已支持 Docker Compose 运行链路。
- 建议配置（Docker 生产）：
  - `MELWATER_DEPLOY_MODE=docker`
  - `MELWATER_DOCKER_COMPOSE_FILE=/opt/melwater-ana/app/deploy/docker/docker-compose.yml`（可选，默认自动推断）
  - `MELWATER_DOCKER_COMPOSE_ENV_FILE=/opt/melwater-ana/secrets/melwater.env`（可选）
  - `MELWATER_DOCKER_COMPOSE_PROJECT=melwater_ana`
- 建议在 `deploy/env/remote-deploy.env.example` 里同步新增配置项（`MELWATER_DEPLOY_MODE` / Compose 相关变量）后按既有流程执行：
  - `--mode=preflight --check-ssh`
  - `--mode=deploy --execute`

### 2026-06-13 后续部署执行（修复回归）

使用以下参数对 `/opt/melwater-ana/app` 执行完整 `deploy --execute`（关键：`REVIEW_STATE_API_BASE` 使用 API 完整路径）：

- `MELWATER_DEPLOY_MODE=docker`
- `MELWATER_DEPLOY_HOST=101.34.52.232`
- `MELWATER_DEPLOY_USER=ubuntu`
- `MELWATER_DEPLOY_PATH=/opt/melwater-ana/app`
- `MELWATER_REMOTE_APP_USER=ubuntu`
- `MELWATER_REMOTE_OWNER=ubuntu:ubuntu`
- `MELWATER_SSH_KEY_PATH=/absolute/path/to/ai_video.pem`
- `REVIEW_STATE_API_BASE=https://melwater.lute-tlz-dddd.top/api/review-state`
- `REVIEW_STATE_VERIFY_TOKEN=<melwater.env 中 admin token>`

执行命令：

```bash
node outputs/prototypes/playbook-pain-radar-lab/server/remoteRelease.mjs --mode=deploy --execute --release-dir=<release-path>
```

验收结果：

- 预检（`preflight`）通过
- 镜像构建与 `docker compose up -d --build` 执行成功，`melwater_api` / `melwater_web` 就绪
- `verify` 阶段返回 `ok: true`
- 验证指标确认 `melwater_review_state_replay_ok 1`

已确认：`sudo -n -u <user> sh -lc ...` 修复有效，`verify` 命令不再触发 `sudo: cd: command not found`。下一步需将此经验沉淀到部署 runbook 与操作手册中的标准参数说明（尤其是 API Base 需带 `/api/review-state`）。

### 2026-06-13 回滚链路验收

回滚链路验证命令（同一套环境变量）:

```bash
node outputs/prototypes/playbook-pain-radar-lab/server/remoteRelease.mjs --mode=rollback --execute --release-dir=<release-path>
```

预期结果：

- 执行完成，无 `failures`
- 触发 `restore rollback snapshot and restart service` / `verify restored application`
- `verify` 回归结果 `ok: true`
- 指标仍满足 `melwater_review_state_replay_ok 1`

补充：新增配置校验会在 `REVIEW_STATE_API_BASE` 未以 `/api/review-state` 结尾时给出 warning，提示可能回到前端 HTML 页面而非 API JSON 的风险。

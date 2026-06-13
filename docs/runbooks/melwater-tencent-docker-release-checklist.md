# Melwater Tencent Cloud Docker Release Checklist (Standard Runbook)

更新时间：2026-06-13

本文将生产发布固化为一条可复用链路：  
`预检 → 部署计划/执行 → 验收 → 回滚演练`

适用范围：  
`outputs/prototypes/playbook-pain-radar-lab` 的 Docker 生产环境发布（`/opt/melwater-ana`）。

## 一、前置约定

- 生产发布应始终使用 release artifact（`releases/<id>`）而不是散文件同步。
- 远端发布环境应为独立 Docker 项目：`MELWATER_DOCKER_COMPOSE_PROJECT=melwater_ana`。
- API 验证基线必须使用完整路径：
  `REVIEW_STATE_API_BASE=https://melwater.lute-tlz-dddd.top/api/review-state`
- 发布 token 不得提交到 Git，使用本地环境文件注入。

## 二、运行脚本

```bash
outputs/prototypes/playbook-pain-radar-lab/deploy/scripts/melwater-prod-release-checklist.sh
```

默认行为：

1. 本地预检（migrate/replay/verify/build/package/verify）
2. 读取 `.remote-deploy.env`
3. 运行 `remoteRelease.mjs --mode=preflight`（默认 dry-run）
4. 运行 `remoteRelease.mjs --mode=deploy`（默认 dry-run）
5. 运行 `verifyPublicSite.mjs`
6. 运行 `verifyDeployment.mjs --require-auth`（若 token 完整）
7. 运行回滚 dry-run（`remoteRelease.mjs --mode=rollback`）

默认不会对生产执行写操作。要写操作请显式加参数。

## 三、标准流程（按序）

### 1) 预检（Preflight）

```bash
cd outputs/prototypes/playbook-pain-radar-lab
cp deploy/env/remote-deploy.env.example .remote-deploy.env

# 填写生产参数后
set -a
. ./.remote-deploy.env
set +a

node server/remoteRelease.mjs --mode=preflight --check-ssh
```

若 `preflight` 仍返回 env 缺失/ssh 不可达，请优先修复：
- `MELWATER_DEPLOY_HOST` / `MELWATER_DEPLOY_USER` / `MELWATER_SSH_KEY_PATH`
- `MELWATER_DOCKER_COMPOSE_FILE` / `MELWATER_DOCKER_COMPOSE_ENV_FILE`
- `MELWATER_DEPLOY_PATH` / `MELWATER_REMOTE_STAGE_ROOT`
- `MELWATER_EDGE_RESTART_ENABLED` 与 `MELWATER_EDGE_CONTAINER`（或 `MELWATER_EDGE_REFRESH_CMD`）

通过条件：
- 本地 release 结构通过 `release:verify`
- 远端工具、路径、权限都可达
- `REVIEW_STATE_API_BASE` 与 token 配置齐全（至少在后续验收可用）

### 2) 发布（Deploy）

```bash
cd outputs/prototypes/playbook-pain-radar-lab
node server/remoteRelease.mjs --mode=deploy
```

上面命令为 dry-run，输出执行计划。  
实际落库：

```bash
node server/remoteRelease.mjs --mode=deploy --execute
```

建议发布前也加 `--check-ssh`，提前发现环境阻塞点：

```bash
node server/remoteRelease.mjs --mode=deploy --check-ssh --execute
```

### 3) 验收（Verification）

```bash
cd outputs/prototypes/playbook-pain-radar-lab
node server/verifyPublicSite.mjs --url=https://melwater.lute-tlz-dddd.top --expect=Melwater
```

API 验收（推荐）：优先从远端 token map 提取 admin token，避免手输 token 过期/错误：

```bash
cd outputs/prototypes/playbook-pain-radar-lab

ADMIN_TOKEN="$(npm run -s deploy:get-admin-token)"

REVIEW_STATE_VERIFY_TOKEN="$ADMIN_TOKEN" REVIEW_STATE_API_BASE=https://melwater.lute-tlz-dddd.top/api/review-state \
  node server/verifyDeployment.mjs --require-auth
```

如果你已经有固定 token（建议先确认仍在有效期内）可直接使用：

```bash
REVIEW_STATE_VERIFY_TOKEN=... REVIEW_STATE_API_BASE=https://melwater.lute-tlz-dddd.top/api/review-state \
  node server/verifyDeployment.mjs --require-auth
```

通过条件：
- `verifyPublicSite` 返回 `ok: true`、HTTP 200、标题包含 `Melwater`
- `verifyDeployment` 返回 `ok: true`、`melwater_review_state_replay_ok 1`

### 4) 回滚演练（Rollback Drill）

```bash
cd outputs/prototypes/playbook-pain-radar-lab
node server/remoteRelease.mjs --mode=rollback
```

以上为 dry-run 方案，演练通过不改动生产。  
真实回滚演练（仅在预演窗口）：

```bash
node server/remoteRelease.mjs --mode=rollback --execute
```

回滚前建议确认本次发布目录下已包含 rollback artifact：

```bash
ls -l releases/<release-id>/*-rollback.tar.gz
```

### 5) 关键验收门禁（可直接贴进 PR 检核）

- `Melwater release checklist completed`
- `verifyPublicSite` 返回 `ok: true`
- `verifyDeployment --require-auth` 返回 `ok: true`
- Metrics 包含 `melwater_review_state_replay_ok 1`

不满足任一项时，不建议推进业务流：

1) 复核 `.remote-deploy.env` 与远端 compose/端口/权限
2) 复测 `--check-ssh`
3) 必要时执行 `--rollback-execute`

## 四、脚本化一键检查（推荐）

```bash
cd outputs/prototypes/playbook-pain-radar-lab

# 只跑本地发布预检（不碰远端）
./deploy/scripts/melwater-prod-release-checklist.sh --skip-remote

# 仅使用一条命令执行完整闭环 dry-run（含本地预检/远端计划/回滚预演）
./deploy/scripts/melwater-release-orchestrate.sh --skip-public-verify --skip-api-verify

# 也可用 npm 脚本同样执行
npm run deploy:orchestrate -- --skip-public-verify --skip-api-verify

# 按完整流程生成部署和回滚计划（远端 dry-run）
./deploy/scripts/melwater-prod-release-checklist.sh

# 进行真实发布（部署执行）
./deploy/scripts/melwater-prod-release-checklist.sh --deploy-execute
./deploy/scripts/melwater-release-orchestrate.sh --execute

# 进行真实回滚演练（危险操作，按需执行）
./deploy/scripts/melwater-prod-release-checklist.sh --deploy-execute --rollback-execute
```

## 五、已知边界与建议

- 回滚演练建议在变更窗口进行，优先执行 `--deploy-execute` 后再做 `--rollback-execute` 的演练。
- 共享边缘（`ai_video_nginx`）场景请保留 `MELWATER_EDGE_RESTART_ENABLED=1`，避免上游缓存导致 API 502。
- 当 `REVIEW_STATE_API_BASE` 非 API 路径（未以 `/api/review-state` 结尾）时，部署验证可能命中前端 HTML，出现误判。
- `verifyDeployment.mjs --require-auth` 如返回 401，通常是 token 错误或缺失；在本仓库当前部署体系中，远端 `melwater.env` 以 `REVIEW_STATE_TOKENS` 管理多 token，不会天然注入 `REVIEW_STATE_VERIFY_TOKEN`。

## 六、发布后可观测性闭环

发布和回滚演练通过后，应确保生产健康巡检、备份和 Ops report cron 已安装：

```bash
cd /opt/melwater-ana/app
sh deploy/scripts/melwater-install-ops-cron.sh --run-now
```

详细流程见：

```text
docs/runbooks/melwater-production-observability.md
```

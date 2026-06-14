# Melwater Branch and Release Decision Packet（已完成）

更新时间：2026-06-14

本文用于记录 release-hardening 分支、PR #1、`main`、生产发布和 release 到 git commit 映射的决策过程。该决策已执行完成，本文保留为历史证据。

## 当前结论

已完成路径：

1. `codex/fix-playbook-deploy-checklist` 作为 release-hardening 分支完成。
2. 已通过 PR #1 合入 `main`：`https://github.com/zjgulai/melwater_ana/pull/1`。
3. 合并前已运行本地质量门禁和前端门禁。
4. `origin/main` 已成为生产运维脚本的源头。
5. 已完成真实生产发布，并把 production release id 映射到 git commit `7a09e358`。

当前文档状态：生产运维脚本已进入 `main`；`main` 已包含完整 release/observability/webhook readiness 闭环。

## 分支状态

当前工作分支：

```text
main
```

当前文档主线：

```text
main / origin/main（当前 HEAD 以 git log -1 为准）
```

远端：

```text
origin https://github.com/zjgulai/melwater_ana.git
```

已观察到的分支关系：

```text
origin/main: current documentation main, see git log -1
local main: current documentation main, see git log -1
origin/codex/fix-playbook-deploy-checklist: 06e7d01b docs: summarize melwater capability debt roadmap
```

本地 `main` 与 `origin/main` 已同步。`codex/fix-playbook-deploy-checklist` 已合并，保留为历史分支，可按需删除。

## 已合并提交

PR #1 合并内容：

```text
06e7d01b docs: summarize melwater capability debt roadmap
fda8d752 chore: add external webhook readiness gate
a0734bce chore: add production alert drill loop
db9d4459 chore: prepare external alert webhook smoke tests
439e48ef chore: close production observability loop
8838005d chore: harden melwater deploy orchestrate and token verification flow
d9a755b7 chore: add melwater docker release checklist runbook
```

这些提交覆盖：

- Docker release checklist runbook
- deploy orchestrate 和 token verification flow
- production observability loop
- external alert webhook smoke tests
- production alert drill
- external webhook readiness gate
- capability/debt roadmap、docs index、production inventory 更新

## 文件范围

PR #1 主要变更：

- `docs/runbooks/melwater-production-observability.md`
- `docs/runbooks/melwater-tencent-docker-release-checklist.md`
- `outputs/prototypes/playbook-pain-radar-lab/deploy/crontab/melwater-ops.cron`
- `outputs/prototypes/playbook-pain-radar-lab/deploy/docker/melwater.env.example`
- `outputs/prototypes/playbook-pain-radar-lab/deploy/scripts/melwater-alert-drill.mjs`
- `outputs/prototypes/playbook-pain-radar-lab/deploy/scripts/melwater-alert-test.sh`
- `outputs/prototypes/playbook-pain-radar-lab/deploy/scripts/melwater-alert-webhook-readiness.mjs`
- `outputs/prototypes/playbook-pain-radar-lab/deploy/scripts/melwater-alert-webhook-readiness.test.mjs`
- `outputs/prototypes/playbook-pain-radar-lab/deploy/scripts/melwater-backup.sh`
- `outputs/prototypes/playbook-pain-radar-lab/deploy/scripts/melwater-get-admin-token.sh`
- `outputs/prototypes/playbook-pain-radar-lab/deploy/scripts/melwater-healthcheck.sh`
- `outputs/prototypes/playbook-pain-radar-lab/deploy/scripts/melwater-install-ops-cron.sh`
- `outputs/prototypes/playbook-pain-radar-lab/deploy/scripts/melwater-ops-report.sh`
- `outputs/prototypes/playbook-pain-radar-lab/deploy/scripts/melwater-prod-release-checklist.sh`
- `outputs/prototypes/playbook-pain-radar-lab/deploy/scripts/melwater-release-orchestrate.sh`
- `outputs/prototypes/playbook-pain-radar-lab/package.json`
- `outputs/prototypes/playbook-pain-radar-lab/server/remoteRelease.mjs`

## 当前生产状态关联

最近生产核查记录显示：

- 域名：`https://melwater.lute-tlz-dddd.top`
- 服务器：`101.34.52.232`
- 应用目录：`/opt/melwater-ana/app`
- 当前生产 release：`playbook-pain-radar-lab-0.0.0-20260614T052228Z-g7a09e358`
- 对应 git commit：`7a09e358`
- `melwater_web` 和 `melwater_api` 容器健康。
- `/health` 返回 `ok=true`。
- ops report 和 mock alert drill 均指向当前 release。
- 真实外部 webhook 尚未配置，webhook readiness 返回 blocked。

当前缺口：

- 真实 Feishu/WeCom webhook 未申请完成前，readiness 阻断是正确行为。
- 本次 rollback readiness 是 dry-run，不是真实回滚恢复演练。
- 生产负责人、SLO、腾讯云资源 ID 和监控入口仍需补齐。

## 合并前门禁

合并或 PR 前必须运行：

```bash
make quality
cd outputs/prototypes/playbook-pain-radar-lab
npm run test:webhook-readiness
npm run build
```

通过标准：

- Python/data 门禁全部通过。
- Webhook readiness 单测通过。
- Vite production build 通过。
- `git diff --check` 无空白错误。

2026-06-14 本地门禁证据：

- `git diff --check`：通过。
- `make quality`：通过；包含 35 个 pytest、Excel validation `PASS`、checksum 全部 `OK`、Ruff 42 files、mypy 20 source files、Bandit。
- `npm run test:webhook-readiness`：通过；3 tests pass。
- `npm run build`：通过；Vite production build 完成。

## 推荐执行顺序

- [x] 运行合并前门禁。
- [x] 选择 PR 路径。
- [x] 将本文作为 PR 描述依据。
- [x] 合并 PR #1。
- [x] 合并后同步 `main`。
- [x] 生产发布后记录 `release id -> git commit` 映射。
- [ ] 真实 webhook 可用后运行 external readiness 和 alert drill。

## 暂不执行项

- 不在本文件中保存 token、webhook URL 或 SSH key。
- 不把生产 readiness blocked 当作失败；当前 blocked 原因是缺少真实 webhook。
- 不把 mock alert drill 等同于真实 Feishu/WeCom 外部告警送达证明。

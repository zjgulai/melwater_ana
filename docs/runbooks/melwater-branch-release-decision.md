# Melwater Branch and Release Decision Packet

更新时间：2026-06-14

本文用于把当前分支、远端、生产发布和待合并运维脚本的关系说清楚。当前文件只做决策记录，不执行 merge、push 或生产变更。

## 当前结论

推荐路径：

1. 保留 `codex/fix-playbook-deploy-checklist` 作为 release-hardening 分支。
2. 将该分支通过 PR 或直接 merge 合入 `main`。
3. 合入前重新运行本地质量门禁和前端门禁。
4. 合入后让 `origin/main` 成为生产运维脚本的唯一源头。
5. 下一次真实生产发布后，把生产 release id 映射到 git commit。

不建议继续让生产运维脚本只存在于未合并分支。当前生产已经依赖这些脚本能力，但 `origin/main` 尚未包含完整闭环。

## 分支状态

当前工作分支：

```text
codex/fix-playbook-deploy-checklist
```

当前 HEAD：

```text
fda8d752 chore: add external webhook readiness gate
```

远端：

```text
origin https://github.com/zjgulai/melwater_ana.git
```

已观察到的分支关系：

```text
origin/main: b777ef69 docs: record successful rollback verification run
local main: d9a755b7 chore: add melwater docker release checklist runbook
origin/codex/fix-playbook-deploy-checklist: fda8d752
```

本地 `main` 相对 `origin/main` ahead 1。当前 release-hardening 分支相对 `origin/main` 多 6 个提交。

## 未合并提交

`origin/main..HEAD`：

```text
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

## 文件范围

`origin/main..HEAD` 主要变更：

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
- 当前生产 release：`playbook-pain-radar-lab-0.0.0-2026-06-13T10-12-36-766Z`
- `melwater_web` 和 `melwater_api` 容器健康。
- `/health` 返回 `ok=true`。
- 真实外部 webhook 尚未配置，webhook readiness 返回 blocked。

当前缺口：

- 最新生产 release 只体现 package timestamp，尚未在文档中映射到 git commit。
- 最新 alert drill 证据需要在当前 release 上重跑。
- 真实 Feishu/WeCom webhook 未申请完成前，readiness 阻断是正确行为。

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
- [ ] 选择 PR 或直接 merge。
- [ ] 若走 PR，将本文作为 PR 描述依据。
- [ ] 若直接 merge，先确认本地 `main` 与 `origin/main` 的 ahead 1 提交是否应一起进入远端。
- [ ] 合并后推送 `main`。
- [ ] 下一次生产发布后记录 `release id -> git commit` 映射。
- [ ] 真实 webhook 可用后运行 external readiness 和 alert drill。

## 暂不执行项

- 不在本文件中保存 token、webhook URL 或 SSH key。
- 不把生产 readiness blocked 当作失败；当前 blocked 原因是缺少真实 webhook。
- 不把本地 `main` ahead 状态静默推送到远端，除非完成合并决策。

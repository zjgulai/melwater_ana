# Melwater Production Release QA

日期：2026-06-14  
执行人：Codex  
生产域名：`https://melwater.lute-tlz-dddd.top`  
服务器：`101.34.52.232` / `VM-0-16-ubuntu`  
应用目录：`/opt/melwater-ana/app`

## 1. Release 映射

| 项目 | 值 |
| --- | --- |
| Git merge commit | `7a09e3588e67ec16ee302dc888d286d5714da904` |
| Git short commit | `7a09e358` |
| GitHub PR | `https://github.com/zjgulai/melwater_ana/pull/1` |
| Production release id | `playbook-pain-radar-lab-0.0.0-20260614T052228Z-g7a09e358` |
| App artifact SHA256 | `e701e2dd1f7213c37868082983b374551dadcecf682a94236dbb85f9ca029d30` |
| Rollback artifact SHA256 | `a5174ba799657b75cd4bb0dc05e2556743c2aab24f3a4183d7644689b329f97e` |

远端确认：

```text
/opt/melwater-ana/app/REVISION = playbook-pain-radar-lab-0.0.0-20260614T052228Z-g7a09e358
MELWATER_RELEASE_REF=playbook-pain-radar-lab-0.0.0-20260614T052228Z-g7a09e358
```

## 2. 发布流程

使用本地临时部署 env 文件 `/private/tmp/melwater-remote-deploy.env`，真实 review-state admin token 运行时从远端 `/opt/melwater-ana/secrets/melwater.env` 读取，未写入仓库。

执行命令：

```bash
RELEASE_ID="playbook-pain-radar-lab-0.0.0-20260614T052228Z-g7a09e358" \
REVIEW_STATE_VERIFY_TOKEN="<runtime token from remote env>" \
npm run deploy:orchestrate -- --env-file=/private/tmp/melwater-remote-deploy.env --execute
```

发布步骤结果：

| 阶段 | 结果 |
| --- | --- |
| `review:migrate` | `ok=true` |
| `review:replay` | `ok=true` |
| `npm run build` | Vite build 通过 |
| `release:package` | `ok=true` |
| `release:verify` | `ok=true` |
| remote preflight | `ok=true` |
| remote artifact checksum | `ok=true` |
| Docker deploy/restart | `ok=true` |
| shared edge proxy refresh | `ok=true` |
| remote review-state verification | `ok=true` |
| rollback readiness | dry-run `ok=true` |

## 3. 公网与 API 验收

Public site verification:

```json
{
  "ok": true,
  "url": "https://melwater.lute-tlz-dddd.top",
  "status": 200,
  "title": "Melwater Analyst Lab - Pain Radar",
  "expectedTextProvided": true
}
```

Review-state API verification:

```json
{
  "ok": true,
  "apiBase": "https://melwater.lute-tlz-dddd.top/api/review-state",
  "health": {"status": 200, "ok": true},
  "replay": {"status": 200, "ok": true},
  "metrics": {"status": 200, "ok": true, "melwater_review_state_replay_ok": 1}
}
```

## 4. 生产 Ops 验收

执行：

```bash
cd /opt/melwater-ana/app
sh deploy/scripts/melwater-install-ops-cron.sh --run-now
node deploy/scripts/melwater-alert-drill.mjs
```

结果：

| 检查项 | 结果 |
| --- | --- |
| cron install | `ok=true` |
| last health | `ok=true` |
| ops report | `ok=true` |
| alert drill | `ok=true` |
| alert drill mode | `mock-webhook` |
| alert drill recovery mode | `actual` |
| expected webhook events | `healthcheck_failed`, `healthcheck_incident_open`, `healthcheck_recovered` |
| missing webhook events | none |
| containers | `melwater_web` healthy, `melwater_api` healthy |
| certificate | expires `Sep 11 02:49:24 2026 GMT` |

Ops report files:

```text
/opt/melwater-ana/backups/ops-reports/20260614T052355Z-ops-report.json
/opt/melwater-ana/backups/ops-reports/20260614T052355Z-ops-report.md
/opt/melwater-ana/backups/ops-report-latest.json
/opt/melwater-ana/backups/ops-report-latest.md
```

Alert drill files:

```text
/opt/melwater-ana/backups/alert-drills/20260614T052355Z/alert-drill.json
/opt/melwater-ana/backups/alert-drills/20260614T052355Z/alert-drill.md
/opt/melwater-ana/backups/alert-drill-latest.json
/opt/melwater-ana/backups/alert-drill-latest.md
```

## 5. 仍未关闭的边界

- 真实 `MELWATER_ALERT_WEBHOOK_URL` 未配置；`melwater-alert-webhook-readiness.mjs --no-send --skip-drill` 正确返回 `ok=false`、`ready=false`、`reason=missing MELWATER_ALERT_WEBHOOK_URL`。
- 本次 rollback readiness 是 dry-run，不是真实回滚恢复演练。
- 最新 daily backup 是 `20260613T191701Z-daily.tar.gz`；发布后可按需补一次 manual backup。
- `action_feedback_applied` 和 `measuredActions` 的业务闭环仍需要真实业务 owner 回写，不属于本次生产发布范围。

## 6. 结论

生产发布已完成，当前生产 release 已明确映射到 git commit `7a09e358`。公网、API、Docker health、ops report 和 mock alert drill 均通过。下一步应在真实 Feishu/WeCom webhook 可用后配置外部告警，并执行 `melwater-alert-webhook-readiness.mjs --send`。

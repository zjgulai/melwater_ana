# Melwater Production Observability Runbook

更新时间：2026-06-13

本文定义 Melwater 生产环境的最小可观测性闭环：  
`定时健康检查 -> 本地告警记录 -> 每日备份 -> 每日 Ops report -> Ops API/UI 可查 -> 手动复核与恢复`

适用范围：

- 域名：`https://melwater.lute-tlz-dddd.top`
- 服务器：`101.34.52.232`
- 应用目录：`/opt/melwater-ana/app`
- 运维输出目录：`/opt/melwater-ana/backups`

## 一、监控内容

健康检查每 5 分钟执行一次，检查：

- 公开首页 HTTP 200
- 首页包含 `Melwater Analyst Lab`
- `/api/review-state/health` 鉴权访问成功
- `/api/review-state/metrics` 包含 `melwater_review_state_replay_ok 1`
- `melwater_api` Docker health 为 healthy
- `melwater_web` Docker health 为 healthy

每日任务：

- `03:17` 生成 review-state host 备份
- `03:23` 生成 JSON 与 Markdown Ops report

## 二、生产安装

在服务器上执行：

```bash
cd /opt/melwater-ana/app
sh deploy/scripts/melwater-install-ops-cron.sh --run-now
```

脚本会安装：

```bash
/etc/cron.d/melwater-ops
```

标准 cron 内容为：

```cron
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

*/5 * * * * ubuntu /opt/melwater-ana/app/deploy/scripts/melwater-healthcheck.sh >> /opt/melwater-ana/backups/healthcheck.log 2>&1
17 3 * * * ubuntu /opt/melwater-ana/app/deploy/scripts/melwater-backup.sh daily >> /opt/melwater-ana/backups/review-state-backup.log 2>&1
23 3 * * * ubuntu /opt/melwater-ana/app/deploy/scripts/melwater-ops-report.sh >> /opt/melwater-ana/backups/ops-report.log 2>&1
```

注意：`/etc/cron.d` 格式必须包含执行用户列，本项目生产默认使用 `ubuntu`。

## 三、即时验收

手动运行：

```bash
cd /opt/melwater-ana/app
sh deploy/scripts/melwater-healthcheck.sh
sh deploy/scripts/melwater-ops-report.sh
```

通过条件：

- `/opt/melwater-ana/backups/last-health.json` 中 `ok=true`
- `/opt/melwater-ana/backups/ops-report-latest.json` 中 `ok=true`
- `/api/review-state/ops` 返回 `healthcheck.ok=true`
- `/api/review-state/ops` 返回 `opsReport.ok=true`

本地执行远端验收时可使用：

```bash
cd outputs/prototypes/playbook-pain-radar-lab
ADMIN_TOKEN="$(npm run -s deploy:get-admin-token)"
REVIEW_STATE_VERIFY_TOKEN="$ADMIN_TOKEN" REVIEW_STATE_API_BASE=https://melwater.lute-tlz-dddd.top/api/review-state \
  npm run review:verify-deploy -- --require-auth
```

## 四、产物位置

健康检查：

- `/opt/melwater-ana/backups/last-health.json`
- `/opt/melwater-ana/backups/healthcheck.log`
- `/opt/melwater-ana/backups/health-failure-count.txt`
- `/opt/melwater-ana/backups/health-incident.json`
- `/opt/melwater-ana/backups/health-alerts.log`

备份：

- `/opt/melwater-ana/backups/review-state/*.tar.gz`
- `/opt/melwater-ana/backups/review-state/*.tar.gz.json`

Ops report：

- `/opt/melwater-ana/backups/ops-reports/*-ops-report.json`
- `/opt/melwater-ana/backups/ops-reports/*-ops-report.md`
- `/opt/melwater-ana/backups/ops-report-latest.json`
- `/opt/melwater-ana/backups/ops-report-latest.md`

## 五、告警策略

当前外部 Feishu/WeCom 还未接入，因此先采用本地持久化告警：

- 连续失败计数写入 `health-failure-count.txt`
- 达到 `MELWATER_HEALTH_INCIDENT_THRESHOLD` 后打开 `health-incident.json`
- 每次失败写入 `health-alerts.log`
- 恢复后重置失败计数，并把 incident 标为 `resolved`

未来拿到飞书/企微 webhook 后，在 `/opt/melwater-ana/secrets/melwater.env` 增加：

```bash
MELWATER_ALERT_WEBHOOK_URL=...
MELWATER_ALERT_WEBHOOK_TYPE=feishu
MELWATER_ALERT_DRY_RUN=0
MELWATER_ALERT_TIMEOUT=15
MELWATER_ALERT_EXPECT_STATUS=2xx
```

可选值：

- `generic`
- `feishu`
- `wecom`

配置后先不要等真实故障触发，先执行 smoke test：

```bash
cd /opt/melwater-ana/app
sh deploy/scripts/melwater-alert-test.sh --dry-run --webhook-type=feishu
sh deploy/scripts/melwater-alert-test.sh --send --webhook-type=feishu --message="Melwater Feishu webhook smoke test"
```

企微示例：

```bash
cd /opt/melwater-ana/app
sh deploy/scripts/melwater-alert-test.sh --dry-run --webhook-type=wecom
sh deploy/scripts/melwater-alert-test.sh --send --webhook-type=wecom --message="Melwater WeCom webhook smoke test"
```

如 webhook 服务返回 `204` 而不是 `200`，可调整：

```bash
MELWATER_ALERT_EXPECT_STATUS=204 sh deploy/scripts/melwater-alert-test.sh --send
```

真实 healthcheck 告警事件包括：

- `healthcheck_failed`：单次失败，等级 `warning`
- `healthcheck_incident_open`：连续失败达到阈值，等级 `critical`
- `healthcheck_recovered`：故障后恢复，等级 `resolved`

外部 webhook readiness gate：

```bash
cd /opt/melwater-ana/app
node deploy/scripts/melwater-alert-webhook-readiness.mjs --no-send --skip-drill
```

如果需要指定非默认 env 文件，使用 `--melwater-env-file=/path/to/melwater.env`；不要直接使用 Node 26 的 `--env-file` 参数名。

如生产环境尚未配置 `MELWATER_ALERT_WEBHOOK_URL`，该命令必须返回 `ok=false`、`ready=false`，并给出下一步配置动作。真实 webhook 配好后，执行：

```bash
cd /opt/melwater-ana/app
node deploy/scripts/melwater-alert-webhook-readiness.mjs --send
```

该命令会先发送一条 `alert_smoke_test`，HTTP 状态通过后再执行 external webhook drill。验收时需要同时满足：

- `smokeTest.ok=true`
- `externalDrill.ok=true`
- 飞书/企微目标频道中能看到 smoke alert 和 drill alert

## 六、告警三段式演练

外部 webhook 正式接入前后，都应定期跑告警演练。默认模式会启动本机临时 mock webhook，不会依赖飞书/企微真实凭证：

```bash
cd /opt/melwater-ana/app
node deploy/scripts/melwater-alert-drill.mjs
```

恢复阶段默认最多重试 8 次、每次间隔 5 秒，用来覆盖刚部署后 Docker health 仍处在 `starting` 的窗口。临时调整：

```bash
node deploy/scripts/melwater-alert-drill.mjs --recovery-attempts=12 --recovery-sleep=5
```

演练内容：

1. 使用独立演练状态目录模拟第一次健康检查失败，触发 `healthcheck_failed`
2. 第二次失败达到阈值，触发 `healthcheck_incident_open`
3. 使用真实生产健康检查恢复，触发 `healthcheck_recovered`
4. 生成 `alert-drill-latest.json/md`
5. 重新生成 Ops report，并把本次 drill 摘要写入 `latestAlertDrill`

产物位置：

- `/opt/melwater-ana/backups/alert-drills/<timestamp>/alert-drill.json`
- `/opt/melwater-ana/backups/alert-drills/<timestamp>/alert-drill.md`
- `/opt/melwater-ana/backups/alert-drill-latest.json`
- `/opt/melwater-ana/backups/alert-drill-latest.md`

真实 webhook 演练：

```bash
cd /opt/melwater-ana/app
node deploy/scripts/melwater-alert-webhook-readiness.mjs --send
```

本地只检查脚本链路、不跑真实恢复时：

```bash
node deploy/scripts/melwater-alert-drill.mjs --recovery-mode=skip --skip-ops-report
```

验收门禁：

- `alert-drill-latest.json` 中 `ok=true`
- mock 模式下 webhook event 必须包含 `healthcheck_failed`、`healthcheck_incident_open`、`healthcheck_recovered`
- `alert-drill-latest.json` 中 `missingWebhookEvents=[]`
- Ops report 中 `latestAlertDrill.ok=true`
- 生产正式 `last-health.json` 保持 `ok=true`

## 七、故障处理

健康检查失败时：

1. 查看 `healthcheck.log` 和 `health-alerts.log`
2. 查看 Docker 状态：

```bash
docker ps --filter name=melwater --format 'table {{.Names}}\t{{.Status}}'
```

3. 查看 API 指标：

```bash
TOKEN="$(node - <<'NODE'
const fs = require("node:fs");
const env = fs.readFileSync("/opt/melwater-ana/secrets/melwater.env", "utf8");
const raw = env.split(/\r?\n/).find((line) => line.startsWith("REVIEW_STATE_HEALTH_TOKEN="))?.split("=").slice(1).join("=") || "";
console.log(raw);
NODE
)"
curl -fsS -H "Authorization: Bearer $TOKEN" https://melwater.lute-tlz-dddd.top/api/review-state/metrics
```

4. 如 API 502 但容器健康，重启共享 edge proxy：

```bash
docker restart ai_video_nginx
```

5. 如 review-state 状态异常，先做备份，再按发布 runbook 执行回滚或恢复。

## 八、验收门禁

生产可观测性闭环完成必须满足：

- `/etc/cron.d/melwater-ops` 存在且包含三条任务
- `last-health.json` 为 `ok=true`
- `ops-report-latest.json` 为 `ok=true`
- `review-state` API `health/replay/metrics` 全部通过
- Ops 页面可查看健康、备份、incident、report 状态

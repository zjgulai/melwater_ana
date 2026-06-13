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
```

可选值：

- `generic`
- `feishu`
- `wecom`

## 六、故障处理

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

## 七、验收门禁

生产可观测性闭环完成必须满足：

- `/etc/cron.d/melwater-ops` 存在且包含三条任务
- `last-health.json` 为 `ok=true`
- `ops-report-latest.json` 为 `ok=true`
- `review-state` API `health/replay/metrics` 全部通过
- Ops 页面可查看健康、备份、incident、report 状态

# Melwater Production E2E QA

日期：2026-06-15 UTC  
执行人：Codex  
生产域名：`https://melwater.lute-tlz-dddd.top`  
服务器：`101.34.52.232` / `VM-0-16-ubuntu`  
应用目录：`/opt/melwater-ana/app`

## 1. Release 映射

| 项目 | 值 |
| --- | --- |
| Git commit | `4de64a9d308c876d9640c2b3a95fc986017086cf` |
| Git short commit | `4de64a9d` |
| Production release id | `playbook-pain-radar-lab-0.0.0-2026-06-15T04-08-20-775Z` |
| App artifact SHA256 | `5dd0ef7f10ee46f55b5e8e3e29a25b63608cd8856500e0ceef59d586dc6a1250` |
| Rollback artifact SHA256 | `c9b25483c3ae04e91a1f3f99214bcd01e317f47556eae9b62c028ec9a3632ffc` |

远端确认：

```text
/opt/melwater-ana/app/REVISION = playbook-pain-radar-lab-0.0.0-2026-06-15T04-08-20-775Z
healthcheck.releaseRef = playbook-pain-radar-lab-0.0.0-2026-06-15T04-08-20-775Z
```

## 2. 本轮修复

真实公网回归发现并修复了两个生产问题：

| 问题 | 现象 | 修复 |
| --- | --- | --- |
| Web Docker image 缺少 `public` | 浏览器 console 报 `/favicon.svg` 404 | `deploy/docker/Dockerfile.web` 增加 `COPY public ./public`，release package 增加 `public`，`release:verify` 要求 `public/favicon.svg` 和 `dist/favicon.svg` |
| healthcheck 首页 marker 过期 | 系统运维页显示 `homepage title marker missing`，incident open | `deploy/scripts/melwater-healthcheck.sh` 增加 `MELWATER_HEALTH_HOME_MARKER`，默认检查 `Melwater VOC 决策工作台` |

## 3. 发布与公网验证

| 检查项 | 结果 |
| --- | --- |
| `npm run build` | pass |
| `npm run check:ui-copy` | pass |
| `sh -n deploy/scripts/melwater-healthcheck.sh` | pass |
| `npm run release:verify` | pass, `failures=[]` |
| remote preflight | pass, `melwater-preflight-ok` |
| remote artifact checksum | pass |
| Docker deploy/restart | pass |
| shared edge proxy refresh | pass |
| remote `review:verify-deploy -- --require-auth` | pass |
| public site smoke | pass, HTTP 200, title `Melwater VOC 决策工作台` |
| `/favicon.svg` | pass, HTTP 200, `content-type: image/svg+xml` |
| Docker health | `melwater_web` healthy, `melwater_api` healthy |

Review-state API verification:

```json
{
  "ok": true,
  "apiBase": "https://melwater.lute-tlz-dddd.top/api/review-state",
  "health": {"status": 200, "ok": true},
  "replay": {"status": 200, "ok": true},
  "metrics": {"status": 200, "ok": true}
}
```

## 4. Healthcheck 与 Incident 状态

发布后第一次手动 healthcheck 在 `melwater_web` 仍处于 Docker `health: starting` 时运行，产生一次真实失败。等待容器 healthy 后再次运行 healthcheck，结果恢复：

```json
{
  "ok": true,
  "checkedAt": "2026-06-15T04:15:01Z",
  "publicUrl": "https://melwater.lute-tlz-dddd.top",
  "homepageStatus": 200,
  "apiBase": "https://melwater.lute-tlz-dddd.top/api/review-state",
  "releaseRef": "playbook-pain-radar-lab-0.0.0-2026-06-15T04-08-20-775Z",
  "failureCount": 0,
  "incidentOpen": false
}
```

Incident 文件当前为 `resolved`。历史 failure count 为 13，主要来自旧 marker 和部署窗口 health starting；最新 healthcheck 已恢复。

## 5. 真实浏览器 E2E

执行方式：Chromium 真实浏览器访问公网域名，注入生产 admin token 到浏览器 `localStorage`，逐页点击左侧导航并截图。

断言范围：

- 页面标题可见。
- `业务闭环路径` 可见。
- `页面业务闭环` 可见。
- 可见正文不包含 `Playbook`。
- 系统运维页额外断言 `authorized · admin`、`required · admin`、`生产健康检查通过`、`replay ok`、`mock alert drill 不证明飞书/企微真实送达`。
- 浏览器 `consoleErrors=0`。
- 网络 `badResponses=0`。
- 网络 `failedRequests=0`。

E2E 报告：

```json
{
  "ok": true,
  "checkedAt": "2026-06-15T04:15:06.231Z",
  "url": "https://melwater.lute-tlz-dddd.top/",
  "checkedPages": 14,
  "consoleErrors": 0,
  "badResponses": 0,
  "failedRequests": 0
}
```

页面覆盖：

| 页面 | 标题 | 截图 |
| --- | --- | --- |
| 今日决策台 | 今日决策台 | `output/playwright/2026-06-15-melwater-production-e2e/01-home.png` |
| 数据可信度 | 数据可信度检查 | `output/playwright/2026-06-15-melwater-production-e2e/02-search.png` |
| 产品痛点 | 产品痛点优先级 | `output/playwright/2026-06-15-melwater-production-e2e/03-pain.png` |
| 行动闭环 | 行动闭环看板 | `output/playwright/2026-06-15-melwater-production-e2e/04-actions.png` |
| 竞品证据 | 竞品证据卡 | `output/playwright/2026-06-15-melwater-production-e2e/05-competitor.png` |
| 内容机会 | 内容机会池 | `output/playwright/2026-06-15-melwater-production-e2e/06-content.png` |
| 用户原话 | 用户原话库 | `output/playwright/2026-06-15-melwater-production-e2e/07-quotes.png` |
| 概念验证 | 产品概念验证 | `output/playwright/2026-06-15-melwater-production-e2e/08-concept.png` |
| 风险预警 | 风险预警台 | `output/playwright/2026-06-15-melwater-production-e2e/09-crisis.png` |
| 区域语言 | 区域与语言机会 | `output/playwright/2026-06-15-melwater-production-e2e/10-regions.png` |
| 经营复盘 | 管理层月会 | `output/playwright/2026-06-15-melwater-production-e2e/11-brief.png` |
| 数据红线 | 数据口径与红线 | `output/playwright/2026-06-15-melwater-production-e2e/12-quality.png` |
| 操作留痕 | 操作留痕 | `output/playwright/2026-06-15-melwater-production-e2e/13-audit.png` |
| 系统运维 | 系统运维 | `output/playwright/2026-06-15-melwater-production-e2e/14-ops.png` |

截图目录：

```text
outputs/prototypes/playbook-pain-radar-lab/output/playwright/2026-06-15-melwater-production-e2e/
```

## 6. 仍未关闭的边界

- 真实 `MELWATER_ALERT_WEBHOOK_URL` 未配置；Feishu/WeCom 真实送达仍未验证。
- `action_feedback_applied` 和 `measuredActions` 当前仍为 0，需要真实业务 owner 和动作反馈回流。
- 本次未执行真实回滚恢复演练；rollback tarball 和脚本已生成但未用于生产恢复。
- 腾讯云控制台资源 ID、负责人、SLO、CLS/监控入口仍需补齐。
- 发布包、截图、运行状态和私钥仍应迁移出仓库工作目录，仓库只保留 manifest、runbook 和源码。

## 7. 结论

本轮真实部署和公网回归通过。生产站当前是中文 Melwater VOC 决策工作台，release `playbook-pain-radar-lab-0.0.0-2026-06-15T04-08-20-775Z` 可追溯到 git commit `4de64a9d`。14 个页面已完成真实浏览器 E2E；公网、API、favicon、Docker health、healthcheck 和 incident recovery 均通过。

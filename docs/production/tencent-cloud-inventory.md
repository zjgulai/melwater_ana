# 腾讯云生产资产清单

> 状态：部分可验证。当前已知服务器、域名、应用目录、Docker 服务、最近 release、ops report 和 mock alert drill；仍缺负责人、SLO、腾讯云资源 ID、监控入口、真实 webhook 和真实恢复演练证据。

## 使用方式

1. 复制 `config/production.example.json` 为本地私有配置，例如 `config/production.json`。
2. 补齐本文件中的资源、域名、地域、负责人和监控链接。
3. 生产核查脚本只读取本地私有配置或只读 CAM 凭据，不把密钥写入仓库。
4. 每次生产状态核查后，在“核查记录”追加一条记录。

## 产品边界

| 项目 | 当前值 | 证据/链接 | 负责人 |
| --- | --- | --- | --- |
| 产品名称 | Melwater Analyst Lab | 生产页面与 release runbook | 待指定 |
| 生产域名 | `https://melwater.lute-tlz-dddd.top` | 生产部署记录 | 待指定 |
| 生产服务器 | `101.34.52.232` / `VM-0-16-ubuntu` | SSH 生产核查 | 待指定 |
| 应用目录 | `/opt/melwater-ana/app` | SSH 生产核查 | 待指定 |
| 业务地域 | 腾讯云轻量应用服务器地域待补充 | 需腾讯云控制台确认 | 待指定 |
| 腾讯云账号/项目 | 待补充 | 需腾讯云控制台确认 | 待指定 |
| 当前发布版本 | `playbook-pain-radar-lab-0.0.0-20260614T052228Z-g7a09e358` | `/health`、远端 release env、`REVISION`；对应 git commit `7a09e358` | 待指定 |
| 数据产物位置 | 本地 `data/`、`exports_20260520/`；云端产物存储待补充 | 本地 manifest 已核查；云端待补充 | 待指定 |

## 腾讯云资源

| 资源类型 | 地域 | 资源 ID/名称 | 用途 | 健康核查方式 | 监控链接 | 负责人 |
| --- | --- | --- | --- | --- | --- | --- |
| Lighthouse | 待控制台确认 | `101.34.52.232` / `VM-0-16-ubuntu` | 应用运行 | SSH、Docker health、HTTP health | 待补充 | 待指定 |
| Docker Compose | 服务器本机 | `melwater_web`、`melwater_api` | 前端和 review-state API | `docker ps --filter name=melwater` | 服务器本机 | 待指定 |
| COS Bucket | 待补充 | 待补充 | 数据/产物存储 | 待补充 | 待补充 | 待指定 |
| CDN/负载均衡/边缘 Nginx | 待补充 | `ai_video_nginx` 共享 edge proxy | 外部访问 | HTTP smoke、必要时重启 edge proxy | 待补充 | 待指定 |
| 云数据库/缓存 | 未接入 | 当前 review-state 使用应用侧状态与备份 | 状态存储 | review-state health/replay/metrics | 待补充 | 待指定 |
| 日志服务 CLS | 待补充 | 待补充 | 日志查询 | 待补充 | 待补充 | 待指定 |
| 监控告警 | 部分本地化 | cron health、ops report、local alert log；真实 webhook 未配置 | SLO/告警 | webhook readiness、alert drill | 待补充 | 待指定 |

## 必需凭据和权限

生产巡检只应使用只读权限，建议最小权限如下：

| 权限项 | 用途 | 是否已配置 | 备注 |
| --- | --- | --- | --- |
| CAM 只读用户/角色 | 查询云资源状态 | 否 | 不应使用主账号密钥 |
| COS 只读权限 | 校验数据产物 | 否 | 限定 bucket 和 prefix |
| CLS 只读权限 | 查询日志 | 否 | 限定 logset/topic |
| 监控只读权限 | 查询指标和告警 | 否 | 限定产品/地域 |

## 生产健康检查清单

| 检查项 | 目标 | 当前状态 | 阻塞项 |
| --- | --- | --- | --- |
| 公网域名可访问 | 2xx/3xx，延迟在 SLO 内 | 已部署，需持续 smoke | SLO 未定义 |
| 应用版本可追踪 | 能定位到发布版本或构建号 | release id 已映射到 git commit `7a09e358` | 后续每次发布继续记录映射 |
| 腾讯云资源状态 | 资源运行中，无异常告警 | 服务器和容器可通过 SSH 核查；控制台不可验证 | 缺少资源 ID/只读凭据 |
| COS 数据产物完整性 | checksum 与发布清单一致 | 本地可验证，云端不可验证 | 缺少 bucket/prefix |
| 日志可查询 | 最近一次任务有日志 | 服务器本机日志可查；CLS 不可验证 | 缺少 CLS 信息 |
| 告警可触达 | 告警规则与联系人有效 | 本地告警与 mock drill 可用；真实 webhook 未配置 | 缺少 Feishu/WeCom webhook |

## 核查记录

| 日期 | 核查人 | 结论 | 证据 |
| --- | --- | --- | --- |
| 2026-06-10 | Codex | 本地数据链路通过；腾讯云产品级状态不可验证 | 见 `docs/audits/2026-06-10-debt-and-production-readiness-audit.md` |
| 2026-06-14 | Codex | 生产域名、服务器、Docker 服务、health、ops report 可核查；真实 webhook、SLO、负责人和控制台资源仍缺 | 见 `docs/runbooks/melwater-branch-release-decision.md` 与 `docs/superpowers/plans/2026-06-14-melwater-capability-debt-roadmap.md` |
| 2026-06-14 | Codex | 已发布 `playbook-pain-radar-lab-0.0.0-20260614T052228Z-g7a09e358`；公网、review-state API、ops report、mock alert drill 均通过；真实 webhook 仍未配置 | 见 `docs/audits/2026-06-14-melwater-production-release-qa.md` |

# Melwater Documentation Index

更新时间：2026-06-15 UTC

本目录用于区分当前源文档、生产运行文档、历史审计记录和执行计划。后续协作时优先从本文件进入，不要直接以旧审计文档作为当前状态判断。

## 当前三方一致性快照

| 状态面 | 当前值 | 说明 |
| --- | --- | --- |
| 仓库文档主线 | `main` / `origin/main` | 当前文档 HEAD 以 `git log -1` 为准；文档提交不等同于生产部署 |
| 生产代码版本 | `playbook-pain-radar-lab-0.0.0-2026-06-15T10-40-14-650Z` | 生产 `REVISION`、`MELWATER_RELEASE_REF` 和 healthcheck `releaseRef` 均指向该 release；前端展示层已按 Melwater 口径脱敏 |
| 代码来源提交 | `6aa6364e` | release manifest `gitSha=6aa6364e`；包含页面使用说明、中文化、字体层级、移动端布局和公网 E2E 修复 |
| 本地静态分析索引 | 已执行，未持久化 | 本次会话已完成 `codegraph init`（67 文件，1,445 nodes，3,270 edges）；当前 `.codegraph/` 不在工作区 |
| 发布证据提交 | `900ca318` | 首次记录生产发布 QA 的文档提交；后续交接文档可能位于更新提交 |
| 生产域名 | `https://melwater.lute-tlz-dddd.top` | 公网站点 HTTP 200，review-state API 验收通过 |
| 当前生产证据 | `docs/audits/2026-06-15-melwater-page-function-usage-qa.md` | 公网页面说明、筛选/搜索/写回/导出/Ops 入口、桌面/移动端 14 页真实浏览器 E2E 均已记录 |
| 生产产品体验 | 中文 Melwater VOC 决策工作台 | 14 个页面已在公网逐页验收，页面均含 `业务闭环路径`、`页面业务闭环` 和 `当前页面使用说明`，且可见文案不含 `Playbook` |
| E2E 截图证据 | `outputs/prototypes/playbook-pain-radar-lab/output/playwright/2026-06-15-production-deep-check/production-final-v3-auth-readonly/` | 28 张桌面/移动端页面截图和 `production-final-v3-auth-readonly.json`；本目录为本地验收产物，不作为源码发布物 |

## 当前源文档

| 主题 | 文档 | 用途 |
| --- | --- | --- |
| 项目总览、债务和路线图 | `docs/superpowers/plans/2026-06-14-melwater-capability-debt-roadmap.md` | 当前项目能力、业务价值、扩展性、脆弱点、缺口和优化计划 |
| 中文业务闭环产品审计 | `docs/audits/2026-06-14-melwater-cn-business-loop-audit.md` | 当前网站中文化、故事线、页面闭环和产品重构计划 |
| Codex 交接摘要 | `docs/handoff/2026-06-14-codex-project-handoff-summary.md` | 下一次开发/执行 Codex 的快速上下文 |
| 数据业务 Playbook | `docs/playbooks/meltwater-voc-business-insights-playbook.md` | Meltwater VOC 数据如何转为业务洞察和动作 |
| 质量门禁 | `docs/runbooks/quality-gates.md` | 本地数据、代码、类型和安全扫描验收命令 |
| Action feedback 闭环 | `docs/runbooks/action-feedback-loop.md` | 动作反馈写回、状态汇总和闭环验收 |
| VOC 自动化 | `docs/runbooks/voc-insight-automation.md` | marts、insights、review queues 和业务输出生成链路 |

## 生产与发布文档

| 主题 | 文档 | 当前状态 |
| --- | --- | --- |
| 腾讯云资产清单 | `docs/production/tencent-cloud-inventory.md` | 已记录当前域名、服务器、release、commit 映射和缺口；负责人/SLO/资源 ID 仍需补齐 |
| Docker 发布清单 | `docs/runbooks/melwater-tencent-docker-release-checklist.md` | 当前发布流程源文档 |
| 生产可观测性 | `docs/runbooks/melwater-production-observability.md` | 当前健康检查、备份、ops report、告警和 webhook readiness 源文档 |
| 分支/发布决策包 | `docs/runbooks/melwater-branch-release-decision.md` | PR #1 合并和生产 release 映射的历史决策证据 |

## 数据与 Excel 文档

| 主题 | 文档 | 用途 |
| --- | --- | --- |
| JSON 到完整 Excel | `docs/runbooks/json-to-complete-excel.md` | 原始 JSON 解析到目标 Excel 包 |
| 目标补采 | `docs/runbooks/targeted-backfill.md` | manifest 驱动补采流程 |
| API 字段清单 | `docs/Meltwater_API_可用字段清单.md` | Meltwater 字段说明 |
| VOC 导出汇总 | `docs/Meltwater_VOC导出汇总.md` | 首次导出统计记录 |

## 历史审计与 QA

`docs/audits/` 下的文件保留为历史证据。读取时按日期和 P 阶段理解，不应单独作为当前状态。

仍有参考价值的历史文档：

- `docs/audits/2026-06-04-project-audit.md`：初始项目结构和早期债务。
- `docs/audits/2026-06-10-debt-and-production-readiness-audit.md`：生产化之前的债务基线。
- `docs/audits/2026-06-11-playbook-closure-gap-audit.md`：Playbook 分支闭环缺口基线。
- `docs/audits/2026-06-12-site-playbook-gap-analysis.md`：站点与 Playbook GAP 的早期版本；部分内容已被 P15-P17 和当前路线图更新。
- `docs/audits/2026-06-13-*`：生产、Ops、Action closed-loop、Weekly review、Meeting snapshot 的最新 QA 证据。
- `docs/audits/2026-06-14-melwater-production-release-qa.md`：PR #1 合并后生产发布、release 到 git commit 映射、公网站点、API、ops report 和 alert drill 验收证据。
- `docs/audits/2026-06-14-melwater-cn-business-loop-audit.md`：中文业务闭环产品审计、重构计划和 Phase 1-3 本地执行记录。
- `docs/audits/2026-06-15-melwater-production-e2e-qa.md`：中文工作台真实部署、公网 smoke、API、healthcheck 和 14 页浏览器 E2E 验收证据。
- `docs/audits/2026-06-15-melwater-page-function-usage-qa.md`：页面使用说明、筛选/搜索/写回/导出/Ops 入口、字体字号、移动端布局和公网 E2E 验收证据。

## 当前已知未完成事项

- `codex/fix-playbook-deploy-checklist` 已通过 PR #1 合并；本地/远端分支可按需清理。
- 真实 Feishu/WeCom webhook 未配置，生产 webhook readiness 仍应阻断。
- `action_feedback_applied` 和 `measuredActions` 当前为 0，需要真实业务动作回流。
- 中文业务决策工作台已发布到生产并完成 14 页公网 E2E；后续变更仍需重复 release + E2E 流程。
- 生产资产清单仍缺负责人、SLO、腾讯云资源 ID、监控入口和真实回滚恢复演练记录。
- 大体量数据、发布包、运行状态和私钥应从仓库工作目录外置。

## 更新规则

- 当前状态变更后，优先更新本索引和对应 runbook。
- 历史审计不要删除；如已过期，在本索引标注其历史属性。
- 新增生产变更时，同步更新 `docs/runbooks/melwater-branch-release-decision.md` 或生产 runbook。

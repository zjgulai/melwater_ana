# Codex Project Handoff Summary

日期：2026-06-14  
项目路径：`/Users/lute/project/Agent/product/data_achieve/meltwater`  
生产域名：`https://melwater.lute-tlz-dddd.top`  
仓库：`https://github.com/zjgulai/melwater_ana`

## 1. 一句话状态

Melwater 项目已经从原始 Meltwater JSON/Excel 处理，推进到可部署的 VOC Analyst Lab 产品：`main` 已包含 release-hardening 运维脚本，腾讯云生产环境已发布并验证，当前最大未闭环事项是真实外部告警 webhook、业务 action feedback 回流、生产负责人/SLO/资源清单和数据资产外置。

## 2. 三方一致性

| 状态面 | 当前事实 | 证据 |
| --- | --- | --- |
| 仓库主线 | `main` / `origin/main` | `git log -1` gives the current docs HEAD |
| 生产代码 release | `playbook-pain-radar-lab-0.0.0-20260614T052228Z-g7a09e358` | `/opt/melwater-ana/app/REVISION`、`MELWATER_RELEASE_REF` |
| 生产代码提交 | `7a09e358` | release id 中的 `g7a09e358`，PR #1 merge commit |
| 发布证据文档 | `docs/audits/2026-06-14-melwater-production-release-qa.md` | 已 push 到 `origin/main`；首次记录提交为 `900ca318` |
| 生产状态 | 公网站点 200，review-state API ok，Docker containers healthy，ops report ok，mock alert drill ok | 生产 release QA 与 ops report |

注意：生产代码正确映射到 `7a09e358`；后续文档提交不会自动触发生产部署。

## 2.1 整轮对话摘要（可直接交接）

- 先后完成：`codegraph init`、playbook 问题梳理、网站文本从 Playbook 到 Melwater 统一、PR #1 合并、腾讯云部署回归验证、Ops/alert 可观测链路验证。
- 生产发布结论持续一致：`main` 与 `origin/main` 对齐，生产仍使用 `playbook-pain-radar-lab-0.0.0-20260614T052228Z-g7a09e358`；release 与 commit 映射可靠。
- 当前真实未闭环口径：真实外部 webhook、action owner 与 feedback 回流、SLO/负责人/腾讯云资源清单与真实恢复演练。
- 数据侧当前口径稳定：完整 Excel 包校验 PASS，raw 数与 unique 文档/关系行已在 handoff 文档中落地；blocked search quality gate 仍为 2 个，需后续 query rewrite 与重采复测。
- 代码扫描口径更新：`codegraph init` 成功（67 文件，1,445 nodes，3,270 edges）；当前 `.codegraph/` 未持久保留，如需图谱查询需重新初始化。
- 产品体验新增判断：当前网站已具备多页面能力，但仍偏分析模块堆叠，中英文混排，缺少从“数据是否可信 -> 业务问题 -> 证据 -> 负责人动作 -> 复盘结果”的中文故事线。
- 中文产品壳第一轮已执行：前端主导航、首页“今日决策台”、全局闭环条、主页面标题和主要业务路径文案已中文化；生产尚未重新发布。
- 中文业务闭环第二轮已执行：所有页面顶部新增“当前判断、证据基础、风险红线、建议动作、复盘指标”面板；生产尚未重新发布。
- 中文业务闭环第三轮已执行：新增 `npm run check:ui-copy` 文案守卫，补齐 favicon，修复系统运维 token 表单语义，并通过 Playwright 抽样验证 6 条主路径。
- 中文业务闭环第四轮已执行：输出桌面首页、移动首页、移动系统运维截图 QA，证据在 `output/playwright/2026-06-14-melwater-cn-business-loop/`；生产尚未重新发布。
- 中文业务闭环第五轮已执行：生成本地 release candidate `playbook-pain-radar-lab-0.0.0-2026-06-15T02-46-20-637Z`，本地 `release:verify` 通过，腾讯云只读 `deploy:preflight --execute --check-ssh` 通过。
- 当前阻断点已修复：本轮中文化和 QA 改动已提交并推送到 `origin/main`，commit `f0d52ca0`；随后重新生成可追溯 release candidate `playbook-pain-radar-lab-0.0.0-2026-06-15T02-51-50-613Z`，manifest `gitSha=f0d52ca0`，本地 `release:verify` 与腾讯云只读 preflight 均通过。
- 接续建议优先级：执行真实生产部署与公网回归；随后补齐 P0 外部 webhook 与 action 闭环、生产治理信息、数据与运行时外置。

## 3. 当前能力

- 原始 Meltwater JSON 导出清点、补采规划、补采执行保护、完整 Excel 解析。
- 完整 Excel 包：`data/excel_complete_20260611/`。
- 数据 marts：pain radar、search quality、weekly health、competitor battlecards、content opportunities、quote library、crisis watch、region priorities、concept candidates、executive monthly、action register、feedback overlay。
- 前端产品：`outputs/prototypes/playbook-pain-radar-lab`，本地已推进为中文 Melwater VOC 决策工作台；当前生产仍是上一版 release。
- 生产能力：Docker release package、remote deploy、rollback dry-run、public smoke、review-state API verification、healthcheck、backup、ops report、mock alert drill、external webhook readiness gate。

## 4. 数据口径

当前完整包关键指标：

- Source count：7
- Raw document occurrences：347,138
- Unique document ids：336,435
- Category unique documents：吸奶器 129,569；暖奶器 195,984；消毒器 16,789
- Relation rows：6,871,226
- Known source gaps：0
- Formula count in generated workbooks：0

当前业务产品数据：

- Pain cards：21
- Proposed actions：57
- Competitor battlecards：18
- Content opportunities：30
- Concept candidates：21
- Crisis watch rows：30
- Region priorities：30
- Executive monthly rows：14
- Quotes：120
- Blocked search-quality gates：2

## 5. 最近完成的关键事项

- 原始 JSON 完整解析为目标 Excel，字段和数组关系未忽略。
- 基于 Playbook 反推 ETL、marts、洞察框架、行动闭环。
- 开发 Melwater Analyst Lab 前端产品形态。
- 部署到腾讯云轻量服务器 `101.34.52.232`，域名 `melwater.lute-tlz-dddd.top`。
- 完成 production observability：healthcheck、backup、ops report、cron、alert drill。
- 新增 external webhook readiness gate，但真实 webhook 尚未配置。
- PR #1 已合并：`Release hardening and Melwater roadmap docs`。
- 已发布生产 release：`playbook-pain-radar-lab-0.0.0-20260614T052228Z-g7a09e358`。
- 已记录生产发布 QA 并 push 到 `origin/main`。
- 本地中文业务闭环 release candidate 已完成 package、verify、manifest gitSha 对齐和远程只读 preflight，但尚未 deploy。

## 6. 常用验证命令

本地完整门禁：

```bash
make quality
cd outputs/prototypes/playbook-pain-radar-lab
npm run test:webhook-readiness
npm run build
```

生产只读核查：

```bash
ssh -i /Users/lute/project/Agent/product/data_achieve/meltwater/ai_video.pem -p 22 \
  -o BatchMode=yes -o StrictHostKeyChecking=accept-new ubuntu@101.34.52.232 \
  "cat /opt/melwater-ana/app/REVISION; docker ps --filter name=melwater --format 'table {{.Names}}\t{{.Status}}'; cat /opt/melwater-ana/backups/last-health.json"
```

生产 release QA 文档：

```text
docs/audits/2026-06-14-melwater-production-release-qa.md
```

## 7. 重要文件

| 文件 | 用途 |
| --- | --- |
| `README.md` | 项目入口与当前产品状态 |
| `TODO.md` | 当前待办与历史补采记录 |
| `docs/README.md` | 文档索引与三方一致性快照 |
| `docs/production/tencent-cloud-inventory.md` | 生产资产与缺口清单 |
| `docs/audits/2026-06-14-melwater-production-release-qa.md` | 最近一次生产发布证据 |
| `docs/audits/2026-06-14-melwater-cn-business-loop-audit.md` | 中文业务闭环产品审计和重构计划 |
| `docs/superpowers/plans/2026-06-14-melwater-capability-debt-roadmap.md` | 项目能力、债务、路线图 |
| `docs/playbooks/meltwater-voc-business-insights-playbook.md` | VOC 业务洞察 Playbook |
| `outputs/prototypes/playbook-pain-radar-lab` | 前端产品与部署脚本 |

## 8. 仍未完成

P0：

- 配置真实 Feishu/WeCom webhook：设置 `MELWATER_ALERT_WEBHOOK_URL` 和 `MELWATER_ALERT_WEBHOOK_TYPE` 后运行 `node deploy/scripts/melwater-alert-webhook-readiness.mjs --send`。
- 给 action register 配真实 owner，并让业务动作产生 feedback 回流；当前 `action_feedback_applied=0`、`measuredActions=0`。
- 补齐生产负责人、SLO、腾讯云资源 ID、监控入口和真实恢复演练证据。
- 把 `ai_video.pem` 移出项目根目录，使用 SSH agent 或外部 secrets 目录。
- 将本地中文业务决策工作台发布到腾讯云生产，并保留 release 与 commit 映射。
- 做生产发布准备和公网回归截图，确认线上中文业务闭环面板与本地一致。

P1：

- 针对 2 个 blocked search-quality gates 做 query rewrite、重采和 precision 复测。
- 建立 fixture CI 与 full-data scheduled validation。
- 增加浏览器级产品验收测试。
- 将大体量数据、release 包、runtime state 外置到 artifact storage。
- 对 review-state 存储做多用户/持久化升级评估。

## 9. 操作注意

- 不要把真实 token、webhook URL、SSH key 写入仓库。
- `.remote-deploy.env` 不在仓库根 `.gitignore` 中覆盖；部署时优先使用 `/private/tmp` 这类临时路径。
- 当前 external webhook readiness blocked 是正确状态，不是生产失败。
- mock alert drill 只证明告警链路逻辑，不证明飞书/企微真实频道送达。
- 生产 release 代码是 `7a09e358`，不要误认为后续文档提交已被部署。

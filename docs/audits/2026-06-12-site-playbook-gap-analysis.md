# Melwater Site vs VOC Playbook GAP Analysis

日期：2026-06-12  
范围：生产站 `https://mkt.lute-tlz-dddd.top/`、本地 Melwater Analyst Lab 原型、`docs/playbooks/meltwater-voc-business-insights-playbook.md`、`docs/product-design/playbook-analyst-lab-uiux.md`、`data/marts/20260611/`。

## 0. 已执行的命名修正

按用户指定拼写，已将本地可编辑网站原型中的可见 `Playbook` 文案替换为 `Melwater`：

- `Playbook Analyst Lab` -> `Melwater Analyst Lab`
- `Playbook闭环` -> `Melwater闭环`
- 页面标题 `Playbook Analyst Lab - Pain Radar` -> `Melwater Analyst Lab - Pain Radar`

修改位置：

- `outputs/prototypes/playbook-pain-radar-lab/src/App.jsx`
- `outputs/prototypes/playbook-pain-radar-lab/index.html`
- `outputs/prototypes/playbook-pain-radar-lab/dist/index.html`
- `outputs/prototypes/playbook-pain-radar-lab/design-qa.md`

注意：仓库与数据管道仍大量使用官方产品名 `Meltwater`。如果品牌拼写最终应为 `Meltwater` 而不是 `Melwater`，需要后续统一做一次命名迁移。

## 1. 当前网站事实

### 1.1 生产站现状

生产站标题为 `Momcozy - Market Insight Platform`，首页是 Momcozy 市场洞察工作台，视觉体系已经清晰：

- 浅暖底色、白色圆角卡片、玫瑰主色、柔和阴影。
- 顶部导航：`首页 / 五看 / 看市场 / 看竞争 / 看用户 / 看行业 / 看自己 / AI助手 / AI画廊`。
- 首页核心模块：市场数据看板、竞品库、新品监测、用户画像、政策法规、报告中心、看自己、AI助手。
- 已有内容方向：TAM/SAM/SOM、竞品份额、合规通知、报告中心、市场趋势、待办通知。

生产站强项是“宏观市场 + 竞品 + 合规 + 报告”的经营驾驶舱；弱项是尚未产品化 VOC playbook 所要求的“证据、质量门禁、业务问题、动作闭环”。

### 1.2 本地 Melwater 原型现状

本地原型路径：

`outputs/prototypes/playbook-pain-radar-lab/`

当前只有一个高保真可交互页面：`Product Pain Radar`。

已具备：

- 品牌风格和生产站保持一致。
- 痛点雷达、严重度分布、趋势卡、Issue List、右侧洞察建议。
- 点击痛点行刷新右侧洞察。
- 点击行动按钮进入 `行动卡已创建` 状态。

未具备：

- 多页面路由。
- 与 `data/marts/20260611/` 的真实数据绑定。
- Query quality gate 的全局门禁。
- 通用证据抽屉。
- Action owner、状态、due date、review、actual metric 的闭环操作。

## 2. Playbook 要求的目标能力

业务 playbook 定义了 10 个 play：

1. 搜索质量治理
2. 品类健康周报
3. 产品痛点雷达
4. 竞品 Battlecard
5. 内容与种草策略
6. 危机与异常预警
7. 区域与语言优先级
8. 产品共创与概念验证
9. 客服与售后闭环
10. 管理层月度洞察会

UI/UX 设计文档要求的核心页面：

- Melwater Home
- Question Explorer
- Search Quality Lab
- Category Health Lab
- Pain & Competitor Lab
- Content Opportunity Lab
- Concept Candidate Lab
- Action Closed Loop
- Evidence Drawer
- Data Quality

体验原则：

- Question first：先选业务问题，不先找表。
- Evidence always visible：每个结论都可展开证据。
- Quality gate before interpretation：query blocked 时不能输出业务结论。
- Decision traceability：`insight_id -> evidence -> action_id -> owner -> review` 全链路可追踪。

## 3. 数据资产可用性

`data/marts/20260611/mart_manifest.json` 已通过，状态为 `PASS`。

关键数据规模：

- `fact_insight`: 600
- `fact_evidence_sample`: 3863
- `fact_sample_review`: 3863
- `fact_action_register`: 57
- `mart_product_pain_radar`: 21
- `mart_content_opportunity`: 76
- `mart_user_voice_quote_library`: 378
- `mart_crisis_watch_daily`: 368
- `mart_region_language_priority`: 1076
- `fact_query_sample_review`: 132

这意味着当前瓶颈不在数据产物，而在网站信息架构、页面表达、交互闭环和数据接入。

## 4. 页面级 GAP 矩阵

| 能力/页面 | 生产站现状 | 本地原型现状 | 数据是否就绪 | GAP 等级 | 建议动作 |
| --- | --- | --- | --- | --- | --- |
| Melwater Home | 无 VOC 专属入口 | 无首页，直接进痛点页 | 就绪 | P0 | 新增 VOC 总入口，展示质量门禁、Top 问题、Action 摘要 |
| Question Explorer | 无问题目录 | 无 | 就绪 | P0 | 把 10 个 play 变成可点击问题卡 |
| Search Quality Lab | 只有公开来源/连接器状态 | 无 | 就绪 | P0 | 展示 blocked/pass、噪声样本、query rewrite 建议 |
| Product Pain Radar | 无 | 已有单页 | 就绪 | P0 | 接入真实 mart，补 evidence drawer 和 action register |
| Evidence Drawer | 无 | 右侧仅展示 mock evidence | 就绪 | P0 | 建通用抽屉，支持 occurrence/document/url/source/sentiment |
| Action Closed Loop | 生产站有待办通知，但不是 VOC action | 局部按钮状态 | 就绪 | P0 | 建 board/table，支持 owner/status/due/review/metric |
| Category Health Lab | 有宏观市场趋势 | 无 VOC 周度变化 | 就绪 | P1 | 周趋势、负面率、变化点和质量提示 |
| Competitor Battlecard | 有竞品库/份额 | 无 VOC battlecard | 就绪 | P1 | 显示竞品 VOC 情感、卖点、抱怨、弱信号 |
| Content Opportunity Lab | 有报告/营销入口 | 无 | 就绪 | P1 | 内容 brief 队列、quote library、平台筛选 |
| Concept Candidate Lab | 有新品监测 | 无 VOC 概念验证 | 就绪 | P2 | 概念卡、反证、测试建议 |
| Crisis Watch | 有通知 | 无 VOC 危机规则 | 就绪 | P2 | Daily alert digest、PR/CX triage |
| Region & Language | 生产站偏区域市场 | 无 VOC 语言/国家优先级 | 就绪 | P2 | 语言优先级、country known guardrail |
| Executive Monthly Brief | 有报告中心 | 无 VOC 管理层月报 | 就绪 | P2 | 管理层视图，先看 blocked，再看 actions |
| Data Quality | 无 VOC 数据口径页 | 无 | 就绪 | P0 | 解释 document/occurrence、sentiment、zz、body 缺失等 |

## 5. 最大缺口诊断

### 5.1 信息架构缺口

当前生产站按“看市场/看竞争/看用户/看行业/看自己”组织，适合经营驾驶舱；VOC playbook 需要按“业务问题/证据/动作”组织。两者不冲突，但需要新增一个 Melwater VOC 工作区，而不是把 VOC 页面散落到原有模块里。

建议导航：

```text
 首页
 五看
 AI
 Melwater VOC
   - VOC 总览
   - 问题探索
   - 搜索质量
   - 痛点雷达
   - 竞品洞察
   - 内容机会
   - 概念候选
   - 危机预警
   - 区域语言
   - 动作闭环
   - 数据质量
```

### 5.2 决策可信度缺口

生产站首页已有大量高层结论，但 VOC playbook 明确要求先过质量门禁。当前最关键事实是：

- 暖奶器 `Estimated Precision = 40.29%`，`blocked_by_query_noise`
- 消毒器 `Estimated Precision = 79.52%`，`blocked_by_query_noise`
- 吸奶器搜索 mostly `pass`

因此所有与暖奶器/消毒器相关的业务解释页面必须出现醒目的 blocked banner，避免把搜索噪声当作真实市场/用户信号。

### 5.3 证据链缺口

数据中已经有 `fact_evidence_sample`、`sample_review_queue.csv`、`query_sample_review_queue.csv` 和 quote library，但网站没有通用证据抽屉。没有证据抽屉，整个系统会退化成 BI 卡片，无法支撑“可审计洞察”。

### 5.4 闭环缺口

`action_register.csv` 已生成 57 条 action，但全部停留在 `Proposed`，`Measured rate = 0.00%`。网站需要优先把 action 从“生成”推进到“owner/status/due/review/actual metric”。

### 5.5 数据接入缺口

当前本地原型使用 mock 数据，生产站数据看起来来自其已有市场情报数据源。Melwater VOC 页面应建立独立的数据适配层：

- 从 `data/marts/20260611/*.csv/*.md/*.json` 生成前端 JSON。
- 或通过轻量 API 读取 `voc_mart.sqlite`。
- 每个页面必须显示 `generated_at` 和 `mart_manifest.status`。

## 6. 分阶段优化计划

### Phase 0：命名与边界统一

状态：本地原型已完成初步替换。

任务：

- 确认最终拼写：`Melwater` 是否为用户指定品牌名，还是应统一为 `Meltwater`。
- 确认 Momcozy 是企业/业务品牌，Melwater 是 VOC 数据产品入口。
- 保留 `Meltwater` 用于 API/数据源官方名称，避免技术文档误拼。

验收：

- 可见 UI 不再出现大写 `Playbook`。
- 数据源文档仍保留官方 `Meltwater` 名称。

### Phase 1：建立 Melwater VOC 总入口和问题导航

新增页面：

- `Melwater Home`
- `Question Explorer`
- `Data Quality Overview`

核心内容：

- 数据包状态：source count、document count、generated_at、known gaps。
- Quality gate summary：pass/review/blocked。
- Top 10 business questions。
- Action loop summary：57 proposed、measured 0%、owner 分布。
- 最近生成 insight cards。

数据映射：

- `mart_manifest.json`
- `search_precision_report.md`
- `insight_register.csv`
- `action_status_summary.csv`
- `action_closed_loop_summary.md`

验收：

- 用户 30 秒内能知道哪些结论可用、哪些被 query blocked。
- 用户可以从问题卡进入具体 Lab。

### Phase 2：补齐 P0 决策安全页面

新增/完善：

- `Search Quality Lab`
- `Evidence Drawer`
- `Product Pain Radar` 真实数据绑定
- `Action Closed Loop`

关键交互：

- Search Quality：查看噪声样本，标记 `true_product_match/noise/unclear`。
- Pain Radar：按 category/topic/channel/brand 筛选，点击任一痛点打开证据抽屉。
- Evidence Drawer：显示 evidence text、URL、source type、sentiment、document_id、occurrence_id、review status。
- Action Loop：修改 owner、status、due date、review date、actual metric、close reason。

数据映射：

- `pain_point_cards.csv`
- `product_pain_deep_dive.md`
- `query_sample_review_queue.csv`
- `sample_review_queue.csv`
- `action_register.csv`

验收：

- 每个可行动洞察都能追溯到至少 5 条证据样本。
- blocked category 在所有相关页面显示不可误读的 banner。
- action 不能只创建，必须能进入 owner/status/review 流程。

### Phase 3：补齐 P1 增长与内容页面

新增页面：

- `Category Health Lab`
- `Competitor Battlecard`
- `Content Opportunity Lab`
- `Quote Library`

数据映射：

- `weekly_voc_brief.md`
- `weekly_change_points.md`
- `competitor_battlecards.md`
- `content_opportunities.md`
- `content_brief_queue.md`
- `user_voice_quote_library.csv`

验收：

- Category Health 不允许被解释为销量或市场份额。
- Battlecard 样本不足时必须显示 `weak_signal`。
- Quote Library 默认标记为 candidate，外发前需要人工 review。

### Phase 4：补齐 P2 管理层与前瞻页面

新增页面：

- `Concept Candidate Lab`
- `Crisis Watch`
- `Region & Language Priority`
- `Executive Monthly Brief`

数据映射：

- `concept_candidates.md`
- `crisis_watch_daily.md`
- `region_language_priority.md`
- `executive_monthly_brief.md`

验收：

- Concept candidate 必须显示 counter-evidence 和 external validation needed。
- Crisis Watch 必须区分 `data_quality_alert` 和真实 PR/CX alert。
- Region 页面必须突出 `country_known=no` 不能做地域结论。
- Executive brief 首屏必须先显示 blocked searches，再显示业务结论。

### Phase 5：生产化与工程化

任务：

- 将本地原型从 `outputs/prototypes` 迁入正式前端目录，或对接生产站源码仓库。
- 建立 `marts -> frontend json` 的构建脚本。
- 为每个页面建立数据契约测试。
- 增加视觉 QA 截图和回归检查。
- 增加部署前检查：无大写 `Playbook`、无 blocked 误读、无 raw quote 外发。

验收：

- `npm run build` 通过。
- 页面数据来自 `data/marts/20260611` 或后续最新 mart，而不是手写 mock。
- 每个页面有空状态、blocked 状态、loading 状态和数据过期状态。

## 7. 推荐的第一轮执行清单

第一轮不要一次性补全所有页面。建议先做一个能闭环的 P0 版本：

1. 新增 `src/data/`，把 `mart_manifest.json`、`pain_point_cards.csv`、`action_register.csv`、`query_sample_review_queue.csv` 转成前端可读 JSON。
2. 改造现有单页为多视图：
   - Melwater Home
   - Search Quality
   - Pain Radar
   - Action Loop
   - Data Quality
3. 把 sidebar 的 `Melwater闭环` 改成可点击分组。
4. 新增 `QualityGateBanner`、`EvidenceDrawer`、`ActionStatusChip`、`ReadinessBadge`、`MartFreshness` 组件。
5. Pain Radar 从 mock 数据切换到 `pain_point_cards.csv`。
6. Action Loop 读取 `action_register.csv`，先做前端状态编辑，不直接写回文件。
7. 生成设计 QA 对比图和功能验收记录。

## 8. 最小验收标准

第一轮 P0 版本完成后，应满足：

- UI 可见文本无大写 `Playbook`。
- 用户能从 Melwater Home 进入至少 4 个 VOC 页面。
- Search Quality 明确显示暖奶器/消毒器 blocked。
- Pain Radar 使用真实 mart 数据，非 mock。
- 任一 insight 可打开证据抽屉。
- 任一 action 可看到 owner/status/due/review 字段。
- Action summary 显示当前真实状态：57 proposed、measured 0%。
- 页面保持生产站浅暖品牌风格，不进入深色风格。

## 9. 风险与待确认

- 仓库内没有生产站源码，只能修改本地原型；生产站落地需要拿到对应前端仓库或部署管道。
- `Melwater` 与官方 `Meltwater` 拼写不一致，需要业务确认是否是新产品名。
- 不能把 `Meltwater` 社媒声量解释为销量、市场份额或投诉率。
- 暖奶器和消毒器必须先做 query quality 治理，不能直接进入业务结论。
- raw quote 不能直接外发，需要人工 review 和合规检查。

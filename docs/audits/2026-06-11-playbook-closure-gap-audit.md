# Playbook Closure Gap Audit

版本：2026-06-11  
审计对象：`docs/playbooks/meltwater-voc-business-insights-playbook.md`  
当前自动化产物：`data/marts/20260611/`  
结论：当前已经跑通了 `Meltwater JSON -> mart -> Markdown/CSV 报告 -> 初始 action register` 的自动产物链，但还没有跑通真正的业务闭环链，即 `insight_id -> 人工样本复核 -> owner/due date -> 业务动作 -> 动作后指标 -> close/reject reason`。

---

## 1. 审计口径

闭环成熟度分 6 级：

| 等级 | 定义 |
| --- | --- |
| 0 | 未实现 |
| 1 | 有 mart 或基础聚合 |
| 2 | 有报告产物和质量门禁 |
| 3 | 有样本复核队列、置信度和可追溯证据 |
| 4 | 有动态 action register、owner、due date、review date |
| 5 | 有动作后指标、复盘结论、规则/产品/内容/客服回写 |

当前总评：

- 自动化产物层：约 2/5。
- 决策闭环层：约 1/5。
- 动作复盘层：0/5。

核心原因：

- 没有 `fact_insight` 和稳定 `insight_id`。
- 没有 `fact_evidence_sample` 和人工样本复核结果。
- `fact_action_register` 仍是静态种子数据，12 条全部为 `Proposed`。
- 没有 owner、due date、review date、baseline、target、actual metric。
- 没有客服工单、退货原因、Amazon/DTC review、SKU/订单等交易型反馈数据。

当前事实：

| 表 | 行数 |
| --- | ---: |
| `mart_search_quality` | 9 |
| `mart_product_pain_radar` | 21 |
| `mart_category_health_weekly` | 56 |
| `mart_competitor_battlecard` | 18 |
| `mart_content_opportunity` | 76 |
| `mart_crisis_watch_daily` | 368 |
| `mart_region_language_priority` | 1,076 |
| `mart_concept_candidates` | 21 |
| `mart_executive_monthly` | 14 |
| `fact_action_register` | 12 |

---

## 2. Play-by-Play 闭环审计

### Play 1：搜索质量治理

当前状态：部分跑通，成熟度 2/5。

已完成：

- 已生成 `mart_search_quality` 和 `search_precision_report.md`。
- 已识别暖奶器 `Bottle Warmer` precision 约 40.29%，状态 `blocked_by_query_noise`。
- 已识别消毒器 `Bottle Sterilizer & Dryer` precision 约 79.52%，低于 80% 门槛，状态 `blocked_by_query_noise`。
- 吸奶器相关 search 当前为 `pass`。

未闭环：

- 当前 precision 是规则估算，不是人工抽样 precision。
- 没有自动生成 Meltwater query rewrite 草案。
- 没有 `query_update_recommendation` 表记录必含词、排除词、观察词。
- 没有执行 query 修改后的补采和 precision 复测。
- 没有误报样本人工标签，也没有把误报原因回写到 `query_noise_rules.json` 的流程。

必须补齐：

- 建立 `fact_query_sample_review`。
- 每个重点 search 随机/分层抽样至少 50 条。
- 输出 `query_rewrite_recommendations.md`。
- query 修改后重新补采，生成 before/after precision。

### Play 2：品类健康周报

当前状态：部分跑通，成熟度 2/5。

已完成：

- 已生成 `mart_category_health_weekly` 和 `weekly_voc_brief.md`。
- 有周度声量、唯一文档、负面率、source type mix。

未闭环：

- 没有 WoW 变化、4 周均值、异常解释和 top negative domains。
- 没有把被 query 阻断的品类从业务健康结论中降级为数据治理结论。
- 没有“本周 3 个变化点”的自动生成逻辑。
- 没有变化点 owner 和 due date。

必须补齐：

- 新增 `mart_category_health_weekly_delta`。
- 计算 WoW、4-week baseline、negative rate lift。
- 输出 `weekly_change_points` 和动态 action。

### Play 3：产品痛点雷达

当前状态：吸奶器部分跑通，成熟度 2/5；暖奶器/消毒器因 query gate 阻断。

已完成：

- 已生成 `mart_product_pain_radar` 和 `pain_point_cards.md/csv`。
- 吸奶器 7 个 topic 为 `ready_for_action`，合计 5,968 mentions、460 negative mentions。
- 暖奶器和消毒器所有痛点被正确标记为 `blocked_by_query_noise`。

未闭环：

- 当前 topic taxonomy 仍偏关键词级，没有根因、使用场景、产品部件、客服类型。
- evidence samples 只是机器采样，没有人工样本复核 verdict。
- 没有 `issue x channel x competitor x sentiment` 矩阵。
- 没有自动为每个 ready pain point 创建 `action_id`。
- 没有进入产品/客服/内容 backlog 的状态追踪。

必须补齐：

- 建立 `fact_insight`、`fact_evidence_sample`、`sample_review_queue.csv`。
- 为 ready pain point 自动生成 action register 行。
- 增加 `mart_issue_channel_competitor_matrix`。

### Play 4：竞品 Battlecard

当前状态：基础聚合跑通，成熟度 2/5。

已完成：

- 已生成 `mart_competitor_battlecard` 和 `competitor_battlecards.md`。
- 吸奶器有 6 个 `ready_for_review` 品牌/竞品，合计 137,350 mentions。
- 暖奶器和消毒器竞品行被 query gate 阻断。

未闭环：

- 没有 Feature Claim Matrix。
- 没有 Objection Handling Sheet。
- 没有品牌共现网络和竞品对比场景。
- alias 匹配可能误召回，例如通用词/人名/非品牌语境。
- 当前只能给品牌层声量和负面率，不能输出“可攻击点/可借鉴点”。

必须补齐：

- 新增 `mart_brand_topic_cooccurrence`。
- 新增 `mart_feature_claim_matrix`。
- 品牌匹配增加实体类型、search ID、上下文约束。
- 生成 `objection_handling_sheet.md`。

### Play 5：内容与种草策略

当前状态：基础聚合跑通，成熟度 1.5/5。

已完成：

- 已生成 `mart_content_opportunity` 和 `content_opportunities.md`。
- 吸奶器有 10 条 `ready_for_review` 内容机会，另有 13 条弱信号。

未闭环：

- 未拆到 `source.name`、`source.domain`、平台和具体社区。
- 没有用户原话库，也没有每周 10 条原话沉淀。
- 没有内容 brief 模板自动填充。
- 没有 hashtag/creator/URL 素材库。
- 没有内容发布后的互动指标回收。

必须补齐：

- 新增 `mart_user_voice_quotes`。
- 新增 `mart_platform_content_opportunity`。
- 输出 `content_brief_queue.md/csv`。
- 为内容机会自动生成 content action。

### Play 6：危机与异常预警

当前状态：基础日报跑通，但预警闭环不足，成熟度 1.5/5。

已完成：

- 已生成 `mart_crisis_watch_daily` 和 `crisis_watch_daily.md`。
- 当前有 non-green alert：吸奶器 22 天、暖奶器 122 天、消毒器 39 天。

未闭环：

- 当前阈值是静态规则，不是 4 周均值/标准差/环比异常。
- 没有问题词异常、平台集中异常、高影响力 P95 异常。
- 暖奶器/消毒器已被 query gate 阻断，但 crisis 表仍会给它们 red/orange/yellow，容易制造误报。
- 没有 triage owner、24h/72h 复盘字段。
- 没有误报原因回写。

必须补齐：

- 新增 `mart_crisis_watch_baseline`。
- alert 维度加入 topic、platform、reach/engagement P95。
- query blocked category 只能产生 `data_quality_alert`，不能产生业务危机 alert。
- 新增 `fact_alert_event` 和 triage 状态。

### Play 7：区域与语言优先级

当前状态：基础聚合跑通，成熟度 1.5/5。

已完成：

- 已生成 `mart_region_language_priority` 和 `region_language_priority.md`。
- 语言/国家组合 1,076 行。
- 已区分 `country_known`，`zz` 不作为地域市场结论。

当前事实：

- 吸奶器 unknown country mentions 86,390，known country mentions 45,079。
- 暖奶器 unknown country mentions 91,994，known country mentions 106,886，但该品类 query blocked。
- 消毒器 unknown country mentions 5,223，known country mentions 11,566，但该品类 query blocked。

未闭环：

- 没有每个重点语言的 topic profile。
- 没有每个语言 30 条样本复核队列。
- 没有与销售地区、广告投放、客服语言的对齐。
- 没有本地化动作建议或 owner。

必须补齐：

- 新增 `mart_language_topic_profile`。
- 输出 `language_sample_review_queue.csv`。
- 增加外部 market priority input 模板。

### Play 8：产品共创与概念验证

当前状态：候选生成跑通，但概念卡未闭环，成熟度 1/5。

已完成：

- 已生成 `mart_concept_candidates` 和 `concept_candidates.md`。
- 吸奶器 7 个概念候选为 `ready_for_review`。

未闭环：

- 当前概念直接来自痛点雷达，不包含正向偏好、论坛表达、竞品方案、反证。
- 没有概念卡结构化输出。
- 没有小样测试、问卷、A/B 测试 action。
- 没有商业可行性和研发复杂度评分。

必须补齐：

- 新增 `concept_cards.md`。
- 概念证据拆成 `problem_evidence`、`positive_preference`、`competitor_solution`、`risk_evidence`。
- 为 ready concepts 自动创建 `concept_test` action。

### Play 9：客服与售后闭环

当前状态：未跑通，成熟度 0/5。

已完成：

- 仅有 `act-feedback-integration` 这条静态 action。
- 目前没有 `mart_voc_cs_alignment`。

未闭环：

- 未接入客服工单。
- 未接入退货原因。
- 未接入 Amazon/DTC reviews。
- 未接入 SKU、批次、订单地区。
- 没有 VOC-to-CS Tag Mapping。
- 没有 FAQ 更新清单。
- 没有动作后同类工单下降复盘。

必须补齐：

- 定义外部反馈 CSV schema。
- 新增 ingest：`support_tickets`、`return_reasons`、`product_reviews`。
- 新增 `mart_voc_cs_alignment`。
- 输出 `faq_update_queue.md/csv` 和 `returns_reason_alignment.md`。

### Play 10：管理层月度洞察会

当前状态：基础月表跑通，成熟度 1.5/5。

已完成：

- 已生成 `mart_executive_monthly` 和 `executive_monthly_brief.md`。
- 可显示每月品类声量、负面率、blocked searches、ready actions。

未闭环：

- 没有 Top 5 insight narrative。
- 没有行动复盘、延期率、关闭率。
- 没有下月实验和资源请求。
- `fact_action_register` 全部为 `Proposed`，没有真实 owner/due。
- 没有会议材料模板或 PPT/Docs 输出。

必须补齐：

- 新增 `executive_insight_digest.md`。
- action register 动态化后，月报加入 action status、overdue、measured impact。
- 加入 resource request 和 decision log。

---

## 3. 横向债务

### 3.1 Insight ID 债务

当前没有统一 `insight_id`。报告行、样本、action register 不能稳定关联。

修复：

- 新增 `fact_insight`。
- insight key 建议：`{play_id}:{category}:{entity}:{period}:{taxonomy_version}`。
- 所有 mart/report 输出必须带 `insight_id`。

### 3.2 样本复核债务

当前 `evidence_samples_json` 是机器收集的样本，不是人工复核结论。

修复：

- 新增 `fact_evidence_sample`。
- 输出 `sample_review_queue.csv`。
- 字段包括 `sample_verdict`、`noise_reason`、`business_relevance`、`reviewer`、`reviewed_at`。

### 3.3 Action Register 债务

当前 12 条 action 全部为静态 `Proposed`，没有 insight 绑定。

修复：

- ready insight 自动生成 action。
- action 状态从 `Proposed` 流转到 `Accepted/In Progress/Shipped/Measured/Closed/Rejected`。
- 必填 `owner_domain`、`owner_name`、`due_date`、`review_date`、`expected_metric`。

### 3.4 Query Quality Gate 债务

当前 query gate 已经用于痛点、竞品、内容、区域、概念，但 crisis 仍会对 blocked category 生成业务 alert。

修复：

- blocked category 的 crisis 输出只能是 `data_quality_alert`。
- 业务危机 alert 必须基于 query-pass 数据。

### 3.5 影响力指标债务

当前 reach、estimated views、engagement 没有进入评分。

修复：

- 新增 `fact_metric_availability`。
- insight score 加入字段覆盖率和 P95 influence。

### 3.6 外部业务反馈债务

没有交易型反馈数据，Play 9 和动作后复盘无法完成。

修复：

- 先用 CSV 模板接入，不等待 API。
- 定义 `external_feedback/` 输入规范，但默认忽略真实数据文件。

### 3.7 性能债务

当前 `build-marts` 全量重跑耗时较长，会重新 stage 34 万文档和 687 万关系行。

修复：

- 支持从已有 stage 或 persisted silver DB 构建 marts。
- 把 mart 构建拆成 `build-silver`、`build-marts-from-db`。
- 对品牌/topic 匹配做预归一化和批处理。

---

## 4. 下一轮执行计划

### Phase A：闭环骨架补齐

目标：让每条可行动洞察都有 `insight_id`、样本队列和 action。

任务：

1. 新增 `fact_insight`。
2. 新增 `fact_evidence_sample`。
3. 新增 `fact_sample_review`。
4. 让 pain、competitor、content、crisis、region、concept、executive 都输出 `insight_id`。
5. 动态生成 action register，不再只用 12 条静态种子。
6. 输出：
   - `insight_register.csv`
   - `sample_review_queue.csv`
   - `action_register.csv`

验收：

- 每个 `ready_for_action`/`ready_for_review` 洞察都有 `insight_id`。
- 每个 `ready_for_action` 洞察都有对应 `action_id`。
- 每个正式洞察至少有 20 条样本队列；不足则必须 `weak_signal`。
- `make quality` 通过。

### Phase B：Search Quality 真闭环

目标：把规则估算 precision 升级为人工抽样 precision，并能指导 query 修改。

任务：

1. 新增 `query_sample_review_queue.csv`。
2. 输出 `query_rewrite_recommendations.md`。
3. query recommendation 字段：
   - `must_include_terms`
   - `exclude_terms`
   - `watch_terms`
   - `sample_noise_examples`
   - `expected_precision_lift`
4. 修改 `mart_search_quality`，同时保存 rule precision 和 reviewed precision。
5. 为暖奶器、消毒器生成 query update action。

验收：

- 暖奶器和消毒器各有不少于 50 条复核样本队列。
- query rewrite recommendation 可直接交给 Meltwater 配置人员。
- reviewed precision 未达 80% 时，所有业务结论继续 blocked。

### Phase C：业务分析深水区

目标：让 Play 2-8 的报告从“表格”升级为“可决策卡片”。

任务：

1. 品类健康：
   - WoW、4-week baseline、top negative domains、top change drivers。
2. 痛点雷达：
   - `issue x channel x competitor x sentiment` 矩阵。
   - root cause / usage issue / product defect / service issue 初始分类。
3. 竞品：
   - `mart_brand_topic_cooccurrence`
   - `feature_claim_matrix.csv`
   - `objection_handling_sheet.md`
4. 内容：
   - source.name/domain/platform 级机会。
   - 用户原话 quote library。
   - content brief queue。
5. 危机：
   - 4-week baseline、topic spike、platform concentration、P95 influence。
6. 区域：
   - language topic profile。
   - top language sample queue。
7. 概念：
   - concept card，含正向偏好、负向问题、竞品方案、反证、测试建议。

验收：

- 每个 Play 至少输出 1 个可直接进入业务会议的 card/brief。
- 每个 card 有 `insight_id`、证据样本、readiness、owner_domain、recommended action。

### Phase D：客服与售后闭环

目标：真正跑通 Play 9。

任务：

1. 新增外部反馈输入模板：
   - `support_tickets.example.csv`
   - `return_reasons.example.csv`
   - `product_reviews.example.csv`
2. 新增 ingest 模块。
3. 新增 `mart_voc_cs_alignment`。
4. 输出：
   - `voc_to_cs_tag_mapping.csv`
   - `faq_update_queue.md`
   - `returns_reason_alignment.md`

验收：

- VOC top issue 能与客服/退货/review 至少一种外部数据对齐。
- FAQ/PDP/客服话术 action 有 baseline 和 review_date。

### Phase E：管理层闭环与生产化

目标：让 Play 10 能用于月会和复盘。

任务：

1. 新增 `executive_insight_digest.md`。
2. action register 加入 status metrics：
   - accepted rate
   - overdue rate
   - closed rate
   - measured impact count
3. 输出 decision log。
4. 优化性能：
   - persist silver DB
   - support incremental mart build
5. 增加 GitHub Actions 或本地 CI runbook。

验收：

- 月报包含 Top 5 insights、Top actions、overdue actions、next experiments。
- 全量 build 时间下降，或者支持从 persisted DB 重建 mart。
- 质量门禁保持通过。

---

## 5. 优先级

| 优先级 | 内容 | 原因 |
| --- | --- | --- |
| P0 | `fact_insight`、样本复核队列、动态 action register | 没有这三件事，所有 Play 都只是报告，不是闭环 |
| P0 | Search quality 人工复核和 query rewrite recommendation | 暖奶器/消毒器当前仍被阻断 |
| P1 | Pain/Competitor/Content 的可决策卡片 | 吸奶器是当前最可用业务场景 |
| P1 | Crisis baseline 和 query-gated alert | 当前 alert 误报风险高 |
| P2 | CS/returns/reviews 外部反馈 | Play 9 和动作后复盘依赖这些数据 |
| P2 | Executive monthly decision log | 管理层闭环依赖 action 状态和复盘指标 |
| P3 | 性能优化和生产调度 | 当前能跑，但全量重建成本较高 |

---

## 6. 建议立即执行的第一批任务

1. 实现 `fact_insight` 和 `insight_register.csv`。
2. 实现 `fact_evidence_sample` 和 `sample_review_queue.csv`。
3. 改造 action register：由 ready insights 自动生成 action。
4. 修复 crisis gate：blocked query category 只输出 data quality alert。
5. 为暖奶器和消毒器输出 `query_rewrite_recommendations.md`。
6. 补测试：insight/action/sample 三张表的主键、行数、状态门禁。
7. 运行 `make quality` 和 `make insights`。


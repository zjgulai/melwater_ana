# Playbook Remaining Closure Execution Plan

版本：2026-06-11  
来源审计：`docs/audits/2026-06-11-playbook-closure-gap-audit.md`  
目标：把当前“自动报告链”升级为真正的 `insight -> sample review -> action -> measurement -> learning` 业务闭环。

---

## Execution Log

- 2026-06-11: 第一轮 P0 已执行。本次新增 `fact_insight`、`fact_evidence_sample`、`fact_sample_review`、`fact_query_sample_review`、`mart_query_rewrite_recommendation`，输出 `insight_register.csv`、`sample_review_queue.csv`、`query_sample_review_queue.csv`、`query_rewrite_recommendations.md`，并将 action register 从静态 seed 改为基于 insight 动态生成。crisis watch 已接入 query quality gate：query-blocked 品类输出 `data_quality_alert`，不再输出业务 red/orange/yellow alert。
- 2026-06-11: 第二轮 P0 已执行。本次新增 action feedback overlay：`--action-feedback` 支持 CSV/JSON 回写 `owner_name`、`status`、`shipped_at`、`actual_metric`、`close_reason` 等字段；新增 `mart_action_status_summary`、`fact_action_feedback_unmatched`，输出 `action_status_summary.csv`、`action_feedback_unmatched.csv`、`action_closed_loop_summary.md`，并补充 `docs/runbooks/action-feedback-loop.md`。
- 2026-06-11: 第三轮 P1 已执行。本次新增 `mart_category_health_weekly_delta`、`mart_issue_channel_competitor_matrix`、`mart_platform_content_opportunity`、`mart_user_voice_quote_library`，输出 `weekly_change_points.md`、`product_pain_deep_dive.md`、`content_brief_queue.md`、`user_voice_quote_library.csv`，把品类健康、痛点和内容机会升级为可决策卡片；同时新增 `build-marts-from-stage` / `make insights-from-stage`，用于只重建 mart/report，降低后续 playbook 迭代成本。

---

## Goal

完成 playbook 未闭环部分的工程化落地：

- 每条关键洞察有稳定 `insight_id`。
- 每条正式洞察有样本复核队列。
- 每条可行动洞察有动态 `action_id`。
- 每条 action 有 owner、due date、review date、expected metric。
- query 噪声、危机预警、客服售后、管理层月报都进入可复盘闭环。

---

## Non-Goals

- 不把原始 JSON、Excel、SQLite 产物提交到 Git。
- 不直接把 Meltwater 社媒声量解释为销量、市场份额或真实投诉率。
- 不在缺少外部客服/退货/review 数据时声称 Play 9 已完成。
- 不绕过 query quality gate 输出暖奶器/消毒器业务结论。

---

## Phase A：Insight / Sample / Action 主干

优先级：P0  
目标：所有 Play 的后续闭环都依赖这一层。

### Task A1：新增核心闭环表

修改：

- `src/meltwater_excel/marts.py`

新增表：

- `fact_insight`
- `fact_evidence_sample`
- `fact_sample_review`

建议字段：

`fact_insight`

- `insight_id`
- `play_id`
- `category`
- `entity_type`
- `entity_id`
- `period`
- `readiness`
- `priority_score`
- `confidence_score`
- `source_table`
- `source_key_json`
- `recommended_action_type`
- `owner_domain`
- `created_at`

`fact_evidence_sample`

- `sample_id`
- `insight_id`
- `occurrence_id`
- `document_id`
- `evidence_text`
- `url`
- `sentiment`
- `sample_rank`
- `sample_reason`

`fact_sample_review`

- `sample_id`
- `review_status`
- `sample_verdict`
- `noise_reason`
- `business_relevance`
- `reviewer`
- `reviewed_at`

验收：

- `fact_insight.insight_id` 唯一。
- `ready_for_action`/`ready_for_review` 的 mart 行必须生成 insight。
- 每个正式 insight 至少生成样本队列；不足则降级为 `weak_signal`。

### Task A2：动态 Action Register

修改：

- `src/meltwater_excel/marts.py`
- `config/insights/action_owners.example.json`

新增逻辑：

- 不再只写 12 条静态 seed action。
- 对 `ready_for_action` 洞察自动生成 action。
- 对 `blocked_by_query_noise` 生成 `query_update` 或 `data_quality_triage` action。
- 对 crisis 非 green 且 query pass 的 alert 生成 `pr_triage`/`cs_triage` action。

字段要求：

- `insight_id`
- `action_id`
- `owner_domain`
- `status`
- `expected_metric`
- `due_date`
- `review_date`

验收：

- `fact_action_register.insight_id` 非空比例 ≥ 80%。
- 每个 `ready_for_action` insight 至少 1 条 action。
- action 状态只允许：`Proposed`、`Accepted`、`In Progress`、`Shipped`、`Measured`、`Closed`、`Rejected`。

### Task A3：输出闭环队列文件

新增输出：

- `insight_register.csv`
- `sample_review_queue.csv`
- `action_register.csv`

更新：

- `docs/runbooks/voc-insight-automation.md`
- `data/marts/YYYYMMDD/mart_manifest.json`

测试：

- `tests/test_marts.py`
- 可新增 `tests/test_insight_closure.py`

验收命令：

```bash
uv run --python 3.12 --group dev pytest tests/test_marts.py -q
make quality
```

---

## Phase B：Search Quality 真闭环

优先级：P0  
目标：暖奶器和消毒器不能永远停留在 query blocked；必须进入 query 修复、复测、再分析。

### Task B1：人工复核样本队列

新增表：

- `fact_query_sample`
- `fact_query_sample_review`

新增输出：

- `query_sample_review_queue.csv`

规则：

- 每个 blocked/review search 抽样至少 50 条。
- 抽样需覆盖高频噪声词、随机样本和高影响力样本。

验收：

- 暖奶器 `Bottle Warmer` 至少 50 条样本。
- 消毒器 `Bottle Sterilizer & Dryer` 至少 50 条样本。

### Task B2：query rewrite recommendation

新增表：

- `mart_query_rewrite_recommendation`

新增输出：

- `query_rewrite_recommendations.md`

字段：

- `category`
- `search_name`
- `current_precision`
- `top_noise_terms`
- `must_include_terms`
- `exclude_terms`
- `watch_terms`
- `sample_noise_examples`
- `expected_precision_lift`

验收：

- 暖奶器输出必须包含 `bear`、`warm home`、`bitter cold` 类排除建议。
- 消毒器输出必须包含 `bear` 相关误召回建议。

### Task B3：危机预警接入 query gate

修改：

- `mart_crisis_watch_daily`

规则：

- query blocked category 只能生成 `data_quality_alert`。
- query pass category 才能生成业务 `yellow/orange/red`。

验收：

- 暖奶器/消毒器不再出现业务 red/orange/yellow alert。
- 对这些品类改出 `data_quality_alert`。

---

## Phase C：Play 2-8 深水区卡片化

优先级：P1  
目标：从“表格”升级为“可决策卡片”。

### Task C1：品类健康变化点

新增：

- `mart_category_health_weekly_delta`
- `weekly_change_points.md`

指标：

- WoW volume change
- WoW negative rate change
- 4-week baseline
- top source domains
- top negative domains

验收：

- 每周至少输出 3 个变化点或明确说明样本不足。

### Task C2：痛点深挖矩阵

新增：

- `mart_issue_channel_competitor_matrix`
- `product_pain_deep_dive.md`

维度：

- issue
- category
- channel/source_type
- brand/competitor
- sentiment
- sample verdict

验收：

- 吸奶器至少输出 Top 10 issue matrix。
- 每个 ready issue 有 Product/CX/Content 推荐动作。

### Task C3：竞品可行动产物

新增：

- `mart_brand_topic_cooccurrence`
- `feature_claim_matrix.csv`
- `objection_handling_sheet.md`

验收：

- Momcozy、Elvie、Willow、Medela、Spectra、Eufy 均有样本量、主要正向主题、主要负向主题。
- 低样本或疑似误召回自动标弱信号。

### Task C4：内容 brief 队列

新增：

- `mart_user_voice_quotes`
- `mart_platform_content_opportunity`
- `content_brief_queue.md`
- `user_voice_quote_library.csv`

验收：

- 每周至少 10 条用户原话候选。
- 每月至少 3 个内容选题 action。

### Task C5：区域语言 topic profile

新增：

- `mart_language_topic_profile`
- `language_sample_review_queue.csv`

验收：

- top language 每个至少 30 条样本队列。
- `country_known=0` 的输出不得进入地域市场结论。

### Task C6：概念卡

新增：

- `concept_cards.md`

结构：

- 用户问题
- 正向偏好
- 负向痛点
- 竞品/替代方案
- 反证
- 测试建议
- owner_domain

验收：

- 吸奶器 ready concepts 至少 5 张概念卡。

---

## Phase D：客服与售后闭环

优先级：P2  
目标：跑通 Play 9。

### Task D1：外部反馈 schema

新增：

- `docs/runbooks/external-feedback-ingestion.md`
- `config/external_feedback.example.json`
- `tests/fixtures/support_tickets_fixture.csv`
- `tests/fixtures/return_reasons_fixture.csv`
- `tests/fixtures/product_reviews_fixture.csv`

默认忽略真实输入：

- `external_feedback/`

### Task D2：外部反馈 ingest

新增：

- `src/meltwater_excel/external_feedback.py`

输入：

- support tickets
- return reasons
- product reviews

输出表：

- `fact_support_ticket`
- `fact_return_reason`
- `fact_product_review`

### Task D3：VOC-CS alignment

新增：

- `mart_voc_cs_alignment`
- `voc_to_cs_tag_mapping.csv`
- `faq_update_queue.md`
- `returns_reason_alignment.md`

验收：

- 至少一个 VOC issue 能与 support/return/review fixture 对齐。
- action register 能生成 FAQ/PDP/CS macro 更新 action。

---

## Phase E：管理层月报和生产化

优先级：P2/P3  
目标：从分析系统变成管理节奏。

### Task E1：Executive digest

新增：

- `executive_insight_digest.md`
- `decision_log.csv`

内容：

- Top 5 insights
- blocked data quality risks
- action status summary
- overdue actions
- measured impact
- next experiments

验收：

- 月报不再只是月度聚合表。
- 每条 Top insight 有 action 或 blocked reason。

### Task E2：性能优化

新增命令：

- `build-silver`
- `build-marts-from-db`

目标：

- 支持复用 persisted SQLite。
- 避免每次 `make insights` 都重新 stage 原始 JSON。

验收：

- 从 persisted DB 重建 mart 成功。
- 文档说明何时 full rebuild，何时 mart-only rebuild。

### Task E3：生产调度

新增：

- GitHub Actions 或本地 CI runbook。
- 腾讯云生产调度方案。

验收：

- `make quality` 作为 CI 门禁。
- data freshness、build status、report status 可观测。

---

## 第一轮执行顺序

建议先执行 Phase A + Phase B3：

1. 新增 `fact_insight`。
2. 新增 `fact_evidence_sample`。
3. 动态 action register。
4. 输出 `insight_register.csv` 和 `sample_review_queue.csv`。
5. 修复 crisis query gate。
6. 补测试。
7. `make quality`。
8. `make insights`。
9. commit + push。

原因：这会让所有现有 mart 立刻从“报告”升级为“闭环候选”，并修掉当前最大误报风险。

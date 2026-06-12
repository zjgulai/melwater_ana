# VOC Insight Automation Runbook

版本：2026-06-11  
适用范围：从 Meltwater 原始 JSON 来源配置生成 VOC insight mart、搜索质量报告、产品痛点卡、周报和初始 action register。

---

## 1. 输入

默认输入：

- 来源配置：`config/excel_export_sources.json`
- 洞察配置目录：`config/insights/`
- 原始 JSON：由来源配置中的 `sources[].path` 指定

洞察配置：

- `topic_taxonomy.json`：产品问题/痛点主题词表
- `brand_taxonomy.json`：品牌、竞品、别名和 search ID
- `query_noise_rules.json`：噪声词、排除语境和观察词
- `insight_thresholds.json`：precision、样本量和弱信号阈值
- `action_owners.example.json`：业务 owner 域模板
- `action_feedback.example.csv`：action 状态回写模板

---

## 2. 生成 P0 洞察产物

默认输出目录：

```bash
make insights
```

等价命令：

```bash
uv run --python 3.12 python -m meltwater_excel.cli build-marts \
  --config config/excel_export_sources.json \
  --output-dir data/marts/20260611
```

自定义输出：

```bash
uv run --python 3.12 python -m meltwater_excel.cli build-marts \
  --config config/excel_export_sources.json \
  --output-dir data/marts/YYYYMMDD_custom \
  --insights-config-dir config/insights
```

带 action 回写重跑：

```bash
uv run --python 3.12 python -m meltwater_excel.cli build-marts \
  --config config/excel_export_sources.json \
  --output-dir data/marts/YYYYMMDD_with_feedback \
  --insights-config-dir config/insights \
  --action-feedback path/to/action_feedback.csv
```

或：

```bash
make insights INSIGHTS_OUTPUT_DIR=data/marts/YYYYMMDD_with_feedback \
  INSIGHTS_ACTION_FEEDBACK=path/to/action_feedback.csv
```

注意：`build-marts` 不覆盖已存在目录；如果需要重跑，请先换一个输出目录或备份旧目录。

复用已构建 stage DB 只重建 mart/report：

```bash
uv run --python 3.12 python -m meltwater_excel.cli build-marts-from-stage \
  --config config/excel_export_sources.json \
  --stage-db path/to/stage.sqlite \
  --output-dir data/marts/YYYYMMDD_mart_only \
  --insights-config-dir config/insights
```

或：

```bash
make insights-from-stage STAGE_DB=path/to/stage.sqlite \
  INSIGHTS_OUTPUT_DIR=data/marts/YYYYMMDD_mart_only
```

使用规则：

- 原始 JSON、source 配置、canonical 逻辑变化时，用 `build-marts` full rebuild。
- 只调整 topic/brand/query/action/report 逻辑时，可用 `build-marts-from-stage` mart-only rebuild。

---

## 3. 输出

成功后输出目录包含：

| 文件 | 用途 |
| --- | --- |
| `voc_mart.sqlite` | P0 insight mart 数据库 |
| `mart_manifest.json` | 输入、taxonomy version、输出表行数 |
| `source_inventory.json` | 来源文件、sha256、文档数 |
| `search_precision_report.md` | query precision、噪声行、是否阻断 |
| `query_rewrite_recommendations.md` | query 修改建议、必含词、排除词、观察词 |
| `pain_point_cards.md` | 产品痛点卡 Markdown |
| `pain_point_cards.csv` | 产品痛点卡结构化版本 |
| `weekly_voc_brief.md` | 周度 VOC brief |
| `weekly_change_points.md` | 品类周度声量/负面率变化点 |
| `competitor_battlecards.md` | 竞品 Battlecard |
| `product_pain_deep_dive.md` | 痛点 × 渠道 × 品牌/竞品深挖矩阵 |
| `content_opportunities.md` | 内容与种草机会 |
| `content_brief_queue.md` | 可转化为 PDP/FAQ/短视频/社媒的内容 brief 队列 |
| `user_voice_quote_library.csv` | 用户原话候选库 |
| `crisis_watch_daily.md` | 危机与异常日预警 |
| `region_language_priority.md` | 区域与语言优先级 |
| `concept_candidates.md` | 产品共创概念候选 |
| `executive_monthly_brief.md` | 管理层月度洞察会入口 |
| `insight_register.csv` | 稳定 insight_id 和 readiness 注册表 |
| `sample_review_queue.csv` | 洞察证据样本人工复核队列 |
| `query_sample_review_queue.csv` | query precision 人工复核队列 |
| `action_register.csv` | 动态动作闭环登记，支持 action feedback 覆盖 |
| `action_status_summary.csv` | owner/status 维度闭环状态汇总 |
| `action_feedback_unmatched.csv` | 回写文件中未匹配到自动 action 的审计行 |
| `action_closed_loop_summary.md` | action 闭环率、逾期、状态分布摘要 |

当前核心 mart 表：

- `mart_search_quality`
- `mart_product_pain_radar`
- `mart_category_health_weekly`
- `mart_category_health_weekly_delta`
- `mart_competitor_battlecard`
- `mart_content_opportunity`
- `mart_issue_channel_competitor_matrix`
- `mart_platform_content_opportunity`
- `mart_user_voice_quote_library`
- `mart_crisis_watch_daily`
- `mart_region_language_priority`
- `mart_concept_candidates`
- `mart_executive_monthly`
- `mart_query_rewrite_recommendation`
- `fact_insight`
- `fact_evidence_sample`
- `fact_sample_review`
- `fact_query_sample_review`
- `fact_action_register`
- `mart_action_status_summary`
- `fact_action_feedback_unmatched`

---

## 4. 质量门禁

完整质量验证：

```bash
make quality
```

包含：

- pytest
- Excel package validate
- checksum
- ruff lint
- mypy
- bandit

当前环境中 ruff 直接读取路径会对任意文件报 `E902 stream did not contain valid UTF-8`，但 stdin 模式正常。因此 `make lint` 使用 `scripts/run_ruff_stdin.py` 逐个文件以 `--stdin-filename` 方式执行 ruff，仍保留 ruff 检查本身。

---

## 5. 业务解释规则

搜索质量是上游门禁：

- `blocked_by_query_noise`：不得输出确定性业务结论，只能进入 query 治理动作。
- `weak_signal`：样本量不足，只能作为观察项。
- `pass`：可进入后续洞察分析。

产品痛点卡的 `readiness`：

- `blocked_by_query_noise`：该品类搜索质量未达标，痛点仅作线索。
- `weak_signal`：样本不足。
- `ready_for_review`：可以进入业务复核。
- `ready_for_action`：可以进入 action register。

当前 2026-06-11 全量结果中，暖奶器和消毒器被 query quality gate 阻断；吸奶器痛点雷达可作为 P0 可行动用例。

其他 playbook 分支同样继承 query quality gate：

- 竞品 Battlecard：样本不足或 query 阻断时不可解释为市场份额。
- 周度变化点：只表示 Meltwater 声量/负面率变化，不代表销量变化。
- 痛点深挖矩阵：把 issue 拆到 source_type 和 brand/competitor，用作复核入口，不直接等同产品缺陷率。
- 内容机会：只把 `ready_for_review` 或更高状态进入内容 brief；用户原话需人工复核后再用于外部素材。
- 危机预警：非 green 事件应进入 PR/CX triage。
- 区域语言：`country_known=no` 只能做语言线索，不能直接做地域市场结论。
- 概念候选：必须再接入 review、客服、退货等交易型反馈验证。
- 管理层月报：优先展示质量阻断、可行动洞察和 action closed-loop 状态。

闭环解释：

- 每个可进入复核的发现会生成 `insight_id`。
- 有证据样本的 insight 会进入 `sample_review_queue.csv`。
- 被 query gate 阻断或需要人工复核的 search 会进入 `query_sample_review_queue.csv`。
- 可行动 insight 会自动生成 `action_id`，并填入默认 `due_date` 和 `review_date`。
- 业务可通过 `--action-feedback` 回写 `owner_name`、`status`、`shipped_at`、`actual_metric`、`close_reason` 等生命周期字段。
- 回写状态只允许：`Proposed`、`Accepted`、`In Progress`、`Shipped`、`Measured`、`Closed`、`Rejected`。
- 暖奶器/消毒器的 crisis 输出被降级为 `data_quality_alert`，不作为业务危机结论。

---

## 6. 快速检查命令

查看 manifest：

```bash
cat data/marts/20260611/mart_manifest.json
```

查看表行数：

```bash
uv run --python 3.12 python - <<'PY'
import sqlite3
with sqlite3.connect("data/marts/20260611/voc_mart.sqlite") as db:
    for table in [
        "mart_search_quality",
        "mart_product_pain_radar",
        "mart_category_health_weekly",
        "mart_category_health_weekly_delta",
        "mart_competitor_battlecard",
        "mart_content_opportunity",
        "mart_issue_channel_competitor_matrix",
        "mart_platform_content_opportunity",
        "mart_user_voice_quote_library",
        "mart_crisis_watch_daily",
        "mart_region_language_priority",
        "mart_concept_candidates",
        "mart_executive_monthly",
        "mart_query_rewrite_recommendation",
        "fact_insight",
        "fact_evidence_sample",
        "fact_sample_review",
        "fact_query_sample_review",
        "fact_action_register",
        "mart_action_status_summary",
        "fact_action_feedback_unmatched",
    ]:
        print(table, db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])
PY
```

查看被 query gate 阻断的痛点：

```bash
uv run --python 3.12 python - <<'PY'
import sqlite3
with sqlite3.connect("data/marts/20260611/voc_mart.sqlite") as db:
    for row in db.execute("""
        SELECT category, COUNT(*)
        FROM mart_product_pain_radar
        WHERE readiness = 'blocked_by_query_noise'
        GROUP BY category
        ORDER BY category
    """):
        print(row)
PY
```

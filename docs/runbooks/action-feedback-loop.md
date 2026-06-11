# Action Feedback Loop Runbook

版本：2026-06-11

目标：把自动生成的 `action_register.csv` 推进到可运营闭环，即 `action_id -> owner -> status -> shipped_at -> actual_metric -> close_reason`。

---

## 1. 回写文件

从最新 mart 输出复制 `action_register.csv`，保留 `action_id` 和 `insight_id`，填写以下字段：

| 字段 | 说明 |
| --- | --- |
| `action_id` | 必填，来自自动生成的 action |
| `insight_id` | 可选校验字段；填写后必须与自动 action 匹配 |
| `owner_domain` | 可覆盖团队域 |
| `owner_name` | 具体负责人或团队 alias |
| `status` | `Proposed`、`Accepted`、`In Progress`、`Shipped`、`Measured`、`Closed`、`Rejected` |
| `expected_metric` | 可覆盖原默认成功指标 |
| `baseline_value` | 行动前基线 |
| `target_value` | 目标值 |
| `due_date` | 动作截止日期，ISO 日期 |
| `shipped_at` | 动作完成或上线日期 |
| `review_date` | 复盘日期 |
| `actual_metric` | 复盘实际结果 |
| `close_reason` | 关闭、拒绝或继续观察原因 |

模板：`config/insights/action_feedback.example.csv`

---

## 2. 构建命令

```bash
uv run --python 3.12 python -m meltwater_excel.cli build-marts \
  --config config/excel_export_sources.json \
  --output-dir data/marts/YYYYMMDD_with_feedback \
  --insights-config-dir config/insights \
  --action-feedback path/to/action_feedback.csv
```

Makefile 写法：

```bash
make insights INSIGHTS_OUTPUT_DIR=data/marts/YYYYMMDD_with_feedback \
  INSIGHTS_ACTION_FEEDBACK=path/to/action_feedback.csv
```

---

## 3. 验收

构建后检查：

- `action_register.csv`：最终合并后的 action 明细。
- `action_status_summary.csv`：按 owner/status 汇总 action、逾期、7 天内到期、已复盘和已关闭数量。
- `action_closed_loop_summary.md`：管理层可读的闭环摘要。
- `action_feedback_unmatched.csv`：回写文件中没有匹配到自动 action 的行。
- `mart_manifest.json`：
  - `action_feedback_applied`
  - `fact_action_feedback_unmatched`
  - `mart_action_status_summary`

SQLite 快速检查：

```bash
sqlite3 data/marts/YYYYMMDD_with_feedback/voc_mart.sqlite \
  "SELECT status, COUNT(*) FROM fact_action_register GROUP BY status;"
```

```bash
sqlite3 data/marts/YYYYMMDD_with_feedback/voc_mart.sqlite \
  "SELECT owner_domain, owner_name, status, action_count, overdue_count FROM mart_action_status_summary;"
```

---

## 4. 运营规则

- `Accepted`：owner 已确认接手。
- `In Progress`：动作正在执行。
- `Shipped`：动作已上线或已交付，但还未复盘。
- `Measured`：已记录 `actual_metric`。
- `Closed`：有明确关闭原因，进入月度复盘。
- `Rejected`：不执行，必须写 `close_reason`。

不建议直接删除 action。若业务判断不做，应标记 `Rejected` 并写明原因，这样月报能保留学习记录。

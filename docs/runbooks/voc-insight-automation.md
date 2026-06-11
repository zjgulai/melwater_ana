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

注意：`build-marts` 不覆盖已存在目录；如果需要重跑，请先换一个输出目录或备份旧目录。

---

## 3. 输出

成功后输出目录包含：

| 文件 | 用途 |
| --- | --- |
| `voc_mart.sqlite` | P0 insight mart 数据库 |
| `mart_manifest.json` | 输入、taxonomy version、输出表行数 |
| `source_inventory.json` | 来源文件、sha256、文档数 |
| `search_precision_report.md` | query precision、噪声行、是否阻断 |
| `pain_point_cards.md` | 产品痛点卡 Markdown |
| `pain_point_cards.csv` | 产品痛点卡结构化版本 |
| `weekly_voc_brief.md` | 周度 VOC brief |
| `action_register.csv` | 初始动作闭环登记 |

当前核心 mart 表：

- `mart_search_quality`
- `mart_product_pain_radar`
- `mart_category_health_weekly`
- `fact_action_register`

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
        "fact_action_register",
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


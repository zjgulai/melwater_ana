# Meltwater 完整 JSON 到 Excel Runbook

## 1. 用途

将配置中的 Meltwater 原始 Export JSON 转为无损、可追溯的关系型 Excel 数据包。原始 JSON 始终只读。

## 2. 环境

```bash
cd /Users/lute/project/Agent/product/data_achieve/meltwater
uv run --python 3.12 pytest -q
```

依赖由 `pyproject.toml` 管理：

- Python 3.12
- ijson
- openpyxl
- pytest

## 3. 来源配置

配置文件：

`config/excel_export_sources.json`

每个来源必须定义：

- `alias`
- `category`
- `path`
- `export_id`
- `request_start`
- `request_end`
- `expected_documents`

新增来源前先确认：

- 文件位于项目目录内。
- 文件后缀为 `.json`。
- `expected_documents` 与 Export request count 一致。
- 新字段已纳入 `src/meltwater_excel/schema.py`；未知字段会 fail-closed。

## 4. 全量构建

目标目录必须不存在，避免覆盖已验收数据包。

```bash
uv run --python 3.12 python scripts/json_to_complete_excel.py build-all \
  --config config/excel_export_sources.json \
  --output-dir data/excel_complete_20260604
```

流程：

1. 扫描 6 个来源并生成 SHA-256 来源清单。
2. 使用 `ijson` 流式写入受限临时 SQLite。
3. 生成 canonical document、品类关系和标量变体。
4. 使用 write-only XLSX writer 生成核心和关系工作簿。
5. 生成目录与校验工作簿。
6. 执行完整验收。
7. 只有全部验收通过后，将临时目录原子移动到目标目录。

构建失败时，不会创建最终目录；诊断产物保留在 `data/.excel_complete_*.failed-*`。

## 5. 分阶段命令

### 来源清单

```bash
uv run --python 3.12 python -m meltwater_excel.cli inventory \
  --config config/excel_export_sources.json \
  --output /tmp/meltwater_source_inventory.json
```

### Staging 与 canonical

```bash
uv run --python 3.12 python -m meltwater_excel.cli stage \
  --config config/excel_export_sources.json \
  --db /tmp/meltwater_complete_stage.sqlite
```

### Staging 汇总

```bash
uv run --python 3.12 python -m meltwater_excel.cli summarize \
  --db /tmp/meltwater_complete_stage.sqlite \
  --output /tmp/meltwater_stage_summary.json
```

### 核心工作簿

```bash
uv run --python 3.12 python -m meltwater_excel.cli build-core \
  --db /tmp/meltwater_complete_stage.sqlite \
  --output /tmp/Meltwater_VOC_01_核心主表.xlsx
```

### 关系工作簿

```bash
uv run --python 3.12 python -m meltwater_excel.cli build-relations \
  --db /tmp/meltwater_complete_stage.sqlite \
  --output-dir /tmp/meltwater_complete_excel
```

## 6. 验收

对最终数据包执行独立验证：

```bash
uv run --python 3.12 python -m meltwater_excel.cli validate \
  --config config/excel_export_sources.json \
  --output-dir data/excel_complete_20260604
```

随机回源抽检：

```bash
uv run --python 3.12 python -m meltwater_excel.cli sample-audit \
  --config config/excel_export_sources.json \
  --output-dir data/excel_complete_20260604 \
  --samples-per-source 20 \
  --seed 20260604 \
  --output docs/audits/2026-06-04-json-to-excel-sample-audit.json
```

`validate` 必须返回：

```json
{"status": "PASS"}
```

## 7. 数据使用

- 唯一文档分析使用核心主表 `Mentions`。
- 回溯某个来源版本使用 `Occurrences`。
- 比较重复文档的字段变化使用 `Scalar_Variants`。
- 超长文本使用 `Long_Text_Chunks` 按 `chunk_ordinal` 拼接。
- 数组关系使用 `occurrence_id` 回连；必须保留 `ordinal`，不能按值去重。
- 跨品类文档使用 `Mentions.categories` 或品类 occurrence 进行分析。
- 高精度字段优先使用 raw 文本；分析计算可使用对应 `__number` 列。

## 8. 安全与限制

- 不修改原始 JSON。
- 不把 `manifest.json`、`validation.json` 或历史 Excel 当成 Mention 来源。
- 不为已知 API 缺口伪造数据。
- 外部文本按纯文本安全写入；读取以 `'= + - @` 开头的值时，需要理解首个单引号是 Excel 安全转义。
- 每个数据 sheet 最多 750,000 条数据行。
- 输出目录权限为 `0700`，输出文件权限为 `0600`。


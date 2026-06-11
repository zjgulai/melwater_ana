# Meltwater Complete JSON to Excel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development while implementing each task and superpowers:verification-before-completion before reporting completion.

**Goal:** 将现有 6 份 Meltwater 原始 Export JSON 全量、可追溯、无重要字段遗漏地解析为一组互相关联的 Excel 工作簿，并用可重复执行的自动化校验证明数据完整性。

**Architecture:** 原始 JSON 保持只读；使用 `ijson` 流式读取到临时 SQLite staging，保留每次原始出现及数组原始序号；从 staging 生成 canonical 主表、标量变体表和分片关系表；最后生成目录与校验工作簿及机器可读验收清单。大型数据工作簿使用 `openpyxl.Workbook(write_only=True)` 流式写入，目录、小样和视觉验收使用 `@oai/artifact-tool`。

**Tech Stack:** Python 3.12、`uv`、`ijson`、SQLite、`openpyxl` write-only、`@oai/artifact-tool`、pytest、标准库 `hashlib/json/decimal/datetime/pathlib/stat`

---

## 0. 执行门槛与不可变输入

**执行前决策**

- 由于目标关系行超过 686 万，且单个工作簿需要多 sheet 分片，实施必须允许大型数据工作簿采用 `openpyxl` write-only 流式写入。
- `@oai/artifact-tool` 用于目录工作簿、小样渲染和视觉验收，不用于承载数百万行的主写入流程。
- 本计划获确认前，不生成目标 Excel。

**输入边界**

只读取下列 6 份原始 Export JSON：

1. `exports_20260520/warmer_3months.json`
2. `data/exports/round_20260604_backfill_20260101_20260221/暖奶器_batch1_17774638_20260101_20260221.json`
3. `exports_20260520/pump_core_3months.json`
4. `exports_20260520/pump_secondary_3months.json`
5. `data/exports/round_20260604_backfill_20260101_20260221/吸奶器_batch1_17774723_20260101_20260221.json`
6. `exports_20260520/sterilizer_3months.json`

不把 `manifest.json`、`validation.json`、配置 JSON 或历史 Excel 当作原始 Mention 数据。

**已知基线**

- 原始出现记录：346,891
- 全局唯一 `document.id`：336,288
- 数组关系行：6,865,075
- 已知未获取缺口：搜索 `28546470`、`28546475` 在 `[2026-01-01, 2026-02-20)`，估计 255 次搜索命中

**不可变要求**

- 原始 JSON 在转换前后 SHA-256 必须一致。
- 输出不得伪造已知缺口数据。
- 所有输出文件权限设为 `0600`，输出目录权限设为 `0700`。
- 当前目录不是 Git 仓库；若实施阶段需要提交历史，先经用户确认后初始化 Git。

## 1. 目标数据包

输出目录：

`data/excel_complete_20260604/`

输出文件：

1. `Meltwater_VOC_00_目录与校验.xlsx`
2. `Meltwater_VOC_01_核心主表.xlsx`
3. `Meltwater_VOC_02_内容数组.xlsx`
4. `Meltwater_VOC_03_关键词.xlsx`
5. `Meltwater_VOC_04_命名实体.xlsx`
6. `Meltwater_VOC_05_命中关系.xlsx`
7. `validation_manifest.json`
8. `source_inventory.json`

关联键：

- `document_id`：全局 Mention 标识，所有 Excel 中始终按文本写入。
- `occurrence_id`：一次原始 JSON 出现记录的稳定标识，格式为 `source_alias:zero_based_document_index`。
- `field_path + ordinal`：数组元素的原始字段路径与零基序号，保留顺序和重复元素。

## 2. 无损建模规则

### 2.1 Canonical Mention

每个 `document.id` 在 `Mentions` 中只保留一个 canonical occurrence：

1. `indexed_date` 最大者优先。
2. 相同 `indexed_date` 时，Export 请求结束时间较晚者优先。
3. 仍相同时，按 source alias 字典序选择，保证重复运行结果稳定。

### 2.2 原始出现与变体

- 346,891 次原始出现全部进入 `Occurrences`。
- 多源文档的每一个不同标量值全部进入 `Scalar_Variants`。
- 完全相同的重复出现仍保留在 `Occurrences`，但不制造无差异的 variant 行。
- 跨品类文档在 `Mentions` 中保留完整品类列表，并在 `Occurrences` 中保留每次来源品类。

### 2.3 数组与状态

- 所有数组按 occurrence 展开，保留重复元素和原始序号。
- 字段缺失、显式 `null`、空数组、非空数组必须可区分。
- `Occurrences` 保存 `missing_field_paths`、`null_field_paths`，并为每个数组保存状态和元素数。

### 2.4 Excel 安全规则

- 所有外部文本按纯文本写入；以 `= + - @` 开头的值在 Excel 层安全转义，原始语义仍可恢复。
- 目标数据工作簿公式节点数必须为 0。
- 所有 ID 和 external ID 按文本写入。
- `published_date`、`indexed_date` 同时输出原始 ISO 文本和 Excel UTC datetime。
- `location.geo.latitude`、`location.geo.longitude`、`metrics.earned_media_value`、`source.metrics.ave` 同时输出 `*_raw` 精确文本和 `*_number` 分析数值。
- 超过 32,767 字符的文本使用 `Long_Text_Chunks` 每段最多 30,000 字符无损保存；主表保存安全预览、原长度和 chunk 数。
- 每个数据 sheet 最多写入 750,000 条数据行，连同表头最多 750,001 行。

## 3. 目标工作簿与预期行数

### `Meltwater_VOC_00_目录与校验.xlsx`

- `README`
- `Sources`：6 行
- `Field_Dictionary`：覆盖全部 82 个标量叶路径、9 个非空数组路径和 17 个对象路径
- `Coverage_Checks`
- `Category_Summary`
- `Known_Gaps`：明确记录 2 个缺失搜索和 255 次估计命中
- `Output_Inventory`

### `Meltwater_VOC_01_核心主表.xlsx`

- `Mentions`：336,288 行
- `Occurrences`：346,891 行
- `Scalar_Variants`：由实际差异展开，验收时必须覆盖全部差异字段和值
- `Long_Text_Chunks`：35 行

### `Meltwater_VOC_02_内容数组.xlsx`

- `Emojis`：213,375 行
- `Hashtags`：670,772 行
- `Links`：332,991 行
- `Mentions`：62,408 行
- `Outlet_Types`：114,082 行

### `Meltwater_VOC_03_关键词.xlsx`

- `Keyphrases_001`：750,000 行
- `Keyphrases_002`：750,000 行
- `Keyphrases_003`：548,857 行

### `Meltwater_VOC_04_命名实体.xlsx`

- `Named_Entities_001`：750,000 行
- `Named_Entities_002`：750,000 行
- `Named_Entities_003`：594,008 行

### `Meltwater_VOC_05_命中关系.xlsx`

- `Matched_Inputs`：355,657 行
- `Matched_Keywords_001`：750,000 行
- `Matched_Keywords_002`：222,925 行

## 4. 实施任务

### Task 1: 建立可重复执行环境和测试骨架

**Files**

- Create: `pyproject.toml`
- Create: `src/meltwater_excel/__init__.py`
- Create: `tests/conftest.py`
- Create: `tests/fixtures/complete_export_fixture.json`
- Create: `tests/test_environment.py`

**Fixture 必须包含**

- 同一 `document.id` 的完全相同重复记录。
- 同一 `document.id` 的 `matched`、`content`、`metrics` 标量或数组差异。
- 跨品类 document。
- 缺失字段、显式 null、空数组、非空数组。
- 单个数组内重复元素。
- 以 `= + - @` 开头的文本。
- 超过 32,767 字符的标题。
- 超过 Excel 15 位有效数字的小数。
- UTC 日期与毫秒日期。

**Implementation**

- 使用 `uv` 锁定 Python 3.12、`ijson`、`openpyxl`、pytest。
- 把核心代码放入 `src/meltwater_excel`，脚本仅作为 CLI wrapper。
- 禁止测试读取真实 2.5 GB 临时探查数据库；单元测试只使用小型 fixture。

**Verification**

Run:

```bash
uv run pytest tests/test_environment.py -q
```

Expected:

```text
1 passed
```

### Task 2: 固化来源清单、路径和 SHA-256

**Files**

- Create: `config/excel_export_sources.json`
- Create: `src/meltwater_excel/inventory.py`
- Create: `tests/test_inventory.py`

**Implementation**

- 在配置中保存 6 个 source alias、品类、相对路径、Export ID、请求开始和结束时间。
- 读取前验证路径位于项目目录内并且后缀为 `.json`。
- 计算文件大小、mtime、SHA-256 和文档数。
- 在开始和结束阶段重复计算 SHA-256。
- 输出 `source_inventory.json`。

**Verification**

Run:

```bash
uv run pytest tests/test_inventory.py -q
uv run python -m meltwater_excel.cli inventory --config config/excel_export_sources.json --output /tmp/meltwater_source_inventory.json
```

Expected:

- 精确识别 6 个来源。
- 文档数总和为 346,891。
- 来源品类原始出现数为：暖奶器 198,880、吸奶器 131,222、消毒器 16,789。

### Task 3: 建立完整字段字典和目标映射

**Files**

- Create: `src/meltwater_excel/schema.py`
- Create: `tests/test_schema.py`

**Implementation**

- 用结构化映射定义所有标量、对象和数组路径，不用临时字符串拼接推断目标列。
- 为每个路径记录：源路径、观察类型、可空性、目标 workbook、目标 sheet、目标列、转换规则。
- 将当前全 null 的 6 个字段保留在字典中。
- 将 9 个非空数组路径全部映射到关系 sheet。
- 对新出现但未映射的路径执行 fail-closed：停止构建并报告路径。

**Verification**

Run:

```bash
uv run pytest tests/test_schema.py -q
```

Expected:

- 82 个标量叶路径全部有映射。
- 9 个非空数组路径全部有映射。
- 17 个对象路径全部在字段字典中可追踪。
- 任意未映射字段会令测试失败。

### Task 4: 流式载入 SQLite staging

**Files**

- Create: `src/meltwater_excel/staging.py`
- Create: `tests/test_staging.py`

**Implementation**

- 使用 `ijson` 顺序读取每个原始文件，不将整个 JSON 加载入内存。
- 建立 `sources`、`occurrences`、`scalar_values`、`array_items`、`field_states` 表。
- `array_items` 使用 `(occurrence_id, field_path, ordinal)` 唯一键，允许相同 value 在不同 ordinal 重复。
- 标量值同时保存标准化比较值和原始精确文本。
- 每个来源完成后提交事务并记录计数；错误时保留日志但不生成 Excel。
- staging 文件只写入受限临时目录，权限为 `0600`。

**Verification**

Run:

```bash
uv run pytest tests/test_staging.py -q
uv run python -m meltwater_excel.cli stage --config config/excel_export_sources.json --db /tmp/meltwater_complete_stage.sqlite
```

Expected:

- occurrence 总数 346,891。
- 所有 occurrence 都有 `document_id`。
- 数组关系总数 6,865,075。
- 各数组关系计数严格等于探查基线。
- 单个数组中的重复元素与 ordinal 均被保留。

### Task 5: 生成 canonical、品类关系和标量变体

**Files**

- Create: `src/meltwater_excel/canonical.py`
- Create: `tests/test_canonical.py`

**Implementation**

- 按本计划 2.1 的三段规则选择 canonical occurrence。
- 建立 document 到所有 occurrence、所有品类的关系。
- 比较所有多源文档标量字段；每个不同值及其来源 occurrence 写入 variant staging。
- 对数组差异只通过 occurrence 关系表表达，不把数组压入 Scalar_Variants。
- 为边界时刻 `2026-02-22T00:00:00Z` 的暖奶器记录生成审计标记。

**Verification**

Run:

```bash
uv run pytest tests/test_canonical.py -q
uv run python -m meltwater_excel.cli summarize --db /tmp/meltwater_complete_stage.sqlite --output /tmp/meltwater_stage_summary.json
```

Expected:

- 全局唯一 document 336,288。
- 重复出现次数 10,603。
- 多源 document 10,318。
- 完全相同多源 document 4,583。
- 存在版本差异的 document 5,735。
- 跨品类 document 5,662。
- 品类成员关系 342,120。
- canonical 选择重复运行结果一致。
- 非 `matched` 区域差异文档数为 41，且无差异字段被遗漏。

### Task 6: 实现 Excel 安全文本、日期、数值和长文本转换

**Files**

- Create: `src/meltwater_excel/excel_safe.py`
- Create: `tests/test_excel_safe.py`

**Implementation**

- 为所有外部文本实现纯文本安全写入，防止公式节点。
- 精确小数写入 `*_raw`，分析数值写入 `*_number`。
- 日期写入原始 ISO 文本和 UTC datetime 派生列。
- 长文本以 30,000 字符分块，并生成可逆的 chunk 元数据。
- 缺失、null 和空值使用明确状态列，不用相同空白代替。

**Verification**

Run:

```bash
uv run pytest tests/test_excel_safe.py -q
```

Expected:

- fixture 中所有 `= + - @` 文本打开后仍为纯文本。
- 公式节点数为 0。
- 超长标题分块后可逐字还原。
- 任一 Excel 单元格文本长度不超过 32,767。
- 精确小数的 `*_raw` 与 JSON 原始值一致。

### Task 7: 实现通用流式 Excel writer 和样式

**Files**

- Create: `src/meltwater_excel/writer.py`
- Create: `tests/test_writer.py`

**Implementation**

- 使用 `openpyxl.Workbook(write_only=True)` 写大型数据工作簿。
- 使用冻结表头、筛选、清晰的列名、受控列宽和一致的 UTC/数值格式。
- 每 750,000 条数据行自动切换 sheet。
- 每个 workbook 关闭后重新只读打开，统计 sheet、行数、列数、公式和超长单元格。
- 使用 `@oai/artifact-tool` 生成小型目录样本并做渲染检查。

**Verification**

Run:

```bash
uv run pytest tests/test_writer.py -q
```

Expected:

- 自动分片位置准确。
- 所有 sheet 连同表头不超过 750,001 行。
- 关闭并重新打开后行列数不变。
- 输出文件权限为 `0600`。

### Task 8: 生成核心主表工作簿

**Files**

- Create: `src/meltwater_excel/build_core.py`
- Create: `tests/test_build_core.py`

**Implementation**

- 生成 `Mentions`、`Occurrences`、`Scalar_Variants`、`Long_Text_Chunks`。
- `Mentions` 输出 55 个已填充核心标量路径、全 null 声明字段、类别列表、canonical 来源和风险标记。
- `Occurrences` 输出来源、Export、请求区间、品类、canonical 标记、字段状态和数组计数。
- `Scalar_Variants` 输出 document、字段路径、原始值、比较值、occurrence 和来源。

**Verification**

Run:

```bash
uv run pytest tests/test_build_core.py -q
uv run python -m meltwater_excel.cli build-core --db /tmp/meltwater_complete_stage.sqlite --output data/excel_complete_20260604/Meltwater_VOC_01_核心主表.xlsx
```

Expected:

- `Mentions` 336,288 条数据行。
- `Occurrences` 346,891 条数据行。
- `Long_Text_Chunks` 35 条数据行。
- 10 次超长 `content.title` 均可完整还原。
- `source.name` 缺失的 12 次 occurrence 有明确缺失状态。

### Task 9: 生成全部数组关系工作簿

**Files**

- Create: `src/meltwater_excel/build_relations.py`
- Create: `tests/test_build_relations.py`

**Implementation**

- 从 `array_items` 按 `occurrence_id + field_path + ordinal` 写入 4 份关系工作簿。
- Keyphrases 保存原数组对象的所有观察字段。
- Named Entities 保存实体名称、情感和类型等所有观察字段。
- Matched Inputs 和 Matched Keywords 保存原始对象字段、search/source 关联与 ordinal。
- 不对重复元素执行去重。

**Verification**

Run:

```bash
uv run pytest tests/test_build_relations.py -q
uv run python -m meltwater_excel.cli build-relations --db /tmp/meltwater_complete_stage.sqlite --output-dir data/excel_complete_20260604
```

Expected:

- `content.emojis` 213,375 行。
- `content.hashtags` 670,772 行。
- `content.links` 332,991 行。
- `content.mentions` 62,408 行。
- `source.outlet_types` 114,082 行。
- `enrichments.keyphrases` 2,048,857 行。
- `enrichments.named_entities` 2,094,008 行。
- `matched.inputs` 355,657 行。
- `matched.keywords` 972,925 行。
- 所有 relation 行均能回连到有效 occurrence 和 document。

### Task 10: 生成目录、字段字典和验收清单

**Files**

- Create: `src/meltwater_excel/checks.py`
- Create: `src/meltwater_excel/build_catalog.py`
- Create: `tests/test_checks.py`

**Implementation**

- 生成 README、Sources、Field_Dictionary、Coverage_Checks、Category_Summary、Known_Gaps、Output_Inventory。
- Known_Gaps 明确记录 2 个搜索、缺失区间和 255 次估计命中，不产生伪造 Mention。
- Coverage_Checks 对账来源、document、occurrence、品类、关系、变体、长文本和安全风险。
- 输出 `validation_manifest.json`，包含每个输出文件 SHA-256、sheet 行列数、公式数、超长单元格数和来源 SHA 复核结果。

**Verification**

Run:

```bash
uv run pytest tests/test_checks.py -q
uv run python -m meltwater_excel.cli build-catalog --db /tmp/meltwater_complete_stage.sqlite --output-dir data/excel_complete_20260604
```

Expected:

- 目录中列出全部 6 个来源和全部输出文件。
- 字段字典覆盖全部观察路径。
- 已知缺口清晰可见。
- 所有对账检查为 pass。

### Task 11: 提供单命令全量构建入口

**Files**

- Create: `src/meltwater_excel/cli.py`
- Create: `scripts/json_to_complete_excel.py`
- Create: `tests/test_cli.py`

**Implementation**

- 提供 `inventory`、`stage`、`summarize`、`build-core`、`build-relations`、`build-catalog`、`validate`、`build-all` 子命令。
- `build-all` 使用新的受限临时 staging，并在全部验收通过后原子移动到最终输出目录。
- 构建失败时保留诊断清单，不将不完整文件冒充最终输出。
- 支持 `--resume-from-stage`，但恢复前必须验证来源 SHA。

**Verification**

Run:

```bash
uv run pytest tests/test_cli.py -q
uv run python scripts/json_to_complete_excel.py build-all --config config/excel_export_sources.json --output-dir data/excel_complete_20260604
```

Expected:

- 单命令生成 6 份 Excel 和 2 份 JSON 清单。
- 任意验收失败时命令返回非零。
- 成功时输出目录仅包含通过验收的最终文件。

### Task 12: 全量验收、视觉抽检和交付说明

**Files**

- Create: `docs/audits/2026-06-04-json-to-excel-acceptance.md`
- Create: `docs/runbooks/json-to-complete-excel.md`

**Automated Verification**

Run:

```bash
uv run pytest -q
uv run python -m meltwater_excel.cli validate --config config/excel_export_sources.json --output-dir data/excel_complete_20260604
```

Required acceptance:

- 来源文件数 = 6。
- 原始 occurrence = 346,891。
- 全局唯一 document = 336,288。
- 品类唯一 document：暖奶器 195,984、吸奶器 129,347、消毒器 16,789。
- 品类原始 occurrence：暖奶器 198,880、吸奶器 131,222、消毒器 16,789。
- 数组关系总数 = 6,865,075，且各关系计数与 Task 9 一致。
- 10 次超长 title 生成 35 个 chunk，逐字还原成功。
- 165,629 个公式风险文本均未生成公式节点。
- 111,945 个超精度小数值均保留精确 `*_raw`。
- 目标文件中公式节点总数 = 0。
- 目标文件中超 32,767 字符的单元格数 = 0。
- 所有 sheet 连同表头不超过 750,001 行。
- 每一个观察到的字段路径都有明确目标映射。
- 每一个 array item 保留 occurrence、field path 和 ordinal。
- 所有不同标量版本都能通过 `Scalar_Variants` 回溯。
- 字段缺失、null、空数组和非空数组可区分。
- 2 个缺失搜索和估计 255 次命中只作为 Known Gap，不生成数据行。
- 转换前后 6 个原始 JSON SHA-256 完全一致。
- 输出目录权限 = `0700`，输出文件权限 = `0600`。

**Visual QA**

- 使用 `@oai/artifact-tool` 渲染目录工作簿和每类目标表的代表性小样。
- 人工检查中文列名、表头冻结、筛选、日期显示、长文本预览、缺失状态和关联键可读性。
- 随机抽取每个来源 20 个 occurrence，与原始 JSON 逐字段回查。
- 定向抽查跨品类 document、重复数组元素、标量变体、公式风险文本和超长标题。

**Delivery Documentation**

- 验收报告记录所有命令、运行时间、输出 SHA-256、行数清单和通过状态。
- Runbook 记录重跑方式、增量来源接入方式、失败恢复方式和已知缺口。

## 5. 完成定义

只有同时满足以下条件，才可报告“全量 JSON 到 Excel 解析完成”：

1. 6 份原始 JSON 全部纳入，且 SHA-256 未变化。
2. 6 份目标 Excel 与 2 份机器可读清单成功生成。
3. 自动化验收全部通过，所有基线计数一致。
4. 所有观察字段有去向，所有数组顺序和重复元素可还原。
5. 所有变体、缺失/null/空数组状态和已知数据缺口可追溯。
6. Excel 限制、公式注入和数值精度风险均得到验证性处理。
7. 视觉抽检与原始 JSON 定向回查通过。


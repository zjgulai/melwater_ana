# Meltwater 原始 JSON 到完整 Excel 探查报告

> 探查日期：2026-06-04  
> 目标：为全部现有 Meltwater 原始 JSON 设计不忽略重要字段和内容的 Excel 数据包  
> 本阶段状态：只探查与设计，尚未生成目标 Excel  
> 数据范围：6 份原始 Export JSON；不包含 `manifest.json`、`validation.json` 和配置 JSON

## 1. 结论

现有 `scripts/collect.py` 的 47 列宽表不能作为下一版目标：

- 它遗漏多个重要标量字段，例如 `external_id`、`source.id`、`content.image`、`location.geo`、`metrics.estimated_views`、`engagement.quotes/reposts`。
- 它把数组和对象拼接成字符串，丢失元素顺序、重复元素、对象字段和来源批次。
- 它无法表达同一个 `document.id` 在不同 Export 中出现的字段版本差异。
- 它无法安全容纳 10 条超过 Excel 单元格 32,767 字符限制的标题。
- 它会把以 `= + - @` 开头的外部文本解释为公式。

推荐输出为 **6 份互相关联的 Excel 工作簿**：

1. `Meltwater_VOC_00_目录与校验.xlsx`
2. `Meltwater_VOC_01_核心主表.xlsx`
3. `Meltwater_VOC_02_内容数组.xlsx`
4. `Meltwater_VOC_03_关键词.xlsx`
5. `Meltwater_VOC_04_命名实体.xlsx`
6. `Meltwater_VOC_05_命中关系.xlsx`

所有工作簿通过 `document_id` 和 `occurrence_id` 关联。原始 JSON 保持只读并继续作为事实来源。

## 2. 原始数据盘点

| 来源别名 | 品类 | 原始文档数 | API 区间 |
|---|---|---:|---|
| `warmer_old` | 暖奶器 | 119,112 | `[2026-02-20, 2026-05-20)` |
| `warmer_new` | 暖奶器 | 79,768 | `[2026-01-01, 2026-02-22)` |
| `pump_core_old` | 吸奶器 | 86,911 | `[2026-02-20, 2026-05-20)` |
| `pump_secondary_old` | 吸奶器 | 603 | `[2026-02-20, 2026-05-20)` |
| `pump_core_new` | 吸奶器 | 43,708 | `[2026-01-01, 2026-02-22)` |
| `sterilizer_old` | 消毒器 | 16,789 | `[2026-02-20, 2026-05-20)` |
| **合计** |  | **346,891** |  |

已知数据缺口：

- 吸奶器搜索 `28546470`、`28546475` 在 `[2026-01-01, 2026-02-20)` 尚未获取。
- Analytics 估计缺少 255 次搜索命中。
- Excel 必须在目录和校验页明确标注该缺口，不能伪造缺失记录。

## 3. 唯一性、重复与版本差异

| 指标 | 数量 |
|---|---:|
| 原始文档出现次数 | 346,891 |
| 全局唯一 `document.id` | 336,288 |
| 重复出现次数 | 10,603 |
| 出现在多个源文件的文档 | 10,318 |
| 多源文档中内容完全一致 | 4,583 |
| 多源文档中存在版本差异 | 5,735 |
| 出现在多个业务品类的文档 | 5,662 |
| 品类成员关系总数 | 342,120 |

每个品类的唯一文档：

| 品类 | 唯一文档 |
|---|---:|
| 暖奶器 | 195,984 |
| 吸奶器 | 129,347 |
| 消毒器 | 16,789 |

重复版本发生差异的顶层区域：

| 顶层区域 | 有差异的文档数 |
|---|---:|
| `matched` | 5,711 |
| `content` | 36 |
| `indexed_date` | 21 |
| `enrichments` | 19 |
| `source` | 17 |
| `author` | 15 |
| `url` | 15 |
| `metrics` | 4 |
| `published_date` | 1 |

关键结论：

- 不能简单保留第一条或最后一条后丢弃其他出现记录。
- 核心主表可以选一个规范版本，但所有源文件出现记录必须进入 `Occurrences`。
- 所有发生变化的标量值必须进入 `Scalar_Variants`。
- 数组内容必须保留 `occurrence_id` 和原始序号，不能直接做集合去重。

## 4. 字段结构探查

全部数据观察到：

| 类型 | 数量 |
|---|---:|
| 标量叶子路径 | 82 |
| 非空数组路径 | 9 |
| 对象路径 | 17 |
| 适合核心主表的已填充标量路径 | 55 |
| 当前全部为 null 的声明字段 | 6 |

全部为 null、但不能从字段字典中删除的字段：

- `custom.custom_categories`
- `custom.custom_fields`
- `custom.tags`
- `location.geo`
- `metrics.episode_reach`
- `source.metrics.national_viewership`

当前非空数组：

- `content.emojis`
- `content.hashtags`
- `content.links`
- `content.mentions`
- `source.outlet_types`
- `enrichments.keyphrases`
- `enrichments.named_entities`
- `matched.inputs`
- `matched.keywords`

`custom.tags`、`custom.custom_categories`、`custom.custom_fields` 在当前 346,891 次出现中均为 null。目标数据包仍需在字段字典和 occurrence 状态列中说明。

## 5. 数组展开规模

为保证顺序、重复值和来源不丢失，数组按原始 occurrence 展开，共 **6,865,075 行**：

| 关系 | 原始展开行数 | 目标工作簿 |
|---|---:|---|
| `content.emojis` | 213,375 | 内容数组 |
| `content.hashtags` | 670,772 | 内容数组 |
| `content.links` | 332,991 | 内容数组 |
| `content.mentions` | 62,408 | 内容数组 |
| `source.outlet_types` | 114,082 | 内容数组 |
| `enrichments.keyphrases` | 2,048,857 | 关键词 |
| `enrichments.named_entities` | 2,094,008 | 命名实体 |
| `matched.inputs` | 355,657 | 命中关系 |
| `matched.keywords` | 972,925 | 命中关系 |

重复数组元素在单个文档中真实存在。例如暖奶器中有 5,402 个 occurrence 的 emojis 数组包含重复值。因此不能把数组直接转成去重集合。

Excel 单表最多 1,048,576 行。实施时每个数据 sheet 的数据行上限固定为 750,000：

- Keyphrases 需要拆成 3 个 sheet。
- Named Entities 需要拆成 3 个 sheet。
- Matched Keywords 需要拆成 2 个 sheet。

## 6. Excel 内容风险

### 6.1 超长文本

- 10 次 `content.title` 超过 Excel 单元格 32,767 字符限制。
- 最大标题长度为 151,774 字符。
- 使用每段最多 30,000 字符的 `Long_Text_Chunks` 表，可无损拆成 35 行。
- 核心主表只保存安全预览、总长度和 chunk 数。

### 6.2 公式注入

- 共有 165,629 个标量或数组文本以 `= + - @` 开头。
- 其中大量是正常的 `@mention`、作者 Handle、实体名称和以负号开头的标题。
- 所有外部文本写入 Excel 时必须使用纯文本安全转义。
- 目标数据工作簿不得包含任何公式节点。

### 6.3 数值精度

四个字段同时出现整数和小数：

- `location.geo.latitude`
- `location.geo.longitude`
- `metrics.earned_media_value`
- `source.metrics.ave`

其中 111,945 个小数值超过 Excel 的 15 位有效数字精度。为不丢失原始值，这四个字段需要同时输出：

- `*_raw`：原始十进制文本，保证精确还原。
- `*_number`：用于 Excel 筛选和分析的数值版本。

所有 ID 和 external ID 必须始终按文本写入。

### 6.4 日期精度

`published_date` 和 `indexed_date` 包含 UTC、毫秒和原始字符串语义。目标表同时输出：

- 原始 ISO 字符串。
- Excel 可筛选的 UTC datetime 派生列。

### 6.5 其他质量信号

- 所有 346,891 条记录都有 `document.id`。
- `source.name` 有 12 条记录缺失，不是显式 null。
- 未发现 XML 非法控制字符。
- 暖奶器新批次有 7 个唯一文档位于 API 排他结束时刻 `2026-02-22T00:00:00Z`，需要边界异常标记。

## 7. 目标工作簿结构

### `00_目录与校验.xlsx`

- `README`：数据范围、使用方式、关联键和已知缺口。
- `Sources`：6 个原始文件、SHA-256、Export ID、请求区间和数量。
- `Field_Dictionary`：所有标量、数组和对象路径的类型、出现率、目标位置。
- `Coverage_Checks`：字段覆盖、行数对账、重复、冲突、长文本和公式风险。
- `Category_Summary`：品类唯一数、原始出现数和跨品类重叠。
- `Known_Gaps`：未获取搜索和区间。
- `Output_Inventory`：所有目标工作簿、sheet 和行数。

### `01_核心主表.xlsx`

- `Mentions`：336,288 个全局唯一 Mention；完整标量字段和派生审计列。
- `Occurrences`：346,891 次原始出现；源文件、Export、请求区间、分类、数组状态和 canonical 标记。
- `Scalar_Variants`：重复版本中发生变化的标量值。
- `Long_Text_Chunks`：超长文本无损分块。

### `02_内容数组.xlsx`

按原始 occurrence 和元素序号保存：

- `Hashtags`
- `Mentions`
- `Emojis`
- `Links`
- `Outlet_Types`

### `03_关键词.xlsx`

- `Keyphrases_001`
- `Keyphrases_002`
- `Keyphrases_003`

### `04_命名实体.xlsx`

- `Named_Entities_001`
- `Named_Entities_002`
- `Named_Entities_003`

每行保存实体名称、情感和类型。

### `05_命中关系.xlsx`

- `Matched_Inputs`
- `Matched_Keywords_001`
- `Matched_Keywords_002`

## 8. 规范版本选择与无损规则

核心主表每个 `document.id` 选择一个 canonical occurrence：

1. `indexed_date` 最大者优先。
2. 相同 `indexed_date` 时，Export 请求结束时间较晚者优先。
3. 仍相同时，按稳定的 source alias 排序。

无损保护：

- 每一次原始出现都进入 `Occurrences`。
- 所有数组元素都使用 `occurrence_id + field_path + ordinal` 保存。
- 标量发生差异时，每个来源版本都进入 `Scalar_Variants`。
- 空数组、null、字段缺失分别记录，不混成同一个空白。
- 跨品类文档在核心表保留完整品类列表。
- 原始 JSON 文件路径和 SHA-256 进入 Sources，Excel 可追溯回源。

## 9. 实施前技术决策

输出规模超过 720 万数据行，必须使用流式 JSON 解析、SQLite 暂存和流式 XLSX 写入。

当前 `@oai/artifact-tool` 帮助接口未发现流式 XLSX 导出能力。建议：

- 大型数据工作簿使用 `openpyxl.Workbook(write_only=True)` 流式生成。
- `@oai/artifact-tool` 用于目录/校验工作簿和抽样预览的视觉检查。
- 执行前需确认允许采用此大数据流式写入方案。

## 10. 探查产物与可重复性

本次探查使用流式扫描和临时 SQLite 索引，没有改动任何原始 JSON。

核心探查结果：

- `/tmp/meltwater_excel_probe.json`
- `/tmp/meltwater_relation_counts.json`
- `/tmp/meltwater_excel_probe.sqlite`

这些文件仅用于本次设计，不是最终交付物。正式实施会把必要的聚合结果写入目标目录和校验工作簿。


# Meltwater 原始 JSON 到完整 Excel 验收报告

> 验收日期：2026-06-04  
> 输出目录：`data/excel_complete_20260604/`  
> 状态：PASS

## 1. 交付物

| 文件 | 大小 |
|---|---:|
| `Meltwater_VOC_00_目录与校验.xlsx` | 17 KB |
| `Meltwater_VOC_01_核心主表.xlsx` | 213 MB |
| `Meltwater_VOC_02_内容数组.xlsx` | 52 MB |
| `Meltwater_VOC_03_关键词.xlsx` | 72 MB |
| `Meltwater_VOC_04_命名实体.xlsx` | 92 MB |
| `Meltwater_VOC_05_命中关系.xlsx` | 50 MB |
| `source_inventory.json` | 4.2 KB |
| `validation_manifest.json` | 16 KB |

最终数据包约 505 MB。目录权限为 `0700`，全部文件权限为 `0600`。

## 2. 核心对账结果

| 指标 | 验收值 | 状态 |
|---|---:|---|
| 原始来源文件 | 6 | PASS |
| 原始 occurrence | 346,891 | PASS |
| 全局唯一 document | 336,288 | PASS |
| 重复 occurrence | 10,603 | PASS |
| 存在版本差异的 document | 5,735 | PASS |
| 完全相同的重复 document | 4,583 | PASS |
| 跨品类 document | 5,662 | PASS |
| 品类成员关系 | 342,120 | PASS |
| 标量变体行 | 7,227 | PASS |
| 数组关系行 | 6,865,075 | PASS |

品类唯一 document：

- 暖奶器：195,984
- 吸奶器：129,347
- 消毒器：16,789

品类原始 occurrence：

- 暖奶器：198,880
- 吸奶器：131,222
- 消毒器：16,789

## 3. 关系表对账

| 字段路径 | 数据行 |
|---|---:|
| `content.emojis` | 213,375 |
| `content.hashtags` | 670,772 |
| `content.links` | 332,991 |
| `content.mentions` | 62,408 |
| `source.outlet_types` | 114,082 |
| `enrichments.keyphrases` | 2,048,857 |
| `enrichments.named_entities` | 2,094,008 |
| `matched.inputs` | 355,657 |
| `matched.keywords` | 972,925 |

所有关系行保留 `occurrence_id + field_path + ordinal`，单个数组中的重复元素没有被去重。

## 4. Excel 风险验收

| 风险 | 验收结果 |
|---|---|
| 公式风险文本 | 165,629 个已按纯文本写入；目标公式节点数为 0 |
| 超长文本 | 10 次超长文本拆为 35 个 chunk；目标单元格均不超过 32,767 字符 |
| 超精度小数 | 111,945 个值保留精确 raw 文本及分析数值 |
| XML 非法控制字符 | 0 |
| Sheet 行数限制 | 全部 sheet 连同表头不超过 750,001 行 |
| 原始 JSON 完整性 | 构建前后 6 个来源 SHA-256 一致 |
| 已知缺口 | 2 个搜索、估计 255 次命中只在 Known_Gaps 记录，没有伪造数据行 |

## 5. 工作簿行数

### 核心主表

- `Mentions`：336,288 数据行
- `Occurrences`：346,891 数据行
- `Scalar_Variants`：7,227 数据行
- `Long_Text_Chunks`：35 数据行

### 大表分片

- `Keyphrases_001/002/003`：750,000 / 750,000 / 548,857
- `Named_Entities_001/002/003`：750,000 / 750,000 / 594,008
- `Matched_Keywords_001/002`：750,000 / 222,925

## 6. 回源抽检

命令：

```bash
uv run --python 3.12 python -m meltwater_excel.cli sample-audit \
  --config config/excel_export_sources.json \
  --output-dir data/excel_complete_20260604 \
  --samples-per-source 20 \
  --seed 20260604 \
  --output docs/audits/2026-06-04-json-to-excel-sample-audit.json
```

结果：

- 每个来源随机抽取 20 条，共 120 个 occurrence。
- 核对 occurrence 的 document、来源、品类和 9 类数组状态。
- 核对 2,690 个抽样数组元素的原始内容和 ordinal。
- 失败项：0。

## 7. 视觉验收

- 实际目录工作簿已通过 `@oai/artifact-tool` 导入、检查和渲染。
- 由于工具对含中文字符的本地文件路径存在兼容性限制，视觉检查使用内容完全相同的 ASCII 临时文件名。
- 首次视觉检查发现 Sources、Known_Gaps 和 Output_Inventory 的长列被截断；已修复生成器和最终目录工作簿列宽。
- 修复后再次渲染，来源路径、请求区间、SHA-256、缺口原因、工作簿名称和 sheet 名称均可读。
- 6 份目标 XLSX 已分别通过 Python ZIP 完整性检查、OpenPyXL 重开和独立 XML 扫描。

## 8. 最终验证命令

```bash
uv run --python 3.12 pytest -q
uv run --python 3.12 python -m meltwater_excel.cli validate \
  --config config/excel_export_sources.json \
  --output-dir data/excel_complete_20260604
```

验收依据：

- `data/excel_complete_20260604/validation_manifest.json`
- `data/excel_complete_20260604/source_inventory.json`
- `docs/audits/2026-06-04-json-to-excel-sample-audit.json`

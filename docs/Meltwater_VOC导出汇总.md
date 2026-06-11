---
name: meltwater-voc-export-summary
description: Meltwater 三品类（消毒器/暖奶器/吸奶器）近3个月VOC原始数据导出汇总。记录导出ID、数据量、统计信息及数据文件路径。
---

# Meltwater VOC 原始数据导出汇总

> 导出时间：2026-05-20  
> 数据范围：2026-02-20 ~ 2026-05-20（3个月）  
> 模板：api.json

## 一、导出概览

| 品类 | 导出ID | 条数 | 日均 | 正面率 | 负面率 | 中性率 | 文件大小 | 文件 |
|---|---|---|---|---|---|---|---|---|
| **消毒器** | 17599469 | **16,789** | 186 | 33.1% | 5.2% | 52.8% | 46 MB | [sterilizer_3months.json](sterilizer_3months.json) |
| **暖奶器** | 17599472 | **119,112** | 1,323 | 40.0% | **10.6%** | 39.2% | 308 MB | [warmer_3months.json](warmer_3months.json) |
| **吸奶器（核心）** | 17599479 | **86,911** | 965 | 53.8% | 4.0% | 36.4% | 255 MB | [pump_core_3months.json](pump_core_3months.json) |
| **吸奶器（次要）** | 17599482 | **603** | 6 | 84.4% | 0.5% | 12.6% | 2.1 MB | [pump_secondary_3months.json](pump_secondary_3months.json) |
| **合计** | — | **223,415** | 2,480 | — | — | — | 611 MB | — |

### 负面 VOC 总计

| 品类 | 负面条数 |
|---|---|
| 消毒器 | 875 |
| 暖奶器 | **12,590** |
| 吸奶器（核心） | 3,441 |
| 吸奶器（次要） | 3 |
| **合计** | **16,909** |

## 二、各品类详细数据

### 消毒器 (Bottle Sterilizer & Dryer)

- 搜索ID：28678966（新建）
- 搜索Query：覆盖 sterilizer/steriliser/sanitizer/dryer + 14 个品牌 + 中文关键词（消毒器/紫外线消毒/蒸汽消毒/烘干）
- Query 长度：679 字符
- 来源分布：新闻 54% · 社媒 42% · 论坛 3%
- 语言：英语 51% · 简体中文 28% · 繁体中文 7% · 日语 3%
- 国家：未知 31% · 中国 29% · 美国 22% · 日本 3%

### 暖奶器 (Bottle Warmer)

- 搜索ID：22869413（已优化）
- 搜索Query：（优化后）从 55 字符扩展到 ~400 字符，新增中文关键词（暖奶器/温奶器/热奶器）和 13 个品牌
- 优化效果：日均声量从 153 → 1,323（**增长 8.6 倍**）
- 来源分布：社媒 59% · 新闻 37% · Blog 3%
- 语言：英语 87% · 简体中文 1% · 泰语 1%
- 国家：未知 45% · 美国 34% · 英国 5% · 加拿大 2%

### 吸奶器（核心品牌）

- 包含搜索：Momcozy (18922074) · Momcozy Negative (18922087) · Elvie (18913527) · Eufy Breast Pump (28546460) · Willow Breast Pump (28546462)
- 来源分布：社媒 93% · 新闻 7%
- 语言：英语 54% · 西班牙语 8% · 印尼语 5% · 泰语 4%
- 国家：未知 67% · 美国 9% · 泰国 4% · 印尼 3%

### 吸奶器（次要品牌）

- 包含搜索：Medela Breast Pump (28546470) · Spectra Breast Pump (28546475)
- 数据量较小（603 条/3月），主要集中在美国市场

## 三、搜索变更记录

| 操作 | 搜索名称 | ID | 原因 |
|---|---|---|---|
| ❌ 删除 | Eufy Pump | 27168292 | 被 Eufy Breast Pump (28546460) 完全覆盖 |
| ❌ 删除 | Eufy 吸奶器产品 | 18922082 | 缺少 S1 系列，被 28546460 覆盖 |
| ❌ 删除 | Momcozy Breast Pump | 28546442 | 是 Momcozy (18922074) 的真子集 |
| ❌ 删除 | 【临时任务】快消GTM | 27735339 | 临时任务搜索，与母婴无关 |
| ✅ 新建 | **Bottle Sterilizer & Dryer** | 28678966 | 新增消毒器品类覆盖 |
| ✏️ 优化 | Bottle Warmer | 22869413 | 扩展中英文关键词+品牌覆盖 |

## 四、数据获取方式

如需重新导出，使用以下端点：

```
# 消毒器
POST /v3/exports/one-time
{ "onetime_export": { "search_ids": [28678966], ... } }

# 暖奶器
POST /v3/exports/one-time
{ "onetime_export": { "search_ids": [22869413], ... } }

# 吸奶器
POST /v3/exports/one-time
{ "onetime_export": { "search_ids": [18922074, 18922087, 18913527, 28546460, 28546462], ... } }
POST /v3/exports/one-time
{ "onetime_export": { "search_ids": [28546470, 28546475], ... } }
```

## 五、当前搜索列表（11个）

| ID | 名称 | 品类 |
|---|---|---|
| 18913527 | Elvie | 吸奶器 |
| 18922074 | （勿动）Momcozy | 吸奶器 |
| 18922087 | （勿动）Momcozy Negative Information | 吸奶器 |
| 22869339 | 通用母婴产品信息(勿动） | 综合 |
| 22869399 | Willow | 吸奶器 |
| 22869413 | Bottle Warmer ✏️ | 暖奶器 |
| 28546460 | Eufy Breast Pump | 吸奶器 |
| 28546462 | Willow Breast Pump | 吸奶器 |
| 28546470 | Medela Breast Pump | 吸奶器 |
| 28546475 | Spectra Breast Pump | 吸奶器 |
| **28678966** | **Bottle Sterilizer & Dryer** ✨ | **消毒器** |

## 六、字段说明

每个 Mention 包含完整字段，详见 [Meltwater_API_可用字段清单.md](Meltwater_API_可用字段清单.md)。

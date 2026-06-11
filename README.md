# Meltwater VOC 采集项目

基于 Meltwater API 的母婴品类 VOC（用户之声）数据采集工具。一键拉取指定品类的原始 mention 数据，输出结构化 Excel。

## 快速重启

```bash
cd /Users/lute/project/Agent/product/data_achieve/meltwater

# 1. 环境准备（首次使用）
python3 -m venv .venv && source .venv/bin/activate && pip install openpyxl

# 2. 查看当前声量
python3 scripts/analytics.py --all

# 3. 采集数据
# 旧脚本默认冻结 live API；补采优先使用 manifest 驱动入口
uv run --python 3.12 python -m meltwater_excel.cli backfill-plan \
  --config config/backfill_20260101_20260220_pump_secondary.json

# 4. 列出可用品类
python3 scripts/collect.py --list
```

## 当前数据持有

| 时间段 | 品类 | 数据量 | 位置 |
|---|---|---|---|
| 2026-02-20 ~ 05-20 | 消毒器 | 16,789 条 | [exports_20260520/](exports_20260520/) |
| 2026-02-20 ~ 05-20 | 暖奶器 | 119,112 条 | [exports_20260520/](exports_20260520/) |
| 2026-02-20 ~ 05-20 | 吸奶器 | 87,514 条 | [exports_20260520/](exports_20260520/) |
| 2026-01-01 ~ 02-21 | 暖奶器 | 79,768 条原始数据；76,872 条为旧数据未覆盖 | [data/exports/round_20260604_backfill_20260101_20260221/](data/exports/round_20260604_backfill_20260101_20260221/) |
| 2026-01-01 ~ 02-21 | 吸奶器核心 5 搜索 | 43,708 条原始数据；41,880 条为旧数据未覆盖 | [data/exports/round_20260604_backfill_20260101_20260221/](data/exports/round_20260604_backfill_20260101_20260221/) |
| 2026-01-01 ~ 02-19 | 吸奶器次要 2 搜索 | 247 条原始数据；已补齐上一轮缺口 | [data/exports/backfill_20260101_20260220_pump_secondary/](data/exports/backfill_20260101_20260220_pump_secondary/) |
| ❌ 2026-05-20 之前 | 消毒器 | 不可用 | 搜索新建于 05-20，不回溯 |

> 2026-06-11 已用 manifest 驱动补采完成吸奶器次要搜索 `28546470` 和 `28546475`。当前完整 Excel 包为 [data/excel_complete_20260611/](data/excel_complete_20260611/)。所有新旧数据合并时必须按 `document.id` 去重。

## 目录结构

```
meltwater/
├── README.md                # 本文件
├── TODO.md                  # 待执行任务
├── .env                     # API 密钥（不入 git）
├── .gitignore
├── config/
│   └── categories.json      # 品类 → 搜索 ID 映射（可修改）
├── scripts/
│   ├── collect.py           # 主采集：创建导出 → 等待 → 下载 → Excel
│   └── analytics.py         # 快速声量概览（聚合数据，不消耗配额）
├── data/
│   ├── exports/             # JSON 原始导出结果
│   └── excel/               # 生成的 Excel 文件
├── docs/
│   ├── Meltwater_API_可用字段清单.md   # 全部 45 个字段说明
│   └── Meltwater_VOC导出汇总.md       # 首次导出统计
└── exports_20260520/        # 历史导出快照（22.3 万条）
```

## 可用品类

| 品类 | 搜索数 | 搜索ID | 近7天日均声量 |
|---|---|---|---|
| 消毒器 | 1 | 28678966 | ~143 |
| 暖奶器 | 1 | 22869413 | ~1,121 |
| 吸奶器 | 7 | 18922074 等 | ~829 |
| 奶瓶清洗器 | 1 | 28549685 | ~188 |
| 通用母婴 | 1 | 22869339 | ~261 |

## 使用方式

```bash
# 补采预检（不消耗 Export 配额）
uv run --python 3.12 python -m meltwater_excel.cli backfill-plan \
  --config config/backfill_20260101_20260220_pump_secondary.json

# 真实补采（消耗 Export 配额，需双重确认）
MELTWATER_LIVE_API=1 uv run --python 3.12 python -m meltwater_excel.cli backfill-run \
  --config config/backfill_20260101_20260220_pump_secondary.json \
  --execute

# 查看概览（消耗 Analytics 配额）
python3 scripts/analytics.py <品类名> [--all] [--days N]

# 修改品类配置
vim config/categories.json
```

## 采集流程（collect.py 自动完成）

1. 读取 `config/categories.json` 获取 search_ids
2. 调用 `POST /v3/exports/one-time` 创建异步导出（每批最多 5 个搜索）
3. 轮询 `GET /v3/exports/one-time/{id}` 等待完成
4. 下载 JSON → `data/exports/`
5. 转换为 Excel → `data/excel/`
   - 全量表：45 列完整字段
   - 负面 VOC 子表：仅 sentiment=negative 的记录

## 输出字段

每条 Mention 包含 **45 个字段**，涵盖：

- 元数据（ID、发布时间、URL、内容类型）
- 来源信息（名称、类型、域名）
- 作者信息（姓名、Handle、主页）
- 内容文本（标题、正文、Hashtags、Mentions、Emojis）
- NLP 富化（情感、语言、国家、关键词、命名实体）
- 传播指标（触达量、AVE、社交回声、编辑回声）
- 互动指标（点赞、回复、评论、分享、浏览量）
- 匹配上下文（命中搜索、命中关键词）
- 自定义标签与分类

详细说明见 [docs/Meltwater_API_可用字段清单.md](docs/Meltwater_API_可用字段清单.md)。

## 已知限制

| 限制 | 说明 |
|---|---|
| 月度 Export 配额 | 套餐决定，当前约可导出 20-30 万条/月 |
| 搜索不回溯历史 | 新建搜索只从创建日开始采集，无历史数据 |
| 单个 Export 最多 5 个搜索 | 超过自动分批 |
| X/Reddit 原文不可获取 | body 字段为 null，需调用源平台 API |
| Social Analytics 无权限 | 无法拉取自有社媒账号数据 |
| Data Streams 无权限 | 无法实时推送 |

## API 认证

在 Meltwater 后台生成 API Token，写入 `.env`：

```
MELTWATER_API_KEY=your_token_here
MELTWATER_BASE_URL=https://api.meltwater.com
```

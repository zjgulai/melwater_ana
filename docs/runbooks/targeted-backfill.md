# Targeted Meltwater Backfill Runbook

本 runbook 用于继续执行上一轮因额度耗尽而中断的 Meltwater API 补采。当前唯一允许的目标是吸奶器次要搜索 `28546470`、`28546475` 在 `[2026-01-01T00:00:00Z, 2026-02-20T00:00:00Z)` 的缺口。

## 安全边界

- 不要重新运行整个“吸奶器”品类。
- 不要重复拉取已经完成的核心 5 个搜索：`18922074`、`18922087`、`18913527`、`28546460`、`28546462`。
- 不要复用已完成的 Export `17774723`。
- 真实 API 调用必须同时满足：
  - 命令带 `--execute`
  - 环境变量 `MELTWATER_LIVE_API=1`
  - `.env` 中有 `MELTWATER_API_KEY`

## 预检

```bash
uv run --python 3.12 python -m meltwater_excel.cli backfill-plan \
  --config config/backfill_20260101_20260220_pump_secondary.json \
  --output-root data/exports
```

预期输出：

```json
{"status": "DRY_RUN", "run_name": "backfill_20260101_20260220_pump_secondary", "can_publish": false}
```

该命令会创建或刷新：

```text
data/exports/backfill_20260101_20260220_pump_secondary/manifest.json
```

## 真实执行

```bash
MELTWATER_LIVE_API=1 uv run --python 3.12 python -m meltwater_excel.cli backfill-run \
  --config config/backfill_20260101_20260220_pump_secondary.json \
  --output-root data/exports \
  --execute
```

成功时，manifest 状态应变为 `READY_TO_PUBLISH`，并写入下载文件的 `path`、`bytes`、`sha256`、`document_count`、`unique_document_ids`。

如果账号额度仍受限，manifest 状态会变为 `PARTIAL_QUOTA_EXHAUSTED`，具体 export 状态会标记为 `BLOCKED_QUOTA`。这种情况不能发布，只能等额度恢复或升级套餐后重试。

## 后续解析

成功下载后，应把新 JSON 加入 `config/excel_export_sources.json` 或建立新的来源配置，再运行：

```bash
uv run --python 3.12 python -m meltwater_excel.cli build-all \
  --config config/excel_export_sources.json \
  --output-dir data/excel_complete_YYYYMMDD
```

合并分析必须按 `document.id` 去重；跨品类重叠是否保留，需要由分析口径决定。


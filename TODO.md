# 待执行任务

> 状态更新：本文件保留历史 API 补采记录，但 2026-06-11 后不再把“吸奶器次要 2 搜索额度阻断”视为当前阻塞项。当前项目级待办以 `docs/superpowers/plans/2026-06-14-melwater-capability-debt-roadmap.md` 为准。

## 2026-06-14 当前待办

- 配置真实告警 webhook 后，运行生产 webhook readiness 和 alert drill。
- 补齐生产资产清单中的负责人、SLO、腾讯云资源 ID、备份恢复证据和告警渠道。
- 将 action owner 与 action feedback 从示例配置推进到真实业务闭环。
- 对 blocked search quality gate 执行 query rewrite、重采和 precision 复测。
- 将大体量数据、发布包、运行状态和私钥移出仓库工作目录，保留 manifest、fixture 和可复现脚本。
- 可选清理已合并分支 `codex/fix-playbook-deploy-checklist`；该分支已通过 PR #1 合入 `main`。

## 2026-06-14 已关闭事项

- PR #1 已合并到 `main`，release-hardening 运维脚本已进入 `origin/main`。
- 生产已发布 `playbook-pain-radar-lab-0.0.0-20260614T052228Z-g7a09e358`。
- 生产 release 已映射到 git commit `7a09e358`。
- 公网站点、review-state API、Docker health、ops report 和 mock alert drill 已通过。

## 2026-06-11 补采闭环状态

当前完整 Excel 包：

`data/excel_complete_20260611/`

当前校验结论：

- `validation_manifest.json` 状态：`PASS`
- 原始出现记录：347,138
- 唯一文档：336,435
- 已知缺口：0
- 吸奶器次要搜索 `28546470`、`28546475` 已通过 manifest 驱动补采完成。

完整业务 Playbook：

- `docs/playbooks/meltwater-voc-business-insights-playbook.md`

项目总览、债务和后续计划：

- `docs/superpowers/plans/2026-06-14-melwater-capability-debt-roadmap.md`

## 2026-06-04 本轮 API 获取结果（历史记录）

目标用户日期：`2026-01-01 ~ 2026-02-21`（包含结束日）  
实际 API 区间：`[2026-01-01T00:00:00Z, 2026-02-22T00:00:00Z)`

结果目录：

`data/exports/round_20260604_backfill_20260101_20260221/`

| 品类/批次 | 状态 | 文档数 | 与旧数据重叠 | 真正新增唯一文档 |
|---|---|---:|---:|---:|
| 暖奶器 | ✅ 已下载，Export `17774638` | 79,768 | 2,896 | 76,872 |
| 吸奶器核心 5 搜索 | ✅ 已下载，Export `17774723` | 43,708 | 1,828 | 41,880 |
| 吸奶器次要 2 搜索 | ✅ 2026-06-11 已补齐 | 247 | 已并入完整包 | 上一轮缺口已关闭 |

2026-06-04 当时 Meltwater 当月已计入 **123,476 个 Export 文档**。创建第三批时，Export API 和 Search API 均返回 `HTTP 429 restricted`。该阻塞已在 2026-06-11 通过后续补采关闭。

### 历史执行建议

当时建议额度恢复或升级后只补采以下两个搜索：

- `28546470`：Medela Breast Pump，估计缺少 219 次命中
- `28546475`：Spectra Breast Pump，估计缺少 36 次命中
- 缺口区间：`[2026-01-01T00:00:00Z, 2026-02-20T00:00:00Z)`

**不要重新运行整个“吸奶器”品类补采**，否则会重复获取已完成的 43,708 条核心批次并再次消耗额度。

详细状态见：

- `data/exports/round_20260604_backfill_20260101_20260221/manifest.json`
- `data/exports/round_20260604_backfill_20260101_20260221/validation.json`
- `data/exports/round_20260604_backfill_20260101_20260221/RUN_SUMMARY.md`
- `data/exports/backfill_20260101_20260220_pump_secondary/`

## 消毒器限制

搜索 28678966 于 2026-05-20 新建，**2026-05-20 之前无历史数据**。
如需消毒器历史数据，Meltwater 无法提供（搜索不回溯）。

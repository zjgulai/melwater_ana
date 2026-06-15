# Melwater 页面功能与使用说明 QA

日期：2026-06-15 UTC  
执行人：Codex  
生产域名：`https://melwater.lute-tlz-dddd.top/`  
最终生产 release：`playbook-pain-radar-lab-0.0.0-2026-06-15T10-35-31-110Z`

## 1. 结论

本轮已完成生产站 14 个页面的深度巡检、中文化补强、字体字号层级优化、移动端布局修复、页面使用说明补齐、筛选/搜索/写回/导出/运维入口验证和公网真实浏览器 E2E。

最终公网 E2E 结果：

```json
{
  "baseUrl": "https://melwater.lute-tlz-dddd.top/",
  "writebackTokenProvided": true,
  "failures": [],
  "checkedPages": "14 pages x desktop/mobile",
  "bodyOverflowX": 0,
  "outOfViewportCount": 0,
  "consoleErrors": 0,
  "playbookText": false
}
```

## 2. 本轮修复范围

| 类别 | 修复 |
| --- | --- |
| 页面解释 | 所有页面新增“页面用途 / 怎么使用 / 筛选与交互 / 输出动作”说明区 |
| 中文化 | 业务页可见文案统一中文；保留必要技术词，如 API、VOC、token、review-state、document_id |
| 字体字号 | 增加全局字号层级变量，提升标题、卡片、指标、表格、按钮的可读性 |
| 移动端导航 | 移动端导航从横向滚动改为自动换行按钮区，消除视口外元素 |
| 痛点页布局 | 1320px 以下强制单列；修复移动端雷达图和右侧卡片挤压导致的超长页面 |
| 行动页溢出 | 长英文原话和 URL 增加 `overflow-wrap:anywhere`，避免撑宽卡片 |
| Ops 发布展示 | 运维页展示层把内部 release 包名脱敏为 Melwater 口径，避免旧 Playbook 文案露出 |
| 写回鉴权 | 公网 E2E 使用正确浏览器 token key：`melwater:apiToken` |

## 3. 页面使用说明与验收

| 页面 | 怎么使用 | 已验证功能 |
| --- | --- | --- |
| 今日决策台 | 先看数据可信、痛点、行动和复盘的今日优先级；点击问题卡进入对应工作区。 | 决策卡片导航、页面说明、中文文案、桌面/移动端布局 |
| 数据可信度 | 判断搜索词是否足够可信；样本标记为真产品、噪声或不确定。 | 搜索样本判定写回、可信度门禁、页面说明、无 401 |
| 产品痛点 | 先看品类门禁，再用筛选切换品类；点击痛点行查看证据、雷达和推荐动作。 | 品类筛选、痛点行选择、证据抽屉、行动卡按钮、移动端单列布局 |
| 行动闭环 | 按负责人、状态、优先级、证据和关键词筛选动作；调整状态并导出。 | 状态写回控件、筛选下拉、搜索输入、导出控件、长链接换行 |
| 竞品证据 | 点击品牌卡查看竞品信号；被搜索阻断的品类只用于搜索治理。 | 竞品卡选择、解释边界、页面说明 |
| 内容机会 | 用来源标签筛选内容机会；点击机会行查看建议角度和原话。 | 来源筛选、机会行选择、跳转用户原话库 |
| 用户原话 | 按情感标签筛选原话；查看主题、来源、document_id 和 occurrence_id。 | 情感筛选、通过写回、法务写回 |
| 概念验证 | 点击概念行查看验证假设、实验步骤和证据；对概念做测试/暂缓/拒绝决策。 | 概念行选择、概念决策写回 |
| 风险预警 | 用品类标签筛选风险队列；判断业务危机、搜索污染或采集异常。 | 风险品类筛选、风险行选择、分诊写回 |
| 区域语言 | 切换全部线索/仅已知国家；点击语言国家行判断是否能进入市场优先级。 | 仅已知国家筛选、区域语言行选择 |
| 经营复盘 | 切换月份后点击品类行，生成会议叙事、可信度边界和行动要求。 | 月份切换、复盘品类选择 |
| 数据红线 | 查看数据解释边界；把红线规则带入所有业务页和导出材料。 | 红线卡片可见、页面说明、无横向溢出 |
| 操作留痕 | 刷新最新事件，按 namespace、operation、actor、版本和 meta 追踪变更。 | 操作留痕刷新，生产写回事件可见 |
| 系统运维 | 保存/测试 token，刷新生产健康；管理员再执行备份或 report。 | 保存 token、测试 token、刷新生产健康、发布展示脱敏 |

## 4. 验收证据

本地验证：

| 命令/检查 | 结果 |
| --- | --- |
| `npm run build` | pass |
| `npm run check:ui-copy` | pass |
| 本地全站轻量巡检 | pass，14 页桌面/移动端无视口横向溢出 |
| 移动端痛点页目标复测 | pass，证据抽屉和行动卡可点击 |
| 行动页目标复测 | pass，桌面/移动端无视口溢出 |

生产发布：

| 检查 | 结果 |
| --- | --- |
| `release:package` | pass |
| `release:verify` | pass，`failures=[]` |
| 远程 preflight | pass，`melwater-preflight-ok` |
| Docker deploy/restart | pass |
| shared edge proxy refresh | pass |
| public smoke | pass，HTTP 200，title `Melwater VOC 决策工作台` |
| `review:verify-deploy -- --require-auth` | pass |

生产 API replay：

```json
{
  "ok": true,
  "eventCount": 12,
  "replayedEventCount": 12,
  "entriesTotal": 5,
  "replayOk": 1
}
```

证据路径：

```text
outputs/prototypes/playbook-pain-radar-lab/output/playwright/2026-06-15-production-deep-check/local-final-v3/local-final-v3.json
outputs/prototypes/playbook-pain-radar-lab/output/playwright/2026-06-15-production-deep-check/local-target-pain/mobile-pain-target.json
outputs/prototypes/playbook-pain-radar-lab/output/playwright/2026-06-15-production-deep-check/local-target-actions/actions-target.json
outputs/prototypes/playbook-pain-radar-lab/output/playwright/2026-06-15-production-deep-check/production-final-v2/production-final-v2-e2e.json
outputs/prototypes/playbook-pain-radar-lab/output/playwright/2026-06-15-production-deep-check/production-final-v2/
```

## 5. 仍需保留的边界

- 真实飞书/企微 webhook 尚未申请，外部送达仍不能声明已闭环。
- 本轮生产 E2E 使用了受控写回，actor 为 `Codex production E2E 2026-06-15`；后续业务数据上线前应保留测试事件可追溯性。
- 内部 package/release id 仍沿用历史包名；前端展示已脱敏，但后续可单独做包名迁移，避免运维层语义债继续积累。
- 本轮未执行生产 rollback 恢复演练。


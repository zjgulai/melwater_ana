# Melwater 中文业务闭环产品审计与优化计划

日期：2026-06-14
范围：当前仓库、生产发布口径、Meltwater VOC 数据链路、`outputs/prototypes/playbook-pain-radar-lab` 前端产品、既有 playbook 与 roadmap 文档。

## 1. 当前结论

项目的数据工程和生产部署已经明显领先于产品体验：数据采集、Excel 解析、marts、发布、健康检查、备份、ops report 和 mock alert drill 已经形成基础闭环；但网站本身还没有形成中文业务闭环产品。

当前网站更像“分析模块集合”，不是“业务负责人能按故事线完成决策的工作台”。核心问题是：

- 页面入口仍以英文分析名和技术模块名为主，例如 `Search Quality Lab`、`Product Pain Radar`、`Action Closed Loop`、`Quote Library`、`Ops Status`。
- 首页虽然已有“从业务问题进入”的雏形，但页面之间缺少强制流程：用户可以看到数据，却不一定知道下一步该交给谁、做什么、何时复盘。
- 中英文混排严重，降低管理层和业务团队理解成本，也削弱品牌一致性。
- 目前 action register 能编辑 owner/status，但真实业务反馈还没有回流，`action_feedback_applied=0`、`measuredActions=0`。
- 页面有证据和动作元素，但缺少统一的“问题 -> 证据 -> 判断 -> 动作 -> 复盘 -> 下次决策”叙事骨架。

目标应调整为：把 Melwater Analyst Lab 重构成一个中文业务决策工作台，而不是英文数据分析实验室。

## 2. 当前项目已经提供的能力

### 2.1 数据能力

- 原始 Meltwater JSON 导出清点、补采规划、补采执行保护。
- JSON 到完整 Excel 解析，保留 scalar 字段、数组关系、命中关系、关键词、实体和长文本。
- 完整 Excel 包 `data/excel_complete_20260611/` 已校验 `PASS`。
- 当前数据口径：347,138 条原始出现记录，336,435 个唯一文档，6,871,226 行关系数据，known source gaps 为 0。
- 已生成 search quality、pain radar、weekly health、competitor battlecards、content opportunities、quote library、crisis watch、region priorities、concept candidates、executive monthly、action register 和 feedback overlay。

### 2.2 洞察能力

- 判断搜索质量是否可信，避免把 query 噪声解释成业务结论。
- 找出产品痛点、负面主题、证据深度和推荐 owner domain。
- 生成竞品 battlecard、内容机会、用户原话库、概念候选、危机 watch、区域语言优先级和管理层月报。
- 输出 21 张 pain cards、57 条 proposed actions、18 张 battlecards、30 条 content opportunities、120 条 quotes、2 个 blocked search-quality gates。

### 2.3 产品与生产能力

- React/Vite 前端已覆盖首页、搜索质量、痛点雷达、动作闭环、数据质量、竞品、内容、原话、概念、危机、区域、月报、审计日志、Ops 状态。
- Review-state API 支持写回 owner/status/priority/impact、事件回放、备份、metrics、ops report。
- 腾讯云生产环境已部署，域名 `https://melwater.lute-tlz-dddd.top`。
- 生产 release `playbook-pain-radar-lab-0.0.0-20260614T052228Z-g7a09e358` 映射到 git commit `7a09e358`。
- 当前 `main` 与 `origin/main` 对齐；未发现未合并分支。

## 3. 可以解决的具体业务问题

当前系统能够支撑以下问题，但网站还没有把这些问题串成稳定流程：

| 业务问题 | 当前可用能力 | 当前产品缺口 |
| --- | --- | --- |
| 这批 VOC 数据能不能用于业务判断？ | Search quality gate、sample review、blocked 标记 | 应成为首页第一步，而不是独立英文实验室 |
| 哪些产品问题最严重？ | Pain radar、negative rate、evidence count、quotes | 缺少“进入产品/CX/内容动作”的强制分流 |
| 哪些洞察不能下结论？ | blocked search quality、readiness label | 阻断信息没有贯穿所有页面的决策按钮 |
| 哪些竞品问题可用于销售/内容话术？ | Battlecards、brand/topic/channel 拆解 | 缺少中文 battlecard 输出模板和负责人 |
| 哪些用户原话可转为内容？ | Quote library、content opportunities | 缺少人工审核状态、发布渠道和内容 brief 闭环 |
| 哪些概念值得验证？ | Concept candidates、evidence samples | 缺少小样测试、产品评审和反证区 |
| 是否有危机或异常信号？ | Crisis watch、daily alert rows | 缺少 PR/CX 分诊流程和 24h/72h 复盘状态 |
| 管理层月会先看什么？ | Executive monthly、weekly action review | 缺少中文会议路径和“本周必须决策”收口 |
| 已提出的动作有没有产生影响？ | Action register、feedback overlay | 真实 feedback 尚未回流，闭环指标为 0 |

## 4. 业务价值

### 4.1 已经可以实现的价值

- 产品团队：把零散用户声音转为按严重度、证据深度和 owner domain 排序的痛点池。
- 客服/CX：把 leak、suction、battery、refund、broken 等问题转为 FAQ、话术、售后标签和升级路径。
- 内容/营销：把正向用户语言、使用场景和平台分布转为内容 brief、PDP copy 和短视频脚本方向。
- 竞品/销售：用用户证据生成 battlecard，支撑 objection handling 和竞品差异化表达。
- PR/品牌：识别高影响力负面、平台集中负面和异常主题，形成预警队列。
- 管理层：把“数据质量、Top 洞察、行动状态、未闭环风险”压缩到月会决策路径。

### 4.2 还不能宣称的价值

- 不能直接宣称销量、市场份额、留存、ROI 改善，因为缺少订单、退货、客服工单、广告、CRM 或 SKU 数据。
- 不能宣称动作有效，因为真实 action feedback 和 measured actions 仍为 0。
- 不能把暖奶器、消毒器的被阻断搜索直接解释为业务结论。

## 5. 当前网站页面审计

| 当前页面 | 当前作用 | 主要问题 | 目标中文页面 |
| --- | --- | --- | --- |
| Home | 指标概览和问题入口 | 中文问题与英文状态混排；故事线弱 | `今日决策台` |
| Search Quality | 搜索质量表和样本 | 英文命名；像数据治理工具，不像业务第一关 | `数据可信度检查` |
| Pain Radar | 痛点雷达和证据抽屉 | 图表有价值，但行动入口不够强 | `产品痛点优先级` |
| Action Loop | action register 和 weekly review | 有写回能力，但真实闭环未发生 | `行动闭环看板` |
| Data Quality | 业务解释护栏 | 应全局化，而不是单独页面 | `数据口径与红线` |
| Competitor | battlecards | 缺少中文销售/内容输出模板 | `竞品证据卡` |
| Content | content opportunities | 缺少 brief 审核、发布渠道和复盘指标 | `内容机会池` |
| Quotes | quote library | 缺少可发布/不可发布审稿流 | `用户原话库` |
| Concept | concept candidates | 缺少小样测试流程和反证 | `产品概念验证` |
| Crisis | crisis watch | 缺少分诊 owner 和响应状态 | `风险预警台` |
| Region | region/language priority | 容易误读地域，需更强口径约束 | `区域与语言机会` |
| Executive | monthly rows | 缺少“本月要决策什么”的会议结构 | `管理层月会` |
| Audit Log | review event history | 对业务用户价值弱 | `操作留痕` |
| Ops | production ops | 运维页面不应混在业务主导航 | `系统运维` |

## 6. 目标信息架构

建议重构为 6 个中文主流程，而不是 14 个并列模块：

1. `今日决策台`
   - 回答：今天哪些数据可信？哪些问题必须处理？哪些动作过期？
   - 入口指标：数据可信度、Top 5 痛点、待确认 owner、待复盘动作、风险预警。

2. `数据可信度检查`
   - 回答：哪些搜索可以解释业务，哪些只能做 query 治理？
   - 输出：query rewrite brief、样本复核任务、阻断原因。

3. `产品痛点与证据`
   - 回答：产品/CX/内容/PR 应该处理哪些问题？
   - 输出：痛点卡、证据抽屉、推荐动作、owner domain。

4. `增长与竞品机会`
   - 回答：哪些内容、竞品话术、用户原话可以转成增长动作？
   - 输出：内容 brief、竞品证据卡、用户原话审核队列。

5. `行动闭环`
   - 回答：谁负责、做到哪一步、是否产生效果？
   - 输出：owner、状态、优先级、验收指标、复盘结果。

6. `经营复盘`
   - 回答：本周/月管理层应该看什么、决定什么、追责什么？
   - 输出：周会队列、月报、风险清单、未闭环清单。

运维能力保留，但移动到二级入口：`系统运维`、`操作留痕`、`生产状态`。

## 7. 中文风格规范

### 7.1 命名原则

- 产品名保留 `Melwater`。
- 一级导航全部中文。
- 技术名只在字段、导出、审计和开发态显示。
- 页面标题使用业务语言，不使用 `Lab`、`Radar`、`Action Loop`、`Battlecard` 作为主标题。

### 7.2 推荐替换表

| 当前文案 | 建议中文 |
| --- | --- |
| Melwater Analyst Lab | Melwater VOC 决策工作台 |
| Search Quality Lab | 数据可信度检查 |
| Product Pain Radar | 产品痛点优先级 |
| Action Closed Loop | 行动闭环看板 |
| Data Quality Overview | 数据口径与红线 |
| Competitor Battlecards | 竞品证据卡 |
| Content Opportunity Lab | 内容机会池 |
| User Voice Quote Library | 用户原话库 |
| Concept Candidate Lab | 产品概念验证 |
| Crisis Response Watchtower | 风险预警台 |
| Region & Language Priority | 区域与语言机会 |
| Executive Monthly Brief | 管理层月会 |
| Review Audit Log | 操作留痕 |
| Ops Status & Access | 系统运维 |
| Owner | 负责人 |
| Review | 复盘 |
| Ready | 可进入业务判断 |
| Blocked | 已阻断 |
| Proposed | 待确认 |
| Measured | 已复盘 |

### 7.3 页面叙事模板

每个业务页面必须统一为 5 段：

1. `当前判断`：这页现在能告诉业务什么。
2. `证据基础`：数据量、样本、来源、可信度。
3. `风险红线`：哪些结论不能说。
4. `建议动作`：推荐给哪个团队做什么。
5. `复盘指标`：用什么指标判断动作是否有效。

## 8. 可拓展性评估

### 8.1 强项

- ETL 和 mart 层已经覆盖多个业务场景，扩展新页面不需要从零做数据。
- 静态 JSON + React 部署简单，适合内部产品快速迭代。
- Docker 部署、release package、health、backup、ops report 已有生产基础。
- action/writeback API 已经具备真实闭环的技术底座。

### 8.2 限制

- 当前前端核心逻辑集中在 `src/App.jsx`，页面多、状态多、文案多，继续扩展会变得难维护。
- 静态 JSON 适合只读分析，但不适合多用户、权限、增量刷新和历史版本对比。
- Review-state 目前还不是长期多用户数据库方案。
- Excel 适合交付，不适合作为大规模关系分析长期底座。
- 真实业务效果评估缺少外部数据源。

### 8.3 扩展方向

- 前端拆分为 `routes/`、`components/`、`data/`、`copy/zh-CN.js`。
- 数据层保留 fixture JSON，生产态逐步切到 API/SQLite/DuckDB。
- Review-state 迁移到 Postgres/SQLite server mode，并加入用户、角色和审计。
- 大数据产物迁移到 artifact storage，仓库只保留 manifest、fixture、schema 和脚本。

## 9. 脆弱点与缺口

| 类型 | 脆弱点 | 优先级 | 处理方案 |
| --- | --- | --- | --- |
| 产品体验 | 页面是模块堆叠，不是中文业务闭环 | P0 | 重构 IA 和页面文案，建立 6 个中文主流程 |
| 业务闭环 | `action_feedback_applied=0`、`measuredActions=0` | P0 | 接入真实 owner、状态和复盘反馈 |
| 数据治理 | 2 个 blocked search-quality gates | P0 | query rewrite、重采、precision 复测 |
| 文案一致性 | 中英文混排，管理层理解成本高 | P0 | 建立中文 copy map 和 lint 检查 |
| 前端工程 | `App.jsx` 过重，页面和文案耦合 | P1 | 拆路由、组件、数据适配和文案文件 |
| 生产告警 | 真实 Feishu/WeCom webhook 未配置 | P0 | 配置真实 webhook 并跑 readiness |
| 生产治理 | 负责人、SLO、资源 ID、监控入口缺失 | P0 | 补齐腾讯云资产清单 |
| 密钥治理 | `ai_video.pem` 在项目根目录 | P0 | 移出 repo 目录，使用 SSH agent 或外部 secret path |
| 数据平台 | 大体量数据和 release/runtime artifacts 在 workspace | P1 | 迁移到外部 artifact storage |
| 测试 | 缺少浏览器级业务验收测试 | P1 | Playwright 覆盖 6 个主流程 |

## 10. 分支和合并状态

当前确认：

- 当前分支：`main`。
- `main`、`origin/main`、`origin/HEAD` 对齐到 `17d31631`。
- 未发现未合并到 `main` 的本地分支。
- 未发现未合并到 `main` 的远端分支。
- `codex/fix-playbook-deploy-checklist` 和 `origin/codex/fix-playbook-deploy-checklist` 是历史分支，PR #1 已合并，当前可按需删除。
- 生产代码不是最新文档提交，而是 release id 中映射的 `7a09e358`。

## 11. 未完成任务总表

### P0

- 中文业务闭环网站重构。
- 清理中英文混排，建立中文文案系统。
- 真实 action owner 与 feedback 回流。
- 2 个 blocked query 的 rewrite、重采和复测。
- 配置真实外部告警 webhook。
- 补齐生产负责人、SLO、资源 ID、监控入口和恢复演练证据。
- 移出项目根目录中的 SSH key。

### P1

- 前端模块化拆分。
- 增加浏览器级验收测试。
- fixture CI 与 full-data scheduled validation。
- 外置大体量数据、release 包和 runtime state。
- review-state 持久化方案升级。
- 接入客服、退货、评论、订单或 CRM 数据，支撑 ROI/留存/质量改善判断。

### P2

- 多角色权限。
- 自定义业务问题模板。
- 自动生成中文周报/月报/会议包。
- 多周期趋势对比和版本化数据快照。

## 12. 执行计划

### Phase 1：中文产品壳和故事线

目标：让网站第一屏变成中文业务决策工作台。

任务：

- 建立中文导航：今日决策台、数据可信度、产品痛点、增长与竞品、行动闭环、经营复盘、系统运维。
- 把 `pageHeaders`、sidebar、按钮、状态、空状态、表头统一中文化。
- 首页改为“今天先看什么”：数据可信度、Top 痛点、待分派动作、待复盘动作、风险预警。
- 所有页面加入统一闭环条：`可信度 -> 证据 -> 动作 -> 负责人 -> 复盘`。

验收：

- 业务主路径无英文页面标题。
- 用户从首页 2 次点击内进入任一业务动作。
- 每个页面都有“下一步动作”和“复盘指标”。

### Phase 2：页面闭环重构

目标：每个页面从分析视图变成可执行业务页面。

任务：

- 数据可信度页：输出 query rewrite brief 和复核队列。
- 产品痛点页：每张痛点卡绑定推荐 owner、动作类型、证据样本和复盘指标。
- 增长与竞品页：合并内容、竞品、原话，输出内容 brief / 竞品话术 / 用户原话审核。
- 行动闭环页：默认按未分派、即将到期、需复盘排序。
- 经营复盘页：输出本周必须决策、已阻断结论、待追责动作。

验收：

- 每个 insight 都可追踪到 `evidence -> action -> owner -> status`。
- 行动闭环页不再只是列表，而是业务 review 队列。

### Phase 3：真实业务反馈闭环

目标：让 `measuredActions` 和 `action_feedback_applied` 从 0 变为正数。

任务：

- 选 10-15 条 P0/P1 action 分配真实 owner。
- 约定状态：待确认、已接收、处理中、已上线、已复盘、已关闭、已拒绝。
- 建立 action feedback CSV/API 写回字段：实际动作、上线时间、复盘指标、结果、关闭原因。
- 每周经营复盘页面读取反馈并更新闭环率。

验收：

- `action_feedback_applied > 0`。
- `measuredActions > 0`。
- 至少 1 个问题家族完成从 VOC 到动作到复盘。

### Phase 4：数据可信度修复

目标：解除 blocked query 对业务结论的限制。

任务：

- 针对暖奶器和消毒器 blocked search 执行 query rewrite。
- 重采受影响时间窗。
- 重建 Excel/marts/product JSON。
- 对比重采前后的 precision、噪声词、痛点分布。

验收：

- blocked gate 通过 precision 阈值，或保留阻断但有明确业务例外说明。
- 所有页面对 blocked 数据继续显示风险红线。

### Phase 5：工程化和可扩展

目标：让下一轮产品迭代不再压在单文件和人工验收上。

任务：

- 拆分 `src/App.jsx`。
- 建立 `copy/zh-CN` 文案表。
- 建立页面配置驱动导航。
- 加入 Playwright 验收：今日决策台、数据可信度、产品痛点、行动闭环、经营复盘、系统运维。
- 建立英文残留检查，允许字段名/技术名白名单。

验收：

- 主业务页面标题、按钮、导航、表头中文化。
- 浏览器测试覆盖 6 条主路径。
- 新页面接入只需新增 route config、copy、data adapter。

## 13. 推荐下一步

建议下一轮直接执行 Phase 1，原因是它风险最低、业务可见度最高，并且不会触碰生产数据采集或外部 webhook。

具体第一轮任务：

1. 在前端建立中文导航和页面标题映射。
2. 把首页改成“今日决策台”。
3. 把主流程收敛为 6 个中文入口。
4. 保留原页面能力，但重新组织到中文故事线下。
5. 加入英文残留清单，先允许技术字段，禁止业务 UI 标题继续英文混排。

第一轮验收标准：

- 公网首页第一屏是中文业务决策工作台。
- 主导航无 `Lab`、`Radar`、`Action Loop`、`Battlecards`、`Quote Library` 这类英文主标题。
- 首页能明确回答：哪些数据可信、哪些问题优先、哪些动作待闭环、下一步由谁处理。

## 14. Phase 1 执行记录

执行时间：2026-06-14

已完成：

- 主导航从英文模块式导航收敛为中文业务路径：今日决策台、数据可信度、产品痛点、行动闭环、增长与竞品、经营复盘、系统运维等。
- 首页改为“今日决策台”，新增今日处理顺序、四张决策卡和六个业务问题入口。
- 增加全局闭环条：数据可信、业务问题、证据判断、负责人动作、复盘结果。
- 页面主标题从 `Lab/Radar/Action Loop/Battlecards/Quote Library` 等英文实验室风格，改为中文业务标题。
- 行动闭环页增加中文状态、中文行动类型、中文周会队列与负责人负载文案。
- 浏览器标题改为 `Melwater VOC 决策工作台`，页面语言设置为 `zh-CN`。

验证：

- `git diff --check` 通过。
- `npm run build` 通过。
- 本地开发服务 `http://127.0.0.1:5173/` 返回 HTTP 200。

仍未完成：

- 尚未做浏览器截图级视觉验收。
- 尚未部署到腾讯云生产。
- 各页面还需要进一步补齐“当前判断、证据基础、风险红线、建议动作、复盘指标”的页面级闭环结构。
- 部分技术字段、环境变量、底层状态枚举仍保留英文，后续应建立白名单和 UI 英文残留检查。

## 15. Phase 2 执行记录

执行时间：2026-06-14

已完成：

- 新增页面级业务闭环面板，所有页面顶部统一展示：
  - 当前判断
  - 证据基础
  - 风险红线
  - 建议动作
  - 复盘指标
- 每个页面拥有独立闭环文案，覆盖今日决策台、数据可信度、产品痛点、行动闭环、数据红线、竞品证据、内容机会、用户原话、概念验证、风险预警、区域语言、经营复盘、操作留痕和系统运维。
- 闭环面板与 Phase 1 的全局流程条共同形成“数据可信 -> 业务问题 -> 证据判断 -> 负责人动作 -> 复盘结果”的固定故事线。
- 新增响应式样式，桌面端五列展示，小屏自动收敛为两列或单列。

验证：

- `git diff --check` 通过。
- `npm run build` 通过。
- 本地开发服务继续可用，`http://127.0.0.1:5173/` 返回 HTTP 200。

仍未完成：

- 尚未执行浏览器截图级视觉验收。
- 尚未部署到腾讯云生产。
- 仍需建立 UI 英文残留检查和技术字段白名单。
- 行动闭环仍缺真实业务 owner 和 feedback 回流，`measuredActions` 仍未从数据侧闭环。

## 16. Phase 3 执行记录

执行时间：2026-06-14

已完成：

- 新增 UI 文案守卫：`npm run check:ui-copy`。
  - 禁止旧的可见业务标题回流，例如 `Melwater Analyst Lab`、`Search Quality Lab`、`Product Pain Radar`、`Action Closed Loop`、`Quote Library`、`Ops Status & Access`。
  - 允许技术字段和运行时字段，例如 API、VOC、marts、query、owner、token、review-state、document_id、occurrence_id、`MELWATER_RELEASE_REF`。
- 补齐 `public/favicon.svg` 并在 `index.html` 引用，消除浏览器默认 `/favicon.ico` 404。
- 修复系统运维页 token 输入区语义，把普通容器改为 `form`，保存 token 走 submit，清除 Chrome password-field verbose 提示。
- 用 Playwright 抽样验证以下主路径：
  - 今日决策台
  - 数据可信度
  - 产品痛点
  - 行动闭环
  - 经营复盘
  - 系统运维
- 输出桌面与移动端截图级 QA 证据：
  - `output/playwright/2026-06-14-melwater-cn-business-loop/desktop-home.png`
  - `output/playwright/2026-06-14-melwater-cn-business-loop/mobile-home.png`
  - `output/playwright/2026-06-14-melwater-cn-business-loop/mobile-ops.png`

验证：

- `npm run check:ui-copy` 通过。
- `npm run build` 通过。
- `git diff --check` 通过。
- `curl -I http://127.0.0.1:5173/` 返回 HTTP 200。
- Playwright 快照确认页面标题为 `Melwater VOC 决策工作台`，首页和系统运维页均展示中文业务闭环面板。
- 最新 Playwright 控制台日志仅有 React DevTools 开发提示，无 favicon 404、无 password field verbose 提示、无运行时 error。
- 390px 移动端首页与系统运维页目检通过，导航、页面闭环面板、指标卡和表单区均按单列或横向导航收敛，无明显遮挡。

仍未完成：

- 尚未部署到腾讯云生产；生产仍是 `playbook-pain-radar-lab-0.0.0-20260614T052228Z-g7a09e358`。
- 尚未做发布后公网截图回归。
- 行动闭环仍缺真实业务 owner 和 feedback 回流，`measuredActions` 仍未从数据侧闭环。
- 真实飞书/企微 webhook 仍未配置，本轮只保留系统运维页风险红线说明。

## 17. Phase 4 发布预检记录

执行时间：2026-06-15

首次发布候选：

- Release ID：`playbook-pain-radar-lab-0.0.0-2026-06-15T02-46-20-637Z`
- Release dir：`outputs/prototypes/playbook-pain-radar-lab/releases/playbook-pain-radar-lab-0.0.0-2026-06-15T02-46-20-637Z`
- App tarball sha256：`b08921939f1ea69b87068a0de3adf19003f91240b5c6794af8fdf32487ab528d`
- Rollback tarball sha256：`508f5205d281ef3c29e965e80896d9ab14710f614ef18758294c62aa1b8af543`

已完成：

- `npm run release:package` 生成本地发布候选和 rollback 包。
- `npm run release:verify -- --release-dir=...` 通过，`failures: []`，app file count 55，rollback file count 24。
- 使用临时环境变量执行腾讯云只读预检：
  - `deploy:preflight -- --release-dir=... --execute --check-ssh`
  - 目标服务器：`101.34.52.232`
  - 部署模式：Docker Compose
  - 远程检查：docker、docker compose、tar、rsync、sha256sum、compose 文件、secrets env 文件、sudo、stage root。
  - 结果：`ok: true`，`stdout: melwater-preflight-ok`，`warnings: []`，`failures: []`。

明确未执行：

- 未上传 release tarball。
- 未重启 Docker Compose。
- 未刷新共享 nginx。
- 未覆盖生产目录。
- 未修改线上 `REVISION` 或 `MELWATER_RELEASE_REF`。

发布前阻断：

- 当前记录对应的首次候选生成时，工作区仍有未提交改动。`release:package` 会打入本地改动，但 manifest 的 `gitSha` 仍来自当前 HEAD；如果直接部署，会造成生产 release 与 git commit 不可追溯。
- 该阻断点已在后续步骤修复：本轮中文化和 QA 改动已提交并推送到 `origin/main`，commit `f0d52ca0`；随后重新生成可追溯 release candidate `playbook-pain-radar-lab-0.0.0-2026-06-15T02-51-50-613Z`，manifest `gitSha=f0d52ca0`，`release:verify` 通过，腾讯云只读 `deploy:preflight --execute --check-ssh` 通过。
- 后续真实部署前如再发生 docs-only 或代码提交，应按同一规则重新生成 candidate，确保 release manifest 的 `gitSha` 对齐目标提交。

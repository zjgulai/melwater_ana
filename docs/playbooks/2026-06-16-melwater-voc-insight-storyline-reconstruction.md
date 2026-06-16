# Melwater VOC 洞察故事线重构方案

日期：2026-06-16  
范围：当前 PRD / playbook、`data/excel_complete_20260611/`、`data/marts/20260611/`、前端快照 `outputs/prototypes/playbook-pain-radar-lab/src/data/vocData.json`、已部署中文业务闭环产品形态。  
目标：把当前“模块化分析页面”重构为端到端的业务故事线：`数据可信 -> 反直觉洞察 -> 决策判断 -> 责任分派 -> 业务动作 -> 复盘学习`。

---

## 1. 一句话结论

当前系统已经具备数据工程和初步洞察自动化能力，但洞察故事线仍停留在“报告集合”阶段。真正的产品价值不应该是展示 14 个页面和 57 条 action，而是帮助业务负责人回答 5 个连续问题：

1. 这批数据哪些能信，哪些不能信？
2. 哪些信号挑战了我们原来的判断？
3. 哪些洞察值得马上变成决策？
4. 谁负责做什么，什么时候复盘？
5. 动作之后，客户声音、业务指标和规则模型是否发生变化？

重构方向：把 Melwater VOC 从“分析工作台”升级成“经营决策闭环系统”。页面不再按数据模块组织，而按业务决策旅程组织。

---

## 2. 当前事实基线

### 2.1 数据资产

当前完整 Excel 数据包和 mart 已具备可审计底座：

| 指标 | 当前值 | 解释 |
| --- | ---: | --- |
| 来源数 | 7 | 来自 Meltwater 多个导出和补采配置 |
| 原始出现记录 | 347,138 | 用于触点、搜索命中、渠道和曝光分析 |
| 唯一文档 | 336,435 | 用于唯一内容规模分析 |
| 关系数据行 | 6,871,226 | 包含关键词、实体、命中关系、数组字段 |
| known source gaps | 0 | 当前完整包没有已知采集缺口 |
| `fact_insight` | 600 | 自动生成的洞察事实 |
| `fact_evidence_sample` | 3,863 | 洞察证据样本 |
| `fact_action_register` | 57 | 自动生成的业务动作候选 |

### 2.2 当前前端快照

| 指标 | 当前值 | 业务解释 |
| --- | ---: | --- |
| 阻断搜索 | 2 | 暖奶器、消毒器不能直接下业务结论 |
| 可行动痛点 | 7 | 当前主要集中在吸奶器 |
| Proposed actions | 57 | 全部仍处于待确认状态 |
| Measured actions | 0 | 尚未形成真实业务复盘 |
| 可复核竞品 | 6 | 吸奶器竞品维度可进入复核 |
| 可复核内容 brief | 10 | 多数来自吸奶器正向用户语言 |
| 可复核概念 | 7 | 可用于产品小样验证，不等同立项 |
| Crisis alerts | 30 | 当前主要应解释为数据治理/分诊队列 |
| 精选用户原话 | 120 | 前端精选子集；完整 quote mart 更多 |

### 2.3 质量门禁

| 品类 | Search | 估算 precision | 状态 | 业务含义 |
| --- | --- | ---: | --- | --- |
| 暖奶器 | Bottle Warmer | 40.29% | `blocked_by_query_noise` | 不能把负面率、异常、痛点解释成业务事实 |
| 消毒器 | Bottle Sterilizer & Dryer | 79.52% | `blocked_by_query_noise` | 接近阈值，但仍必须先复核和改 query |
| 吸奶器 | Momcozy / 竞品搜索 | 100.00% | `pass` | 可以进入洞察复核和动作分派 |

核心判断：系统当前最大的价值不是“发现了多少洞察”，而是已经能阻止错误洞察进入业务会议。

---

## 3. 行业参照：从 Meltwater/VOC 案例抽取机制

### 3.1 Meltwater Consumer Intelligence

Meltwater 对 Consumer Intelligence 的定位是持续捕捉社媒、新闻、论坛、评论等多源消费者对话，识别趋势、品牌健康、竞品动态和情感变化，并强调比传统调研更实时、更贴近非提示式真实表达。  
可迁移机制：当前 Melwater 不应只做静态报表，而应建立“趋势早发现 + 品牌健康 + 竞品语境 + 实时行动”的运行节奏。  
来源：[Meltwater Consumer Intelligence](https://www.meltwater.com/en/use-case/consumer-intelligence)、[Meltwater Consumer Insights Platform](https://www.meltwater.com/en/products/consumer-insights)。

### 3.2 Pernod Ricard：按消费场景组织社交数据

Pernod Ricard 使用 Meltwater 将消费者讨论按消费时刻、场合和行为场景组织，用于品牌健康、产品创新和趋势洞察。  
可迁移机制：母婴 VOC 不应只按 `pain / suction / leak` 关键词组织，还要按使用场景组织，例如夜间泵奶、办公室泵奶、外出携带、清洗消毒、产后疼痛、客服退换货。  
来源：[Pernod Ricard customer story](https://www.meltwater.com/en/customer-stories/pernod-ricard)。

### 3.3 The Economist：从数字到“为什么”的月度快照

The Economist 使用 Meltwater 把分散数据连接成可解释的 audience insight，并用月度 snapshot 支持内容、市场和区域决策。  
可迁移机制：当前 `executive_monthly_brief.md` 不能只列每月 occurrences、negative rate、blocked searches；必须转成“本月管理层要做的 3 个决定”。  
来源：[The Economist customer story](https://www.meltwater.com/en/customer-stories/economist)。

### 3.4 Hyundai：围绕价值观和社群理解细分客群

Hyundai France 使用 social listening 理解电动车消费者的价值观、偏好、意见领袖和社群，调整营销策略。  
可迁移机制：吸奶器 VOC 应从“功能痛点”升级为“妈妈群体价值观/场景语言/社区表达”的洞察，例如独立、舒适、隐私、夜间安静、重返职场、移动使用。  
来源：[Hyundai customer story](https://www.meltwater.com/en/customer-stories/hyundai)。

### 3.5 Haleon：超越品牌监测，服务销售和沟通

Haleon 使用 Meltwater 跟踪客户和医疗专业人士社群，洞察不仅服务外部沟通，也服务销售团队。  
可迁移机制：Momcozy 的 VOC 不应只服务产品和内容，还应产出销售/客服可直接使用的 objection handling、FAQ、证据卡。  
来源：[Haleon customer story](https://www.meltwater.com/en/customer-stories/haleon)。

### 3.6 闭环 VOC 最佳实践

Qualtrics 强调闭环反馈需要从收集反馈、识别触发条件、创建 ticket/case 到跟进处理；Gainsight 强调把反馈、产品行为和 build-measure-learn 连接起来。  
可迁移机制：当前 57 条 action 只有 `Proposed`，还没有 owner、actual metric 和 close reason，所以只能算 action 候选，不能算业务闭环。  
来源：[Qualtrics closed-loop CX](https://www.qualtrics.com/articles/customer-experience/closed-loop-cx/)、[Qualtrics closed-loop program](https://www.qualtrics.com/articles/customer-experience/how-create-closed-loop-program/)、[Gainsight closed-loop feedback](https://www.gainsight.com/essential-guide/product-led-growth/closed-loop-feedback/)。

---

## 4. 反直觉洞察

### 洞察 1：当前最大业务价值不是洞察，而是“阻断错误决策”

暖奶器声量最大、负面率看起来高，但 query precision 只有 40.29%。如果直接把它解释为产品危机，会误导产品、PR 和管理层。  

重构后的故事线应该先展示：

- 哪些结论被阻断。
- 阻断原因是什么。
- 需要怎样的 query rewrite 和样本复核。
- 阻断解除后哪些页面才能开放业务判断。

业务动作：把“阻断搜索”提升为首页 P0，而不是藏在数据质量页。

### 洞察 2：痛点词不只代表投诉，也可能代表卖点资产

吸奶器中 `Noise`、`Battery / power`、`Suction performance`、`Pain / comfort` 同时出现在痛点、内容 brief 和正向用户语言中。例如社媒 Noise 正向 444 条、正向率 67.89%；Battery 正向 429 条、正向率 50.89%。  

反直觉结论：同一个主题既可能是“产品改进问题”，也可能是“内容放大机会”。业务不应只按负面处理，而要拆成三类：

- 投诉型：进入产品/CX backlog。
- 解释型：进入 FAQ/PDP/客服话术。
- 资产型：进入内容 brief/用户原话库。

### 洞察 3：高声量不是市场份额，低声量也不等于低价值

吸奶器 Momcozy 提及 127,685，竞品 Elvie、Spectra、Medela、Willow、Eufy 明显更低。但这只能说明当前 query 与品牌覆盖结构，不代表市场份额。  

更有价值的角度是“竞品负向率和语境缺口”：

- Eufy 在吸奶器竞品中负向率 9.64%。
- Spectra 7.95%。
- Willow 6.78%。
- Medela 5.46%。
- Elvie 4.61%。

这些不是份额结论，而是 sales/content 可以复核的 objection mining 线索。

### 洞察 4：`zz` 未知国家不是废数据，而是“渠道归因债务”

吸奶器 `en/zz` 57,362 条、`es/zz` 9,713 条。`zz` 不能用于地域市场排序，但它能暴露两个机会：

- Meltwater/source 归因质量需要改善。
- 语言本身可能比国家更适合作为内容本地化优先级。

重构后的区域页应改名为“语言与本地化机会”，避免用户把未知国家误读成市场结论。

### 洞察 5：57 条 action 是债务，不是成绩

当前 57 条 action 全部 `Proposed`，`Feedback rows applied=0`，`Measured rate=0%`。  

反直觉结论：action 数量越多，未分派债务越大。管理层不应该看“提出了多少动作”，而应看：

- 已确认 owner 的比例。
- 已启动动作的比例。
- 已进入复盘窗口的比例。
- 实际指标回收比例。
- 关闭/拒绝原因是否反哺 taxonomy 和规则。

### 洞察 6：危机预警页当前更像“数据质量预警”，不是 PR 危机台

当前 crisis watch 前 30 条主要来自暖奶器，alert 为 `data_quality_alert`。这意味着系统已经避免把 query 噪声升级为 PR 危机。  

重构后应将危机页拆成两层：

- 数据质量异常：Data owner 处理 query、样本和规则。
- 真实业务风险：PR/CX owner 处理平台、样本 URL、影响力和 24h/72h 复盘。

### 洞察 7：产品共创不是“下一代功能清单”，而是“假设淘汰器”

概念候选中吸奶器 Battery、Pain、Noise、Suction、Return、Broken、Leak 均可进入复核。但只有 Meltwater VOC 不能证明商业可行性，也不能证明研发优先级。  

重构后的概念页不应叫“产品路线”，而应叫“假设验证队列”：

- 这个概念解决哪个用户情境？
- 支持证据是什么？
- 反证是什么？
- 需要客服、退货、评论、订单、问卷中的哪类外部数据验证？
- 2 周内能做的最小实验是什么？

---

## 5. 淘金式洞察框架

“淘金式洞察”不是把所有报告都看一遍，而是从噪声、矛盾、边缘样本和跨表连接中找高价值线索。

| 金矿类型 | 当前证据 | 业务价值 | 下一步 |
| --- | --- | --- | --- |
| Query Drift Gold | 暖奶器 precision 40.29%，消毒器 79.52% | 发现市场语言、搜索词和产品语境错位 | query rewrite + 复采 + before/after precision |
| Positive-in-Pain Gold | Noise/Battery/Suction 同时有正向内容和痛点证据 | 把问题主题转成 PDP、FAQ、短视频、客服话术 | 每个主题拆成投诉、解释、卖点三类 |
| Competitor Objection Gold | Eufy/Spectra/Willow 负向率高于 Momcozy | 生成销售和内容 battlecard | 抽样确认负向语境，生成 objection handling |
| Language Opportunity Gold | `vi/vn` 吸奶器负向率 26.49%，`pl/pl` 6.30%，`th/th` 5.70% | 找本地化内容、客服语言、渠道复核优先级 | 每个重点语言抽 30 条样本 |
| Crisis False Positive Gold | blocked category 只输出 data_quality_alert | 减少误报，保护 PR/CX 注意力 | alert 分为数据治理和业务风险 |
| Quote Gold | 前端精选 120 条原话，完整 quote mart 更多 | 转化成广告、PDP、FAQ、内容 brief | 增加 legal/review/usage 状态 |
| Action Debt Gold | 57 条 action、0 measured | 暴露组织执行断点 | 先关停低质量 action，聚焦 P0 action portfolio |
| Low-volume High-severity Gold | broken/refund/leak 量不一定最高，但更接近售后成本 | 发现产品质量和退货风险 | 接入 CS/returns/review 交叉验证 |

---

## 6. 新洞察故事线

建议全站统一成一条主叙事：

```text
数据可信度
  -> 经营假设
  -> 反直觉信号
  -> 证据淘金
  -> 决策分派
  -> 执行动作
  -> 复盘学习
```

### 6.1 第 0 步：数据可信度

业务问题：这批数据哪些能用于业务判断？

页面必须先回答：

- 哪些品类/query 通过门禁？
- 哪些被阻断？
- 阻断是否影响下游结论？
- 下一个数据动作是什么？

当前结论：

- 吸奶器可进入业务复核。
- 暖奶器、消毒器先进入 query rewrite 和样本复核。

### 6.2 第 1 步：经营假设

业务问题：我们原来相信什么？

建议将每个 playbook 输出改成假设，而不是直接结论：

- 假设 A：吸奶器用户最在意的是安静、舒适、续航和吸力。
- 假设 B：暖奶器负面上升可能是产品问题，也可能是 query 噪声。
- 假设 C：竞品负向语境可转成 Momcozy 销售/内容话术。
- 假设 D：语言优先级比国家优先级更适合当前数据。

### 6.3 第 2 步：反直觉信号

业务问题：哪些信号挑战了我们的假设？

当前反直觉信号：

- 最大声量品类最不可信。
- 痛点主题也能产出正向内容。
- action 很多但闭环为 0。
- crisis 看起来多，但大多是数据质量事件。
- 区域数据不可靠，但语言数据可做内容线索。

### 6.4 第 3 步：证据淘金

业务问题：哪些证据值得被放进会议？

证据卡必须包含：

- `insight_id`
- `document_id` / `occurrence_id`
- 样本数量
- 样本复核状态
- 原话/命中句
- source/channel
- readiness
- 反证或限制

不满足证据要求的内容只能进入观察池，不能进入决策池。

### 6.5 第 4 步：决策分派

业务问题：现在谁该做什么？

每条洞察必须落到一种决策：

| 决策类型 | Owner | 示例 |
| --- | --- | --- |
| `query_update` | Data | 暖奶器 query rewrite |
| `product_backlog` | Product/CX | 吸奶器 battery/noise/pain 复核 |
| `content_brief` | Content/Marketing | Noise/Battery 正向原话转 PDP/短视频 |
| `battlecard_update` | Sales/Marketing | Eufy/Spectra objection handling |
| `pr_triage` | PR/CX | 真实高影响力负面事件 |
| `localization_review` | Regional/Marketing | 越南语/波兰语/泰语样本复核 |
| `concept_test` | Product/Research | 小样/问卷/A-B 概念验证 |

### 6.6 第 5 步：执行动作

业务问题：动作是否启动，是否有最低可行实验？

每条 action 必须补齐：

- owner_name
- due_date
- expected_metric
- baseline_value
- target_value
- shipped_at
- review_date
- actual_metric
- close_reason

若没有 owner 和 expected metric，状态不能高于 `Proposed`。

### 6.7 第 6 步：复盘学习

业务问题：动作之后系统学到了什么？

复盘结果必须回流到三类资产：

- 数据规则：query_noise_rules、taxonomy、precision 阈值。
- 业务资产：FAQ、PDP、内容 brief、battlecard、客服话术。
- 经营判断：哪些假设被验证、被推翻、需要外部数据。

---

## 7. 面向管理层的故事线

管理层页面不应展示所有表，而应形成一个 15 分钟会议包。

### 7.1 会议结构

1. 本月哪些数据不能用于决策？
2. 本月哪些洞察挑战原有认知？
3. 本月必须确认哪 3 个动作？
4. 哪些动作延期或没人负责？
5. 下月要用什么指标判断成败？

### 7.2 当前建议管理层决策

| 决策 | 原因 | Owner | 验收 |
| --- | --- | --- | --- |
| 先治理暖奶器/消毒器 query | 当前 precision 阻断业务判断 | Data | precision >= 80%，完成复采 |
| 分派吸奶器 7 个可复核痛点 | 当前唯一可进入业务动作的品类 | Product/CX/Content | 每个痛点 owner + due + expected metric |
| 批准 10 个内容 brief 进入复核 | 痛点主题中存在正向原话资产 | Content/Marketing | 每个 brief 有 quote approval 和发布渠道 |
| 选 2 个竞品 objection 做 battlecard | Eufy/Spectra/Willow 有较高负向率线索 | Sales/Marketing | 抽样验证 + battlecard 输出 |
| 要求接入 CS/returns/reviews | 当前不能证明 ROI、退货率或满意度改善 | Data/CX | 建立外部数据输入模板和首批样本 |

### 7.3 管理层不应看到的结论

- 不应把 Meltwater 声量解释为销量。
- 不应把 sentiment 解释为投诉率。
- 不应把暖奶器负面率解释为产品危机。
- 不应把 `zz` 国家码解释为地域机会。
- 不应把 57 条 proposed action 解释为闭环成果。

---

## 8. 面向业务操作层的故事线

### 8.1 Data / Analyst

每日第一任务：

- 查看 query gate。
- 审核 blocked query 样本。
- 维护排除词、必含词、观察词。
- 产出 before/after precision。

完成定义：

- blocked query 有 rewrite brief。
- 样本复核量达到门槛。
- 规则更新记录可追踪。

### 8.2 Product / CX

每周第一任务：

- 只处理 `ready_for_review` 或 `ready_for_action` 的吸奶器痛点。
- 对 Battery、Noise、Pain、Suction、Leak、Broken、Refund 拆分为根因、使用场景、误用、售后问题。
- 将每个痛点映射到产品 backlog、FAQ、客服话术或退货原因验证。

完成定义：

- 每个 P0 痛点有 owner、动作、复盘指标。
- 至少接入一类外部验证数据：CS、returns、review、SKU 或订单。

### 8.3 Content / Marketing

每周第一任务：

- 从 content brief queue 和 quote library 中挑选可发布主题。
- 将 `Noise`、`Battery`、`Suction`、`Pain` 这类双面主题拆成“解释型内容”和“卖点型内容”。
- 对每条用户原话加上 review 状态：可用、需法务、不可用、需改写。

完成定义：

- 每个 brief 有目标平台、用户原话、内容角度、审核状态和发布后指标。

### 8.4 Sales / Competitive

每周第一任务：

- 从 Eufy、Spectra、Willow、Medela、Elvie 负向语境中抽样。
- 不做份额判断，只提炼 objection 和对比话术。
- 将 battlecard 改成“用户怎么抱怨竞品 -> Momcozy 如何回应 -> 证据边界”。

完成定义：

- 每张 battlecard 至少 20 条有效样本或明确标弱信号。

### 8.5 PR / CX Risk

每日第一任务：

- 先区分 `data_quality_alert` 和真实业务 alert。
- 对真实 alert 补齐平台、URL、影响力、样本、owner、24h/72h 复盘。

完成定义：

- 数据质量 alert 不升级为业务危机。
- 真实业务 alert 必须有 owner 和响应状态。

---

## 9. 页面重构建议

### 9.1 信息架构

建议将当前多个并列页面重组为 6 个业务主流程：

1. `今日决策台`
   - 今天先处理哪些阻断、痛点、动作和风险。
2. `数据可信度`
   - query gate、样本复核、rewrite brief、阻断解除。
3. `洞察淘金台`
   - 痛点、用户原话、内容机会、竞品 objection、语言机会统一看。
4. `决策分派台`
   - 管理层要确认的 action portfolio。
5. `行动闭环`
   - owner、状态、优先级、expected metric、actual metric、close reason。
6. `经营复盘`
   - 周会/月会、假设验证、行动结果、规则回写。

### 9.2 每个页面必须统一回答 5 个问题

1. 当前判断是什么？
2. 证据基础是什么？
3. 不能说什么？
4. 建议谁做什么？
5. 下次用什么指标复盘？

### 9.3 当前页面映射

| 现有页面 | 建议归属 | 重构重点 |
| --- | --- | --- |
| Home | 今日决策台 | 从指标概览改成处理顺序和决策队列 |
| Search Quality | 数据可信度 | 加强阻断对下游页面的影响说明 |
| Pain Radar | 洞察淘金台 | 拆成投诉、解释、资产三类 |
| Competitor | 洞察淘金台 | 从 battlecard 改为 objection mining |
| Content | 洞察淘金台 | 从机会表改为 brief 审核流 |
| Quote Library | 洞察淘金台 | 增加可用性和法务/品牌审核 |
| Concept | 决策分派台 | 从概念候选改为假设验证队列 |
| Crisis | 今日决策台 / 数据可信度 | 区分数据质量 alert 和真实危机 |
| Region | 洞察淘金台 | 改为语言与本地化机会 |
| Executive | 经营复盘 | 从月度行改为管理层 3 个决策 |
| Action Loop | 行动闭环 | 从 action 表改为闭环转化漏斗 |
| Audit / Ops | 系统治理 | 从业务主导航降级为二级入口 |

---

## 10. 数据模型补强

### 10.1 新增 mart

| Mart | 目的 | 核心字段 |
| --- | --- | --- |
| `mart_storyline_decision_queue` | 把洞察转成会议决策队列 | storyline_id、decision_type、owner_domain、readiness、risk、expected_metric |
| `mart_contrarian_signals` | 捕捉反直觉信号 | signal_type、assumption、counter_evidence、confidence、next_action |
| `mart_goldmine_opportunities` | 汇总淘金机会 | goldmine_type、evidence_count、business_value、owner_domain、status |
| `mart_action_conversion_funnel` | 衡量 action 是否闭环 | proposed、owner_assigned、accepted、in_progress、shipped、measured、closed |
| `mart_language_topic_profile` | 用语言替代不可靠地域结论 | language、country_known、topic、negative_rate、sample_required |

### 10.2 新增事实表

| 表 | 目的 |
| --- | --- |
| `fact_decision` | 记录管理层或业务 owner 的确认/暂缓/拒绝 |
| `fact_experiment` | 记录内容测试、概念测试、FAQ/PDP 改动、小样测试 |
| `fact_outcome_metric` | 记录动作后指标，例如 CS ticket、return reason、review score、engagement |
| `fact_quote_review` | 记录用户原话是否可用于内容/法务/品牌 |
| `fact_alert_triage` | 记录 alert 的分诊、响应和复盘 |

### 10.3 外部数据输入

要从 VOC 走向经营结果，必须接入至少一种外部业务数据：

- CS tickets：验证痛点是否进入客服高频问题。
- Returns / refunds：验证 broken、refund、leak 是否影响退货。
- Reviews：补足购买后体验。
- Orders / SKU：判断影响范围和商业重要性。
- Ads / content metrics：验证内容 brief 是否带来互动或转化。
- CRM / regional sales：验证语言/市场机会。

---

## 11. PRD 重组建议

当前 PRD 应从“功能列表”改成“决策系统规格”。

### 11.1 新 PRD 目录

1. 产品定位：Melwater VOC 经营决策闭环系统。
2. 用户角色：管理层、产品、CX、内容、PR、销售、数据分析师。
3. 核心旅程：可信度 -> 洞察 -> 决策 -> 动作 -> 复盘。
4. 数据边界：Meltwater 能证明什么，不能证明什么。
5. 洞察模型：反直觉信号、淘金机会、证据卡、置信度。
6. 决策模型：decision_type、owner、expected_metric、risk、review_date。
7. 动作模型：action 状态机和闭环漏斗。
8. 外部数据：CS/returns/reviews/orders/ads/CRM 输入。
9. 页面 IA：6 个主流程和每页 5 问模板。
10. 验收指标：从页面可用性、数据可信度、闭环率和业务结果四层验收。

### 11.2 状态机

```text
weak_signal
  -> ready_for_review
  -> decision_required
  -> owner_assigned
  -> action_in_progress
  -> shipped
  -> measured
  -> closed / rejected / needs_more_data
```

阻断路径：

```text
blocked_by_query_noise
  -> query_rewrite
  -> sample_review
  -> re-collect
  -> precision_passed / still_blocked
```

---

## 12. 落地计划

### Phase 0：确认新故事线

产物：

- 本文档作为 V2 故事线基线。
- 确认 6 个主流程和每页 5 问模板。
- 确认管理层会议包的决策格式。

验收：

- 用户确认重构方向。
- 后续前端/ETL 改造以本文档为需求入口。

### Phase 1：页面叙事改造

任务：

- 首页改为“今日处理顺序”。
- 新增或重构“洞察淘金台”。
- Executive 改为“本月 3 个决策”。
- Action Loop 增加闭环漏斗。
- Crisis 拆分数据质量 alert 和真实业务 alert。

验收：

- 每页都能回答 5 个统一问题。
- 每个主要页面有“下一步动作”而不是只展示数据。
- 中文文案一致，无英文模块名作为业务主标题。

### Phase 2：数据模型改造

任务：

- 生成 `mart_contrarian_signals`。
- 生成 `mart_goldmine_opportunities`。
- 生成 `mart_storyline_decision_queue`。
- 生成 `mart_action_conversion_funnel`。
- 增加 quote review、decision、experiment、outcome metric 输入模板。

验收：

- 前端不再从多个孤立数组拼故事线，而是读取 storyline/decision mart。
- 每条进入管理层会议的洞察都有 evidence、readiness、owner_domain、expected_metric。

### Phase 3：真实闭环

任务：

- 先从 5 条 P0 action 开始，不追求 57 条全部推进。
- 给每条 action 补 owner、due、baseline、target、review_date。
- 接入一类真实外部数据，优先 CS tickets 或 returns。
- 建立每周 action review。

验收：

- action owner assigned rate >= 80%。
- P0 action measured rate >= 60%。
- 至少 1 个 action 有 actual_metric 和 close_reason。

### Phase 4：生产验收

任务：

- 更新前端。
- 重新构建 release package。
- 部署到 `https://melwater.lute-tlz-dddd.top/`。
- 用真实浏览器跑每页 E2E。

验收：

- 每个页面的解释性描述和筛选功能可用。
- 首页能从可信度进入洞察、从洞察进入 action、从 action 进入复盘。
- 所有 blocked category 下游业务判断都有明显阻断提示。
- `/health`、review-state replay、公共站 smoke、浏览器 E2E 全部通过。

---

## 13. 最小可执行版本

如果只做一轮最小闭环，建议只选 5 条 P0：

1. 暖奶器 query rewrite：解除最大噪声源。
2. 消毒器 query rewrite：接近阈值，最可能快速通过。
3. 吸奶器 Noise：同时有正向内容资产和产品体验线索。
4. 吸奶器 Battery：同时有内容和产品验证价值。
5. Eufy/Spectra objection mining：用于销售/内容 battlecard。

这一轮不要追求覆盖所有 playbook 分支。目标是证明系统能把 5 个洞察完整跑到：

```text
insight -> evidence -> decision -> owner -> action -> measured -> learning
```

---

## 14. 验收指标

### 页面验收

- 每个主页面都有 `当前判断 / 证据基础 / 风险红线 / 建议动作 / 复盘指标`。
- 页面主标题全部中文。
- 每个数据表都有业务解释，不只展示字段。
- 筛选功能能改变页面结论或行动队列。

### 数据验收

- blocked query 不进入业务结论。
- management brief 只展示 ready 或明确 blocked 的议题。
- 每条正式洞察都有样本证据和 readiness。
- quote/content/battlecard/concept 都有 review 状态。

### 闭环验收

- P0 actions owner assigned rate >= 80%。
- P0 actions measured rate >= 60%。
- 每个 closed/rejected action 都有 close_reason。
- 至少一个规则或 taxonomy 因复盘被更新。

### 经营验收

- 管理层可以在 15 分钟内明确本周/本月要决策的 3 件事。
- 产品/CX/内容/PR/Data 都能看到自己的待办队列。
- 新一轮数据采集后，系统能比较 before/after，而不是覆盖旧结论。

---

## 15. 下一步推荐

建议下一步不要继续增加页面，而是执行“故事线落地第一轮”：

1. 将首页、Executive、Action Loop 三个页面先改成新版故事线。
2. 新增 `mart_storyline_decision_queue` 和 `mart_action_conversion_funnel`。
3. 从 57 条 action 中筛出 5 条 P0，补齐 owner/metric/review。
4. 部署后对 6 个主流程做真实浏览器 E2E。

这会把当前系统从“能生成洞察”推进到“能驱动业务会议和动作复盘”。

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  IconAdjustmentsHorizontal,
  IconBell,
  IconBookmark,
  IconBox,
  IconBrandTiktok,
  IconBrandYoutube,
  IconCalendar,
  IconChartAreaLine,
  IconChartRadar,
  IconCheck,
  IconChevronDown,
  IconCircleCheck,
  IconClipboardCheck,
  IconDatabase,
  IconDownload,
  IconExternalLink,
  IconFilter,
  IconFlask,
  IconHome,
  IconLayoutGrid,
  IconListDetails,
  IconMessageCircle,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
  IconSparkles,
  IconTargetArrow,
  IconUsers,
} from "@tabler/icons-react";
import vocData from "./data/vocData.json";

const topicLabels = {
  battery_power: "电池续航",
  noise: "噪音控制",
  pain_comfort: "疼痛舒适",
  leak_spill: "漏奶溢出",
  suction: "吸力表现",
  suction_performance: "吸力表现",
  broken_defective: "故障损坏",
  quality_broken: "故障损坏",
  return_refund: "退换货",
};

const viewConfig = {
  home: {
    eyebrow: "Melwater VOC",
    title: "今日决策台",
    subtitle: "先判断数据是否可信，再把证据转成负责人动作和复盘结果。",
  },
  search: {
    eyebrow: "P0 · 数据可信度",
    title: "数据可信度检查",
    subtitle: "判断搜索能不能进入业务解释；被阻断的品类只允许做治理动作。",
  },
  pain: {
    eyebrow: "P0 · 产品痛点",
    title: "产品痛点优先级",
    subtitle: "把高频痛点、负向率、证据样本和推荐负责人合并成可行动队列。",
  },
  actions: {
    eyebrow: "P0 · 行动闭环",
    title: "行动闭环看板",
    subtitle: "把洞察转成负责人、状态、复盘指标和关闭原因。",
  },
  quality: {
    eyebrow: "P0 · 数据红线",
    title: "数据口径与红线",
    subtitle: "解释当前数据包口径、质量风险和不能误读的指标边界。",
  },
  competitor: {
    eyebrow: "P1 · 增长与竞品",
    title: "竞品证据卡",
    subtitle: "把品牌声量、负向率和可信度转成可复核的竞品对比素材。",
  },
  content: {
    eyebrow: "P1 · 内容机会",
    title: "内容机会池",
    subtitle: "从正向证据、渠道和主题反推内容简报；被阻断品类先治理搜索。",
  },
  quotes: {
    eyebrow: "P1 · 用户原话",
    title: "用户原话库",
    subtitle: "沉淀可复核用户原话，支持内容简报、产品论证和证据回溯。",
  },
  concept: {
    eyebrow: "P2 · 产品验证",
    title: "产品概念验证",
    subtitle: "从痛点和证据反推产品概念候选，进入小样本验证和负责人分派。",
  },
  crisis: {
    eyebrow: "P2 · 风险预警",
    title: "风险预警台",
    subtitle: "把每日负面集中度、周度变化点和数据质量阻断转成公关/客服分诊。",
  },
  regions: {
    eyebrow: "P2 · 区域语言",
    title: "区域与语言机会",
    subtitle: "区分 country_known 与 zz 未知国家，避免把语言线索误读成地域市场结论。",
  },
  brief: {
    eyebrow: "P2 · 经营复盘",
    title: "管理层月会",
    subtitle: "为月会压缩数据质量、可行动洞察和待关闭动作的决策入口。",
  },
  audit: {
    eyebrow: "P4 · 操作留痕",
    title: "操作留痕",
    subtitle: "查看状态写回、操作者、版本号和事件历史，支持后续生产审计。",
  },
  ops: {
    eyebrow: "P4 · 系统运维",
    title: "系统运维",
    subtitle: "配置本机 API token，检查生产健康、发布版本、备份和 review-state replay。",
  },
};

const navSections = [
  {
    label: "业务决策",
    items: [
      { id: "home", label: "今日决策台", icon: IconHome },
      { id: "search", label: "数据可信度", icon: IconSearch },
      { id: "pain", label: "产品痛点", icon: IconChartRadar },
      { id: "actions", label: "行动闭环", icon: IconClipboardCheck },
    ],
  },
  {
    label: "机会与复盘",
    items: [
      { id: "competitor", label: "竞品证据", icon: IconTargetArrow },
      { id: "content", label: "内容机会", icon: IconListDetails },
      { id: "quotes", label: "用户原话", icon: IconMessageCircle },
      { id: "concept", label: "概念验证", icon: IconFlask },
      { id: "crisis", label: "风险预警", icon: IconBell },
      { id: "regions", label: "区域语言", icon: IconUsers },
      { id: "brief", label: "经营复盘", icon: IconBookmark },
    ],
  },
  {
    label: "治理与运维",
    items: [
      { id: "quality", label: "数据红线", icon: IconShieldCheck },
      { id: "audit", label: "操作留痕", icon: IconDatabase },
      { id: "ops", label: "系统运维", icon: IconShieldCheck },
    ],
  },
];

const businessLoopSteps = ["数据可信", "业务问题", "证据判断", "负责人动作", "复盘结果"];

const closureGuides = {
  home: {
    judge: "当前数据包可支撑内部 VOC 决策，但暖奶器/消毒器仍有搜索阻断。",
    evidence: "336,435 个唯一文档、6,871,226 行关系数据、57 条待闭环动作。",
    guardrail: "不能把声量等同销量，不能把自动情感等同真实投诉率。",
    action: "先处理阻断搜索，再分派高优先级痛点和待复盘动作。",
    metric: "本周看阻断数、负责人落位率、已复盘动作数。",
  },
  search: {
    judge: "2 个搜索仍被阻断，被阻断品类只能输出治理动作。",
    evidence: "搜索可信度表和噪声样本队列用于判断 query precision。",
    guardrail: "未通过 precision 前，声量、负向率和高频词不能写进业务结论。",
    action: "复核样本，重写 query，完成后重采并重建 marts。",
    metric: "precision 达到阈值，blocked gate 关闭或保留业务例外。",
  },
  pain: {
    judge: "吸奶器已有可行动痛点，适合进入产品、CX 和内容分派。",
    evidence: "痛点卡包含负向率、证据数、代表样本和推荐 owner domain。",
    guardrail: "证据弱或搜索阻断的痛点只能作为假设，不能直接承诺产品路线。",
    action: "把 P0/P1 痛点转成产品待办、客服话术或内容解释。",
    metric: "跟踪 owner 落位、动作上线、同类负向样本变化。",
  },
  actions: {
    judge: "当前系统有行动登记能力，但真实 measured actions 仍为 0。",
    evidence: "行动表记录状态、负责人、优先级、证据链和周会快照。",
    guardrail: "没有负责人、证据或复盘指标的动作不能视为闭环。",
    action: "本周先确认负责人，再推进 P0/P1 到已接收或处理中。",
    metric: "action_feedback_applied、measuredActions、逾期动作数。",
  },
  quality: {
    judge: "当前数据口径可复核，但需要持续显示解释红线。",
    evidence: "manifest、source inventory、document/occurrence 口径和情感字段。",
    guardrail: "document_id、occurrence_id、sentiment、zz 国家码不能混用。",
    action: "把红线规则挂到所有业务页和导出材料。",
    metric: "进入会议的洞察必须带口径说明和样本复核记录。",
  },
  competitor: {
    judge: "竞品证据可用于话术和内容素材，但不能当市场份额。",
    evidence: "18 张竞品卡，按品牌、品类、负向率和 readiness 排序。",
    guardrail: "搜索配置偏向 Momcozy，不能直接比较总声量。",
    action: "把 ready 卡片转为销售 objection、内容角度或产品差异说明。",
    metric: "每张输出卡至少有样本、结论、负责人和使用场景。",
  },
  content: {
    judge: "内容机会可转为 brief，但被阻断品类要先回到搜索治理。",
    evidence: "30 条内容机会、10 条 ready brief、120 条原话候选。",
    guardrail: "用户原话不能未经人工复核就外发。",
    action: "生成主题简报、原话短名单和发布渠道建议。",
    metric: "每周沉淀 brief 数、通过审核原话数、上线后互动指标。",
  },
  quotes: {
    judge: "原话库可支撑内容和产品论证，但当前仍是候选素材。",
    evidence: "原话包含 sentiment、topic、documentId 和 source URL。",
    guardrail: "原话外发前必须确认授权、语境和合规风险。",
    action: "将原话标记为可用、需法务复核或不可用。",
    metric: "审核通过率、被内容 brief 采用数量、引用后表现。",
  },
  concept: {
    judge: "概念候选适合做小样验证，不等同产品路线决策。",
    evidence: "概念卡来自痛点、正向偏好、反证和证据样本。",
    guardrail: "缺少订单、退货、客服或评论数据时不能宣称商业收益。",
    action: "把高证据概念送入产品评审或小样测试。",
    metric: "概念测试完成数、反证记录、进入 roadmap 比例。",
  },
  crisis: {
    judge: "风险页用于分诊，不直接等同品牌危机。",
    evidence: "每日负向集中度、周度变化点、平台和影响力信号。",
    guardrail: "未抽样复核前不能对外升级为危机结论。",
    action: "PR/CX 在 24 小时内确认 acknowledged 或 escalated。",
    metric: "响应时长、误报原因、72 小时复盘状态。",
  },
  regions: {
    judge: "区域语言页优先指导内容本地化，不直接判断市场需求。",
    evidence: "language、country_known、mentions 和 country zz 风险。",
    guardrail: "zz 是未知国家，不能当作地域市场。",
    action: "先按语言抽样，再与销售地区和客服语言对齐。",
    metric: "重点语言样本通过率、本地化内容产出和后续反馈。",
  },
  brief: {
    judge: "经营复盘页应收口为管理层要决策和追责的事项。",
    evidence: "月度 VOC、阻断搜索、ready actions、内容机会。",
    guardrail: "只汇报可解释数据；被阻断品类只汇报治理进度。",
    action: "月会明确本周决定、负责人、截止日和复盘指标。",
    metric: "会议后关闭动作数、逾期动作数、阻断搜索下降数。",
  },
  audit: {
    judge: "操作留痕证明写回过程可追踪，但不是业务闭环本身。",
    evidence: "事件历史包含 namespace、actor、版本和时间戳。",
    guardrail: "审计通过不代表动作有效，仍需业务复盘指标。",
    action: "用事件历史排查冲突、回放状态和生成证据包。",
    metric: "写回成功率、冲突数、可回放事件完整率。",
  },
  ops: {
    judge: "系统运维页证明生产可用性，不替代业务价值验证。",
    evidence: "healthcheck、release ref、backup、ops report 和 incident 状态。",
    guardrail: "mock alert drill 不证明飞书/企微真实送达。",
    action: "配置真实 webhook、补齐 SLO/负责人、执行恢复演练。",
    metric: "webhook readiness、恢复演练证据、SLO 达标率。",
  },
};

const microTrends = [
  { label: "声量", color: "#C25B6E", data: [18, 25, 21, 30, 28, 35, 37] },
  { label: "负向", color: "#FF9500", data: [12, 16, 19, 15, 23, 21, 28] },
  { label: "证据", color: "#E7A84F", data: [20, 22, 25, 30, 31, 34, 39] },
  { label: "动作", color: "#34C759", data: [8, 12, 14, 13, 16, 18, 21] },
];

const channelMix = [
  { name: "TikTok", value: 38 },
  { name: "Instagram", value: 27 },
  { name: "YouTube", value: 18 },
  { name: "Reddit", value: 11 },
  { name: "News", value: 6 },
];

function pct(value, digits = 0) {
  return `${(Number(value || 0) * 100).toFixed(digits)}%`;
}

function score(value) {
  return Math.round(Number(value || 0) * 100);
}

function compactNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatDateTime(value) {
  if (!value) return "unknown";
  return String(value).replace("T", " ").replace("Z", "").slice(0, 19);
}

function formatBytes(value) {
  const numeric = Number(value || 0);
  if (!numeric) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(numeric) / Math.log(1024)), units.length - 1);
  return `${(numeric / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function shortHash(value) {
  return value ? String(value).slice(0, 12) : "unknown";
}

function signedPct(value, digits = 1) {
  const numeric = Number(value || 0);
  const sign = numeric > 0 ? "+" : "";
  return `${sign}${pct(numeric, digits)}`;
}

function displayTopic(card) {
  return topicLabels[card.topicId] || card.topicLabel;
}

function readinessLabel(value) {
  const labels = {
    pass: "通过",
    ready: "可判断",
    ready_for_action: "可行动",
    ready_for_review: "待复核",
    blocked_by_query_noise: "搜索阻断",
    data_quality_alert: "质量风险",
    weak_signal: "弱信号",
    pending_review: "待审核",
  };
  return labels[value] || String(value || "").replaceAll("_", " ");
}

function actionStatusLabel(value) {
  const labels = {
    Proposed: "待确认",
    Accepted: "已接收",
    "In Progress": "处理中",
    Shipped: "已上线",
    Measured: "已复盘",
    Closed: "已关闭",
    Rejected: "已拒绝",
  };
  return labels[value] || value;
}

function actionTypeLabel(value) {
  const labels = {
    competitor_matrix: "竞品证据卡",
    concept_test: "概念验证",
    content_brief: "内容简报",
    executive_decision: "管理层决策",
    pr_triage: "公关分诊",
    product_backlog: "产品待办",
    query_update: "搜索治理",
  };
  return labels[value] || String(value || "").replaceAll("_", " ");
}

function sentimentLabel(value) {
  const labels = {
    all: "全部",
    positive: "正向",
    negative: "负向",
    neutral: "中性",
    unknown: "未知",
  };
  return labels[value] || value;
}

function decisionLaneLabel(value) {
  const labels = {
    Archive: "归档",
    "Approve data fix": "批准数据治理",
    "Confirm owner": "确认负责人",
    "Request evidence": "补齐证据",
    "Commit this cycle": "本周期承诺",
    "Track next": "下轮跟进",
  };
  return labels[value] || value;
}

function ownerForTheme(theme) {
  const text = String(theme || "").toLowerCase();
  if (text.includes("battery") || text.includes("noise") || text.includes("suction") || text.includes("leak")) return "Product";
  if (text.includes("return") || text.includes("refund")) return "CX";
  if (text.includes("pain") || text.includes("comfort")) return "Product/CX";
  return "Product";
}

function matchingQuotes(category, topic, limit = 3) {
  return vocData.quoteLibrary
    .filter((quote) => quote.category === category && quote.topicLabel === topic)
    .slice(0, limit);
}

const actionStatuses = ["Proposed", "Accepted", "In Progress", "Shipped", "Measured", "Closed", "Rejected"];
const actionPriorities = ["P0", "P1", "P2", "P3"];
const actionPriorityRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
const actionOwnerHints = {
  CX: "CX lead",
  "Content/Marketing": "Content lead",
  Data: "Data owner",
  "Data/Business Leads": "Data + BU lead",
  "Marketing/Data": "Growth analyst",
  "PR/CX": "PR/CX duty owner",
  Product: "PM owner",
  "Product/CX": "PM + CX lead",
  "Product/Content": "PM + Content lead",
  "Product/Research": "Research owner",
};

function actionTopicId(action) {
  return String(action.source_action || "").match(/topic:([a-z0-9_]+)/i)?.[1] || "";
}

function actionCategory(action) {
  const source = String(action.source_action || "");
  return [...new Set(vocData.painCards.map((card) => card.category))].find((category) => source.includes(category)) || "未归类";
}

function actionPainCard(action) {
  const topicId = actionTopicId(action);
  const category = actionCategory(action);
  if (!topicId || category === "未归类") return null;
  return vocData.painCards.find((card) => card.category === category && card.topicId === topicId) || null;
}

function actionQuoteLinks(action, limit = 2) {
  const topicId = actionTopicId(action);
  const category = actionCategory(action);
  if (!topicId || category === "未归类") return [];
  return vocData.quoteLibrary
    .filter((quote) => quote.category === category && quote.topicId === topicId)
    .slice(0, limit);
}

function derivedPriority(action, card) {
  if (action.action_type === "query_update") return "P0";
  const priorityScore = score(card?.priorityScore);
  if (priorityScore >= 62) return "P1";
  if (priorityScore >= 48) return "P2";
  return "P3";
}

function derivedBusinessImpact(action, card) {
  if (action.action_type === "query_update") {
    return "恢复 blocked 品类的业务解释权限；precision >= 80% 后重开洞察链路";
  }
  if (card) {
    return `${actionCategory(action)} · ${displayTopic(card)} 负向率 ${pct(card.negativeRate, 1)}，证据 ${card.evidenceCount} 条`;
  }
  if (action.action_type.includes("content")) return "把高置信原话转成内容 brief，并回看互动/转化信号";
  if (action.owner_domain?.includes("PR")) return "缩短负向聚集的响应时间，降低事件扩散风险";
  return action.expected_metric || "需要 owner 补齐业务指标和验收口径";
}

function actionOwnerHint(action) {
  return action.owner_name || actionOwnerHints[action.owner_domain] || action.owner_domain || "未分配负责人";
}

function enrichAction(action, drafts = {}) {
  const card = actionPainCard(action);
  const evidence = card?.evidenceDetails?.slice(0, 2) || [];
  const quotes = actionQuoteLinks(action, 2);
  const ownerOverride = drafts.owner?.[action.action_id];
  const priorityOverride = drafts.priority?.[action.action_id];
  const statusOverride = drafts.status?.[action.action_id];
  const impactOverride = drafts.impact?.[action.action_id];
  const baseStatus = action.status;
  return {
    ...action,
    category: actionCategory(action),
    topicId: actionTopicId(action),
    displayTopic: card ? displayTopic(card) : "搜索质量",
    ownerName: ownerOverride || actionOwnerHint(action),
    ownerResolved: Boolean(ownerOverride || action.owner_name),
    priority: priorityOverride || derivedPriority(action, card),
    status: statusOverride || action.status,
    baseStatus,
    businessImpact: impactOverride || derivedBusinessImpact(action, card),
    evidence,
    evidenceCount: card?.evidenceCount || evidence.length,
    painCard: card,
    quotes,
  };
}

function actionDueInfo(action, now = new Date()) {
  if (!action.due_date) return { date: null, days: null, label: "未设截止日", tone: "muted" };
  const [year, month, day] = String(action.due_date).split("-").map(Number);
  const due = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { date: action.due_date, days, label: `逾期 ${Math.abs(days)} 天`, tone: "rose" };
  if (days === 0) return { date: action.due_date, days, label: "今天到期", tone: "rose" };
  if (days <= 7) return { date: action.due_date, days, label: `剩余 ${days} 天`, tone: "amber" };
  if (days <= 14) return { date: action.due_date, days, label: `剩余 ${days} 天`, tone: "yellow" };
  return { date: action.due_date, days, label: `剩余 ${days} 天`, tone: "muted" };
}

function actionEvidenceStrength(action) {
  if (action.action_type === "query_update") {
    return { label: "需复核", score: 0, tone: "amber", caption: "搜索阻断需要样本复核" };
  }
  const scoreValue = action.evidenceCount + action.quotes.length * 2;
  if (scoreValue >= 20) return { label: "证据强", score: scoreValue, tone: "green", caption: `${action.evidenceCount} 样本 / ${action.quotes.length} 原话` };
  if (scoreValue >= 6) return { label: "证据中", score: scoreValue, tone: "amber", caption: `${action.evidenceCount} 样本 / ${action.quotes.length} 原话` };
  if (scoreValue > 0) return { label: "证据弱", score: scoreValue, tone: "yellow", caption: `${action.evidenceCount} 样本 / ${action.quotes.length} 原话` };
  return { label: "缺证据", score: 0, tone: "rose", caption: "尚未关联证据" };
}

function actionDecisionLane(action) {
  if (action.status === "Closed" || action.status === "Rejected") return "Archive";
  if (action.action_type === "query_update") return "Approve data fix";
  if (!action.ownerResolved) return "Confirm owner";
  if (actionEvidenceStrength(action).score < 6) return "Request evidence";
  if (action.priority === "P0" || action.priority === "P1") return "Commit this cycle";
  return "Track next";
}

function buildWeeklyActionReview(actions) {
  const active = actions.filter((action) => !["Closed", "Rejected"].includes(action.status));
  const enriched = active.map((action) => ({
    ...action,
    due: actionDueInfo(action),
    evidenceStrength: actionEvidenceStrength(action),
    decisionLane: actionDecisionLane(action),
  }));
  const queue = enriched
    .filter((action) => ["P0", "P1"].includes(action.priority) || !action.ownerResolved || action.due.days == null || action.due.days <= 14)
    .sort((a, b) => (
      actionPriorityRank[a.priority] - actionPriorityRank[b.priority]
      || Number(a.ownerResolved) - Number(b.ownerResolved)
      || (a.due.days ?? 999) - (b.due.days ?? 999)
      || b.evidenceStrength.score - a.evidenceStrength.score
    ));
  const ownerSummary = [...new Map(enriched.map((action) => [action.owner_domain || "unassigned", {
    owner: action.owner_domain || "unassigned",
    total: 0,
    p0p1: 0,
    needsOwner: 0,
    strongEvidence: 0,
  }])).values()];
  for (const summary of ownerSummary) {
    const rows = enriched.filter((action) => (action.owner_domain || "unassigned") === summary.owner);
    summary.total = rows.length;
    summary.p0p1 = rows.filter((action) => ["P0", "P1"].includes(action.priority)).length;
    summary.needsOwner = rows.filter((action) => !action.ownerResolved).length;
    summary.strongEvidence = rows.filter((action) => actionEvidenceStrength(action).score >= 20).length;
  }
  ownerSummary.sort((a, b) => b.p0p1 - a.p0p1 || b.needsOwner - a.needsOwner || b.total - a.total);
  return {
    active,
    queue,
    ownerSummary,
    p0p1: enriched.filter((action) => ["P0", "P1"].includes(action.priority)).length,
    dueWithin14: enriched.filter((action) => action.due.days != null && action.due.days <= 14).length,
    needsOwner: enriched.filter((action) => !action.ownerResolved).length,
    evidenceReady: enriched.filter((action) => action.evidenceStrength.score >= 20).length,
  };
}

function formatSnapshotDate(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function buildMeetingSnapshotPayload(review, reviewActions, overrides = {}) {
  const snapshotDate = formatSnapshotDate();
  const snapshotTitle = overrides.title || `Melwater 每周行动复盘 ${snapshotDate}`;
  const note = overrides.note || "";
  const snapshotKey = `weekly-${snapshotDate}`;
  return {
    schemaVersion: 1,
    kind: "meeting-snapshot",
    snapshotDate,
    snapshotKey,
    snapshotTitle,
    capturedBy: getReviewer(),
    capturedAt: new Date().toISOString(),
    meetingWindow: {
      from: snapshotDate,
      to: snapshotDate,
      status: "closed",
    },
    summary: {
      queueSize: review.queue.length,
      activeSize: review.active.length,
      p0p1: review.p0p1,
      dueWithin14: review.dueWithin14,
      needsOwner: review.needsOwner,
      evidenceReady: review.evidenceReady,
    },
    ownerSummary: review.ownerSummary,
    queueSnapshot: review.queue.map((action) => ({
      action_id: action.action_id,
      action_type: action.action_type,
      category: action.category,
      topicId: action.topicId,
      owner: action.ownerName,
      owner_domain: action.owner_domain || "unassigned",
      priority: action.priority,
      decisionLane: action.decisionLane,
      status: action.status,
      baseStatus: action.baseStatus,
      statusChanged: action.status !== action.baseStatus,
      due: action.due,
      evidenceStrength: action.evidenceStrength,
      businessImpact: action.businessImpact,
      reviewMeta: {
        sourceAction: action.source_action,
        reviewDate: action.review_date,
        expectedMetric: action.expected_metric,
      },
    })),
    allActionStatus: reviewActions.map((action) => ({
      action_id: action.action_id,
      status: action.status,
      baseStatus: action.baseStatus,
    })),
    decision: {
      meetingNote: note,
      actionCount: review.queue.length,
      timestamp: new Date().toISOString(),
    },
  };
}

function downloadMeetingSnapshot(snapshot) {
  if (!snapshot) return;
  const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = `${snapshot.snapshotKey || formatSnapshotDate()}.meeting-snapshot.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(blobUrl);
}

function browserCsvCell(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadActionCsv(actions) {
  const headers = [
    "action_id",
    "action_type",
    "category",
    "topic_id",
    "owner_domain",
    "owner_name",
    "priority",
    "status",
    "business_impact",
    "due_date",
    "review_date",
    "expected_metric",
    "evidence_count",
    "quote_count",
  ];
  const rows = actions.map((action) => [
    action.action_id,
    action.action_type,
    action.category,
    action.topicId,
    action.owner_domain || "unassigned",
    action.ownerName,
    action.priority,
    action.status,
    action.businessImpact,
    action.due_date,
    action.review_date,
    action.expected_metric,
    action.evidenceCount,
    action.quotes.length,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(browserCsvCell).join(",")).join("\n") + "\n";
  const blobUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = `melwater-action-loop-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(blobUrl);
}

function combinedSyncState(states) {
  if (states.includes("conflict")) return "conflict";
  if (states.includes("local")) return "local";
  if (states.every((state) => state === "api")) return "api";
  return "loading";
}

function flattenWritebackNamespace(namespaceData = {}) {
  return Object.fromEntries(Object.entries(namespaceData).map(([key, entry]) => [key, entry?.value ?? entry]));
}

function getReviewer() {
  try {
    const existing = window.localStorage.getItem("melwater:reviewer");
    if (existing) return existing;
    window.localStorage.setItem("melwater:reviewer", "Analyst");
  } catch {
    // localStorage can be unavailable in hardened browsing contexts.
  }
  return "Analyst";
}

const reviewStateApiBase = (import.meta.env.VITE_REVIEW_STATE_API_BASE || "").replace(/\/$/, "");

function reviewStateUrl(path = "") {
  return `${reviewStateApiBase}/api/review-state${path}`;
}

function reviewStateHeaders(extra = {}, tokenOverride) {
  let token = tokenOverride;
  try {
    if (token === undefined) token = window.localStorage.getItem("melwater:apiToken") || "";
  } catch {
    // Token auth is optional; local fallback still works when storage is unavailable.
  }
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function normalizeLocalEntries(raw = {}) {
  return Object.fromEntries(
    Object.entries(raw).map(([key, entry]) => [
      key,
      entry && typeof entry === "object" && Object.hasOwn(entry, "value") ? entry : { value: entry, version: null },
    ]),
  );
}

function useWritebackState(namespace) {
  const storageKey = `melwater:${namespace}:entries`;
  const [entries, setEntries] = useState(() => {
    try {
      return normalizeLocalEntries(JSON.parse(window.localStorage.getItem(storageKey) || window.localStorage.getItem(`melwater:${namespace}`) || "{}"));
    } catch {
      return {};
    }
  });
  const [syncState, setSyncState] = useState("loading");
  const values = useMemo(() => flattenWritebackNamespace(entries), [entries]);

  useEffect(() => {
    let alive = true;
    fetch(reviewStateUrl(), { headers: reviewStateHeaders() })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`GET ${response.status}`))))
      .then((payload) => {
        if (!alive) return;
        const nextEntries = payload?.[namespace] || {};
        setEntries(nextEntries);
        window.localStorage.setItem(storageKey, JSON.stringify(nextEntries));
        setSyncState("api");
      })
      .catch(() => {
        if (alive) setSyncState("local");
      });
    return () => {
      alive = false;
    };
  }, [namespace, storageKey]);

  const writeValue = useCallback(
    (key, value, meta = {}) => {
      const previousEntry = entries[key];
      const optimisticEntry = {
        ...(previousEntry || {}),
        value,
        meta,
        updatedBy: getReviewer(),
      };
      setEntries((current) => {
        const next = { ...current, [key]: optimisticEntry };
        window.localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
      fetch(reviewStateUrl(), {
        method: "POST",
        headers: reviewStateHeaders({ "Content-Type": "application/json", "X-Melwater-User": getReviewer() }),
        body: JSON.stringify({
          namespace,
          key,
          value,
          meta,
          actor: getReviewer(),
          expectedVersion: previousEntry?.version ?? undefined,
        }),
      })
        .then(async (response) => {
          const payload = await response.json();
          if (response.status === 409) {
            setEntries(payload.state?.[namespace] || {});
            window.localStorage.setItem(storageKey, JSON.stringify(payload.state?.[namespace] || {}));
            setSyncState("conflict");
            return;
          }
          if (!response.ok) throw new Error(`POST ${response.status}`);
          setEntries(payload.state?.[namespace] || {});
          window.localStorage.setItem(storageKey, JSON.stringify(payload.state?.[namespace] || {}));
          setSyncState("api");
        })
        .catch(() => setSyncState("local"));
    },
    [entries, namespace, storageKey],
  );

  return { entries, values, writeValue, syncState };
}

function AppLogo() {
  return (
    <div className="app-logo" aria-label="Melwater VOC 决策工作台">
      <IconChartRadar size={19} stroke={2.4} />
    </div>
  );
}

function Sidebar({ activeView, setActiveView }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <AppLogo />
        <div className="brand-copy">
          <strong>Melwater VOC 决策工作台</strong>
          <span>证据到行动闭环</span>
        </div>
      </div>

      <nav className="nav-stack">
        {navSections.map((section) => (
          <div className="nav-section active" key={section.label}>
            <button className="nav-section-label" type="button">
              <span>{section.label}</span>
              <IconChevronDown size={14} />
            </button>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  className={activeView === item.id ? "nav-item current" : "nav-item"}
                  disabled={item.disabled}
                  key={item.id}
                  onClick={() => !item.disabled && setActiveView(item.id)}
                  type="button"
                >
                  <Icon size={17} stroke={1.8} />
                  <span>{item.label}</span>
                  {item.disabled && <small>next</small>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="nav-section-label" type="button">
          <span>当前身份</span>
          <IconChevronDown size={14} />
        </button>
        <div className="user-chip">
          <span className="avatar">A</span>
          <div>
            <strong>分析师</strong>
            <span>在线</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Header({ activeView, actionCreated }) {
  const copy = viewConfig[activeView] || viewConfig.home;
  return (
    <header className="topbar">
      <div className="title-block">
        <div className="eyebrow">{copy.eyebrow}</div>
        <h1>{copy.title}</h1>
        <p>{copy.subtitle}</p>
      </div>
      <div className="topbar-actions">
        <button className="date-button" type="button">
          <IconCalendar size={16} />
          2026/01/01 - 2026/06/11
          <IconChevronDown size={14} />
        </button>
        <button className="icon-button" aria-label="刷新" type="button">
          <IconRefresh size={17} />
        </button>
        <button className="icon-button" aria-label="导出" type="button">
          <IconDownload size={17} />
        </button>
        <button className="icon-button has-dot" aria-label="通知" type="button">
          <IconBell size={17} />
          {actionCreated && <span />}
        </button>
        <div className="profile-pill">
          <span>A</span>
          <IconChevronDown size={14} />
        </div>
      </div>
    </header>
  );
}

function BusinessLoopStrip({ activeView }) {
  const activeIndex = {
    home: 0,
    search: 0,
    quality: 0,
    pain: 2,
    competitor: 2,
    content: 2,
    quotes: 2,
    concept: 2,
    crisis: 2,
    regions: 2,
    actions: 3,
    brief: 4,
    audit: 4,
    ops: 4,
  }[activeView] ?? 0;
  return (
    <section className="loop-strip" aria-label="业务闭环路径">
      {businessLoopSteps.map((step, index) => (
        <span className={index <= activeIndex ? "active" : ""} key={step}>
          <b>{index + 1}</b>
          {step}
        </span>
      ))}
    </section>
  );
}

function BusinessClosurePanel({ activeView }) {
  const guide = closureGuides[activeView] || closureGuides.home;
  const items = [
    ["当前判断", guide.judge, IconCircleCheck],
    ["证据基础", guide.evidence, IconDatabase],
    ["风险红线", guide.guardrail, IconShieldCheck],
    ["建议动作", guide.action, IconTargetArrow],
    ["复盘指标", guide.metric, IconClipboardCheck],
  ];
  return (
    <section className="closure-panel" aria-label="页面业务闭环">
      {items.map(([label, body, Icon]) => (
        <article className="closure-item" key={label}>
          <Icon size={15} />
          <div>
            <strong>{label}</strong>
            <p>{body}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

function SelectPill({ icon: Icon, label, value }) {
  return (
    <button className="select-pill" type="button">
      {Icon && <Icon size={15} />}
      <span className="select-label">{label}</span>
      <strong>{value}</strong>
      <IconChevronDown size={14} />
    </button>
  );
}

function FilterBar({ category, setCategory }) {
  return (
    <section className="filter-bar">
      <SelectPill icon={IconBox} label="品类" value={category} />
      <SelectPill icon={IconTargetArrow} label="指标" value="优先级 / 可信度" />
      <SelectPill icon={IconShieldCheck} label="数据包" value="20260611 洞察集" />
      <SelectPill icon={IconCalendar} label="时间范围" value="近 12 周" />
      <SelectPill icon={IconAdjustmentsHorizontal} label="排序" value="先看可行动" />
      <button className="filter-toggle" onClick={() => setCategory(category === "吸奶器" ? "全部品类" : "吸奶器")} type="button">
        <IconFilter size={16} />
        更多筛选
      </button>
    </section>
  );
}

function MartFreshness() {
  const generated = vocData.manifest.generated_at?.replace("T", " ").slice(0, 19);
  return (
    <div className="freshness-pill">
      <IconDatabase size={14} />
      marts: {vocData.manifest.status} · {generated}
    </div>
  );
}

function MetricCard({ label, value, caption, tone = "rose" }) {
  return (
    <section className={`card summary-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{caption}</small>
    </section>
  );
}

function SyncBadge({ state }) {
  const label = state === "api" ? "已写回 API" : state === "local" ? "本地暂存" : state === "conflict" ? "冲突已刷新" : "同步中";
  return <span className={`sync-badge ${state}`}>{label}</span>;
}

function QualityGateBanner({ category }) {
  const blocked = vocData.searchQuality.filter((item) => item.status !== "pass");
  const currentBlocked = category === "全部品类" ? blocked : blocked.filter((item) => item.category === category);
  if (currentBlocked.length === 0) {
    return (
      <section className="quality-banner pass">
        <IconCircleCheck size={18} />
        <div>
          <strong>可信度通过</strong>
          <p>当前筛选下没有 query-blocked 搜索，可进入业务解释，但仍需证据复核。</p>
        </div>
      </section>
    );
  }
  return (
    <section className="quality-banner blocked">
      <IconShieldCheck size={18} />
      <div>
        <strong>{currentBlocked.map((item) => item.category).join(" / ")} 被 query noise 阻断</strong>
        <p>只能输出治理动作，不能把声量、负面率或高频词解释为真实业务结论。</p>
      </div>
    </section>
  );
}

function HomePage({ setActiveView }) {
  const counts = vocData.manifest.counts;
  const topQuestions = [
    ["这些数据能下结论吗？", "先处理暖奶器/消毒器搜索噪声，避免错误业务判断。", "search", "已阻断", "rose"],
    ["今天最该解决哪个产品问题？", "吸奶器续航、噪音、舒适度已进入证据复核队列。", "pain", "可行动", "green"],
    ["哪些动作还没有负责人？", "57 条建议动作仍需负责人确认、状态推进和复盘口径。", "actions", "待确认", "amber"],
    ["哪些结论不能说？", "声量、情感、国家码和用户原话必须按红线解释。", "quality", "红线", "amber"],
    ["竞品和内容该怎么转化？", "竞品证据、内容机会和用户原话需要合并为增长动作。", "competitor", "可复核", "green"],
    ["本周月会要决策什么？", "先看阻断搜索、待分派动作、风险预警和未复盘事项。", "brief", "待复盘", "amber"],
  ];
  const decisionCards = [
    ["数据可信", `${vocData.summaries.blockedSearches} 个搜索阻断`, "先治理 query，再开放业务解释。", "search", "rose"],
    ["产品优先级", `${vocData.painCards.length} 张痛点卡`, "按证据深度和负向率进入产品/CX 队列。", "pain", "amber"],
    ["行动闭环", `${vocData.summaries.proposedActions} 条待确认`, "必须明确负责人、截止日和复盘指标。", "actions", "yellow"],
    ["经营复盘", `${vocData.executiveMonthly.length} 条月度记录`, "压缩为管理层需要决策和追责的事项。", "brief", "green"],
  ];

  return (
    <div className="home-stack">
      <div className="summary-grid">
        <MetricCard label="洞察总量" value={counts.fact_insight} caption="已生成 insight" tone="rose" />
        <MetricCard label="证据样本" value={counts.fact_evidence_sample} caption="可回溯 evidence" tone="amber" />
        <MetricCard label="待闭环动作" value={vocData.summaries.proposedActions} caption="仍需负责人确认" tone="yellow" />
        <MetricCard label="阻断搜索" value={vocData.summaries.blockedSearches} caption="暂不能下业务结论" tone="muted" />
      </div>

      <section className="card decision-hero">
        <div>
          <span className="hero-kicker">今日处理顺序</span>
          <h2>先确认数据可信，再把问题分派给负责人</h2>
          <p>这个页面只保留业务负责人今天需要处理的路径：哪些数据不能解释、哪些痛点优先处理、哪些动作没人负责、哪些事项进入复盘。</p>
        </div>
        <MartFreshness />
      </section>

      <div className="decision-grid">
        {decisionCards.map(([title, value, body, route, tone]) => (
          <button className={`decision-card card ${tone}`} key={title} onClick={() => setActiveView(route)} type="button">
            <span>{title}</span>
            <strong>{value}</strong>
            <p>{body}</p>
            <small>进入处理 <IconExternalLink size={13} /></small>
          </button>
        ))}
      </div>

      <div className="question-grid">
        {topQuestions.map(([title, body, route, status, tone]) => (
          <button className="question-card card" key={title} onClick={() => setActiveView(route)} type="button">
            <span className={`status-badge ${tone}`}>{status}</span>
            <h2>{title}</h2>
            <p>{body}</p>
            <small>进入页面 <IconExternalLink size={13} /></small>
          </button>
        ))}
      </div>
    </div>
  );
}

function SearchQualityPage() {
  const { values: verdicts, writeValue: writeVerdict, syncState } = useWritebackState("searchVerdict");
  const blocked = vocData.searchQuality.filter((item) => item.status !== "pass");
  const pass = vocData.searchQuality.filter((item) => item.status === "pass");

  return (
    <div className="lab-stack">
      <div className="summary-grid compact">
        <MetricCard label="通过搜索" value={pass.length} caption="可进入业务解释" tone="green" />
        <MetricCard label="阻断搜索" value={blocked.length} caption="只能治理 query" tone="rose" />
        <MetricCard label="复核样本" value={vocData.querySamples.length} caption="前端快照样本" tone="amber" />
        <MetricCard label="最低准确率" value={pct(Math.min(...vocData.searchQuality.map((item) => item.precision)), 1)} caption="Bottle Warmer" tone="muted" />
      </div>

      <section className="card data-table-card">
        <div className="card-header">
          <div>
            <h2>搜索可信度门禁</h2>
            <p>blocked 的品类会在下游页面显示业务解释风险。</p>
          </div>
        </div>
        <div className="quality-table">
          {vocData.searchQuality.map((item) => (
            <div className="quality-row" key={`${item.category}-${item.search}`}>
              <span>
                <strong>{item.category}</strong>
                <small>{item.search}</small>
              </span>
              <b>{item.occurrences.toLocaleString()}</b>
              <i>{pct(item.precision, 1)}</i>
              <span className={`readiness ${item.status}`}>{readinessLabel(item.status)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card data-table-card">
        <div className="card-header">
          <div>
            <h2>噪声样本复核队列</h2>
            <p>先把样本标记为真产品、噪声或不确定，再重写 query。</p>
          </div>
          <SyncBadge state={syncState} />
        </div>
        <div className="sample-list">
          {vocData.querySamples.slice(0, 8).map((sample) => (
            <article className="sample-card" key={sample.sample_id}>
              <div>
                <strong>{sample.category} · {sample.search_name}</strong>
                <p>{sample.evidence_text}</p>
                <small>{sample.matched_noise || "watch term"} · {sample.occurrence_id}</small>
              </div>
              <div className="verdict-buttons">
                {["true_product_match", "noise", "unclear"].map((verdict) => (
                  <button
                    className={verdicts[sample.sample_id] === verdict ? "active" : ""}
                    key={verdict}
                    onClick={() => writeVerdict(sample.sample_id, verdict, {
                      category: sample.category,
                      searchName: sample.search_name,
                      occurrenceId: sample.occurrence_id,
                    })}
                    type="button"
                  >
                    {verdict.replaceAll("_", " ")}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function RadarPanel({ painCards, selectedCard }) {
  const radarData = painCards.slice(0, 7).map((card) => ({
    subject: displayTopic(card),
    score: score(card.priorityScore),
    baseline: Math.round(card.categoryNegativeRate * 100),
  }));

  return (
    <section className="card radar-panel">
      <div className="card-header">
        <div>
          <h2>痛点雷达图</h2>
          <p>真实 priority score 叠加 category negative baseline。</p>
        </div>
        <span className="status-badge rose">mart data</span>
      </div>
      <div className="radar-layout">
        <div className="radar-wrap">
          <ResponsiveContainer width="100%" height={246}>
            <RadarChart data={radarData} outerRadius="72%">
              <PolarGrid stroke="#EDE6DF" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: "#6f6763", fontSize: 11 }} />
              <Radar dataKey="score" stroke="#C25B6E" fill="#C25B6E" fillOpacity={0.16} strokeWidth={2} />
              <Radar dataKey="baseline" stroke="#B5AFA8" fill="#B5AFA8" fillOpacity={0.08} strokeWidth={1.4} />
              <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#EDE6DF" }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="radar-callouts">
          <MetricMini label="最高痛点" value={score(selectedCard.priorityScore)} caption={displayTopic(selectedCard)} tone="rose" />
          <MetricMini label="负向率" value={pct(selectedCard.negativeRate, 1)} caption={selectedCard.category} tone="amber" />
          <MetricMini label="证据样本" value={selectedCard.evidenceCount} caption="fact_evidence_sample" tone="green" />
        </div>
      </div>
    </section>
  );
}

function MetricMini({ label, value, caption, tone }) {
  return (
    <div className={`metric-mini ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{caption}</small>
    </div>
  );
}

function SeverityDistribution({ painCards }) {
  const groups = [
    ["高优先级", painCards.filter((item) => item.priorityScore >= 0.62).length, "score ≥ 62", "rose"],
    ["待复核", painCards.filter((item) => item.readiness === "ready_for_review").length, "ready review", "amber"],
    ["被阻断", painCards.filter((item) => item.readiness === "blocked_by_query_noise").length, "query blocked", "yellow"],
    ["弱信号", painCards.filter((item) => item.readiness === "weak_signal").length, "weak signal", "muted"],
  ];
  return (
    <section className="card severity-panel">
      <div className="card-header compact">
        <div>
          <h2>痛点严重度分布</h2>
          <p>按 priority/readiness 聚合</p>
        </div>
        <button className="tiny-select" type="button">真实 mart <IconChevronDown size={13} /></button>
      </div>
      <div className="severity-grid">
        {groups.map(([label, value, caption, tone]) => (
          <div className={`severity-card ${tone}`} key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{caption}</small>
            <i />
          </div>
        ))}
      </div>
    </section>
  );
}

function MiniTrend({ trend, color }) {
  const data = trend.map((value, index) => ({ index, value }));
  return (
    <ResponsiveContainer width="100%" height={56}>
      <AreaChart data={data} margin={{ top: 8, right: 2, left: 2, bottom: 0 }}>
        <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.12} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function TrendCards() {
  return (
    <section className="card trend-panel">
      <div className="card-header compact">
        <div>
          <h2>闭环趋势（示意）</h2>
          <p>下一轮接入 weekly_change_points</p>
        </div>
        <button className="tiny-select" type="button">近 12 周 <IconChevronDown size={13} /></button>
      </div>
      <div className="trend-grid">
        {microTrends.map((item) => (
          <div className="trend-card" key={item.label}>
            <span>{item.label}</span>
            <MiniTrend trend={item.data} color={item.color} />
          </div>
        ))}
      </div>
    </section>
  );
}

function IssueTable({ selectedId, onSelect, painCards }) {
  return (
    <section className="card issue-card">
      <div className="card-header">
        <div>
          <h2>痛点明细</h2>
          <p>点击行查看右侧洞察、证据样本和推荐动作。</p>
        </div>
        <div className="table-tools">
          <button type="button">{painCards.length} 条 <IconChevronDown size={13} /></button>
          <button className="page-button active" type="button">1</button>
        </div>
      </div>
      <div className="issue-table">
        <div className="table-row table-head">
          <span>痛点</span>
          <span>负责人</span>
          <span>占比</span>
          <span>优先级</span>
          <span>提升</span>
          <span>趋势</span>
          <span>渠道</span>
          <span>状态</span>
        </div>
        {painCards.slice(0, 10).map((card) => (
          <button
            className={card.topicId === selectedId ? "table-row selected" : "table-row"}
            key={`${card.category}-${card.topicId}`}
            onClick={() => onSelect(card.topicId)}
            type="button"
          >
            <span className="issue-name">
              <span className="issue-dot" />
              <strong>{displayTopic(card)}</strong>
              <small>{card.category} · {card.topicLabel}</small>
            </span>
            <span>{card.ownerDomain}</span>
            <span>{pct(card.negativeRate, 1)}</span>
            <span>
              <b className="urgency-pill">{score(card.priorityScore)}</b>
            </span>
            <span className={card.negativeLift > 0 ? "delta" : "delta up"}>{pct(card.negativeLift, 1)}</span>
            <span className="row-trend">
              <MiniTrend trend={[42, 48, 45, 52, 61, 58, score(card.priorityScore)]} color={card.topicId === selectedId ? "#C25B6E" : "#B5AFA8"} />
            </span>
            <span className="channel-icons">
              <IconBrandTiktok size={15} />
              <IconBrandYoutube size={15} />
              <IconMessageCircle size={15} />
            </span>
            <span className={`readiness ${card.readiness}`}>{readinessLabel(card.readiness)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function InsightPanel({ card, actionCreated, setActionCreated, setDrawerOpen }) {
  return (
    <aside className="insight-panel">
      <section className="card recommendation-card">
        <div className="side-header">
          <div>
            <h2>优先解决：{displayTopic(card)}</h2>
            <p>{card.topicLabel} · {card.ownerDomain}</p>
          </div>
          <span className="status-badge rose">{readinessLabel(card.readiness)}</span>
        </div>

        <div className="recommendation-body">
          <div className="insight-line">
            <IconSparkles size={16} />
            <p>
              {card.readiness === "blocked_by_query_noise"
                ? "当前品类被 query noise 阻断，先进入搜索治理，不输出业务结论。"
                : `负向率 ${pct(card.negativeRate, 1)}，优先级 ${score(card.priorityScore)}，建议进入 ${card.ownerDomain} 复核。`}
            </p>
          </div>
          <div className="quote-stack">
            {(card.evidenceSamples.length ? card.evidenceSamples : ["No evidence sample in current snapshot."]).slice(0, 2).map((item) => (
              <div className="quote-card" key={item}>
                <span />
                <p>{item}</p>
              </div>
            ))}
          </div>
          <button className="link-button" onClick={() => setDrawerOpen(true)} type="button">
            打开证据抽屉
          </button>
        </div>

        <button className={actionCreated ? "primary-action done" : "primary-action"} onClick={() => setActionCreated(true)} type="button">
          {actionCreated ? <IconCheck size={17} /> : <IconExternalLink size={17} />}
          {actionCreated ? "行动卡已创建" : `生成 ${card.ownerDomain} 行动卡`}
        </button>
      </section>

      <section className="card confidence-card">
        <div className="side-header">
          <h2>证据覆盖度</h2>
          <IconShieldCheck size={16} />
        </div>
        <div className="donut-row">
          <div className="donut" style={{ "--value": `${Math.min(92, score(card.priorityScore))}%` }}>
            <strong>{Math.min(92, score(card.priorityScore))}%</strong>
            <span>可信覆盖</span>
          </div>
          <div className="legend-list">
            {[
              ["证据数", String(card.evidenceCount)],
              ["负向", pct(card.negativeRate, 1)],
              ["基准", pct(card.categoryNegativeRate, 1)],
              ["lift", pct(card.negativeLift, 1)],
            ].map(([label, value], index) => (
              <div key={label}>
                <span className={`legend-dot tone-${index}`} />
                <p>{label}</p>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card related-card">
        <div className="side-header">
          <h2>关键证据来源</h2>
          <IconUsers size={16} />
        </div>
        {channelMix.map((item) => (
          <div className="source-row" key={item.name}>
            <span>{item.name}</span>
            <div>
              <i style={{ width: `${item.value}%` }} />
            </div>
            <strong>{item.value}%</strong>
          </div>
        ))}
      </section>
    </aside>
  );
}

function PainRadarPage({ category, setCategory, setActionCreated, actionCreated }) {
  const [selectedId, setSelectedId] = useState("battery_power");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const painCards = useMemo(() => {
    const rows = category === "全部品类" ? vocData.painCards : vocData.painCards.filter((item) => item.category === category);
    return [...rows].sort((a, b) => b.priorityScore - a.priorityScore);
  }, [category]);
  const selectedCard = painCards.find((item) => item.topicId === selectedId) || painCards[0] || vocData.painCards[0];

  return (
    <>
      <FilterBar category={category} setCategory={setCategory} />
      <QualityGateBanner category={category} />
      <div className="content-grid">
        <div className="main-column">
          <div className="top-grid">
            <RadarPanel painCards={painCards} selectedCard={selectedCard} />
            <div className="right-main-stack">
              <SeverityDistribution painCards={painCards} />
              <TrendCards />
            </div>
          </div>
          <IssueTable selectedId={selectedCard.topicId} onSelect={setSelectedId} painCards={painCards} />
        </div>
        <InsightPanel card={selectedCard} actionCreated={actionCreated} setActionCreated={setActionCreated} setDrawerOpen={setDrawerOpen} />
      </div>
      {drawerOpen && <EvidenceDrawer card={selectedCard} onClose={() => setDrawerOpen(false)} />}
    </>
  );
}

function EvidenceDrawer({ card, onClose }) {
  const evidenceItems = card.evidenceDetails?.length
    ? card.evidenceDetails
    : (card.evidenceSamples.length ? card.evidenceSamples : ["当前快照没有抽样文本，需回查 fact_evidence_sample。"]).map((item) => ({
        evidence: item,
        reviewStatus: "pending_review",
      }));

  return (
    <div className="drawer-backdrop">
      <aside className="evidence-drawer card">
        <div className="side-header">
          <div>
            <h2>证据抽屉 · {displayTopic(card)}</h2>
            <p>{card.category} · {card.topicLabel} · {card.readiness}</p>
          </div>
          <button className="tiny-select" onClick={onClose} type="button">关闭</button>
        </div>
        <div className="drawer-section">
          <h3>Lineage</h3>
          <p>source_table: mart_product_pain_radar · topic_id: {card.topicId}</p>
          <p>valid_mentions: {card.validMentions.toLocaleString()} · evidence_count: {card.evidenceCount}</p>
        </div>
        <div className="drawer-section">
          <h3>Structured Evidence Samples</h3>
          {evidenceItems.map((item, index) => (
            <article className="drawer-evidence structured" key={`${item.occurrenceId || item.evidence}-${index}`}>
              <div className="drawer-evidence-header">
                <span className={`readiness ${item.reviewStatus || "pending_review"}`}>{readinessLabel(item.reviewStatus || "pending_review")}</span>
                {item.url && item.url !== "unknown" && (
                  <a className="drawer-link" href={item.url} target="_blank" rel="noreferrer">
                    打开原文 <IconExternalLink size={12} />
                  </a>
                )}
              </div>
              <p className="drawer-evidence-text">{item.evidence}</p>
              <div className="drawer-meta-grid">
                {[
                  ["sentiment", item.sentiment || "unknown"],
                  ["document_id", item.documentId || "unknown"],
                  ["occurrence_id", item.occurrenceId || "unknown"],
                  ["matched_term", item.matchedTerm || "unknown"],
                ].map(([label, value]) => (
                  <span key={label}>
                    <small>{label}</small>
                    <strong>{value}</strong>
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </aside>
    </div>
  );
}

function CompetitorPage() {
  const cards = useMemo(
    () => [...vocData.competitorBattlecards].sort((a, b) => Number(b.mentions || 0) - Number(a.mentions || 0)),
    [],
  );
  const [selectedKey, setSelectedKey] = useState(`${cards[0]?.category}-${cards[0]?.brand}`);
  const selected = cards.find((item) => `${item.category}-${item.brand}` === selectedKey) || cards[0];
  const categoryOwned = cards.find((item) => item.category === selected.category && item.role === "owned");
  const negativeGap = selected.negativeRate - (categoryOwned?.negativeRate || 0);
  const categories = new Set(cards.map((item) => item.category));
  const competitors = cards.filter((item) => item.role !== "owned");

  return (
    <div className="lab-stack">
      <div className="summary-grid compact">
        <MetricCard label="竞品卡" value={cards.length} caption="品牌 x 品类" tone="rose" />
        <MetricCard label="可复核卡片" value={vocData.summaries.readyCompetitors} caption="可进入复核" tone="green" />
        <MetricCard label="竞品品牌" value={competitors.length} caption="非自有品牌行" tone="amber" />
        <MetricCard label="覆盖品类" value={categories.size} caption="当前数据覆盖" tone="muted" />
      </div>

      <div className="battlecard-layout">
        <section className="card battlecard-board">
          <div className="card-header">
            <div>
              <h2>竞品证据队列</h2>
              <p>优先看 ready_for_review；blocked 品类只用于搜索治理，不做竞品结论。</p>
            </div>
            <span className="status-badge rose">VOC 提及</span>
          </div>
          <div className="battlecard-grid">
            {cards.map((item) => {
              const key = `${item.category}-${item.brand}`;
              return (
                <button
                  className={key === selectedKey ? "battlecard-card selected" : "battlecard-card"}
                  key={key}
                  onClick={() => setSelectedKey(key)}
                  type="button"
                >
                  <div className="battlecard-title">
                    <span className={`brand-role ${item.role}`}>{item.role}</span>
                    <strong>{item.brand}</strong>
                    <small>{item.category}</small>
                  </div>
                  <div className="battlecard-metrics">
                    <span>
                      <small>mentions</small>
                      <b>{compactNumber(item.mentions)}</b>
                    </span>
                    <span>
                      <small>negative</small>
                      <b>{pct(item.negativeRate, 1)}</b>
                    </span>
                  </div>
                  <span className={`readiness ${item.readiness}`}>{readinessLabel(item.readiness)}</span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="card detail-panel">
          <div className="side-header">
            <div>
              <h2>{selected.brand} · {selected.category}</h2>
              <p>Battlecard diagnosis</p>
            </div>
            <IconTargetArrow size={17} />
          </div>
          <div className="detail-stack">
            <div className="battlecard-diagnosis">
              <strong>{selected.role === "owned" ? "Owned baseline" : "Competitive signal"}</strong>
              <p>
                {selected.readiness === "blocked_by_query_noise"
                  ? "该品类被 query noise 阻断，当前只能进入搜索词治理与样本复核。"
                  : selected.role === "owned"
                    ? "作为同品类基准，用于衡量竞品负向率、声量和可传播卖点差异。"
                    : negativeGap > 0
                      ? `竞品负向率高出 owned baseline ${pct(negativeGap, 1)}，适合提炼对比型内容和产品改进假设。`
                      : `竞品负向率低于 owned baseline ${pct(Math.abs(negativeGap), 1)}，需要回看 quote 找到优势叙事和风险点。`}
              </p>
            </div>
            <div className="meter-row">
              <span>VOC mentions</span>
              <div className="meter-track">
                <i style={{ width: `${Math.min(100, Math.max(8, (selected.mentions / cards[0].mentions) * 100))}%` }} />
              </div>
              <strong>{compactNumber(selected.mentions)}</strong>
            </div>
            <div className="meter-row">
              <span>Negative rate</span>
              <div className="meter-track warning">
                <i style={{ width: `${Math.min(100, score(selected.negativeRate) * 2)}%` }} />
              </div>
              <strong>{pct(selected.negativeRate, 1)}</strong>
            </div>
            <div className="guardrail-row inline">
              <IconShieldCheck size={17} />
              <div>
                <strong>解释边界</strong>
                <p>mentions 不是市场份额；battlecard 只表达 VOC 讨论强度和可复核证据方向。</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ContentOpportunityPage({ setActiveView }) {
  const sourceTypes = ["all", ...new Set(vocData.contentOpportunities.map((item) => item.sourceType))];
  const [sourceFilter, setSourceFilter] = useState("all");
  const visibleOpportunities = vocData.contentOpportunities
    .filter((item) => sourceFilter === "all" || item.sourceType === sourceFilter)
    .sort((a, b) => Number(b.positive || 0) - Number(a.positive || 0));
  const [selectedKey, setSelectedKey] = useState("");
  const selected = visibleOpportunities.find((item) => `${item.category}-${item.sourceType}-${item.topic}` === selectedKey) || visibleOpportunities[0];
  const matchingQuotes = vocData.quoteLibrary
    .filter((quote) => quote.category === selected?.category && quote.topicLabel === selected?.topic)
    .slice(0, 4);
  const previewQuotes = matchingQuotes.length ? matchingQuotes : vocData.quoteLibrary.slice(0, 4);

  return (
    <div className="lab-stack">
      <div className="summary-grid compact">
        <MetricCard label="内容机会" value={vocData.contentOpportunities.length} caption="内容简报候选" tone="rose" />
        <MetricCard label="可复核简报" value={vocData.summaries.readyContentBriefs} caption="待人工复核" tone="green" />
        <MetricCard label="用户原话" value={vocData.summaries.quotes} caption="可复核原话" tone="amber" />
        <MetricCard label="来源类型" value={sourceTypes.length - 1} caption="渠道维度" tone="muted" />
      </div>

      <section className="card tab-card">
        <div className="tab-row">
          {sourceTypes.map((source) => (
            <button
              className={sourceFilter === source ? "active" : ""}
              key={source}
              onClick={() => {
                setSourceFilter(source);
                setSelectedKey("");
              }}
              type="button"
            >
              {source}
            </button>
          ))}
        </div>
      </section>

      <div className="opportunity-layout">
        <section className="card data-table-card">
          <div className="card-header">
            <div>
              <h2>内容机会队列</h2>
              <p>按正向证据量排序，优先生成主题简报和用户原话短名单。</p>
            </div>
            <button className="tiny-select" onClick={() => setActiveView("quotes")} type="button">
              打开用户原话库
            </button>
          </div>
          <div className="opportunity-list">
            {visibleOpportunities.slice(0, 16).map((item) => {
              const key = `${item.category}-${item.sourceType}-${item.topic}`;
              return (
                <button
                  className={selected && key === `${selected.category}-${selected.sourceType}-${selected.topic}` ? "opportunity-card selected" : "opportunity-card"}
                  key={key}
                  onClick={() => setSelectedKey(key)}
                  type="button"
                >
                  <div>
                    <strong>{item.topic}</strong>
                    <small>{item.category} · {item.sourceType}</small>
                  </div>
                  <b>{compactNumber(item.positive)}</b>
                  <span>{pct(item.positiveRate, 1)}</span>
                  <span className={`readiness ${item.readiness}`}>{readinessLabel(item.readiness)}</span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="card content-detail">
          <div className="side-header">
            <div>
              <h2>{selected.topic}</h2>
              <p>{selected.category} · {selected.sourceType}</p>
            </div>
            <IconListDetails size={17} />
          </div>
          <div className="detail-stack">
            <div className="battlecard-diagnosis">
              <strong>内容建议</strong>
              <p>
                {selected.readiness === "blocked_by_query_noise"
                  ? "当前机会来自 blocked 品类，先把 query 样本复核完成，再决定是否进入内容生产。"
                  : `该主题有 ${compactNumber(selected.positive)} 条正向证据，正向率 ${pct(selected.positiveRate, 1)}，可进入内容角度拆解。`}
              </p>
            </div>
            <div className="quote-preview-list">
              {previewQuotes.map((quote) => (
                <article className="quote-preview-card" key={quote.quoteId}>
                  <p>{quote.quoteText}</p>
                  <small>{quote.sentiment} · {quote.documentId}</small>
                </article>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function QuoteLibraryPage() {
  const [sentiment, setSentiment] = useState("all");
  const { values: reviewed, writeValue: writeQuoteReview, syncState } = useWritebackState("quoteReview");
  const sentiments = ["all", ...new Set(vocData.quoteLibrary.map((quote) => quote.sentiment))];
  const quotes = vocData.quoteLibrary.filter((quote) => sentiment === "all" || quote.sentiment === sentiment);

  return (
    <div className="lab-stack">
      <div className="summary-grid compact">
        <MetricCard label="原话候选" value={vocData.quoteLibrary.length} caption="内容简报原话" tone="rose" />
        <MetricCard label="当前筛选" value={quotes.length} caption={sentimentLabel(sentiment)} tone="amber" />
        <MetricCard label="本次已审" value={Object.keys(reviewed).length} caption="前端临时状态" tone="green" />
        <MetricCard label="使用类型" value="1" caption="简报引用" tone="muted" />
      </div>

      <section className="card tab-card">
        <div className="tab-row">
          {sentiments.map((item) => (
            <button className={sentiment === item ? "active" : ""} key={item} onClick={() => setSentiment(item)} type="button">
              {sentimentLabel(item)}
            </button>
          ))}
          <SyncBadge state={syncState} />
        </div>
      </section>

      <section className="quote-library-grid">
        {quotes.slice(0, 18).map((quote) => (
          <article className="card quote-library-card" key={quote.quoteId}>
            <div className="quote-card-top">
              <span className={`status-badge ${quote.sentiment === "positive" ? "green" : quote.sentiment === "negative" ? "rose" : "amber"}`}>
                {quote.sentiment}
              </span>
              <small>{quote.sourceType}</small>
            </div>
            <p>{quote.quoteText}</p>
            <div className="quote-meta-grid">
              <span>
                <small>topic</small>
                <strong>{quote.topicLabel}</strong>
              </span>
              <span>
                <small>document_id</small>
                <strong>{quote.documentId}</strong>
              </span>
              <span>
                <small>occurrence_id</small>
                <strong>{quote.occurrenceId}</strong>
              </span>
            </div>
            <div className="quote-actions">
              <button
                className={reviewed[quote.quoteId] === "approved" ? "active" : ""}
                onClick={() => writeQuoteReview(quote.quoteId, "approved", {
                  category: quote.category,
                  topic: quote.topicLabel,
                  documentId: quote.documentId,
                  occurrenceId: quote.occurrenceId,
                  url: quote.url,
                })}
                type="button"
              >
                approve
              </button>
              <button
                className={reviewed[quote.quoteId] === "needs_legal" ? "active muted" : ""}
                onClick={() => writeQuoteReview(quote.quoteId, "needs_legal", {
                  category: quote.category,
                  topic: quote.topicLabel,
                  documentId: quote.documentId,
                  occurrenceId: quote.occurrenceId,
                  url: quote.url,
                })}
                type="button"
              >
                legal
              </button>
              {quote.url && (
                <a href={quote.url} target="_blank" rel="noreferrer">
                  source <IconExternalLink size={12} />
                </a>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function ConceptCandidatePage() {
  const candidates = useMemo(
    () => [...vocData.conceptCandidates].sort((a, b) => Number(b.score || 0) - Number(a.score || 0)),
    [],
  );
  const [selectedKey, setSelectedKey] = useState(`${candidates[0]?.category}-${candidates[0]?.conceptTheme}`);
  const { values: decisions, writeValue: writeConceptDecision, syncState } = useWritebackState("conceptDecision");
  const selected = candidates.find((item) => `${item.category}-${item.conceptTheme}` === selectedKey) || candidates[0];
  const proofQuotes = matchingQuotes(selected.category, selected.conceptTheme, 3);
  const quoteFallback = proofQuotes.length ? proofQuotes : vocData.quoteLibrary.filter((quote) => quote.category === selected.category).slice(0, 3);
  const ready = candidates.filter((item) => item.readiness === "ready_for_review");
  const blocked = candidates.filter((item) => item.readiness === "blocked_by_query_noise");

  return (
    <div className="lab-stack">
      <div className="summary-grid compact">
        <MetricCard label="Concepts" value={candidates.length} caption="concept_candidates" tone="rose" />
        <MetricCard label="Ready" value={vocData.summaries.readyConcepts} caption="可进入复核" tone="green" />
        <MetricCard label="Blocked" value={blocked.length} caption="先治理 query" tone="amber" />
        <MetricCard label="Decisions" value={Object.keys(decisions).length} caption="前端临时状态" tone="muted" />
      </div>

      <div className="p2-layout">
        <section className="card p2-board">
          <div className="card-header">
            <div>
              <h2>Concept Candidate Queue</h2>
              <p>优先处理 ready_for_review；blocked 概念先回到搜索质量治理。</p>
            </div>
            <div className="header-badges">
              <span className="status-badge rose">{ready.length} ready</span>
              <SyncBadge state={syncState} />
            </div>
          </div>
          <div className="signal-list">
            {candidates.map((item) => {
              const key = `${item.category}-${item.conceptTheme}`;
              return (
                <button className={key === selectedKey ? "signal-row selected" : "signal-row"} key={key} onClick={() => setSelectedKey(key)} type="button">
                  <div>
                    <strong>{item.conceptTheme}</strong>
                    <small>{item.category} · owner: {ownerForTheme(item.conceptTheme)}</small>
                  </div>
                  <b>{compactNumber(item.evidence)}</b>
                  <span>{compactNumber(item.negative)}</span>
                  <i>{score(item.score)}</i>
                  <span className={`readiness ${item.readiness}`}>{readinessLabel(item.readiness)}</span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="card p2-detail">
          <div className="side-header">
            <div>
              <h2>{selected.conceptTheme}</h2>
              <p>{selected.category} · {ownerForTheme(selected.conceptTheme)}</p>
            </div>
            <IconFlask size={17} />
          </div>
          <div className="detail-stack">
            <div className="battlecard-diagnosis">
              <strong>Validation hypothesis</strong>
              <p>
                {selected.readiness === "blocked_by_query_noise"
                  ? "概念信号来自 query-blocked 品类，暂不进入产品立项，只进入样本复核和 query rewrite。"
                  : `${selected.conceptTheme} 有 ${compactNumber(selected.evidence)} 条证据和 ${compactNumber(selected.negative)} 条负向触点，可进入小样本概念验证。`}
              </p>
            </div>
            <div className="experiment-grid">
              {["证据复核 20 条", "PDP claim A/B", "客服话术验证", "产品 owner 评审"].map((item) => (
                <span key={item}>
                  <IconCheck size={14} />
                  {item}
                </span>
              ))}
            </div>
            <div className="quote-preview-list">
              {quoteFallback.map((quote) => (
                <article className="quote-preview-card" key={quote.quoteId}>
                  <p>{quote.quoteText}</p>
                  <small>{quote.sentiment} · {quote.occurrenceId}</small>
                </article>
              ))}
            </div>
            <div className="decision-buttons">
              {["test", "hold", "reject"].map((decision) => (
                <button
                  className={decisions[selectedKey] === decision ? "active" : ""}
                  key={decision}
                  onClick={() => writeConceptDecision(selectedKey, decision, {
                    category: selected.category,
                    conceptTheme: selected.conceptTheme,
                    owner: ownerForTheme(selected.conceptTheme),
                    readiness: selected.readiness,
                    score: selected.score,
                  })}
                  type="button"
                >
                  {decision}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CrisisWatchPage() {
  const categories = ["all", ...new Set(vocData.crisisWatch.map((item) => item.category))];
  const [category, setCategory] = useState("all");
  const { values: status, writeValue: writeCrisisStatus, syncState } = useWritebackState("crisisTriage");
  const events = vocData.crisisWatch.filter((item) => category === "all" || item.category === category);
  const selected = events[0] || vocData.crisisWatch[0];
  const changePoints = vocData.weeklyChangePoints.filter((item) => category === "all" || item.category === category).slice(0, 6);
  const maxNegative = Math.max(...vocData.crisisWatch.map((item) => item.negative || 0), 1);

  return (
    <div className="lab-stack">
      <div className="summary-grid compact">
        <MetricCard label="Daily alerts" value={vocData.summaries.crisisAlerts} caption="non-green events" tone="rose" />
        <MetricCard label="Top negative" value={compactNumber(selected.negative)} caption={selected.day} tone="amber" />
        <MetricCard label="Change points" value={vocData.weeklyChangePoints.length} caption="weekly_voc" tone="yellow" />
        <MetricCard label="Triaged now" value={Object.keys(status).length} caption="前端临时状态" tone="green" />
      </div>

      <section className="card tab-card">
        <div className="tab-row">
          {categories.map((item) => (
            <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)} type="button">
              {item}
            </button>
          ))}
        </div>
      </section>

      <div className="p2-layout">
        <section className="card p2-board">
          <div className="card-header">
            <div>
              <h2>Crisis Daily Queue</h2>
              <p>data_quality_alert 需要先判断是业务危机、搜索污染，还是采集异常。</p>
            </div>
            <div className="header-badges">
              <span className="status-badge rose">PR/CX triage</span>
              <SyncBadge state={syncState} />
            </div>
          </div>
          <div className="signal-list crisis">
            {events.map((item) => {
              const key = `${item.category}-${item.day}`;
              return (
                <article className="signal-row static" key={key}>
                  <div>
                    <strong>{item.category} · {item.day}</strong>
                    <small>{item.alert}</small>
                  </div>
                  <b>{compactNumber(item.occurrences)}</b>
                  <span>{compactNumber(item.negative)}</span>
                  <i>{pct(item.negativeRate, 1)}</i>
                  <button
                    className={status[key] ? "mini-state active" : "mini-state"}
                    onClick={() => writeCrisisStatus(key, status[key] === "escalated" ? "acknowledged" : "escalated", {
                      category: item.category,
                      day: item.day,
                      alert: item.alert,
                      negativeRate: item.negativeRate,
                      negative: item.negative,
                    })}
                    type="button"
                  >
                    {status[key] || "triage"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="card p2-detail">
          <div className="side-header">
            <div>
              <h2>Runbook · {selected.category}</h2>
              <p>{selected.day} · negative rate {pct(selected.negativeRate, 1)}</p>
            </div>
            <IconBell size={17} />
          </div>
          <div className="detail-stack">
            <div className="meter-row">
              <span>负向压力</span>
              <div className="meter-track warning">
                <i style={{ width: `${Math.max(8, (selected.negative / maxNegative) * 100)}%` }} />
              </div>
              <strong>{compactNumber(selected.negative)}</strong>
            </div>
            <div className="runbook-grid">
              {[
                ["数据复核", "确认 query、source、重复内容和情感标签"],
                ["CX", "抽样 20 条原话，判断是否为真实投诉"],
                ["PR", "如真实负面集中，准备 FAQ 和响应口径"],
                ["负责人", "24h 内标记 acknowledged / escalated"],
              ].map(([label, body]) => (
                <span key={label}>
                  <strong>{label}</strong>
                  <small>{body}</small>
                </span>
              ))}
            </div>
            <div className="quote-preview-list">
              {changePoints.map((item) => (
                <article className="quote-preview-card" key={`${item.category}-${item.week}`}>
                  <p>{item.category} · {item.week}: {item.level} · 声量 {signedPct(item.wowVolume)} · 负向 {signedPct(item.wowNegative)}</p>
                  <small>{item.reason}</small>
                </article>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function RegionLanguagePage() {
  const [knownOnly, setKnownOnly] = useState(false);
  const rows = vocData.regionPriorities
    .filter((item) => !knownOnly || item.countryKnown === "yes")
    .sort((a, b) => Number(b.mentions || 0) - Number(a.mentions || 0));
  const [selectedKey, setSelectedKey] = useState(`${rows[0]?.category}-${rows[0]?.language}-${rows[0]?.country}`);
  const selected = rows.find((item) => `${item.category}-${item.language}-${item.country}` === selectedKey) || rows[0] || vocData.regionPriorities[0];
  const unknownRows = vocData.regionPriorities.filter((item) => item.countryKnown !== "yes");

  return (
    <div className="lab-stack">
      <div className="summary-grid compact">
        <MetricCard label="机会行" value={vocData.regionPriorities.length} caption="语言 x 国家" tone="rose" />
        <MetricCard label="已知国家" value={vocData.summaries.knownRegionRows} caption="country_known=yes" tone="green" />
        <MetricCard label="未知 zz" value={unknownRows.length} caption="只能做语言线索" tone="amber" />
        <MetricCard label="当前显示" value={rows.length} caption={knownOnly ? "仅已知国家" : "全部"} tone="muted" />
      </div>

      <section className="card tab-card">
        <div className="tab-row">
          <button className={!knownOnly ? "active" : ""} onClick={() => setKnownOnly(false)} type="button">全部线索</button>
          <button className={knownOnly ? "active" : ""} onClick={() => setKnownOnly(true)} type="button">仅已知国家</button>
        </div>
      </section>

      <QualityGateBanner category={selected.category} />

      <div className="p2-layout">
        <section className="card p2-board">
          <div className="card-header">
            <div>
              <h2>区域与语言优先级</h2>
              <p>country_known=no 的 zz 只能作为语言和内容优先级，不能当作地域市场。</p>
            </div>
            <span className="status-badge amber">地域红线</span>
          </div>
          <div className="signal-list region">
            {rows.map((item) => {
              const key = `${item.category}-${item.language}-${item.country}`;
              return (
                <button className={key === selectedKey ? "signal-row selected" : "signal-row"} key={key} onClick={() => setSelectedKey(key)} type="button">
                  <div>
                    <strong>{item.language} · {item.country.toUpperCase()}</strong>
                    <small>{item.category} · country_known={item.countryKnown}</small>
                  </div>
                  <b>{compactNumber(item.mentions)}</b>
                  <span>{pct(item.negativeRate, 1)}</span>
                  <i>{item.countryKnown}</i>
                  <span className={`readiness ${item.readiness}`}>{readinessLabel(item.readiness)}</span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="card p2-detail">
          <div className="side-header">
            <div>
              <h2>{selected.language} / {selected.country.toUpperCase()}</h2>
              <p>{selected.category} · mentions {compactNumber(selected.mentions)}</p>
            </div>
            <IconUsers size={17} />
          </div>
          <div className="detail-stack">
            <div className="battlecard-diagnosis">
              <strong>{selected.countryKnown === "yes" ? "Market-priority candidate" : "Language-only signal"}</strong>
              <p>
                {selected.countryKnown === "yes"
                  ? `该行可以作为 ${selected.country.toUpperCase()} 市场的 VOC 优先级输入，但仍需结合销售、广告和客服数据。`
                  : "country=zz 表示未知国家，只能指导语言内容、标签清洗和后续归因治理。"}
              </p>
            </div>
            <div className="meter-row">
              <span>Mentions</span>
              <div className="meter-track">
                <i style={{ width: `${Math.max(8, (selected.mentions / rows[0].mentions) * 100)}%` }} />
              </div>
              <strong>{compactNumber(selected.mentions)}</strong>
            </div>
            <div className="meter-row">
              <span>Negative</span>
              <div className="meter-track warning">
                <i style={{ width: `${Math.min(100, score(selected.negativeRate) * 3)}%` }} />
              </div>
              <strong>{pct(selected.negativeRate, 1)}</strong>
            </div>
            <div className="guardrail-row inline">
              <IconShieldCheck size={17} />
              <div>
                <strong>验收口径</strong>
                <p>地域页只产生优先级和治理建议，不直接给市场份额、销售预测或投放预算结论。</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ExecutiveMonthlyPage() {
  const months = [...new Set(vocData.executiveMonthly.map((item) => item.month))].sort();
  const [month, setMonth] = useState(months[months.length - 1]);
  const rows = vocData.executiveMonthly.filter((item) => item.month === month);
  const totals = rows.reduce(
    (acc, item) => {
      acc.occurrences += item.occurrences;
      acc.blocked += item.blockedSearches;
      acc.ready += item.readyActions;
      acc.negativeWeighted += item.negativeRate * item.occurrences;
      return acc;
    },
    { occurrences: 0, blocked: 0, ready: 0, negativeWeighted: 0 },
  );
  const avgNegative = totals.occurrences ? totals.negativeWeighted / totals.occurrences : 0;
  const [selectedCategory, setSelectedCategory] = useState(rows[0]?.category || "");
  const selected = rows.find((item) => item.category === selectedCategory) || rows[0] || vocData.executiveMonthly[0];
  const readyBriefs = vocData.contentBriefQueue.filter((item) => item.readiness === "ready_for_review").slice(0, 5);

  return (
    <div className="lab-stack">
      <div className="summary-grid compact">
        <MetricCard label="Month" value={month} caption="executive_monthly_brief" tone="rose" />
        <MetricCard label="Occurrences" value={compactNumber(totals.occurrences)} caption="monthly VOC" tone="amber" />
        <MetricCard label="Avg negative" value={pct(avgNegative, 1)} caption="weighted" tone="yellow" />
        <MetricCard label="Ready actions" value={totals.ready} caption="owner follow-up" tone="green" />
      </div>

      <section className="card tab-card">
        <div className="tab-row">
          {months.map((item) => (
            <button className={month === item ? "active" : ""} key={item} onClick={() => setMonth(item)} type="button">
              {item}
            </button>
          ))}
        </div>
      </section>

      <div className="p2-layout">
        <section className="card p2-board">
          <div className="card-header">
            <div>
              <h2>月会决策包</h2>
              <p>月会顺序：先看数据质量阻断，再看可行动事项，最后看内容/概念扩展。</p>
            </div>
            <span className="status-badge green">{rows.length} 个品类</span>
          </div>
          <div className="signal-list monthly">
            {rows.map((item) => (
              <button
                className={item.category === selected.category ? "signal-row selected" : "signal-row"}
                key={`${item.month}-${item.category}`}
                onClick={() => setSelectedCategory(item.category)}
                type="button"
              >
                <div>
                  <strong>{item.category}</strong>
                  <small>{item.month}</small>
                </div>
                <b>{compactNumber(item.occurrences)}</b>
                <span>{pct(item.negativeRate, 1)}</span>
                <i>{item.blockedSearches}</i>
                <span className={`readiness ${item.blockedSearches ? "blocked_by_query_noise" : "ready_for_review"}`}>
                  {item.blockedSearches ? "搜索阻断" : "可复核"}
                </span>
              </button>
            ))}
          </div>
        </section>

        <aside className="card p2-detail">
          <div className="side-header">
            <div>
              <h2>会议叙事 · {selected.category}</h2>
              <p>{month} · {compactNumber(selected.occurrences)} 次出现</p>
            </div>
            <IconBookmark size={17} />
          </div>
          <div className="detail-stack">
            <div className="battlecard-diagnosis">
              <strong>建议月会讲法</strong>
              <p>
                {selected.blockedSearches
                  ? `${selected.category} 有 ${selected.blockedSearches} 个搜索阻断，管理层页只输出治理进展，不输出业务判断。`
                  : `${selected.category} 数据质量通过，可讨论 ${selected.readyActions} 条可行动事项、痛点优先级和内容机会。`}
              </p>
            </div>
            <div className="runbook-grid">
              {[
                ["1. 可信度", `${selected.blockedSearches} 个阻断搜索`],
                ["2. VOC", `${pct(selected.negativeRate, 1)} 负向率`],
                ["3. 动作", `${selected.readyActions} 条可行动`],
                ["4. 闭环", "负责人 + 下次指标"],
              ].map(([label, body]) => (
                <span key={label}>
                  <strong>{label}</strong>
                  <small>{body}</small>
                </span>
              ))}
            </div>
            <div className="quote-preview-list">
              {readyBriefs.map((brief) => (
                <article className="quote-preview-card" key={brief.briefId}>
                  <p>{brief.topic} · {brief.platform}: {brief.suggestedAngle}</p>
                  <small>{brief.category} · {brief.quotes} 条原话 · {pct(brief.positiveRate, 1)} 正向</small>
                </article>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function AuditLogPage() {
  const [events, setEvents] = useState([]);
  const [syncState, setSyncState] = useState("loading");

  const loadEvents = useCallback(() => {
    setSyncState("loading");
    fetch(reviewStateUrl("/events?limit=100"), { headers: reviewStateHeaders() })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`GET ${response.status}`))))
      .then((payload) => {
        setEvents(payload);
        setSyncState("api");
      })
      .catch(() => setSyncState("local"));
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const namespaceCounts = events.reduce((acc, event) => {
    acc[event.namespace] = (acc[event.namespace] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="lab-stack">
      <div className="summary-grid compact">
        <MetricCard label="事件数" value={events.length} caption="review-events.jsonl" tone="rose" />
        <MetricCard label="操作者" value={new Set(events.map((event) => event.actor)).size} caption="updatedBy" tone="green" />
        <MetricCard label="写回域" value={Object.keys(namespaceCounts).length} caption="writeback domains" tone="amber" />
        <MetricCard label="最近操作" value={events[0]?.operation || "none"} caption={events[0]?.timestamp?.slice(0, 19) || "暂无事件"} tone="muted" />
      </div>

      <section className="card data-table-card">
        <div className="card-header">
          <div>
            <h2>操作事件历史</h2>
            <p>事件历史用于生产审计、冲突排查和下游自动化 replay。</p>
          </div>
          <div className="header-badges">
            <SyncBadge state={syncState} />
            <button className="tiny-select" onClick={loadEvents} type="button">刷新</button>
          </div>
        </div>
        <div className="audit-list">
          {events.map((event) => (
            <article className="audit-row" key={event.eventId}>
              <div>
                <strong>{event.namespace} · {event.operation}</strong>
                <small>{event.key}</small>
              </div>
              <span>{event.actor}</span>
              <span>v{event.previous?.version || 0} → v{event.next?.version || "∅"}</span>
              <span>{event.timestamp?.replace("T", " ").slice(0, 19)}</span>
              <p>{JSON.stringify(event.meta || {})}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function OpsStatusPage() {
  function readStorage(key, fallback = "") {
    try {
      return window.localStorage.getItem(key) || fallback;
    } catch {
      return fallback;
    }
  }

  const [draftToken, setDraftToken] = useState(() => readStorage("melwater:apiToken"));
  const [savedToken, setSavedToken] = useState(() => readStorage("melwater:apiToken"));
  const [reviewer, setReviewer] = useState(() => readStorage("melwater:reviewer", "分析师"));
  const [authStatus, setAuthStatus] = useState({ state: "loading", label: "正在检查 token" });
  const [opsStatus, setOpsStatus] = useState(null);
  const [opsSyncState, setOpsSyncState] = useState("loading");
  const [opsActionState, setOpsActionState] = useState({ state: "idle", message: "" });
  const [message, setMessage] = useState("");

  const requestJsonWithToken = useCallback(async (path, token, options = {}) => {
    const response = await fetch(reviewStateUrl(path), {
      ...options,
      headers: reviewStateHeaders(options.headers || {}, token),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }, []);

  const testToken = useCallback(
    (token) => {
      const targetToken = String(token || "").trim();
      setAuthStatus({ state: "loading", label: "正在检查 token" });
      return requestJsonWithToken("/health", targetToken)
        .then((payload) => {
          setAuthStatus({
            state: "ok",
            label: payload.authRequired ? `authorized · ${payload.role}` : "auth disabled",
            role: payload.role,
            authRequired: payload.authRequired,
          });
          return payload;
        })
        .catch((error) => {
          setAuthStatus({
            state: "error",
            label: error.status === 401 ? "token missing or invalid" : error.message,
          });
          return null;
        });
    },
    [requestJsonWithToken],
  );

  const loadOps = useCallback(
    (token) => {
      const targetToken = String(token || "").trim();
      setOpsSyncState("loading");
      return requestJsonWithToken("/ops", targetToken)
        .then((payload) => {
          setOpsStatus(payload);
          setOpsSyncState("api");
          return payload;
        })
        .catch(() => {
          setOpsStatus(null);
          setOpsSyncState("local");
          return null;
        });
    },
    [requestJsonWithToken],
  );

  useEffect(() => {
    testToken(savedToken);
    loadOps(savedToken);
  }, [loadOps, savedToken, testToken]);

  function saveToken() {
    const nextToken = draftToken.trim();
    if (!nextToken) {
      setMessage("请先粘贴 viewer/editor/admin token。");
      return;
    }
    try {
      window.localStorage.setItem("melwater:apiToken", nextToken);
      window.localStorage.setItem("melwater:reviewer", reviewer.trim() || "Analyst");
      setSavedToken(nextToken);
      setMessage("Token 已保存到本机浏览器，可用于当前页面 API 调用。");
    } catch {
      setMessage("浏览器 localStorage 不可用，无法保存 token。");
    }
  }

  function clearToken() {
    try {
      window.localStorage.removeItem("melwater:apiToken");
    } catch {
      // Ignore storage failures; the UI state still clears.
    }
    setDraftToken("");
    setSavedToken("");
    setOpsStatus(null);
    setMessage("本机 token 已清除。");
  }

  function saveReviewer() {
    try {
      window.localStorage.setItem("melwater:reviewer", reviewer.trim() || "Analyst");
      setMessage("操作者名称已保存。");
    } catch {
      setMessage("浏览器 localStorage 不可用，无法保存 reviewer。");
    }
  }

  async function runOpsAction(action) {
    const token = String(savedToken || draftToken || "").trim();
    if (!token) {
      setOpsActionState({ state: "error", message: "请先保存 admin token，再执行手动运维动作。" });
      return;
    }
    const actionLabel = action === "backup" ? "API 备份" : "运维报告";
    const path = action === "backup" ? "/ops/backup" : "/ops/report";
    const body = action === "backup"
      ? { label: `ops-ui-${new Date().toISOString().replace(/[:.]/g, "-")}` }
      : {};
    setOpsActionState({ state: "loading", message: `${actionLabel} 执行中...` });
    try {
      const payload = await requestJsonWithToken(path, token, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Melwater-User": reviewer.trim() || "Analyst" },
        body: JSON.stringify(body),
      });
      await loadOps(token);
      setSavedToken(token);
      setOpsActionState({
        state: "ok",
        message: action === "backup"
          ? `API 备份完成：${payload.backup?.label || body.label}`
          : `运维报告已生成：${payload.reportFiles?.markdown || "latest markdown"}`,
      });
    } catch (error) {
      setOpsActionState({
        state: "error",
        message: error.status === 403 ? `${actionLabel} 需要 admin token。` : `${actionLabel} 失败：${error.message}`,
      });
    }
  }

  async function downloadLatestReport() {
    const token = String(savedToken || draftToken || "").trim();
    if (!token) {
      setOpsActionState({ state: "error", message: "请先保存 token，再下载 latest report。" });
      return;
    }
    setOpsActionState({ state: "loading", message: "正在下载 latest Markdown report..." });
    try {
      const response = await fetch(reviewStateUrl("/ops/report/latest.md"), {
        headers: reviewStateHeaders({}, token),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      const blobUrl = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = opsReport?.markdownFile || "melwater-ops-report-latest.md";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(blobUrl);
      setOpsActionState({ state: "ok", message: "Latest Markdown report 已下载。" });
    } catch (error) {
      setOpsActionState({ state: "error", message: `下载失败：${error.message}` });
    }
  }

  const health = opsStatus?.healthcheck;
  const backup = opsStatus?.backup?.latest;
  const reviewState = opsStatus?.reviewState;
  const incident = opsStatus?.incident;
  const opsReport = opsStatus?.opsReport;
  const certificate = opsStatus?.certificate || opsReport?.certificate;
  const alertLog = opsStatus?.alertLog?.latest || [];
  const authTone = authStatus.state === "ok" ? "green" : authStatus.state === "loading" ? "amber" : "rose";
  const incidentTone = incident?.status === "open" ? "rose" : incident?.status === "resolved" ? "green" : "muted";
  const incidentLabel = incident?.status || "none";

  return (
    <div className="lab-stack">
      <div className="summary-grid compact">
        <MetricCard label="访问令牌" value={authStatus.state === "ok" ? authStatus.role || "ok" : "待检查"} caption={authStatus.label} tone={authStatus.state === "ok" ? "green" : "amber"} />
        <MetricCard label="发布版本" value={shortHash(opsStatus?.release?.ref)} caption="MELWATER_RELEASE_REF" tone="rose" />
        <MetricCard label="健康检查" value={health?.ok ? "通过" : "待检查"} caption={formatDateTime(health?.checkedAt)} tone={health?.ok ? "green" : "yellow"} />
        <MetricCard label="事故状态" value={incidentLabel} caption={formatDateTime(incident?.openedAt || incident?.resolvedAt)} tone={incidentTone} />
      </div>

      <div className="ops-layout">
        <section className="card ops-card">
          <div className="card-header">
            <div>
              <h2>访问令牌</h2>
              <p>真实飞书/企微还未接入前，先用本机 Token 管理完成生产访问闭环。</p>
            </div>
            <span className={`status-badge ${authTone}`}>{authStatus.label}</span>
          </div>
          <form
            className="token-form"
            onSubmit={(event) => {
              event.preventDefault();
              saveToken();
            }}
          >
            <label>
              <span>API token</span>
              <input
                autoComplete="off"
                onChange={(event) => setDraftToken(event.target.value)}
                placeholder="粘贴 viewer/editor/admin token"
                type="password"
                value={draftToken}
              />
            </label>
            <label>
              <span>操作者</span>
              <input
                autoComplete="off"
                onChange={(event) => setReviewer(event.target.value)}
                placeholder="分析师"
                type="text"
                value={reviewer}
              />
            </label>
            <div className="ops-actions">
              <button className="primary-action compact" type="submit">
                <IconCheck size={16} />
                保存 token
              </button>
              <button className="tiny-select" onClick={() => testToken(draftToken)} type="button">
                <IconShieldCheck size={15} />
                测试 token
              </button>
              <button className="tiny-select" onClick={saveReviewer} type="button">保存操作者</button>
              <button className="tiny-select" onClick={clearToken} type="button">清除</button>
            </div>
            {message && <p className="ops-note">{message}</p>}
          </form>
        </section>

        <section className="card ops-card">
          <div className="card-header">
            <div>
              <h2>生产健康</h2>
              <p>来自服务器 cron healthcheck 的最后一次结果。</p>
            </div>
            <div className="header-badges">
              <SyncBadge state={opsSyncState} />
              <button className="tiny-select" onClick={() => loadOps(savedToken)} type="button">
                <IconRefresh size={14} />
                刷新
              </button>
            </div>
          </div>
          <div className={`ops-health-banner ${health?.ok ? "pass" : "blocked"}`}>
            {health?.ok ? <IconCircleCheck size={18} /> : <IconBell size={18} />}
            <div>
              <strong>{health?.ok ? "生产健康检查通过" : "未拿到健康检查结果"}</strong>
              <p>{health?.error || `${health?.publicUrl || "public site"} · HTTP ${health?.homepageStatus || "unknown"}`}</p>
            </div>
          </div>
          {incident && (
            <div className={`ops-health-banner ${incident.status === "open" ? "blocked" : "pass"}`}>
              {incident.status === "open" ? <IconBell size={18} /> : <IconCircleCheck size={18} />}
              <div>
                <strong>事故：{incident.status}</strong>
                <p>
                  {incident.status === "open"
                    ? `${incident.failureCount || 0}/${incident.threshold || 0} consecutive failures · ${incident.error || "unknown error"}`
                    : `resolved at ${formatDateTime(incident.resolvedAt)} after ${incident.failureCount || 0} failure(s)`}
                </p>
              </div>
            </div>
          )}
          <div className="ops-kv-grid">
            <span>
              <small>checkedAt</small>
              <strong>{formatDateTime(health?.checkedAt)}</strong>
            </span>
            <span>
              <small>releaseRef</small>
              <strong>{shortHash(health?.releaseRef || opsStatus?.release?.ref)}</strong>
            </span>
            <span>
              <small>apiBase</small>
              <strong>{health?.apiBase || "unknown"}</strong>
            </span>
            <span>
              <small>auth</small>
              <strong>{opsStatus?.auth?.authRequired ? `required · ${opsStatus.auth.role}` : "disabled"}</strong>
            </span>
            <span>
              <small>cert expires</small>
              <strong>{certificate?.daysRemaining !== null && certificate?.daysRemaining !== undefined ? `${certificate.daysRemaining} days` : "unknown"}</strong>
            </span>
            <span>
              <small>cert notAfter</small>
              <strong>{certificate?.notAfter || "unknown"}</strong>
            </span>
          </div>
        </section>
      </div>

      <div className="ops-layout">
        <section className="card ops-card">
          <div className="card-header">
            <div>
              <h2>写回状态运行时</h2>
              <p>写回状态、事件 replay 和 namespace 数量。</p>
            </div>
            <span className={`status-badge ${reviewState?.replayOk ? "green" : "rose"}`}>
              replay {reviewState?.replayOk ? "ok" : "unknown"}
            </span>
          </div>
          <div className="ops-kv-grid">
            <span>
              <small>schemaVersion</small>
              <strong>{reviewState?.schemaVersion || "unknown"}</strong>
            </span>
            <span>
              <small>totalEntries</small>
              <strong>{reviewState?.totalEntries ?? "unknown"}</strong>
            </span>
            <span>
              <small>eventCount</small>
              <strong>{reviewState?.eventCount ?? "unknown"}</strong>
            </span>
            <span>
              <small>lastEvent</small>
              <strong>{formatDateTime(reviewState?.lastEventAt)}</strong>
            </span>
          </div>
          <div className="namespace-list">
            {Object.entries(reviewState?.entriesByNamespace || {}).map(([namespace, count]) => (
              <div className="namespace-row" key={namespace}>
                <span>{namespace}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="card ops-card">
          <div className="card-header">
            <div>
              <h2>Backup Evidence</h2>
              <p>最近一次 review-state 备份清单、手动动作和日报下载。</p>
            </div>
            <div className="header-badges">
              <button className="tiny-select" disabled={opsActionState.state === "loading"} onClick={() => runOpsAction("backup")} type="button">
                <IconDatabase size={14} />
                触发备份
              </button>
              <button className="tiny-select" disabled={opsActionState.state === "loading"} onClick={() => runOpsAction("report")} type="button">
                <IconRefresh size={14} />
                生成 report
              </button>
              <button className="tiny-select" disabled={opsActionState.state === "loading"} onClick={downloadLatestReport} type="button">
                <IconDownload size={14} />
                下载 report
              </button>
            </div>
          </div>
          {opsActionState.message && <p className={`ops-action-note ${opsActionState.state}`}>{opsActionState.message}</p>}
          {backup ? (
            <div className="backup-card">
              <strong>{backup.backupFile}</strong>
              <p>{formatDateTime(backup.createdAt)} · {backup.label || "manual"} · {formatBytes(backup.bytes)}</p>
              <code>{backup.sha256 || "sha256 unavailable"}</code>
            </div>
          ) : (
            <div className="ops-health-banner blocked">
              <IconBell size={18} />
              <div>
                <strong>还没有可读备份清单</strong>
                <p>等待服务器 daily backup 或手动执行 melwater-backup.sh 后刷新。</p>
              </div>
            </div>
          )}
          {opsReport && (
            <div className="backup-card">
              <strong>运维报告 · {opsReport.healthOk}</strong>
              <p>{formatDateTime(opsReport.generatedAt)} · 事故 {opsReport.incidentStatus || "none"} · {opsReport.latestBackupFile || "no backup"}</p>
              <code>{opsReport.markdownFile || "markdown unavailable"}</code>
            </div>
          )}
          {alertLog.length > 0 && (
            <div className="alert-log-list">
              {alertLog.slice(-4).map((entry, index) => (
                <div className="alert-log-row" key={`${entry.timestamp || index}-${entry.message || index}`}>
                  <span className={`status-badge ${entry.ok ? "green" : "rose"}`}>{entry.ok ? "recovered" : "failure"}</span>
                  <p>{entry.message || "health event"}</p>
                  <small>{formatDateTime(entry.timestamp)} · count {entry.failureCount ?? 0}</small>
                </div>
              ))}
            </div>
          )}
          <div className="ops-runbook">
            <span>
              <strong>当前降级闭环</strong>
              <small>页面 token + cron healthcheck + incident JSON + ops report，可覆盖外部 webhook 空窗期。</small>
            </span>
            <span>
              <strong>下一步接入</strong>
              <small>飞书/企微 webhook 申请后，仅需配置 MELWATER_ALERT_WEBHOOK_URL。</small>
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}

function WeeklyActionReview({
  review,
  reviewActions,
  onStatusChange,
  writeMeta,
  onSaveSnapshot,
  latestSnapshot,
  syncState,
}) {
  const queuePreview = review.queue.slice(0, 10);
  const laneCounts = ["Confirm owner", "Approve data fix", "Commit this cycle", "Request evidence", "Track next"].map((lane) => ({
    lane,
    count: review.queue.filter((action) => action.decisionLane === lane).length,
  }));
  const [snapshotTitle, setSnapshotTitle] = useState("");
  const [snapshotNote, setSnapshotNote] = useState("");

  const proposedTitle = snapshotTitle.trim() || `Melwater 每周行动复盘 ${formatSnapshotDate()}`;
  const latestAt = latestSnapshot?.capturedAt || "";
  const latestLabel = latestAt ? `上次归档: ${new Date(latestAt).toLocaleString("zh-CN", { hour12: false })}` : "暂无周会归档";

  const handleSave = () => {
    const payload = buildMeetingSnapshotPayload(review, reviewActions, {
      title: snapshotTitle.trim(),
      note: snapshotNote.trim(),
    });
    onSaveSnapshot(payload);
  };

  const handleExport = () => {
    const payload = buildMeetingSnapshotPayload(review, reviewActions, {
      title: snapshotTitle.trim(),
      note: snapshotNote.trim(),
    });
    downloadMeetingSnapshot(payload);
  };

  return (
    <section className="card weekly-review-card">
      <div className="card-header">
        <div>
          <h2>每周行动复盘</h2>
          <p>按优先级、负责人、到期窗口和证据强度生成本周周会决策队列。</p>
        </div>
        <div className="header-badges">
          <span className="status-badge rose">{review.queue.length} 条待处理</span>
          <span className="status-badge amber">{review.dueWithin14} 条 14 天内到期</span>
          <span className={`status-badge ${syncState === "api" ? "green" : "muted"}`}>{syncState === "api" ? "快照已写回" : "快照本地暂存"}</span>
        </div>
      </div>
      <div className="meeting-snapshot-controls">
        <label>
          会议信息
          <input
            value={snapshotTitle}
            onChange={(event) => setSnapshotTitle(event.target.value)}
            placeholder={`Melwater 每周行动复盘 ${formatSnapshotDate()}`}
          />
        </label>
        <label>
          本周决策记录
          <textarea
            value={snapshotNote}
            onChange={(event) => setSnapshotNote(event.target.value)}
            rows={3}
            placeholder="记录每条行动的本周决策、负责人确认、证据补齐要求和跟进原因。"
          />
        </label>
        <div className="snapshot-toolbar">
          <button onClick={handleSave} type="button">
            <IconClipboardCheck size={15} />
            保存归档快照
          </button>
          <button onClick={handleExport} type="button">
            <IconDownload size={15} />
            导出快照 JSON
          </button>
        </div>
        <div className="snapshot-meta">
          <strong>{proposedTitle}</strong>
          <span>{latestLabel}</span>
        </div>
        {latestSnapshot && (
          <div className="snapshot-latest">
            <small>最新快照：队列 {latestSnapshot.summary?.queueSize || 0}，负责人负载 {latestSnapshot.ownerSummary?.length || 0}</small>
            <small>{latestSnapshot.summary?.meetingNote || latestSnapshot.decision?.meetingNote || "—"}</small>
          </div>
        )}
      </div>

      <div className="weekly-review-grid">
        <div className="weekly-agenda">
          <div className="meeting-lane-grid">
            {laneCounts.map((item) => (
              <span key={item.lane}>
                <strong>{item.count}</strong>
                <small>{decisionLaneLabel(item.lane)}</small>
              </span>
            ))}
          </div>

          <div className="weekly-queue-list">
            {queuePreview.map((action, index) => (
              <article className="weekly-queue-row" key={action.action_id}>
                <div className="queue-rank">{index + 1}</div>
                <div className="queue-main">
                  <div className="action-title-row">
                    <span className={`status-badge ${action.priority === "P0" ? "rose" : action.priority === "P1" ? "amber" : "muted"}`}>{action.priority}</span>
                    <strong>{decisionLaneLabel(action.decisionLane)}</strong>
                    <small>{action.owner_domain || "unassigned"} · {action.category} · {action.displayTopic}</small>
                  </div>
                  <p>{action.businessImpact}</p>
                  <div className="queue-signal-row">
                    <span className={`status-badge ${action.due.tone}`}>{action.due.label}</span>
                    <span className={`status-badge ${action.evidenceStrength.tone}`}>{action.evidenceStrength.label}</span>
                    <small>{action.evidenceStrength.caption}</small>
                  </div>
                </div>
                <div className="queue-actions">
                  {["Accepted", "In Progress", "Measured"].map((status) => (
                    <button
                      className={action.status === status ? "mini-state active" : "mini-state"}
                      key={status}
                      onClick={() => onStatusChange(action.action_id, status, writeMeta(action))}
                      type="button"
                    >
                      {actionStatusLabel(status)}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="weekly-owner-panel">
          <div>
            <h3>负责人负载</h3>
            <p>先解决 owner 未落位，再承诺交付节奏。</p>
          </div>
          <div className="owner-load-list">
            {review.ownerSummary.slice(0, 7).map((owner) => (
              <article key={owner.owner}>
                <div>
                  <strong>{owner.owner}</strong>
                  <small>{owner.total} 条动作 · {owner.needsOwner} 条待定负责人</small>
                </div>
                <span>{owner.p0p1} P0/P1</span>
              </article>
            ))}
          </div>
          <div className="weekly-decision-note">
            <strong>会议规则</strong>
            <p>P0/P1 必须在会中明确 owner、状态和验收指标；证据不足的 action 不能直接承诺上线，只能进入 evidence request。</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function ActionLoopPage() {
  const { values: statusDraft, writeValue: writeActionStatus, syncState: statusSync } = useWritebackState("actionStatus");
  const { values: ownerDraft, writeValue: writeActionOwner, syncState: ownerSync } = useWritebackState("actionOwner");
  const { values: priorityDraft, writeValue: writeActionPriority, syncState: prioritySync } = useWritebackState("actionPriority");
  const { values: impactDraft, writeValue: writeActionImpact, syncState: impactSync } = useWritebackState("actionImpact");
  const { values: meetingSnapshotDraft, writeValue: writeMeetingSnapshot, syncState: meetingSnapshotSync } = useWritebackState("meetingSnapshot");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [evidenceFilter, setEvidenceFilter] = useState("all");
  const [query, setQuery] = useState("");
  const syncState = combinedSyncState([statusSync, ownerSync, prioritySync, impactSync]);
  const actions = useMemo(
    () => vocData.actions.map((action) => enrichAction(action, {
      impact: impactDraft,
      owner: ownerDraft,
      priority: priorityDraft,
      status: statusDraft,
    })),
    [impactDraft, ownerDraft, priorityDraft, statusDraft],
  );
  const ownerOptions = useMemo(() => ["all", ...new Set(actions.map((action) => action.owner_domain || "unassigned"))], [actions]);
  const filteredActions = actions.filter((action) => {
    const text = `${action.action_type} ${action.source_action} ${action.category} ${action.topicId} ${action.ownerName} ${action.businessImpact}`.toLowerCase();
    if (ownerFilter !== "all" && (action.owner_domain || "unassigned") !== ownerFilter) return false;
    if (statusFilter !== "all" && action.status !== statusFilter) return false;
    if (priorityFilter !== "all" && action.priority !== priorityFilter) return false;
    if (evidenceFilter === "linked" && action.evidenceCount === 0 && action.quotes.length === 0) return false;
    if (query.trim() && !text.includes(query.trim().toLowerCase())) return false;
    return true;
  });
  const highPriorityCount = actions.filter((action) => ["P0", "P1"].includes(action.priority)).length;
  const unassignedCount = actions.filter((action) => !ownerDraft[action.action_id] && !action.owner_name).length;
  const evidenceLinkedCount = actions.filter((action) => action.evidenceCount > 0 || action.quotes.length > 0).length;
  const weeklyReview = useMemo(() => buildWeeklyActionReview(actions), [actions]);
  const writeMeta = (action) => ({
    actionType: action.action_type,
    category: action.category,
    topicId: action.topicId,
    ownerDomain: action.owner_domain || "unassigned",
    sourceAction: action.source_action,
  });
  const latestSnapshot = useMemo(() => {
    const candidates = Object.entries(meetingSnapshotDraft)
      .map(([snapshotKey, snapshot]) => ({ snapshotKey, ...snapshot }))
      .filter((snapshot) => snapshot.summary && snapshot.snapshotDate)
      .sort((a, b) => new Date(b.capturedAt || b.snapshotDate).getTime() - new Date(a.capturedAt || a.snapshotDate).getTime());
    return candidates[0] || null;
  }, [meetingSnapshotDraft]);
  const saveSnapshot = useCallback(
    (snapshot) => {
      writeMeetingSnapshot(snapshot.snapshotKey || `weekly-${formatSnapshotDate()}`, {
        ...snapshot,
        updatedBy: getReviewer(),
      }, {
        source: "weekly_action_review",
      });
    },
    [writeMeetingSnapshot],
  );

  return (
    <div className="lab-stack">
      <div className="summary-grid compact">
        <MetricCard label="动作总数" value={vocData.actions.length} caption="行动登记表" tone="rose" />
        <MetricCard label="高优先级" value={highPriorityCount} caption="优先进入周会跟进" tone="amber" />
        <MetricCard label="待定负责人" value={unassignedCount} caption="负责人待落位" tone="yellow" />
        <MetricCard label="已关联证据" value={evidenceLinkedCount} caption="可追溯原话 / 样本" tone="green" />
      </div>
      <WeeklyActionReview
        review={weeklyReview}
        reviewActions={actions}
        onStatusChange={writeActionStatus}
        writeMeta={writeMeta}
        onSaveSnapshot={saveSnapshot}
        latestSnapshot={latestSnapshot}
        syncState={meetingSnapshotSync}
      />
      <section className="card data-table-card">
        <div className="card-header">
          <div>
            <h2>行动登记表</h2>
            <p>把业务问题反推到负责人、优先级、业务影响、证据链和复盘口径。</p>
          </div>
          <SyncBadge state={syncState} />
        </div>
        <div className="action-toolbar">
          <label>
            负责人域
            <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
              {ownerOptions.map((owner) => (
                <option key={owner} value={owner}>{owner === "all" ? "全部负责人" : owner}</option>
              ))}
            </select>
          </label>
          <label>
            状态
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">全部状态</option>
              {actionStatuses.map((status) => <option key={status} value={status}>{actionStatusLabel(status)}</option>)}
            </select>
          </label>
          <label>
            优先级
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
              <option value="all">全部优先级</option>
              {actionPriorities.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </label>
          <label>
            证据
            <select value={evidenceFilter} onChange={(event) => setEvidenceFilter(event.target.value)}>
              <option value="all">全部动作</option>
              <option value="linked">已关联证据</option>
            </select>
          </label>
          <label className="action-search">
            搜索
            <input placeholder="主题 / 品类 / 影响" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <button className="filter-toggle action-export-button" onClick={() => downloadActionCsv(filteredActions)} type="button">
            <IconDownload size={15} />
            导出 {filteredActions.length} 条
          </button>
        </div>
        <div className="action-table action-board">
          {filteredActions.slice(0, 24).map((action) => (
            <article className="action-row action-card" key={action.action_id}>
              <div className="action-card-main">
                <div className="action-title-row">
                  <span className={`status-badge ${action.priority === "P0" ? "rose" : action.priority === "P1" ? "amber" : "muted"}`}>{action.priority}</span>
                  <strong>{actionTypeLabel(action.action_type)}</strong>
                  <small>{action.category} · {action.displayTopic}</small>
                </div>
                <p>{action.source_action}</p>
                <div className="action-meta-grid">
                  <span><b>预期指标</b>{action.expected_metric || "待补齐"}</span>
                  <span><b>截止日</b>{action.due_date || "待定"}</span>
                  <span><b>复盘日</b>{action.review_date || "待定"}</span>
                </div>
                <div className="action-impact-note">{action.businessImpact}</div>
                <div className="action-proof-list">
                  {action.evidence.slice(0, 1).map((item) => (
                    <a href={item.url} key={item.occurrenceId || item.url} rel="noreferrer" target="_blank">
                      <IconExternalLink size={13} />
                      {item.evidence}
                    </a>
                  ))}
                  {action.quotes.slice(0, 1).map((quote) => (
                    <a href={quote.url} key={quote.quoteId} rel="noreferrer" target="_blank">
                      <IconMessageCircle size={13} />
                      {quote.quoteText}
                    </a>
                  ))}
                  {action.evidenceCount === 0 && action.quotes.length === 0 && (
                    <span className="action-proof-empty">等待 query 治理后补齐 evidence / quote 链接</span>
                  )}
                </div>
              </div>
              <div className="action-control-grid">
                <label>
                  状态
                  <select
                    value={action.status}
                    onChange={(event) => writeActionStatus(action.action_id, event.target.value, writeMeta(action))}
                  >
                    {actionStatuses.map((status) => (
                      <option key={status} value={status}>{actionStatusLabel(status)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  负责人
                  <input
                    defaultValue={action.ownerName}
                    key={`${action.action_id}-${action.ownerName}`}
                    onBlur={(event) => writeActionOwner(action.action_id, event.currentTarget.value.trim() || actionOwnerHint(action), writeMeta(action))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                  />
                </label>
                <label>
                  优先级
                  <select
                    value={action.priority}
                    onChange={(event) => writeActionPriority(action.action_id, event.target.value, writeMeta(action))}
                  >
                    {actionPriorities.map((priority) => (
                      <option key={priority}>{priority}</option>
                    ))}
                  </select>
                </label>
                <label>
                  业务影响
                  <input
                    defaultValue={action.businessImpact}
                    key={`${action.action_id}-${action.businessImpact}`}
                    onBlur={(event) => writeActionImpact(action.action_id, event.currentTarget.value.trim() || derivedBusinessImpact(action, action.painCard), writeMeta(action))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                  />
                </label>
              </div>
            </article>
          ))}
        </div>
        {filteredActions.length > 24 && <div className="action-more-note">已显示前 24 条；可继续筛选或导出全部 {filteredActions.length} 条。</div>}
      </section>
    </div>
  );
}

function DataQualityPage() {
  const checks = [
    ["document_id vs occurrence_id", "唯一内容分析用 document_id，触点/搜索命中分析用 occurrence_id。"],
    ["sentiment", "自动情感只能做筛选和趋势，不能直接当投诉率。"],
    ["country zz", "zz 是未知/不可归属，不能做地域市场结论。"],
    ["query blocked", "暖奶器和消毒器必须先做 query 治理。"],
    ["raw quote", "用户原话只是候选素材，外发前必须人工复核。"],
  ];
  return (
    <div className="lab-stack">
      <div className="summary-grid compact">
        <MetricCard label="Source count" value={vocData.manifest.source_count} caption="source_inventory" tone="rose" />
        <MetricCard label="Documents" value={vocData.manifest.document_count.toLocaleString()} caption="raw occurrences" tone="amber" />
        <MetricCard label="Known gaps" value="0" caption="manifest pass" tone="green" />
        <MetricCard label="Taxonomy" value="v1" caption="topics / brands / noise" tone="muted" />
      </div>
      <section className="card guardrail-card">
        <div className="card-header">
          <div>
            <h2>业务解释护栏</h2>
            <p>这些规则应在所有 Melwater VOC 页面持续可见。</p>
          </div>
        </div>
        {checks.map(([title, body]) => (
          <div className="guardrail-row" key={title}>
            <IconShieldCheck size={17} />
            <div>
              <strong>{title}</strong>
              <p>{body}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function AppBody({ activeView, category, setCategory, actionCreated, setActionCreated, setActiveView }) {
  if (activeView === "search") return <SearchQualityPage />;
  if (activeView === "pain") return <PainRadarPage category={category} setCategory={setCategory} actionCreated={actionCreated} setActionCreated={setActionCreated} />;
  if (activeView === "actions") return <ActionLoopPage />;
  if (activeView === "quality") return <DataQualityPage />;
  if (activeView === "competitor") return <CompetitorPage />;
  if (activeView === "content") return <ContentOpportunityPage setActiveView={setActiveView} />;
  if (activeView === "quotes") return <QuoteLibraryPage />;
  if (activeView === "concept") return <ConceptCandidatePage />;
  if (activeView === "crisis") return <CrisisWatchPage />;
  if (activeView === "regions") return <RegionLanguagePage />;
  if (activeView === "brief") return <ExecutiveMonthlyPage />;
  if (activeView === "audit") return <AuditLogPage />;
  if (activeView === "ops") return <OpsStatusPage />;
  return <HomePage setActiveView={setActiveView} />;
}

export function App() {
  const [activeView, setActiveView] = useState("home");
  const [category, setCategory] = useState("吸奶器");
  const [actionCreated, setActionCreated] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      <main className="workspace">
        <Header activeView={activeView} actionCreated={actionCreated} />
        <BusinessLoopStrip activeView={activeView} />
        <BusinessClosurePanel activeView={activeView} />
        <AppBody
          activeView={activeView}
          category={category}
          setCategory={setCategory}
          actionCreated={actionCreated}
          setActionCreated={setActionCreated}
          setActiveView={setActiveView}
        />
      </main>
    </div>
  );
}

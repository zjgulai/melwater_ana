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
    title: "Melwater VOC 工作台",
    subtitle: "从业务问题进入，先看质量门禁，再进入证据、行动和复盘。",
  },
  search: {
    eyebrow: "P0 · Search Quality",
    title: "Search Quality Lab",
    subtitle: "判断 query 是否能进入业务解释；blocked 的品类只能做治理动作。",
  },
  pain: {
    eyebrow: "P0 · Product Pain Radar",
    title: "Product Pain Radar",
    subtitle: "基于真实 mart_product_pain_radar，识别高优先级产品痛点与证据样本。",
  },
  actions: {
    eyebrow: "P0 · Action Closed Loop",
    title: "Action Closed Loop",
    subtitle: "把 insight 转成 owner、状态、复盘指标和关闭原因。",
  },
  quality: {
    eyebrow: "P0 · Data Quality",
    title: "Data Quality Overview",
    subtitle: "解释当前数据包口径、质量风险和不能误读的指标边界。",
  },
  competitor: {
    eyebrow: "P1 · Competitor Intelligence",
    title: "Competitor Battlecards",
    subtitle: "把品牌声量、负向率和 readiness 转成可复核的竞品对比素材。",
  },
  content: {
    eyebrow: "P1 · Content Opportunity",
    title: "Content Opportunity Lab",
    subtitle: "从正向证据、渠道和主题反推内容 brief，但 blocked 品类先治理搜索。",
  },
  quotes: {
    eyebrow: "P1 · Quote Library",
    title: "User Voice Quote Library",
    subtitle: "沉淀可复核用户原话，支持内容 brief、产品论证和证据回溯。",
  },
  concept: {
    eyebrow: "P2 · Concept Validation",
    title: "Concept Candidate Lab",
    subtitle: "从痛点和证据反推产品概念候选，进入小样本验证和 owner 分派。",
  },
  crisis: {
    eyebrow: "P2 · Crisis Watch",
    title: "Crisis Response Watchtower",
    subtitle: "把每日负面集中度、周度变化点和数据质量阻断转成 PR/CX triage。",
  },
  regions: {
    eyebrow: "P2 · Region & Language",
    title: "Region Language Priority",
    subtitle: "区分 country_known 与 zz 未知国家，避免把语言线索误读成地域市场结论。",
  },
  brief: {
    eyebrow: "P2 · Executive Brief",
    title: "Executive Monthly Brief",
    subtitle: "为月会压缩数据质量、可行动洞察和待关闭 action 的决策入口。",
  },
  audit: {
    eyebrow: "P4 · Review Ops",
    title: "Review Audit Log",
    subtitle: "查看状态写回、操作者、版本号和事件历史，支持后续生产审计。",
  },
  ops: {
    eyebrow: "P4 · Production Ops",
    title: "Ops Status & Access",
    subtitle: "配置本机 API token，检查生产健康、发布版本、备份和 review-state replay。",
  },
};

const navSections = [
  {
    label: "Melwater VOC",
    items: [
      { id: "home", label: "VOC 总览", icon: IconHome },
      { id: "search", label: "搜索质量", icon: IconSearch },
      { id: "pain", label: "痛点雷达", icon: IconChartRadar },
      { id: "actions", label: "动作闭环", icon: IconClipboardCheck },
      { id: "quality", label: "数据质量", icon: IconShieldCheck },
    ],
  },
  {
    label: "下一批页面",
    items: [
      { id: "competitor", label: "竞品洞察", icon: IconTargetArrow },
      { id: "content", label: "内容机会", icon: IconListDetails },
      { id: "quotes", label: "Quote Library", icon: IconMessageCircle },
      { id: "concept", label: "概念候选", icon: IconFlask },
      { id: "crisis", label: "危机预警", icon: IconBell },
      { id: "regions", label: "地域语言", icon: IconUsers },
      { id: "brief", label: "管理层月报", icon: IconBookmark },
      { id: "audit", label: "审计日志", icon: IconDatabase },
    ],
  },
  {
    label: "系统设置",
    items: [
      { id: "ops", label: "Ops 状态", icon: IconShieldCheck },
    ],
  },
];

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
  return String(value || "").replaceAll("_", " ");
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
  return action.owner_name || actionOwnerHints[action.owner_domain] || action.owner_domain || "Unassigned owner";
}

function enrichAction(action, drafts = {}) {
  const card = actionPainCard(action);
  const evidence = card?.evidenceDetails?.slice(0, 2) || [];
  const quotes = actionQuoteLinks(action, 2);
  return {
    ...action,
    category: actionCategory(action),
    topicId: actionTopicId(action),
    displayTopic: card ? displayTopic(card) : "Search quality",
    ownerName: drafts.owner[action.action_id] || actionOwnerHint(action),
    priority: drafts.priority[action.action_id] || derivedPriority(action, card),
    status: drafts.status[action.action_id] || action.status,
    businessImpact: drafts.impact[action.action_id] || derivedBusinessImpact(action, card),
    evidence,
    evidenceCount: card?.evidenceCount || evidence.length,
    painCard: card,
    quotes,
  };
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
    <div className="app-logo" aria-label="Melwater Analyst Lab">
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
          <strong>Melwater Analyst Lab</strong>
          <span>VOC closed-loop analytics</span>
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
          <span>系统设置</span>
          <IconChevronDown size={14} />
        </button>
        <div className="user-chip">
          <span className="avatar">A</span>
          <div>
            <strong>Analyst</strong>
            <span>Online</span>
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
        <button className="icon-button" aria-label="Refresh" type="button">
          <IconRefresh size={17} />
        </button>
        <button className="icon-button" aria-label="Export" type="button">
          <IconDownload size={17} />
        </button>
        <button className="icon-button has-dot" aria-label="Notifications" type="button">
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
      <SelectPill icon={IconTargetArrow} label="指标" value="Priority / Quality" />
      <SelectPill icon={IconShieldCheck} label="数据包" value="20260611 marts" />
      <SelectPill icon={IconCalendar} label="时间范围" value="近 12 周" />
      <SelectPill icon={IconAdjustmentsHorizontal} label="排序" value="Readiness first" />
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
  const label = state === "api" ? "api writeback" : state === "local" ? "local fallback" : state === "conflict" ? "conflict refreshed" : "loading state";
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
          <strong>Quality gate pass</strong>
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
    ["搜索是否可信？", "先治理暖奶器/消毒器 query noise", "search", "blocked"],
    ["吸奶器痛点集中在哪？", "续航、噪音、舒适度进入 ready 状态", "pain", "ready"],
    ["哪些 action 没有 owner？", "57 条 action 仍为 Proposed", "actions", "review"],
    ["当前数据能否下结论？", "document/occurrence/sentiment/zz 需要分开解释", "quality", "guardrail"],
    ["竞品对比怎么讲？", "18 张 battlecard，6 张可进入复核", "competitor", "ready"],
    ["内容机会在哪里？", "30 条机会，10 条可形成 content brief", "content", "ready"],
    ["哪些原话能引用？", "120 条 quote 候选，需要逐条复核", "quotes", "review"],
    ["哪些概念值得验证？", "21 个概念候选，7 个可进入复核", "concept", "ready"],
    ["今天有危机信号吗？", "30 条 daily alert 需要 PR/CX triage", "crisis", "blocked"],
    ["地域结论可靠吗？", "区分 19 条已知国家与 zz 未知国家", "regions", "guardrail"],
    ["月会先看什么？", "按月份压缩 blocked search 与 ready action", "brief", "review"],
    ["写回是否可审计？", "查看 actor、版本号、事件历史与 CSV 导出", "audit", "ready"],
    ["生产是否健康？", "检查 Token、健康检查、备份和发布版本", "ops", "ready"],
  ];

  return (
    <div className="home-stack">
      <div className="summary-grid">
        <MetricCard label="唯一洞察" value={counts.fact_insight} caption="fact_insight" tone="rose" />
        <MetricCard label="证据样本" value={counts.fact_evidence_sample} caption="fact_evidence_sample" tone="amber" />
        <MetricCard label="待闭环动作" value={vocData.summaries.proposedActions} caption="all status = Proposed" tone="yellow" />
        <MetricCard label="阻断搜索" value={vocData.summaries.blockedSearches} caption="query quality gate" tone="muted" />
      </div>

      <section className="card command-card">
        <div>
          <h2>从业务问题进入</h2>
          <p>P2 已把概念验证、危机 triage、地域语言优先级和管理层月报接入同一套证据闭环。</p>
        </div>
        <MartFreshness />
      </section>

      <div className="question-grid">
        {topQuestions.map(([title, body, route, status]) => (
          <button className="question-card card" key={title} onClick={() => setActiveView(route)} type="button">
            <span className={`status-badge ${status === "ready" ? "green" : status === "blocked" ? "rose" : "amber"}`}>{status}</span>
            <h2>{title}</h2>
            <p>{body}</p>
            <small>打开页面 <IconExternalLink size={13} /></small>
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
        <MetricCard label="Pass searches" value={pass.length} caption="可进入业务解释" tone="green" />
        <MetricCard label="Blocked searches" value={blocked.length} caption="只能治理 query" tone="rose" />
        <MetricCard label="Review samples" value={vocData.querySamples.length} caption="前端快照样本" tone="amber" />
        <MetricCard label="Worst precision" value={pct(Math.min(...vocData.searchQuality.map((item) => item.precision)), 1)} caption="Bottle Warmer" tone="muted" />
      </div>

      <section className="card data-table-card">
        <div className="card-header">
          <div>
            <h2>Query Quality Gate</h2>
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
              <span className={`readiness ${item.status}`}>{item.status}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card data-table-card">
        <div className="card-header">
          <div>
            <h2>Noise Sample Review Queue</h2>
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
          <h2>痛点明细（Issue List）</h2>
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
          <span>Priority</span>
          <span>Lift</span>
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
        <MetricCard label="Battlecards" value={cards.length} caption="brand x category" tone="rose" />
        <MetricCard label="Ready cards" value={vocData.summaries.readyCompetitors} caption="可进入复核" tone="green" />
        <MetricCard label="Competitor brands" value={competitors.length} caption="非 owned rows" tone="amber" />
        <MetricCard label="Categories" value={categories.size} caption="当前数据覆盖" tone="muted" />
      </div>

      <div className="battlecard-layout">
        <section className="card battlecard-board">
          <div className="card-header">
            <div>
              <h2>Brand Battlecard Queue</h2>
              <p>优先看 ready_for_review；blocked 品类只用于搜索治理，不做竞品结论。</p>
            </div>
            <span className="status-badge rose">VOC mentions</span>
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
        <MetricCard label="Opportunities" value={vocData.contentOpportunities.length} caption="content briefs candidates" tone="rose" />
        <MetricCard label="Ready briefs" value={vocData.summaries.readyContentBriefs} caption="ready_for_review" tone="green" />
        <MetricCard label="Quote library" value={vocData.summaries.quotes} caption="可复核原话" tone="amber" />
        <MetricCard label="Source types" value={sourceTypes.length - 1} caption="渠道维度" tone="muted" />
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
              <h2>Content Opportunity Queue</h2>
              <p>按正向证据量排序，优先生成主题 brief 和 quote shortlist。</p>
            </div>
            <button className="tiny-select" onClick={() => setActiveView("quotes")} type="button">
              打开 Quote Library
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
              <strong>Brief recommendation</strong>
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
        <MetricCard label="Quote candidates" value={vocData.quoteLibrary.length} caption="content_brief_quote" tone="rose" />
        <MetricCard label="Filtered" value={quotes.length} caption={sentiment} tone="amber" />
        <MetricCard label="Reviewed now" value={Object.keys(reviewed).length} caption="前端临时状态" tone="green" />
        <MetricCard label="Usage type" value="1" caption="brief quote" tone="muted" />
      </div>

      <section className="card tab-card">
        <div className="tab-row">
          {sentiments.map((item) => (
            <button className={sentiment === item ? "active" : ""} key={item} onClick={() => setSentiment(item)} type="button">
              {item}
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
              <span>Negative load</span>
              <div className="meter-track warning">
                <i style={{ width: `${Math.max(8, (selected.negative / maxNegative) * 100)}%` }} />
              </div>
              <strong>{compactNumber(selected.negative)}</strong>
            </div>
            <div className="runbook-grid">
              {[
                ["Data QA", "确认 query、source、重复内容和情感标签"],
                ["CX", "抽样 20 条原话，判断是否为真实投诉"],
                ["PR", "如真实负面集中，准备 FAQ 和响应口径"],
                ["Owner", "24h 内标记 acknowledged / escalated"],
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
                  <p>{item.category} · {item.week}: {item.level} · volume {signedPct(item.wowVolume)} · negative {signedPct(item.wowNegative)}</p>
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
        <MetricCard label="Rows" value={vocData.regionPriorities.length} caption="language x country" tone="rose" />
        <MetricCard label="Known countries" value={vocData.summaries.knownRegionRows} caption="country_known=yes" tone="green" />
        <MetricCard label="Unknown zz" value={unknownRows.length} caption="只能做语言线索" tone="amber" />
        <MetricCard label="Visible" value={rows.length} caption={knownOnly ? "known only" : "all"} tone="muted" />
      </div>

      <section className="card tab-card">
        <div className="tab-row">
          <button className={!knownOnly ? "active" : ""} onClick={() => setKnownOnly(false)} type="button">all rows</button>
          <button className={knownOnly ? "active" : ""} onClick={() => setKnownOnly(true)} type="button">known country only</button>
        </div>
      </section>

      <QualityGateBanner category={selected.category} />

      <div className="p2-layout">
        <section className="card p2-board">
          <div className="card-header">
            <div>
              <h2>Region Language Priority</h2>
              <p>country_known=no 的 zz 只能作为语言和内容优先级，不能当作地域市场。</p>
            </div>
            <span className="status-badge amber">country guardrail</span>
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
              <h2>Monthly Board Pack</h2>
              <p>月会顺序：先数据质量阻断，再看 ready action，最后看内容/概念扩展。</p>
            </div>
            <span className="status-badge green">{rows.length} categories</span>
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
                  {item.blockedSearches ? "blocked search" : "ready"}
                </span>
              </button>
            ))}
          </div>
        </section>

        <aside className="card p2-detail">
          <div className="side-header">
            <div>
              <h2>Board Narrative · {selected.category}</h2>
              <p>{month} · {compactNumber(selected.occurrences)} occurrences</p>
            </div>
            <IconBookmark size={17} />
          </div>
          <div className="detail-stack">
            <div className="battlecard-diagnosis">
              <strong>Recommended monthly framing</strong>
              <p>
                {selected.blockedSearches
                  ? `${selected.category} 有 ${selected.blockedSearches} 个 blocked search，管理层页只输出治理进展，不输出业务判断。`
                  : `${selected.category} 数据质量通过，可讨论 ${selected.readyActions} 条 ready action、痛点优先级和内容机会。`}
              </p>
            </div>
            <div className="runbook-grid">
              {[
                ["1. Quality", `${selected.blockedSearches} blocked search`],
                ["2. VOC", `${pct(selected.negativeRate, 1)} negative rate`],
                ["3. Action", `${selected.readyActions} ready actions`],
                ["4. Close", "owner + next metric"],
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
                  <small>{brief.category} · {brief.quotes} quotes · {pct(brief.positiveRate, 1)} positive</small>
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
        <MetricCard label="Events" value={events.length} caption="review-events.jsonl" tone="rose" />
        <MetricCard label="Actors" value={new Set(events.map((event) => event.actor)).size} caption="updatedBy" tone="green" />
        <MetricCard label="Namespaces" value={Object.keys(namespaceCounts).length} caption="writeback domains" tone="amber" />
        <MetricCard label="Latest" value={events[0]?.operation || "none"} caption={events[0]?.timestamp?.slice(0, 19) || "no event"} tone="muted" />
      </div>

      <section className="card data-table-card">
        <div className="card-header">
          <div>
            <h2>Review Event History</h2>
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
  const [reviewer, setReviewer] = useState(() => readStorage("melwater:reviewer", "Analyst"));
  const [authStatus, setAuthStatus] = useState({ state: "loading", label: "checking token" });
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
      setAuthStatus({ state: "loading", label: "checking token" });
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
      setMessage("Reviewer 名称已保存。");
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
    const actionLabel = action === "backup" ? "API 备份" : "Ops report";
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
          : `Ops report 已生成：${payload.reportFiles?.markdown || "latest markdown"}`,
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
        <MetricCard label="API Token" value={authStatus.state === "ok" ? authStatus.role || "ok" : "check"} caption={authStatus.label} tone={authStatus.state === "ok" ? "green" : "amber"} />
        <MetricCard label="Release" value={shortHash(opsStatus?.release?.ref)} caption="MELWATER_RELEASE_REF" tone="rose" />
        <MetricCard label="Health" value={health?.ok ? "OK" : "Need check"} caption={formatDateTime(health?.checkedAt)} tone={health?.ok ? "green" : "yellow"} />
        <MetricCard label="Incident" value={incidentLabel} caption={formatDateTime(incident?.openedAt || incident?.resolvedAt)} tone={incidentTone} />
      </div>

      <div className="ops-layout">
        <section className="card ops-card">
          <div className="card-header">
            <div>
              <h2>Access Token</h2>
              <p>真实飞书/企微还未接入前，先用本机 Token 管理完成生产访问闭环。</p>
            </div>
            <span className={`status-badge ${authTone}`}>{authStatus.label}</span>
          </div>
          <div className="token-form">
            <label>
              <span>API token</span>
              <input
                autoComplete="off"
                onChange={(event) => setDraftToken(event.target.value)}
                placeholder="Paste viewer/editor/admin token"
                type="password"
                value={draftToken}
              />
            </label>
            <label>
              <span>Reviewer</span>
              <input
                autoComplete="off"
                onChange={(event) => setReviewer(event.target.value)}
                placeholder="Analyst"
                type="text"
                value={reviewer}
              />
            </label>
            <div className="ops-actions">
              <button className="primary-action compact" onClick={saveToken} type="button">
                <IconCheck size={16} />
                保存 token
              </button>
              <button className="tiny-select" onClick={() => testToken(draftToken)} type="button">
                <IconShieldCheck size={15} />
                测试 token
              </button>
              <button className="tiny-select" onClick={saveReviewer} type="button">保存 reviewer</button>
              <button className="tiny-select" onClick={clearToken} type="button">清除</button>
            </div>
            {message && <p className="ops-note">{message}</p>}
          </div>
        </section>

        <section className="card ops-card">
          <div className="card-header">
            <div>
              <h2>Production Health</h2>
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
                <strong>Incident: {incident.status}</strong>
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
              <h2>Review State Runtime</h2>
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
              <strong>Ops report · {opsReport.healthOk}</strong>
              <p>{formatDateTime(opsReport.generatedAt)} · incident {opsReport.incidentStatus || "none"} · {opsReport.latestBackupFile || "no backup"}</p>
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

function ActionLoopPage() {
  const { values: statusDraft, writeValue: writeActionStatus, syncState: statusSync } = useWritebackState("actionStatus");
  const { values: ownerDraft, writeValue: writeActionOwner, syncState: ownerSync } = useWritebackState("actionOwner");
  const { values: priorityDraft, writeValue: writeActionPriority, syncState: prioritySync } = useWritebackState("actionPriority");
  const { values: impactDraft, writeValue: writeActionImpact, syncState: impactSync } = useWritebackState("actionImpact");
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
  const writeMeta = (action) => ({
    actionType: action.action_type,
    category: action.category,
    topicId: action.topicId,
    ownerDomain: action.owner_domain || "unassigned",
    sourceAction: action.source_action,
  });

  return (
    <div className="lab-stack">
      <div className="summary-grid compact">
        <MetricCard label="Total actions" value={vocData.actions.length} caption="fact_action_register" tone="rose" />
        <MetricCard label="P0/P1 actions" value={highPriorityCount} caption="优先进入周会跟进" tone="amber" />
        <MetricCard label="Need owner" value={unassignedCount} caption="owner_name 待落位" tone="yellow" />
        <MetricCard label="Evidence linked" value={evidenceLinkedCount} caption="可追溯 quote / sample" tone="green" />
      </div>
      <section className="card data-table-card">
        <div className="card-header">
          <div>
            <h2>Action Register</h2>
            <p>把 Playbook 的问题反推到 owner、优先级、业务影响、证据链和复盘口径。</p>
          </div>
          <SyncBadge state={syncState} />
        </div>
        <div className="action-toolbar">
          <label>
            Owner
            <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
              {ownerOptions.map((owner) => (
                <option key={owner} value={owner}>{owner === "all" ? "All owners" : owner}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All status</option>
              {actionStatuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label>
            Priority
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
              <option value="all">All priority</option>
              {actionPriorities.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </label>
          <label>
            Evidence
            <select value={evidenceFilter} onChange={(event) => setEvidenceFilter(event.target.value)}>
              <option value="all">All actions</option>
              <option value="linked">Evidence linked</option>
            </select>
          </label>
          <label className="action-search">
            Search
            <input placeholder="topic / category / impact" value={query} onChange={(event) => setQuery(event.target.value)} />
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
                  <strong>{action.action_type.replaceAll("_", " ")}</strong>
                  <small>{action.category} · {action.displayTopic}</small>
                </div>
                <p>{action.source_action}</p>
                <div className="action-meta-grid">
                  <span><b>Expected</b>{action.expected_metric || "待补齐"}</span>
                  <span><b>Due</b>{action.due_date || "TBD"}</span>
                  <span><b>Review</b>{action.review_date || "TBD"}</span>
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
                  Status
                  <select
                    value={action.status}
                    onChange={(event) => writeActionStatus(action.action_id, event.target.value, writeMeta(action))}
                  >
                    {actionStatuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Owner name
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
                  Priority
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
                  Biz impact
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

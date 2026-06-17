export const DATE_RANGE_OPTIONS = [
  {
    key: "all",
    title: "全量数据",
    label: "2026/01/01 - 2026/06/11",
    start: "2026-01-01",
    end: "2026-06-11",
    description: "当前已采集并建模的全部时间范围。",
  },
  {
    key: "last90",
    title: "近 90 天",
    label: "2026/03/14 - 2026/06/11",
    start: "2026-03-14",
    end: "2026-06-11",
    description: "用于查看近期风险、周度变化和经营复盘。",
  },
  {
    key: "last30",
    title: "近 30 天",
    label: "2026/05/13 - 2026/06/11",
    start: "2026-05-13",
    end: "2026-06-11",
    description: "用于查看最近一个月仍在变化的风险和管理层指标。",
  },
  {
    key: "janFebSamples",
    title: "1-2 月样本期",
    label: "2026/01/01 - 2026/02/28",
    start: "2026-01-01",
    end: "2026-02-28",
    description: "用于查看可推导源日期的样本复核和用户原话。",
  },
  {
    key: "may",
    title: "2026 年 5 月",
    label: "2026/05/01 - 2026/05/31",
    start: "2026-05-01",
    end: "2026-05-31",
    description: "用于复盘最新完整自然月。",
  },
];

export function getDateRangeByKey(key) {
  return DATE_RANGE_OPTIONS.find((item) => item.key === key) || DATE_RANGE_OPTIONS[0];
}

export function filterDailyRowsByDateRange(rows, range, field) {
  if (!range || range.key === "all") return rows;
  return rows.filter((row) => isDayInRange(row[field], range));
}

export function filterWeeklyRowsByDateRange(rows, range, field) {
  return filterDailyRowsByDateRange(rows, range, field);
}

export function filterMonthlyRowsByDateRange(rows, range, field) {
  if (!range || range.key === "all") return rows;
  return rows.filter((row) => {
    const value = row[field];
    if (!value) return false;
    const [start, end] = monthBounds(String(value));
    return start <= range.end && end >= range.start;
  });
}

export function filterSourceRowsByDateRange(rows, range, field) {
  if (!range || range.key === "all") return rows;
  return rows.filter((row) => {
    const value = row[field];
    if (!value) return false;
    const endField = field.endsWith("Start") ? `${field.slice(0, -"Start".length)}End` : "";
    const endValue = endField ? row[endField] : "";
    if (endValue) return String(value).slice(0, 10) <= range.end && String(endValue).slice(0, 10) >= range.start;
    return isDayInRange(value, range);
  });
}

export function isTemporalRangeActive(range) {
  return range && range.key !== "all";
}

function isDayInRange(value, range) {
  if (!value) return false;
  const day = String(value).slice(0, 10);
  return day >= range.start && day <= range.end;
}

function monthBounds(value) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return ["9999-12-31", "0000-01-01"];
  const nextMonth = month === 12 ? new Date(Date.UTC(year + 1, 0, 1)) : new Date(Date.UTC(year, month, 1));
  const endDate = new Date(nextMonth.getTime() - 24 * 60 * 60 * 1000);
  return [`${year}-${String(month).padStart(2, "0")}-01`, endDate.toISOString().slice(0, 10)];
}

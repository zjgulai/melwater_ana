import { DATE_RANGE_OPTIONS } from "./dateRangeFilters.js";

export const DATE_RANGE_QUERY_PARAM = "dateRange";
export const DATE_RANGE_STORAGE_KEY = "melwater:dateRangeKey";

const validDateRangeKeys = new Set(DATE_RANGE_OPTIONS.map((option) => option.key));

export function resolveInitialDateRangeKey(search = "", storage = undefined) {
  const urlKey = readDateRangeKeyFromSearch(search);
  if (urlKey) return urlKey;

  const storedKey = readStoredDateRangeKey(storage);
  return storedKey || "all";
}

export function persistDateRangeKey(key, browserWindow = undefined) {
  const nextKey = normalizeDateRangeKey(key);
  if (!browserWindow) return nextKey;

  try {
    browserWindow.localStorage?.setItem(DATE_RANGE_STORAGE_KEY, nextKey);
  } catch {
    // localStorage can be blocked in hardened browsing contexts.
  }

  try {
    const currentUrl = new URL(browserWindow.location.href);
    if (nextKey === "all") {
      currentUrl.searchParams.delete(DATE_RANGE_QUERY_PARAM);
    } else {
      currentUrl.searchParams.set(DATE_RANGE_QUERY_PARAM, nextKey);
    }
    browserWindow.history.replaceState({}, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
  } catch {
    // URL/history can be unavailable in non-browser tests.
  }

  return nextKey;
}

function readDateRangeKeyFromSearch(search) {
  try {
    const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
    return normalizeDateRangeKey(params.get(DATE_RANGE_QUERY_PARAM), "");
  } catch {
    return "";
  }
}

function readStoredDateRangeKey(storage) {
  try {
    return normalizeDateRangeKey(storage?.getItem?.(DATE_RANGE_STORAGE_KEY), "");
  } catch {
    return "";
  }
}

function normalizeDateRangeKey(key, fallback = "all") {
  const candidate = String(key || "").trim();
  return validDateRangeKeys.has(candidate) ? candidate : fallback;
}

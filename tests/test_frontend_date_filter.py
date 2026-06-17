import subprocess
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_DIR = ROOT / "outputs" / "prototypes" / "playbook-pain-radar-lab"


def run_node_module(code: str) -> str:
    result = subprocess.run(
        ["node", "--input-type=module", "-e", code],
        cwd=APP_DIR,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def test_date_filter_helpers_apply_ranges_to_temporal_marts():
    output = run_node_module(
        """
        import fs from "node:fs";
        import {
          DATE_RANGE_OPTIONS,
          filterDailyRowsByDateRange,
          filterMonthlyRowsByDateRange,
          filterSourceRowsByDateRange,
        } from "./src/dateRangeFilters.js";

        const data = JSON.parse(fs.readFileSync("./src/data/vocData.json", "utf8"));
        const all = DATE_RANGE_OPTIONS.find((item) => item.key === "all");
        const last30 = DATE_RANGE_OPTIONS.find((item) => item.key === "last30");
        const sampleWindow = DATE_RANGE_OPTIONS.find((item) => item.key === "janFebSamples");
        if (!all || !last30) throw new Error("missing expected date ranges");
        if (!sampleWindow) throw new Error("missing sample-window date range");

        const allDaily = filterDailyRowsByDateRange(data.crisisWatch, all, "day");
        if (allDaily.length !== data.crisisWatch.length) throw new Error("all range should keep all crisis rows");

        const recentDaily = filterDailyRowsByDateRange(data.crisisWatch, last30, "day");
        if (!recentDaily.length) throw new Error("last30 should keep matching crisis rows");
        if (recentDaily.some((row) => row.day < last30.start || row.day > last30.end)) {
          throw new Error("last30 returned out-of-range crisis rows");
        }

        const recentMonthly = filterMonthlyRowsByDateRange(data.executiveMonthly, last30, "month");
        if (!recentMonthly.length) throw new Error("last30 should keep overlapping executive rows");
        if (recentMonthly.some((row) => row.month !== "2026-05")) {
          throw new Error("last30 should only include May monthly rows for current snapshot");
        }

        const sampleRows = filterSourceRowsByDateRange(data.querySamples, sampleWindow, "sourceDate");
        if (!sampleRows.length) throw new Error("sample window should keep source-dated query samples");
        if (sampleRows.some((row) => row.sourceDate < sampleWindow.start || row.sourceDate > sampleWindow.end)) {
          throw new Error("sample window returned out-of-range query samples");
        }

        const emptyRecentSamples = filterSourceRowsByDateRange(data.querySamples, last30, "sourceDate");
        if (emptyRecentSamples.length !== 0) throw new Error("last30 should not include Jan/Feb query samples");

        console.log(JSON.stringify({ allDaily: allDaily.length, recentDaily: recentDaily.length, recentMonthly: recentMonthly.length, sampleRows: sampleRows.length }));
        """
    )

    assert "recentDaily" in output


def test_header_exposes_interactive_date_menu():
    source = (APP_DIR / "src" / "App.jsx").read_text()

    assert "date-filter-menu" in source
    assert 'aria-haspopup="menu"' in source
    assert "setDateRangeKey" in source
    assert "DATE_RANGE_OPTIONS" in source
    assert "janFebSamples" in (APP_DIR / "src" / "dateRangeFilters.js").read_text()


def test_date_range_persistence_prefers_url_then_storage():
    output = run_node_module(
        """
        import {
          DATE_RANGE_QUERY_PARAM,
          DATE_RANGE_STORAGE_KEY,
          resolveInitialDateRangeKey,
        } from "./src/dateRangePersistence.js";

        const storage = new Map([[DATE_RANGE_STORAGE_KEY, "last90"]]);
        const storageLike = {
          getItem: (key) => storage.get(key) || "",
        };

        const fromUrl = resolveInitialDateRangeKey(`?${DATE_RANGE_QUERY_PARAM}=last30`, storageLike);
        if (fromUrl !== "last30") throw new Error(`url should win, got ${fromUrl}`);

        const fromStorage = resolveInitialDateRangeKey("", storageLike);
        if (fromStorage !== "last90") throw new Error(`storage should be fallback, got ${fromStorage}`);

        const invalidFallback = resolveInitialDateRangeKey("?dateRange=unknown", { getItem: () => "unknown" });
        if (invalidFallback !== "all") throw new Error(`invalid values should fall back to all, got ${invalidFallback}`);

        console.log(JSON.stringify({ fromUrl, fromStorage, invalidFallback }));
        """
    )

    assert "last30" in output


def test_app_persists_date_range_selection():
    source = (APP_DIR / "src" / "App.jsx").read_text()

    assert "resolveInitialDateRangeKey" in source
    assert "persistDateRangeKey" in source
    assert "handleDateRangeKeyChange" in source


def test_app_extends_date_range_filter_to_sample_and_quote_pages():
    source = (APP_DIR / "src" / "App.jsx").read_text()

    assert "function SearchQualityPage({ dateRange })" in source
    assert "function QuoteLibraryPage({ dateRange })" in source
    assert "filterSourceRowsByDateRange(vocData.querySamples" in source
    assert "filterSourceRowsByDateRange(vocData.quoteLibrary" in source


def test_quote_metadata_long_ids_are_allowed_to_wrap():
    styles = (APP_DIR / "src" / "styles.css").read_text()
    rule_match = re.search(
        r"\.quote-meta-grid strong,\s*\.drawer-meta-grid strong\s*\{(?P<body>[^}]+)\}",
        styles,
        flags=re.MULTILINE,
    )

    assert rule_match
    assert "overflow-wrap: anywhere;" in rule_match.group("body")

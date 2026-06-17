import subprocess
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
        } from "./src/dateRangeFilters.js";

        const data = JSON.parse(fs.readFileSync("./src/data/vocData.json", "utf8"));
        const all = DATE_RANGE_OPTIONS.find((item) => item.key === "all");
        const last30 = DATE_RANGE_OPTIONS.find((item) => item.key === "last30");
        if (!all || !last30) throw new Error("missing expected date ranges");

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

        console.log(JSON.stringify({ allDaily: allDaily.length, recentDaily: recentDaily.length, recentMonthly: recentMonthly.length }));
        """
    )

    assert "recentDaily" in output


def test_header_exposes_interactive_date_menu():
    source = (APP_DIR / "src" / "App.jsx").read_text()

    assert "date-filter-menu" in source
    assert 'aria-haspopup="menu"' in source
    assert "setDateRangeKey" in source
    assert "DATE_RANGE_OPTIONS" in source

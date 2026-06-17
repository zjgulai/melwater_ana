import json
from pathlib import Path


def test_frontend_snapshot_exposes_storyline_decision_queue(project_root: Path):
    snapshot_path = project_root / "outputs" / "prototypes" / "playbook-pain-radar-lab" / "src" / "data" / "vocData.json"
    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))

    queue = snapshot["storylineDecisionQueue"]
    assert len(queue) >= 5
    assert {item["priorityLevel"] for item in queue[:5]} == {"P0"}
    assert {"query_update", "product_backlog", "competitor_matrix"}.issubset(
        {item["decisionType"] for item in queue[:12]}
    )
    assert queue[0]["storylineStage"] == "数据可信"
    assert queue[0]["nextAction"]


def test_frontend_snapshot_exposes_action_conversion_funnel(project_root: Path):
    snapshot_path = project_root / "outputs" / "prototypes" / "playbook-pain-radar-lab" / "src" / "data" / "vocData.json"
    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))

    funnel = snapshot["actionConversionFunnel"]
    assert [stage["stageKey"] for stage in funnel] == [
        "proposed",
        "owner_assigned",
        "accepted",
        "in_progress",
        "shipped",
        "measured",
        "closed",
    ]
    assert funnel[0]["actionCount"] == len(snapshot["actions"])
    assert snapshot["summaries"]["storylineP0Actions"] >= 5


def test_frontend_snapshot_exposes_source_dates_for_sample_and_quote_filters(project_root: Path):
    snapshot_path = project_root / "outputs" / "prototypes" / "playbook-pain-radar-lab" / "src" / "data" / "vocData.json"
    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))

    query_sample_dates = [row.get("sourceDate") for row in snapshot["querySamples"] if row.get("sourceDate")]
    quote_dates = [row.get("sourceDate") for row in snapshot["quoteLibrary"] if row.get("sourceDate")]
    action_source_ranges = [
        row
        for row in snapshot["actions"]
        if row.get("sourceDateStart") and row.get("sourceDateEnd") and row.get("sourceDateCount")
    ]

    assert len(query_sample_dates) >= 30
    assert min(query_sample_dates) >= "2026-01-01"
    assert max(query_sample_dates) <= "2026-02-28"
    assert len(quote_dates) >= 10
    assert min(quote_dates) >= "2026-01-01"
    assert max(quote_dates) <= "2026-02-28"
    assert len(action_source_ranges) >= 10
    assert {row["action_type"] for row in action_source_ranges}.issuperset({"product_backlog", "concept_test"})
    assert all(row["sourceDateStart"] <= row["sourceDateEnd"] for row in action_source_ranges)
    assert min(row["sourceDateStart"] for row in action_source_ranges) >= "2026-01-01"
    assert max(row["sourceDateEnd"] for row in action_source_ranges) <= "2026-02-28"

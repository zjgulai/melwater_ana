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

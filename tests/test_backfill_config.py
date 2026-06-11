from pathlib import Path

import pytest

from meltwater_excel.backfill_config import (
    load_backfill_config,
    planned_output_dir,
    validate_targeted_backfill,
)


def test_backfill_rejects_forbidden_search_ids():
    config = {
        "run_name": "bad_forbidden",
        "category": "吸奶器",
        "search_ids": [18922074, 28546470],
        "forbidden_search_ids": [18922074],
        "forbidden_existing_exports": [17774723],
        "start": "2026-01-01T00:00:00Z",
        "end_exclusive": "2026-02-20T00:00:00Z",
        "expected_reason": "test",
    }

    with pytest.raises(ValueError, match="forbidden search ids"):
        validate_targeted_backfill(config)


def test_backfill_rejects_invalid_time_window():
    config = {
        "run_name": "bad_window",
        "category": "吸奶器",
        "search_ids": [28546470],
        "forbidden_search_ids": [18922074],
        "forbidden_existing_exports": [17774723],
        "start": "2026-02-20T00:00:00Z",
        "end_exclusive": "2026-02-20T00:00:00Z",
        "expected_reason": "test",
    }

    with pytest.raises(ValueError, match="start must be earlier"):
        validate_targeted_backfill(config)


def test_current_targeted_backfill_config_is_valid(project_root: Path):
    config = load_backfill_config(project_root / "config" / "backfill_20260101_20260220_pump_secondary.json")

    assert config["search_ids"] == [28546470, 28546475]
    assert planned_output_dir(config, project_root / "data" / "exports").name == config["run_name"]

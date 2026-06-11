import json
import sqlite3
from pathlib import Path

from meltwater_excel.inventory import load_source_config
from meltwater_excel.staging import stage_sources


def test_staging_preserves_occurrences_states_and_duplicate_array_items(
    fixture_config: Path,
    tmp_path: Path,
):
    db_path = tmp_path / "stage.sqlite"
    summary = stage_sources(load_source_config(fixture_config), db_path)

    assert summary["occurrences"] == 4
    assert summary["array_items"] == 17
    assert summary["documents_without_id"] == 0

    with sqlite3.connect(db_path) as db:
        emojis = db.execute(
            """
            SELECT ordinal, item_text
            FROM array_items
            WHERE occurrence_id = 'fixture_a:0' AND field_path = 'content.emojis'
            ORDER BY ordinal
            """
        ).fetchall()
        states = json.loads(
            db.execute(
                "SELECT array_states_json FROM occurrences WHERE occurrence_id = 'fixture_a:2'"
            ).fetchone()[0]
        )
        missing_paths = json.loads(
            db.execute(
                "SELECT missing_paths_json FROM occurrences WHERE occurrence_id = 'fixture_a:2'"
            ).fetchone()[0]
        )

    assert emojis == [(0, "x"), (1, "x")]
    assert states["content.emojis"] == {"state": "null", "count": 0}
    assert states["matched.inputs"] == {"state": "empty", "count": 0}
    assert "source.name" in missing_paths


def test_staging_records_long_text_and_precision_risks(fixture_config: Path, tmp_path: Path):
    db_path = tmp_path / "stage.sqlite"
    summary = stage_sources(load_source_config(fixture_config), db_path)

    assert summary["formula_risk_texts"] >= 6
    assert summary["long_text_occurrences"] == 2
    assert summary["long_text_chunks"] == 4
    assert summary["precision_risk_values"] >= 6


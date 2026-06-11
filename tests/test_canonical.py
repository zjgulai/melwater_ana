import sqlite3
from pathlib import Path

from meltwater_excel.canonical import build_canonical, summarize_stage
from meltwater_excel.inventory import load_source_config
from meltwater_excel.staging import stage_sources


def test_canonical_selects_latest_indexed_occurrence_and_records_variants(
    fixture_config: Path,
    tmp_path: Path,
):
    db_path = tmp_path / "stage.sqlite"
    stage_sources(load_source_config(fixture_config), db_path)
    build_canonical(db_path)

    with sqlite3.connect(db_path) as db:
        canonical = db.execute(
            "SELECT canonical_occurrence_id FROM documents WHERE document_id = 'doc-1'"
        ).fetchone()[0]
        body_variants = db.execute(
            """
            SELECT occurrence_id, value_json
            FROM scalar_variants
            WHERE document_id = 'doc-1' AND field_path = 'content.body'
            ORDER BY occurrence_id
            """
        ).fetchall()

    assert canonical == "fixture_a:1"
    assert len(body_variants) == 2


def test_stage_summary_reconciles_fixture(fixture_config: Path, tmp_path: Path):
    db_path = tmp_path / "stage.sqlite"
    stage_sources(load_source_config(fixture_config), db_path)
    build_canonical(db_path)
    summary = summarize_stage(db_path)

    assert summary["raw_document_occurrences"] == 4
    assert summary["unique_document_ids"] == 3
    assert summary["duplicate_occurrences"] == 1
    assert summary["documents_with_variants"] == 1
    assert summary["category_unique_documents"] == {"A": 3}


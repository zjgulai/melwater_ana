import json
import sqlite3
from pathlib import Path

from meltwater_excel.marts import build_marts


def _write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def _write_test_insight_config(root: Path) -> Path:
    config_dir = root / "insights"
    config_dir.mkdir()
    _write_json(
        config_dir / "topic_taxonomy.json",
        {
            "version": 99,
            "topics": [
                {
                    "id": "fixture_brand",
                    "label": "Fixture brand",
                    "terms": ["brand", "changed"],
                    "exclude_terms": [],
                    "strategic_relevance": 1.0,
                    "owner_domain": "Data",
                }
            ],
        },
    )
    _write_json(config_dir / "brand_taxonomy.json", {"version": 99, "brands": []})
    _write_json(
        config_dir / "query_noise_rules.json",
        {
            "version": 99,
            "global_noise_terms": [],
            "category_noise_terms": {"A": ["changed"]},
            "watch_terms": {},
        },
    )
    _write_json(
        config_dir / "insight_thresholds.json",
        {
            "version": 99,
            "search_precision_min": 0.8,
            "search_sample_min": 1,
            "formal_insight_min_samples": 2,
            "product_pain_min_representative_samples": 1,
            "competitor_min_samples": 2,
            "concept_min_samples": 2,
            "weak_signal_min_mentions": 1,
        },
    )
    return config_dir


def test_build_marts_generates_p0_outputs(fixture_config: Path, tmp_path: Path):
    output_dir = tmp_path / "marts"
    insight_config_dir = _write_test_insight_config(tmp_path)

    result = build_marts(fixture_config, output_dir, insight_config_dir)

    assert result == output_dir.resolve()
    assert (output_dir / "voc_mart.sqlite").is_file()
    assert (output_dir / "mart_manifest.json").is_file()
    assert (output_dir / "search_precision_report.md").is_file()
    assert (output_dir / "pain_point_cards.md").is_file()
    assert (output_dir / "pain_point_cards.csv").is_file()
    assert (output_dir / "weekly_voc_brief.md").is_file()
    assert (output_dir / "action_register.csv").is_file()

    manifest = json.loads((output_dir / "mart_manifest.json").read_text(encoding="utf-8"))
    assert manifest["status"] == "PASS"
    assert manifest["taxonomy_versions"]["topics"] == 99
    assert manifest["counts"]["fact_action_register"] == 8

    with sqlite3.connect(output_dir / "voc_mart.sqlite") as db:
        search = db.execute(
            """
            SELECT total_occurrences, matched_keyword_rows, noise_keyword_rows, quality_status
            FROM mart_search_quality
            WHERE category = 'A' AND search_name = 'Fixture Search'
            """
        ).fetchone()
        pain = db.execute(
            """
            SELECT valid_mentions, negative_mentions, readiness
            FROM mart_product_pain_radar
            WHERE category = 'A' AND topic_id = 'fixture_brand'
            """
        ).fetchone()
        health = db.execute(
            """
            SELECT occurrences, unique_documents, positive_mentions, neutral_mentions
            FROM mart_category_health_weekly
            WHERE category = 'A'
            """
        ).fetchone()

    assert search == (2, 3, 2, "blocked_by_query_noise")
    assert pain == (2, 0, "blocked_by_query_noise")
    assert health == (4, 3, 2, 2)

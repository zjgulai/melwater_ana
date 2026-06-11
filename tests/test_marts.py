import csv
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
    _write_json(
        config_dir / "brand_taxonomy.json",
        {
            "version": 99,
            "brands": [
                {
                    "id": "fixture_brand",
                    "label": "Fixture Brand",
                    "aliases": ["brand"],
                    "search_ids": ["1"],
                    "role": "owned",
                }
            ],
        },
    )
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
    assert (output_dir / "query_rewrite_recommendations.md").is_file()
    assert (output_dir / "pain_point_cards.md").is_file()
    assert (output_dir / "pain_point_cards.csv").is_file()
    assert (output_dir / "weekly_voc_brief.md").is_file()
    assert (output_dir / "competitor_battlecards.md").is_file()
    assert (output_dir / "content_opportunities.md").is_file()
    assert (output_dir / "crisis_watch_daily.md").is_file()
    assert (output_dir / "region_language_priority.md").is_file()
    assert (output_dir / "concept_candidates.md").is_file()
    assert (output_dir / "executive_monthly_brief.md").is_file()
    assert (output_dir / "insight_register.csv").is_file()
    assert (output_dir / "sample_review_queue.csv").is_file()
    assert (output_dir / "query_sample_review_queue.csv").is_file()
    assert (output_dir / "action_register.csv").is_file()
    assert (output_dir / "action_status_summary.csv").is_file()
    assert (output_dir / "action_feedback_unmatched.csv").is_file()
    assert (output_dir / "action_closed_loop_summary.md").is_file()

    manifest = json.loads((output_dir / "mart_manifest.json").read_text(encoding="utf-8"))
    assert manifest["status"] == "PASS"
    assert manifest["taxonomy_versions"]["topics"] == 99
    assert manifest["counts"]["mart_competitor_battlecard"] == 1
    assert manifest["counts"]["mart_content_opportunity"] == 1
    assert manifest["counts"]["mart_crisis_watch_daily"] == 3
    assert manifest["counts"]["mart_region_language_priority"] == 1
    assert manifest["counts"]["mart_concept_candidates"] == 1
    assert manifest["counts"]["mart_executive_monthly"] == 1
    assert manifest["counts"]["mart_query_rewrite_recommendation"] == 1
    assert manifest["counts"]["fact_query_sample_review"] == 2
    assert manifest["counts"]["fact_insight"] == 9
    assert manifest["counts"]["fact_evidence_sample"] >= 8
    assert manifest["counts"]["fact_sample_review"] == manifest["counts"]["fact_evidence_sample"]
    assert manifest["counts"]["fact_action_register"] >= 1
    assert manifest["counts"]["mart_action_status_summary"] >= 1
    assert manifest["counts"]["fact_action_feedback_unmatched"] == 0
    assert manifest["counts"]["action_feedback_applied"] == 0

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
        competitor = db.execute(
            """
            SELECT valid_mentions, positive_mentions, readiness
            FROM mart_competitor_battlecard
            WHERE category = 'A' AND brand_id = 'fixture_brand'
            """
        ).fetchone()
        content = db.execute(
            """
            SELECT positive_mentions, total_mentions, readiness
            FROM mart_content_opportunity
            WHERE category = 'A' AND topic_id = 'fixture_brand'
            """
        ).fetchone()
        crisis_count = db.execute("SELECT COUNT(*) FROM mart_crisis_watch_daily").fetchone()
        crisis_alerts = db.execute(
            """
            SELECT COUNT(*)
            FROM mart_crisis_watch_daily
            WHERE alert_level = 'data_quality_alert'
            """
        ).fetchone()
        region = db.execute(
            """
            SELECT mentions, positive_mentions, country_known, readiness
            FROM mart_region_language_priority
            WHERE category = 'A' AND language_code = 'en' AND country_code = 'us'
            """
        ).fetchone()
        concept = db.execute(
            """
            SELECT evidence_mentions, negative_mentions, readiness
            FROM mart_concept_candidates
            WHERE category = 'A' AND topic_id = 'fixture_brand'
            """
        ).fetchone()
        executive = db.execute(
            """
            SELECT occurrences, unique_documents, blocked_search_count
            FROM mart_executive_monthly
            WHERE category = 'A' AND month = '2026-01'
            """
        ).fetchone()
        query_rewrite = db.execute(
            """
            SELECT search_name, exclude_terms_json
            FROM mart_query_rewrite_recommendation
            WHERE category = 'A'
            """
        ).fetchone()
        action = db.execute(
            """
            SELECT COUNT(*), SUM(CASE WHEN insight_id <> '' THEN 1 ELSE 0 END)
            FROM fact_action_register
            """
        ).fetchone()
        action_summary = db.execute("SELECT SUM(action_count) FROM mart_action_status_summary").fetchone()

    assert search == (2, 3, 2, "blocked_by_query_noise")
    assert pain == (2, 0, "blocked_by_query_noise")
    assert health == (4, 3, 2, 2)
    assert competitor == (2, 2, "blocked_by_query_noise")
    assert content == (2, 2, "blocked_by_query_noise")
    assert crisis_count == (3,)
    assert crisis_alerts == (3,)
    assert region == (4, 2, 1, "blocked_by_query_noise")
    assert concept == (2, 0, "blocked_by_query_noise")
    assert executive == (4, 3, 1)
    assert query_rewrite[0] == "Fixture Search"
    assert "changed" in query_rewrite[1]
    assert action[0] >= 1
    assert action[0] == action[1]
    assert action_summary == (action[0],)


def test_build_marts_applies_action_feedback_overlay(fixture_config: Path, tmp_path: Path):
    insight_config_dir = _write_test_insight_config(tmp_path)
    base_output = tmp_path / "base_marts"
    build_marts(fixture_config, base_output, insight_config_dir)

    with sqlite3.connect(base_output / "voc_mart.sqlite") as db:
        action_id, insight_id = db.execute(
            """
            SELECT action_id, insight_id
            FROM fact_action_register
            ORDER BY action_id
            LIMIT 1
            """
        ).fetchone()

    feedback_path = tmp_path / "action_feedback.csv"
    fieldnames = [
        "action_id",
        "insight_id",
        "owner_domain",
        "owner_name",
        "status",
        "baseline_value",
        "target_value",
        "due_date",
        "shipped_at",
        "review_date",
        "actual_metric",
        "close_reason",
    ]
    with feedback_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerow(
            {
                "action_id": action_id,
                "insight_id": insight_id,
                "owner_domain": "Data",
                "owner_name": "Owner A",
                "status": "Closed",
                "baseline_value": "precision=0.40",
                "target_value": "precision>=0.80",
                "due_date": "2026-01-10",
                "shipped_at": "2026-01-08",
                "review_date": "2026-01-20",
                "actual_metric": "precision=0.86",
                "close_reason": "query updated and remeasured",
            }
        )
        writer.writerow(
            {
                "action_id": "missing-action",
                "status": "Accepted",
                "owner_name": "Owner B",
            }
        )

    output_dir = tmp_path / "feedback_marts"
    build_marts(fixture_config, output_dir, insight_config_dir, feedback_path)
    manifest = json.loads((output_dir / "mart_manifest.json").read_text(encoding="utf-8"))

    with sqlite3.connect(output_dir / "voc_mart.sqlite") as db:
        action = db.execute(
            """
            SELECT owner_name, status, baseline_value, target_value, shipped_at, actual_metric, close_reason
            FROM fact_action_register
            WHERE action_id = ?
            """,
            (action_id,),
        ).fetchone()
        summary = db.execute(
            """
            SELECT action_count, measured_count, closed_count, overdue_count
            FROM mart_action_status_summary
            WHERE owner_name = 'Owner A' AND status = 'Closed'
            """
        ).fetchone()
        unmatched = db.execute(
            """
            SELECT action_id, reason
            FROM fact_action_feedback_unmatched
            """
        ).fetchone()

    assert manifest["counts"]["action_feedback_applied"] == 1
    assert manifest["counts"]["fact_action_feedback_unmatched"] == 1
    assert action == (
        "Owner A",
        "Closed",
        "precision=0.40",
        "precision>=0.80",
        "2026-01-08",
        "precision=0.86",
        "query updated and remeasured",
    )
    assert summary == (1, 1, 1, 0)
    assert unmatched == ("missing-action", "action_id_not_generated")

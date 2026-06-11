from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any, cast

from .canonical import summarize_stage
from .inventory import resolve_source_path, sha256_file
from .schema import ALLOWED_PATHS
from .writer import inspect_workbook


EXPECTED_WORKBOOKS = [
    "Meltwater_VOC_00_目录与校验.xlsx",
    "Meltwater_VOC_01_核心主表.xlsx",
    "Meltwater_VOC_02_内容数组.xlsx",
    "Meltwater_VOC_03_关键词.xlsx",
    "Meltwater_VOC_04_命名实体.xlsx",
    "Meltwater_VOC_05_命中关系.xlsx",
]

FULL_BASELINE = {
    "raw_document_occurrences": 346891,
    "unique_document_ids": 336288,
    "category_unique_documents": {"吸奶器": 129347, "暖奶器": 195984, "消毒器": 16789},
    "category_occurrences": {"吸奶器": 131222, "暖奶器": 198880, "消毒器": 16789},
    "relation_total_rows": 6865075,
    "relation_rows": {
        "content.emojis": 213375,
        "content.hashtags": 670772,
        "content.links": 332991,
        "content.mentions": 62408,
        "enrichments.keyphrases": 2048857,
        "enrichments.named_entities": 2094008,
        "matched.inputs": 355657,
        "matched.keywords": 972925,
        "source.outlet_types": 114082,
    },
    "risk_metrics": {
        "formula_risk_texts": 165629,
        "long_text_occurrences": 10,
        "long_text_chunks": 35,
        "precision_risk_values": 111945,
        "invalid_xml_strings": 0,
    },
}


def _add_check(checks: list[dict[str, Any]], name: str, expected: Any, actual: Any) -> None:
    checks.append(
        {
            "name": name,
            "expected": expected,
            "actual": actual,
            "status": "PASS" if expected == actual else "FAIL",
        }
    )


def _data_rows_by_prefix(inspection: dict[str, Any], prefix: str) -> int:
    return sum(rows - 1 for name, rows in inspection["sheets"].items() if name.startswith(prefix))


def validate_package(
    config: dict[str, Any],
    db_path: Path | str,
    output_dir: Path | str,
    raise_on_failure: bool = True,
) -> dict[str, Any]:
    target = Path(output_dir)
    summary = summarize_stage(db_path)
    checks: list[dict[str, Any]] = []
    inspections: dict[str, Any] = {}

    for filename in EXPECTED_WORKBOOKS:
        path = target / filename
        _add_check(checks, f"workbook_exists:{filename}", True, path.is_file())
        if path.is_file():
            inspections[filename] = inspect_workbook(path)
            _add_check(checks, f"file_mode:{filename}", "0o600", oct(path.stat().st_mode & 0o777))
    _add_check(checks, "output_dir_mode", "0o700", oct(target.stat().st_mode & 0o777))

    for filename, inspection in inspections.items():
        _add_check(checks, f"formula_count:{filename}", 0, inspection["formula_count"])
        _add_check(
            checks,
            f"max_cell_text_length_ok:{filename}",
            True,
            inspection["max_cell_text_length"] <= 32767,
        )
        _add_check(
            checks,
            f"sheet_row_limit_ok:{filename}",
            True,
            all(rows <= 750001 for rows in inspection["sheets"].values()),
        )

    core = inspections.get("Meltwater_VOC_01_核心主表.xlsx", {"sheets": {}})
    _add_check(checks, "core_mentions_rows", summary["unique_document_ids"], core["sheets"].get("Mentions", 1) - 1)
    _add_check(checks, "core_occurrences_rows", summary["raw_document_occurrences"], core["sheets"].get("Occurrences", 1) - 1)
    _add_check(checks, "core_variant_rows", summary["scalar_variant_rows"], core["sheets"].get("Scalar_Variants", 1) - 1)
    _add_check(checks, "core_long_chunk_rows", summary["risk_metrics"]["long_text_chunks"], core["sheets"].get("Long_Text_Chunks", 1) - 1)

    relation_targets = {
        "content.emojis": ("Meltwater_VOC_02_内容数组.xlsx", "Emojis"),
        "content.hashtags": ("Meltwater_VOC_02_内容数组.xlsx", "Hashtags"),
        "content.links": ("Meltwater_VOC_02_内容数组.xlsx", "Links"),
        "content.mentions": ("Meltwater_VOC_02_内容数组.xlsx", "Mentions"),
        "source.outlet_types": ("Meltwater_VOC_02_内容数组.xlsx", "Outlet_Types"),
        "enrichments.keyphrases": ("Meltwater_VOC_03_关键词.xlsx", "Keyphrases"),
        "enrichments.named_entities": ("Meltwater_VOC_04_命名实体.xlsx", "Named_Entities"),
        "matched.inputs": ("Meltwater_VOC_05_命中关系.xlsx", "Matched_Inputs"),
        "matched.keywords": ("Meltwater_VOC_05_命中关系.xlsx", "Matched_Keywords"),
    }
    relation_rows = cast(dict[str, int], summary["relation_rows"])
    for field_path, expected in relation_rows.items():
        filename, prefix = relation_targets[field_path]
        inspection = inspections.get(filename, {"sheets": {}})
        _add_check(checks, f"relation_rows:{field_path}", expected, _data_rows_by_prefix(inspection, prefix))

    with sqlite3.connect(db_path) as db:
        observed_paths = {row[0] for row in db.execute("SELECT path FROM observed_paths")}
        staged_sources = {
            row[0]: (row[1], row[2])
            for row in db.execute("SELECT alias, path, sha256 FROM sources")
        }
    _add_check(checks, "all_observed_paths_mapped", True, observed_paths <= ALLOWED_PATHS)
    _add_check(checks, "documents_without_id", 0, summary["risk_metrics"]["documents_without_id"])
    _add_check(checks, "invalid_xml_strings", 0, summary["risk_metrics"]["invalid_xml_strings"])

    root = Path(config.get("_project_root", Path.cwd())).resolve()
    for source in config["sources"]:
        path = resolve_source_path(source["path"], root)
        staged_path, staged_sha = staged_sources[source["alias"]]
        _add_check(checks, f"source_path:{source['alias']}", staged_path, str(path.relative_to(root)))
        _add_check(checks, f"source_sha:{source['alias']}", staged_sha, sha256_file(path))

    is_full = summary["source_count"] == 6 and summary["raw_document_occurrences"] == 346891
    if is_full:
        for key in ["raw_document_occurrences", "unique_document_ids", "category_unique_documents", "category_occurrences", "relation_total_rows", "relation_rows"]:
            _add_check(checks, f"full_baseline:{key}", FULL_BASELINE[key], summary[key])
        baseline_risk = cast(dict[str, int], FULL_BASELINE["risk_metrics"])
        summary_risk = cast(dict[str, int], summary["risk_metrics"])
        for key, expected in baseline_risk.items():
            _add_check(checks, f"full_baseline:risk:{key}", expected, summary_risk[key])
        gaps = config.get("known_gaps", [])
        _add_check(checks, "known_gap_count", 1, len(gaps))
        _add_check(checks, "known_gap_estimate", 255, gaps[0]["estimated_search_matches"] if gaps else None)

    status = "PASS" if all(check["status"] == "PASS" for check in checks) else "FAIL"
    manifest = {
        "status": status,
        "summary": summary,
        "workbooks": inspections,
        "checks": checks,
    }
    manifest_path = target / "validation_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    os.chmod(manifest_path, 0o600)
    if status != "PASS" and raise_on_failure:
        failures = [check["name"] for check in checks if check["status"] == "FAIL"]
        raise ValueError(f"validation failed: {', '.join(failures)}")
    return manifest


def validate_existing_package(config: dict[str, Any], output_dir: Path | str) -> dict[str, Any]:
    target = Path(output_dir)
    manifest_path = target / "validation_manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    checks: list[dict[str, Any]] = []
    for filename in EXPECTED_WORKBOOKS:
        path = target / filename
        inspection = inspect_workbook(path)
        _add_check(checks, f"formula_count:{filename}", 0, inspection["formula_count"])
        _add_check(checks, f"sheet_row_limit_ok:{filename}", True, all(value <= 750001 for value in inspection["sheets"].values()))
        _add_check(checks, f"max_cell_text_length_ok:{filename}", True, inspection["max_cell_text_length"] <= 32767)
        _add_check(checks, f"sha256:{filename}", manifest["workbooks"][filename]["sha256"], inspection["sha256"])
    inventory = json.loads((target / "source_inventory.json").read_text(encoding="utf-8"))
    for source in inventory["sources"]:
        _add_check(checks, f"source_sha:{source['alias']}", source["sha256"], sha256_file(Path(source["absolute_path"])))
    status = "PASS" if all(check["status"] == "PASS" for check in checks) else "FAIL"
    result = {"status": status, "checks": checks}
    if status != "PASS":
        raise ValueError("existing package validation failed")
    return result


def refresh_workbook_manifest(output_dir: Path | str, filename: str) -> dict[str, Any]:
    target = Path(output_dir)
    manifest_path = target / "validation_manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["workbooks"][filename] = inspect_workbook(target / filename)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    os.chmod(manifest_path, 0o600)
    return manifest["workbooks"][filename]

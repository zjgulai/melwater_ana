import json
from pathlib import Path

from openpyxl import load_workbook

from meltwater_excel.pipeline import build_all
from meltwater_excel.sample_audit import audit_random_samples


def test_build_all_fixture_creates_valid_package(fixture_config: Path, tmp_path: Path):
    output_dir = tmp_path / "complete"
    result = build_all(fixture_config, output_dir)

    assert result == output_dir
    manifest = json.loads((output_dir / "validation_manifest.json").read_text(encoding="utf-8"))
    assert manifest["status"] == "PASS"
    assert manifest["summary"]["raw_document_occurrences"] == 4
    assert len(list(output_dir.glob("*.xlsx"))) == 6
    assert not (output_dir / "stage.sqlite").exists()
    workbook = load_workbook(output_dir / "Meltwater_VOC_00_目录与校验.xlsx", read_only=False)
    assert workbook["Sources"].column_dimensions["C"].width >= 65
    assert workbook["Known_Gaps"].column_dimensions["F"].width >= 65
    assert workbook["Output_Inventory"].column_dimensions["A"].width >= 38
    workbook.close()


def test_random_sample_audit_round_trips_occurrences_and_relations(
    fixture_config: Path,
    tmp_path: Path,
):
    output_dir = tmp_path / "complete"
    build_all(fixture_config, output_dir)
    result = audit_random_samples(fixture_config, output_dir, samples_per_source=3, seed=1)

    assert result["status"] == "PASS"
    assert result["sample_occurrences"] == 3
    assert result["failed_checks"] == []

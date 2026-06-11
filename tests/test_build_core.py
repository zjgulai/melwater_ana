from pathlib import Path

from meltwater_excel.build_core import build_core_workbook
from meltwater_excel.canonical import build_canonical
from meltwater_excel.inventory import load_source_config
from meltwater_excel.staging import stage_sources
from meltwater_excel.writer import inspect_workbook


def test_core_workbook_contains_unique_occurrences_variants_and_chunks(
    fixture_config: Path,
    tmp_path: Path,
):
    db_path = tmp_path / "stage.sqlite"
    output = tmp_path / "core.xlsx"
    stage_sources(load_source_config(fixture_config), db_path)
    build_canonical(db_path)
    build_core_workbook(db_path, output)

    inspection = inspect_workbook(output)
    assert inspection["sheets"]["Mentions"] == 4
    assert inspection["sheets"]["Occurrences"] == 5
    assert inspection["sheets"]["Long_Text_Chunks"] == 5
    assert inspection["formula_count"] == 0


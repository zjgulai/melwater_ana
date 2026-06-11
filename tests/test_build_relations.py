from pathlib import Path

from meltwater_excel.build_relations import build_relation_workbooks
from meltwater_excel.canonical import build_canonical
from meltwater_excel.inventory import load_source_config
from meltwater_excel.staging import stage_sources
from meltwater_excel.writer import inspect_workbook


def test_relation_workbooks_preserve_all_fixture_items(fixture_config: Path, tmp_path: Path):
    db_path = tmp_path / "stage.sqlite"
    output_dir = tmp_path / "output"
    stage_sources(load_source_config(fixture_config), db_path)
    build_canonical(db_path)
    paths = build_relation_workbooks(db_path, output_dir)

    total_data_rows = 0
    for path in paths:
        inspection = inspect_workbook(path)
        total_data_rows += sum(rows - 1 for rows in inspection["sheets"].values())
        assert inspection["formula_count"] == 0
    assert total_data_rows == 17


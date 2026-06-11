import os
from pathlib import Path

from meltwater_excel.writer import StreamingWorkbook, inspect_workbook


def test_streaming_writer_splits_rows_and_writes_no_formulas(tmp_path: Path):
    output = tmp_path / "split.xlsx"
    writer = StreamingWorkbook(output, max_data_rows=2)
    writer.write_family(
        "Rows",
        ["id", "text"],
        ((index, "=danger") for index in range(5)),
        total_rows=5,
    )
    writer.save()

    inspection = inspect_workbook(output)
    assert list(inspection["sheets"].values()) == [3, 3, 2]
    assert inspection["formula_count"] == 0
    assert inspection["max_cell_text_length"] <= 32767
    assert os.stat(output).st_mode & 0o777 == 0o600


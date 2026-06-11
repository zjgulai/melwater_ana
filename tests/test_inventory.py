from pathlib import Path

import pytest

from meltwater_excel.inventory import build_inventory, load_source_config


def test_inventory_counts_documents_and_hashes_fixture(fixture_config: Path):
    config = load_source_config(fixture_config)
    inventory = build_inventory(config)

    assert len(inventory["sources"]) == 1
    assert inventory["sources"][0]["document_count"] == 4
    assert len(inventory["sources"][0]["sha256"]) == 64


def test_source_path_must_be_json_and_under_project(tmp_path: Path):
    bad = tmp_path / "bad.txt"
    bad.write_text("{}", encoding="utf-8")
    config = {
        "sources": [{
            "alias": "bad",
            "category": "bad",
            "path": str(bad),
            "export_id": 1,
            "request_start": "x",
            "request_end": "y",
            "expected_documents": 0,
        }]
    }
    with pytest.raises(ValueError, match="\\.json"):
        build_inventory(config, allowed_root=tmp_path)


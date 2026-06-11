import json
from pathlib import Path

import pytest


@pytest.fixture
def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


@pytest.fixture
def fixture_export(tmp_path: Path, project_root: Path) -> Path:
    source = project_root / "tests" / "fixtures" / "complete_export_fixture.json"
    data = json.loads(source.read_text(encoding="utf-8"))
    long_title = "=start-" + ("长文本A" * 12000)
    for document in data["documents"]:
        if document["content"]["title"] == "__LONG_TITLE__":
            document["content"]["title"] = long_title
    output = tmp_path / "fixture.json"
    output.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return output


@pytest.fixture
def fixture_config(tmp_path: Path, fixture_export: Path) -> Path:
    config = {
        "version": 1,
        "sources": [
            {
                "alias": "fixture_a",
                "category": "A",
                "path": str(fixture_export),
                "export_id": 999,
                "request_start": "2026-01-01T00:00:00.000Z",
                "request_end": "2026-02-22T00:00:00.000Z",
                "expected_documents": 4,
            }
        ],
        "known_gaps": [],
    }
    path = tmp_path / "sources.json"
    path.write_text(json.dumps(config, ensure_ascii=False), encoding="utf-8")
    return path


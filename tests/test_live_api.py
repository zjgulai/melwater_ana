from pathlib import Path

import pytest

from meltwater_excel.live_api import LiveApiBlocked, require_live_api_enabled, run_targeted_backfill


def valid_config() -> dict:
    return {
        "run_name": "backfill_test",
        "category": "吸奶器",
        "search_ids": [28546470, 28546475],
        "forbidden_search_ids": [18922074],
        "forbidden_existing_exports": [17774723],
        "start": "2026-01-01T00:00:00Z",
        "end_exclusive": "2026-02-20T00:00:00Z",
        "expected_reason": "test",
    }


def test_execute_requires_explicit_live_flag():
    with pytest.raises(LiveApiBlocked, match="MELTWATER_LIVE_API=1"):
        require_live_api_enabled(True, {})


def test_dry_run_writes_manifest_without_live_flag(tmp_path: Path):
    manifest = run_targeted_backfill(valid_config(), output_root=tmp_path, execute=False, environ={})

    assert manifest["status"] == "DRY_RUN"
    assert (tmp_path / "backfill_test" / "manifest.json").is_file()


class FakeClient:
    def create_export(self, search_ids: list[int], start: str, end_exclusive: str) -> dict:
        return {
            "id": 123,
            "status": "CREATED",
            "searches": [{"name": f"search-{item}"} for item in search_ids],
            "data_url": "https://example.com/export.json",
        }

    def get_export(self, export_id: int) -> dict:
        return {"id": export_id, "status": "FINISHED", "data_url": "https://example.com/export.json"}

    def download_json(self, data_url: str) -> dict:
        return {"documents": [{"id": "doc-1", "published_date": "2026-01-02T00:00:00.000Z"}]}


def test_execute_with_fake_client_downloads_json(tmp_path: Path):
    manifest = run_targeted_backfill(
        valid_config(),
        output_root=tmp_path,
        execute=True,
        environ={"MELTWATER_LIVE_API": "1"},
        client=FakeClient(),
        poll_interval=0,
        max_wait=1,
        sleep=lambda _: None,
    )

    assert manifest["status"] == "READY_TO_PUBLISH"
    assert manifest["exports"][0]["status"] == "DOWNLOADED"
    assert manifest["exports"][0]["download"]["document_count"] == 1

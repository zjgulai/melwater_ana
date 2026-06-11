from pathlib import Path

from meltwater_excel.export_manifest import can_publish, new_manifest, read_manifest, write_manifest


def test_manifest_with_blocked_export_cannot_publish():
    manifest = {
        "status": "PARTIAL_QUOTA_EXHAUSTED",
        "exports": [{"status": "DOWNLOADED"}, {"status": "BLOCKED_QUOTA"}],
    }

    assert can_publish(manifest) is False


def test_manifest_ready_to_publish_requires_all_downloaded():
    manifest = {
        "status": "READY_TO_PUBLISH",
        "exports": [{"status": "DOWNLOADED"}, {"status": "DOWNLOADED"}],
    }

    assert can_publish(manifest) is True


def test_write_manifest_round_trips_with_private_permissions(tmp_path: Path):
    config = {
        "run_name": "backfill_test",
        "category": "吸奶器",
        "search_ids": [28546470],
        "start": "2026-01-01T00:00:00Z",
        "end_exclusive": "2026-02-20T00:00:00Z",
    }
    manifest = new_manifest(config, now="2026-06-10T00:00:00Z")

    path = write_manifest(manifest, tmp_path)

    assert path.stat().st_mode & 0o777 == 0o600
    assert read_manifest(path)["run_name"] == "backfill_test"

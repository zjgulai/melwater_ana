from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REQUIRED_MANIFEST_FIELDS = [
    "run_name",
    "category",
    "search_ids",
    "start",
    "end_exclusive",
    "status",
    "exports",
    "created_at",
    "updated_at",
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def new_manifest(config: dict[str, Any], status: str = "READY_TO_EXECUTE", now: str | None = None) -> dict[str, Any]:
    timestamp = now or utc_now()
    return {
        "run_name": config["run_name"],
        "category": config["category"],
        "search_ids": list(config["search_ids"]),
        "start": config["start"],
        "end_exclusive": config["end_exclusive"],
        "expected_reason": config.get("expected_reason"),
        "estimated_search_matches": config.get("estimated_search_matches"),
        "status": status,
        "exports": [],
        "created_at": timestamp,
        "updated_at": timestamp,
    }


def require_manifest_fields(manifest: dict[str, Any]) -> None:
    missing = [field for field in REQUIRED_MANIFEST_FIELDS if field not in manifest]
    if missing:
        raise ValueError(f"manifest missing required fields: {missing}")


def can_publish(manifest: dict[str, Any]) -> bool:
    return manifest.get("status") == "READY_TO_PUBLISH" and all(
        item.get("status") == "DOWNLOADED" for item in manifest.get("exports", [])
    )


def update_manifest_status(manifest: dict[str, Any], status: str, now: str | None = None) -> dict[str, Any]:
    manifest["status"] = status
    manifest["updated_at"] = now or utc_now()
    return manifest


def write_manifest(manifest: dict[str, Any], output_dir: Path | str, filename: str = "manifest.json") -> Path:
    require_manifest_fields(manifest)
    target_dir = Path(output_dir)
    target_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(target_dir, 0o700)
    path = target_dir / filename
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    os.chmod(path, 0o600)
    return path


def read_manifest(path: Path | str) -> dict[str, Any]:
    manifest = json.loads(Path(path).read_text(encoding="utf-8"))
    require_manifest_fields(manifest)
    return manifest

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REQUIRED_BACKFILL_FIELDS = [
    "run_name",
    "category",
    "search_ids",
    "start",
    "end_exclusive",
    "expected_reason",
    "forbidden_search_ids",
    "forbidden_existing_exports",
]

MAX_SEARCHES_PER_EXPORT = 5
RUN_NAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]{2,120}$")


def load_backfill_config(path: Path | str) -> dict[str, Any]:
    config_path = Path(path).resolve()
    config = json.loads(config_path.read_text(encoding="utf-8"))
    config["_config_path"] = str(config_path)
    config["_project_root"] = str(config_path.parent.parent if config_path.parent.name == "config" else config_path.parent)
    validate_targeted_backfill(config)
    return config


def parse_utc_timestamp(value: str) -> datetime:
    if not isinstance(value, str) or not value.endswith("Z"):
        raise ValueError(f"timestamp must be UTC and end with Z: {value}")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo != timezone.utc:
        parsed = parsed.astimezone(timezone.utc)
    return parsed


def normalize_search_ids(values: Any, field_name: str) -> list[int]:
    if not isinstance(values, list) or not values:
        raise ValueError(f"{field_name} must be a non-empty list")
    normalized = []
    for value in values:
        if not isinstance(value, int):
            raise ValueError(f"{field_name} must contain only integers")
        normalized.append(value)
    if len(set(normalized)) != len(normalized):
        raise ValueError(f"{field_name} contains duplicate ids")
    return normalized


def validate_targeted_backfill(config: dict[str, Any]) -> None:
    missing = [field for field in REQUIRED_BACKFILL_FIELDS if field not in config]
    if missing:
        raise ValueError(f"missing required backfill fields: {missing}")

    run_name = config["run_name"]
    if not isinstance(run_name, str) or not RUN_NAME_PATTERN.fullmatch(run_name):
        raise ValueError(f"invalid run_name: {run_name}")

    category = config["category"]
    if not isinstance(category, str) or not category.strip():
        raise ValueError("category must be a non-empty string")

    selected = set(normalize_search_ids(config["search_ids"], "search_ids"))
    forbidden = set(normalize_search_ids(config["forbidden_search_ids"], "forbidden_search_ids"))
    overlap = sorted(selected & forbidden)
    if overlap:
        raise ValueError(f"forbidden search ids selected: {overlap}")

    if len(selected) > MAX_SEARCHES_PER_EXPORT:
        raise ValueError(f"targeted backfill cannot exceed {MAX_SEARCHES_PER_EXPORT} search ids")

    normalize_search_ids(config["forbidden_existing_exports"], "forbidden_existing_exports")

    start = parse_utc_timestamp(config["start"])
    end_exclusive = parse_utc_timestamp(config["end_exclusive"])
    if start >= end_exclusive:
        raise ValueError("start must be earlier than end_exclusive")


def planned_output_dir(config: dict[str, Any], output_root: Path | str) -> Path:
    validate_targeted_backfill(config)
    root = Path(output_root).resolve()
    output = (root / config["run_name"]).resolve()
    if not output.is_relative_to(root):
        raise ValueError(f"output directory escapes root: {output}")
    return output

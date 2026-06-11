from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any


EXCEL_TEXT_LIMIT = 32767
CHUNK_SIZE = 30000
DANGEROUS_PREFIXES = ("=", "+", "-", "@")


def excel_safe_text(value: str) -> str:
    if value.startswith(DANGEROUS_PREFIXES):
        return "'" + value
    return value


def chunk_text(value: str, size: int = CHUNK_SIZE) -> list[str]:
    return [value[start : start + size] for start in range(0, len(value), size)]


def precision_pair(value: Any) -> tuple[str, float | int | None]:
    if value is None:
        return "", None
    raw = format(value, "f") if isinstance(value, Decimal) else str(value)
    try:
        number = float(raw)
    except ValueError:
        number = None
    return raw, number


def excel_utc_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed.astimezone(timezone.utc).replace(tzinfo=None)


def safe_cell_value(value: Any, max_length: int = EXCEL_TEXT_LIMIT) -> Any:
    if value is None:
        return None
    if isinstance(value, str):
        limit = max_length - 1 if value.startswith(DANGEROUS_PREFIXES) else max_length
        preview = value[:limit]
        return excel_safe_text(preview)
    if isinstance(value, Decimal):
        return float(value)
    return value

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Iterator

from .excel_safe import chunk_text, excel_utc_datetime, precision_pair
from .schema import ARRAY_PATHS, DATE_PATHS, ID_PATHS, NUMERIC_PATHS, PRECISE_DECIMAL_PATHS, SCALAR_PATHS
from .writer import StreamingWorkbook


CORE_META_HEADERS = [
    "document_id",
    "categories",
    "canonical_occurrence_id",
    "occurrence_count",
    "source_count",
    "canonical_source_alias",
    "canonical_category",
    "boundary_exception",
]


def _scalar_headers() -> list[str]:
    headers: list[str] = []
    for path in SCALAR_PATHS:
        headers.append(path)
        if path in DATE_PATHS:
            headers.append(f"{path}__utc")
        if path in PRECISE_DECIMAL_PATHS:
            headers.append(f"{path}__number")
    return headers


def _numeric(value: Any) -> Any:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return value
    return int(number) if number.is_integer() else number


def _scalar_values(scalars: dict[str, Any]) -> list[Any]:
    values: list[Any] = []
    for path in SCALAR_PATHS:
        value = scalars.get(path)
        if path in ID_PATHS and value is not None:
            value = str(value)
        elif path in PRECISE_DECIMAL_PATHS:
            raw, number = precision_pair(value)
            values.extend([raw or None, number])
            continue
        elif path in NUMERIC_PATHS:
            value = _numeric(value)
        values.append(value)
        if path in DATE_PATHS:
            values.append(excel_utc_datetime(value))
    return values


def _mention_rows(db: sqlite3.Connection) -> Iterator[list[Any]]:
    query = """
        SELECT d.document_id, d.categories_json, d.canonical_occurrence_id,
               d.occurrence_count, d.source_count, o.source_alias, o.category,
               o.boundary_exception, o.scalar_json
        FROM documents d
        JOIN occurrences o ON o.occurrence_id = d.canonical_occurrence_id
        ORDER BY d.document_id
    """
    for row in db.execute(query):
        yield [
            row["document_id"],
            row["categories_json"],
            row["canonical_occurrence_id"],
            row["occurrence_count"],
            row["source_count"],
            row["source_alias"],
            row["category"],
            row["boundary_exception"],
            *_scalar_values(json.loads(row["scalar_json"])),
        ]


def _occurrence_rows(db: sqlite3.Connection) -> Iterator[list[Any]]:
    query = """
        SELECT occurrence_id, document_id, source_alias, source_index, category,
               request_end, indexed_date, published_date, canonical,
               boundary_exception, missing_paths_json, null_paths_json,
               array_states_json
        FROM occurrences ORDER BY occurrence_id
    """
    for row in db.execute(query):
        states = json.loads(row["array_states_json"])
        result = [
            row["occurrence_id"],
            row["document_id"],
            row["source_alias"],
            row["source_index"],
            row["category"],
            row["request_end"],
            row["indexed_date"],
            row["published_date"],
            row["canonical"],
            row["boundary_exception"],
            row["missing_paths_json"],
            row["null_paths_json"],
        ]
        for path in ARRAY_PATHS:
            result.extend([states[path]["state"], states[path]["count"]])
        yield result


def _variant_rows(db: sqlite3.Connection) -> Iterator[list[Any]]:
    for row in db.execute(
        """
        SELECT document_id, field_path, occurrence_id, source_alias, category,
               state, value_json
        FROM scalar_variants
        ORDER BY document_id, field_path, occurrence_id
        """
    ):
        yield list(row)


def _long_text_rows(db: sqlite3.Connection) -> Iterator[list[Any]]:
    for row in db.execute(
        "SELECT occurrence_id, document_id, source_alias, scalar_json FROM occurrences ORDER BY occurrence_id"
    ):
        scalars = json.loads(row["scalar_json"])
        for path, value in scalars.items():
            if not isinstance(value, str) or len(value) <= 32767:
                continue
            chunks = chunk_text(value)
            for ordinal, chunk in enumerate(chunks):
                yield [
                    row["occurrence_id"],
                    row["document_id"],
                    row["source_alias"],
                    path,
                    ordinal,
                    len(chunks),
                    len(value),
                    chunk,
                ]


def build_core_workbook(db_path: Path | str, output: Path | str) -> Path:
    with sqlite3.connect(db_path) as db:
        db.row_factory = sqlite3.Row
        counts = {
            "mentions": db.execute("SELECT COUNT(*) FROM documents").fetchone()[0],
            "occurrences": db.execute("SELECT COUNT(*) FROM occurrences").fetchone()[0],
            "variants": db.execute("SELECT COUNT(*) FROM scalar_variants").fetchone()[0],
            "chunks": db.execute(
                "SELECT value FROM stage_metrics WHERE name='long_text_chunks'"
            ).fetchone()[0],
        }
        writer = StreamingWorkbook(output)
        writer.write_family("Mentions", CORE_META_HEADERS + _scalar_headers(), _mention_rows(db), counts["mentions"])
        occurrence_headers = [
            "occurrence_id", "document_id", "source_alias", "source_index", "category",
            "request_end", "indexed_date", "published_date", "canonical",
            "boundary_exception", "missing_field_paths", "null_field_paths",
        ]
        for path in ARRAY_PATHS:
            occurrence_headers.extend([f"{path}__state", f"{path}__count"])
        writer.write_family("Occurrences", occurrence_headers, _occurrence_rows(db), counts["occurrences"])
        writer.write_family(
            "Scalar_Variants",
            ["document_id", "field_path", "occurrence_id", "source_alias", "category", "state", "value_json"],
            _variant_rows(db),
            counts["variants"],
        )
        writer.write_family(
            "Long_Text_Chunks",
            ["occurrence_id", "document_id", "source_alias", "field_path", "chunk_ordinal", "chunk_count", "original_length", "chunk_text"],
            _long_text_rows(db),
            counts["chunks"],
        )
        return writer.save()


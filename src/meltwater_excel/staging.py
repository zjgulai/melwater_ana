from __future__ import annotations

import hashlib
import json
import os
import re
import sqlite3
from collections import Counter
from decimal import Decimal
from pathlib import Path
from typing import Any, Iterable, Mapping

from .excel_safe import CHUNK_SIZE, DANGEROUS_PREFIXES
from .inventory import iter_documents, resolve_source_path, sha256_file
from .schema import (
    ARRAY_PATHS,
    PRECISE_DECIMAL_PATHS,
    SCALAR_PATHS,
    collect_document_paths,
    get_path,
    validate_document_schema,
)


MISSING = object()
INVALID_XML_CONTROL = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F]")


def jsonable(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, Mapping):
        return {str(key): jsonable(child) for key, child in value.items()}
    if isinstance(value, list):
        return [jsonable(child) for child in value]
    return value


def json_text(value: Any) -> str:
    return json.dumps(jsonable(value), ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def create_stage_schema(db: sqlite3.Connection) -> None:
    db.executescript(
        """
        PRAGMA journal_mode=OFF;
        PRAGMA synchronous=OFF;
        PRAGMA temp_store=MEMORY;
        PRAGMA cache_size=-200000;

        CREATE TABLE sources(
            alias TEXT PRIMARY KEY,
            category TEXT NOT NULL,
            path TEXT NOT NULL,
            export_id TEXT,
            request_start TEXT,
            request_end TEXT,
            expected_documents INTEGER,
            document_count INTEGER,
            sha256 TEXT
        );

        CREATE TABLE occurrences(
            occurrence_id TEXT PRIMARY KEY,
            source_alias TEXT NOT NULL,
            source_index INTEGER NOT NULL,
            document_id TEXT NOT NULL,
            category TEXT NOT NULL,
            request_end TEXT,
            indexed_date TEXT,
            published_date TEXT,
            scalar_json TEXT NOT NULL,
            missing_paths_json TEXT NOT NULL,
            null_paths_json TEXT NOT NULL,
            array_states_json TEXT NOT NULL,
            full_hash TEXT NOT NULL,
            canonical INTEGER NOT NULL DEFAULT 0,
            boundary_exception INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE array_items(
            occurrence_id TEXT NOT NULL,
            document_id TEXT NOT NULL,
            category TEXT NOT NULL,
            field_path TEXT NOT NULL,
            ordinal INTEGER NOT NULL,
            item_json TEXT NOT NULL,
            item_text TEXT,
            item_id TEXT,
            item_name TEXT,
            item_sentiment TEXT,
            item_type TEXT,
            PRIMARY KEY(occurrence_id, field_path, ordinal)
        ) WITHOUT ROWID;

        CREATE TABLE observed_paths(
            path TEXT PRIMARY KEY,
            occurrence_count INTEGER NOT NULL
        );

        CREATE TABLE stage_metrics(
            name TEXT PRIMARY KEY,
            value INTEGER NOT NULL
        );
        """
    )


def _scan_text_risks(value: Any, counters: Counter[str]) -> None:
    if isinstance(value, str):
        if value.startswith(DANGEROUS_PREFIXES):
            counters["formula_risk_texts"] += 1
        if len(value) > 32767:
            counters["long_text_occurrences"] += 1
            counters["long_text_chunks"] += (len(value) + CHUNK_SIZE - 1) // CHUNK_SIZE
        if INVALID_XML_CONTROL.search(value):
            counters["invalid_xml_strings"] += 1
    elif isinstance(value, Mapping):
        for child in value.values():
            _scan_text_risks(child, counters)
    elif isinstance(value, list):
        for child in value:
            _scan_text_risks(child, counters)


def _has_precision_risk(value: Any) -> bool:
    if not isinstance(value, Decimal):
        return False
    return len(value.as_tuple().digits) > 15


def _extract_occurrence(
    source: Mapping[str, Any],
    source_index: int,
    document: Mapping[str, Any],
    path_counts: Counter[str],
    counters: Counter[str],
) -> tuple[tuple[Any, ...], list[tuple[Any, ...]]]:
    validate_document_schema(document)
    path_counts.update(collect_document_paths(document))
    _scan_text_risks(document, counters)
    for path in PRECISE_DECIMAL_PATHS:
        value = get_path(document, path, MISSING)
        if value is not MISSING and _has_precision_risk(value):
            counters["precision_risk_values"] += 1

    document_id_value = document.get("id")
    if document_id_value in (None, ""):
        counters["documents_without_id"] += 1
        raise ValueError(f"{source['alias']} document {source_index} has no id")
    document_id = str(document_id_value)
    occurrence_id = f"{source['alias']}:{source_index}"

    scalars: dict[str, Any] = {}
    missing_paths: list[str] = []
    null_paths: list[str] = []
    for path in SCALAR_PATHS:
        value = get_path(document, path, MISSING)
        if value is MISSING:
            missing_paths.append(path)
        elif value is None:
            null_paths.append(path)
        else:
            scalars[path] = jsonable(value)

    array_states: dict[str, dict[str, Any]] = {}
    relation_rows: list[tuple[Any, ...]] = []
    for path in ARRAY_PATHS:
        value = get_path(document, path, MISSING)
        if value is MISSING:
            array_states[path] = {"state": "missing", "count": 0}
            continue
        if value is None:
            array_states[path] = {"state": "null", "count": 0}
            continue
        if not isinstance(value, list):
            raise ValueError(f"{occurrence_id} {path} is not an array")
        array_states[path] = {"state": "empty" if not value else "nonempty", "count": len(value)}
        for ordinal, item in enumerate(value):
            item_mapping = item if isinstance(item, Mapping) else {}
            relation_rows.append(
                (
                    occurrence_id,
                    document_id,
                    source["category"],
                    path,
                    ordinal,
                    json_text(item),
                    str(item) if not isinstance(item, (Mapping, list)) else None,
                    str(item_mapping.get("id")) if item_mapping.get("id") is not None else None,
                    item_mapping.get("name"),
                    item_mapping.get("sentiment"),
                    item_mapping.get("type"),
                )
            )

    published_date = scalars.get("published_date")
    indexed_date = scalars.get("indexed_date")
    boundary_exception = int(
        source["alias"] == "warmer_new" and published_date == source["request_end"]
    )
    full_hash = hashlib.sha256(json_text(document).encode("utf-8")).hexdigest()
    occurrence_row = (
        occurrence_id,
        source["alias"],
        source_index,
        document_id,
        source["category"],
        source["request_end"],
        indexed_date,
        published_date,
        json_text(scalars),
        json_text(sorted(missing_paths)),
        json_text(sorted(null_paths)),
        json_text(array_states),
        full_hash,
        boundary_exception,
    )
    return occurrence_row, relation_rows


def _insert_batches(
    db: sqlite3.Connection,
    sql: str,
    rows: Iterable[tuple[Any, ...]],
    batch_size: int = 10000,
) -> int:
    batch: list[tuple[Any, ...]] = []
    count = 0
    for row in rows:
        batch.append(row)
        if len(batch) >= batch_size:
            db.executemany(sql, batch)
            count += len(batch)
            batch.clear()
    if batch:
        db.executemany(sql, batch)
        count += len(batch)
    return count


def stage_sources(config: dict[str, Any], db_path: Path | str) -> dict[str, int]:
    output = Path(db_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        output.unlink()
    root = Path(config.get("_project_root", Path.cwd())).resolve()
    counters: Counter[str] = Counter()
    path_counts: Counter[str] = Counter()

    occurrence_sql = """
        INSERT INTO occurrences(
            occurrence_id, source_alias, source_index, document_id, category,
            request_end, indexed_date, published_date, scalar_json,
            missing_paths_json, null_paths_json, array_states_json, full_hash,
            boundary_exception
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    relation_sql = """
        INSERT INTO array_items(
            occurrence_id, document_id, category, field_path, ordinal, item_json,
            item_text, item_id, item_name, item_sentiment, item_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """

    with sqlite3.connect(output) as db:
        create_stage_schema(db)
        for source in config["sources"]:
            source_path = resolve_source_path(source["path"], root)
            source_count = 0
            occurrence_batch: list[tuple[Any, ...]] = []
            relation_batch: list[tuple[Any, ...]] = []
            for source_index, document in enumerate(iter_documents(source_path)):
                occurrence, relations = _extract_occurrence(
                    source, source_index, document, path_counts, counters
                )
                occurrence_batch.append(occurrence)
                relation_batch.extend(relations)
                source_count += 1
                if len(occurrence_batch) >= 1000:
                    db.executemany(occurrence_sql, occurrence_batch)
                    occurrence_batch.clear()
                if len(relation_batch) >= 10000:
                    db.executemany(relation_sql, relation_batch)
                    counters["array_items"] += len(relation_batch)
                    relation_batch.clear()
            if occurrence_batch:
                db.executemany(occurrence_sql, occurrence_batch)
            if relation_batch:
                db.executemany(relation_sql, relation_batch)
                counters["array_items"] += len(relation_batch)
            if source_count != source["expected_documents"]:
                raise ValueError(
                    f"{source['alias']} expected {source['expected_documents']}, found {source_count}"
                )
            db.execute(
                """
                INSERT INTO sources(
                    alias, category, path, export_id, request_start, request_end,
                    expected_documents, document_count, sha256
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    source["alias"],
                    source["category"],
                    str(source_path.relative_to(root)),
                    str(source["export_id"]),
                    source["request_start"],
                    source["request_end"],
                    source["expected_documents"],
                    source_count,
                    sha256_file(source_path),
                ),
            )
            counters["occurrences"] += source_count
            db.commit()

        db.executemany(
            "INSERT INTO observed_paths(path, occurrence_count) VALUES (?, ?)",
            sorted(path_counts.items()),
        )
        counters.setdefault("documents_without_id", 0)
        counters.setdefault("formula_risk_texts", 0)
        counters.setdefault("long_text_occurrences", 0)
        counters.setdefault("long_text_chunks", 0)
        counters.setdefault("precision_risk_values", 0)
        counters.setdefault("invalid_xml_strings", 0)
        db.executemany(
            "INSERT INTO stage_metrics(name, value) VALUES (?, ?)",
            sorted(counters.items()),
        )
        db.executescript(
            """
            CREATE INDEX occurrences_document_id_idx ON occurrences(document_id);
            CREATE INDEX occurrences_source_alias_idx ON occurrences(source_alias);
            CREATE INDEX occurrences_category_idx ON occurrences(category);
            CREATE INDEX array_items_field_path_idx ON array_items(field_path);
            CREATE INDEX array_items_document_id_idx ON array_items(document_id);
            """
        )
        db.commit()

    os.chmod(output, 0o600)
    return dict(counters)


from __future__ import annotations

import itertools
import json
import sqlite3
from pathlib import Path
from typing import Any

from .schema import SCALAR_PATHS


def _state_value(row: sqlite3.Row, path: str) -> tuple[str, Any]:
    missing = set(json.loads(row["missing_paths_json"]))
    nulls = set(json.loads(row["null_paths_json"]))
    if path in missing:
        return "missing", None
    if path in nulls:
        return "null", None
    scalars = json.loads(row["scalar_json"])
    return "value", scalars.get(path)


def _canonical_occurrence(rows: list[sqlite3.Row]) -> sqlite3.Row:
    max_indexed = max((row["indexed_date"] or "") for row in rows)
    candidates = [row for row in rows if (row["indexed_date"] or "") == max_indexed]
    max_request_end = max((row["request_end"] or "") for row in candidates)
    candidates = [row for row in candidates if (row["request_end"] or "") == max_request_end]
    return min(candidates, key=lambda row: (row["source_alias"], row["source_index"]))


def build_canonical(db_path: Path | str) -> None:
    with sqlite3.connect(db_path) as db:
        db.row_factory = sqlite3.Row
        db.executescript(
            """
            DROP TABLE IF EXISTS documents;
            DROP TABLE IF EXISTS document_categories;
            DROP TABLE IF EXISTS scalar_variants;

            CREATE TABLE documents(
                document_id TEXT PRIMARY KEY,
                canonical_occurrence_id TEXT NOT NULL,
                categories_json TEXT NOT NULL,
                occurrence_count INTEGER NOT NULL,
                source_count INTEGER NOT NULL,
                distinct_hash_count INTEGER NOT NULL
            );

            CREATE TABLE document_categories(
                document_id TEXT NOT NULL,
                category TEXT NOT NULL,
                PRIMARY KEY(document_id, category)
            ) WITHOUT ROWID;

            CREATE TABLE scalar_variants(
                document_id TEXT NOT NULL,
                field_path TEXT NOT NULL,
                occurrence_id TEXT NOT NULL,
                source_alias TEXT NOT NULL,
                category TEXT NOT NULL,
                state TEXT NOT NULL,
                value_json TEXT,
                PRIMARY KEY(document_id, field_path, occurrence_id)
            ) WITHOUT ROWID;
            """
        )
        cursor = db.execute("SELECT * FROM occurrences ORDER BY document_id, occurrence_id")
        document_rows: list[tuple[Any, ...]] = []
        category_rows: list[tuple[str, str]] = []
        variant_rows: list[tuple[Any, ...]] = []
        canonical_ids: list[tuple[str]] = []
        for document_id, group_iter in itertools.groupby(cursor, key=lambda row: row["document_id"]):
            rows = list(group_iter)
            canonical = _canonical_occurrence(rows)
            categories = sorted({row["category"] for row in rows})
            sources = {row["source_alias"] for row in rows}
            hashes = {row["full_hash"] for row in rows}
            document_rows.append(
                (
                    document_id,
                    canonical["occurrence_id"],
                    json.dumps(categories, ensure_ascii=False),
                    len(rows),
                    len(sources),
                    len(hashes),
                )
            )
            canonical_ids.append((canonical["occurrence_id"],))
            category_rows.extend((document_id, category) for category in categories)
            if len(rows) > 1:
                for path in SCALAR_PATHS:
                    states = [_state_value(row, path) for row in rows]
                    distinct = {
                        (state, json.dumps(value, ensure_ascii=False, sort_keys=True))
                        for state, value in states
                    }
                    if len(distinct) <= 1:
                        continue
                    for row, (state, value) in zip(rows, states, strict=True):
                        variant_rows.append(
                            (
                                document_id,
                                path,
                                row["occurrence_id"],
                                row["source_alias"],
                                row["category"],
                                state,
                                json.dumps(value, ensure_ascii=False, sort_keys=True)
                                if state == "value"
                                else None,
                            )
                        )
            if len(document_rows) >= 5000:
                db.executemany("INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?)", document_rows)
                db.executemany("UPDATE occurrences SET canonical=1 WHERE occurrence_id=?", canonical_ids)
                db.executemany("INSERT INTO document_categories VALUES (?, ?)", category_rows)
                db.executemany(
                    "INSERT INTO scalar_variants VALUES (?, ?, ?, ?, ?, ?, ?)",
                    variant_rows,
                )
                document_rows.clear()
                canonical_ids.clear()
                category_rows.clear()
                variant_rows.clear()
        if document_rows:
            db.executemany("INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?)", document_rows)
            db.executemany("UPDATE occurrences SET canonical=1 WHERE occurrence_id=?", canonical_ids)
            db.executemany("INSERT INTO document_categories VALUES (?, ?)", category_rows)
            db.executemany(
                "INSERT INTO scalar_variants VALUES (?, ?, ?, ?, ?, ?, ?)",
                variant_rows,
            )
        db.executescript(
            """
            CREATE INDEX scalar_variants_field_idx ON scalar_variants(field_path);
            CREATE INDEX documents_canonical_idx ON documents(canonical_occurrence_id);
            """
        )
        db.commit()


def _dict_query(db: sqlite3.Connection, sql: str) -> dict[str, int]:
    return {str(key): int(value) for key, value in db.execute(sql)}


def summarize_stage(db_path: Path | str) -> dict[str, Any]:
    with sqlite3.connect(db_path) as db:
        raw = db.execute("SELECT COUNT(*) FROM occurrences").fetchone()[0]
        unique = db.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
        return {
            "source_count": db.execute("SELECT COUNT(*) FROM sources").fetchone()[0],
            "raw_document_occurrences": raw,
            "unique_document_ids": unique,
            "duplicate_occurrences": raw - unique,
            "documents_in_multiple_source_files": db.execute(
                "SELECT COUNT(*) FROM documents WHERE source_count > 1"
            ).fetchone()[0],
            "documents_in_multiple_categories": db.execute(
                """
                SELECT COUNT(*) FROM (
                    SELECT document_id FROM document_categories
                    GROUP BY document_id HAVING COUNT(*) > 1
                )
                """
            ).fetchone()[0],
            "documents_with_variants": db.execute(
                "SELECT COUNT(*) FROM documents WHERE distinct_hash_count > 1"
            ).fetchone()[0],
            "documents_exact_duplicates": db.execute(
                "SELECT COUNT(*) FROM documents WHERE occurrence_count > 1 AND distinct_hash_count = 1"
            ).fetchone()[0],
            "category_memberships": db.execute(
                "SELECT COUNT(*) FROM document_categories"
            ).fetchone()[0],
            "category_unique_documents": _dict_query(
                db,
                "SELECT category, COUNT(*) FROM document_categories GROUP BY category ORDER BY category",
            ),
            "category_occurrences": _dict_query(
                db,
                "SELECT category, COUNT(*) FROM occurrences GROUP BY category ORDER BY category",
            ),
            "relation_rows": _dict_query(
                db,
                "SELECT field_path, COUNT(*) FROM array_items GROUP BY field_path ORDER BY field_path",
            ),
            "relation_total_rows": db.execute("SELECT COUNT(*) FROM array_items").fetchone()[0],
            "scalar_variant_rows": db.execute("SELECT COUNT(*) FROM scalar_variants").fetchone()[0],
            "risk_metrics": _dict_query(
                db, "SELECT name, value FROM stage_metrics ORDER BY name"
            ),
        }


def write_stage_summary(db_path: Path | str, output: Path | str) -> None:
    path = Path(output)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(summarize_stage(db_path), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    path.chmod(0o600)


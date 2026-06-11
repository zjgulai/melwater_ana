from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Iterator

from .writer import StreamingWorkbook


RELATION_COLUMNS = [
    "occurrence_id",
    "document_id",
    "category",
    "ordinal",
    "item_text",
    "item_id",
    "item_name",
    "item_sentiment",
    "item_type",
    "item_json",
]

OUTPUTS = {
    "Meltwater_VOC_02_内容数组.xlsx": [
        ("content.emojis", "Emojis"),
        ("content.hashtags", "Hashtags"),
        ("content.links", "Links"),
        ("content.mentions", "Mentions"),
        ("source.outlet_types", "Outlet_Types"),
    ],
    "Meltwater_VOC_03_关键词.xlsx": [("enrichments.keyphrases", "Keyphrases")],
    "Meltwater_VOC_04_命名实体.xlsx": [("enrichments.named_entities", "Named_Entities")],
    "Meltwater_VOC_05_命中关系.xlsx": [
        ("matched.inputs", "Matched_Inputs"),
        ("matched.keywords", "Matched_Keywords"),
    ],
}


def _relation_rows(db: sqlite3.Connection, field_path: str) -> Iterator[list[str | int | None]]:
    query = """
        SELECT occurrence_id, document_id, category, ordinal, item_text, item_id,
               item_name, item_sentiment, item_type, item_json
        FROM array_items WHERE field_path=? ORDER BY occurrence_id, ordinal
    """
    for row in db.execute(query, (field_path,)):
        yield list(row)


def build_relation_workbooks(db_path: Path | str, output_dir: Path | str) -> list[Path]:
    target = Path(output_dir)
    target.mkdir(parents=True, exist_ok=True, mode=0o700)
    paths: list[Path] = []
    with sqlite3.connect(db_path) as db:
        for filename, relations in OUTPUTS.items():
            writer = StreamingWorkbook(target / filename)
            for field_path, sheet_name in relations:
                count = db.execute(
                    "SELECT COUNT(*) FROM array_items WHERE field_path=?", (field_path,)
                ).fetchone()[0]
                writer.write_family(
                    sheet_name,
                    RELATION_COLUMNS,
                    _relation_rows(db, field_path),
                    count,
                )
            paths.append(writer.save())
    return paths


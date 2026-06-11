from __future__ import annotations

import csv
import json
import os
import shutil
import sqlite3
import tempfile
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .canonical import build_canonical
from .inventory import build_inventory, load_source_config, write_inventory
from .staging import stage_sources
from .taxonomy import InsightConfig, is_noise_match, load_insight_config, normalize_text, topic_matches


@dataclass(frozen=True)
class OccurrenceMeta:
    occurrence_id: str
    document_id: str
    category: str
    published_date: str
    week_start: str
    sentiment: str
    source_type: str
    content_type: str
    language_code: str
    country_code: str
    url: str
    evidence_text: str
    match_text: str


@dataclass
class SearchGroup:
    category: str
    search_id: str
    search_name: str
    input_type: str
    total_occurrences: int = 0
    matched_keyword_rows: int = 0
    noise_keyword_rows: int = 0
    noise_terms: Counter[str] = field(default_factory=Counter)
    samples: list[str] = field(default_factory=list)
    noise_samples: list[dict[str, str]] = field(default_factory=list)


@dataclass
class PainGroup:
    category: str
    topic_id: str
    topic_label: str
    owner_domain: str
    strategic_relevance: float
    valid_mentions: int = 0
    negative_mentions: int = 0
    samples: list[dict[str, str]] = field(default_factory=list)


def _json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def _safe_scalar(scalars: dict[str, Any], key: str) -> str:
    value = scalars.get(key)
    return "" if value is None else str(value)


def _shorten(value: str, limit: int = 500) -> str:
    value = " ".join(value.split())
    if len(value) <= limit:
        return value
    return value[: limit - 1] + "..."


def _parse_week_start(value: str) -> str:
    if not value:
        return "unknown"
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return "unknown"
    week_start = parsed.date().fromordinal(parsed.date().toordinal() - parsed.weekday())
    return week_start.isoformat()


def _load_occurrence_meta(stage_db: sqlite3.Connection) -> dict[str, OccurrenceMeta]:
    rows: dict[str, OccurrenceMeta] = {}
    cursor = stage_db.execute(
        """
        SELECT occurrence_id, document_id, category, published_date, scalar_json
        FROM occurrences
        ORDER BY occurrence_id
        """
    )
    for occurrence_id, document_id, category, published_date, scalar_json in cursor:
        scalars = json.loads(scalar_json)
        title = _safe_scalar(scalars, "content.title")
        body = _safe_scalar(scalars, "content.body")
        hit_sentence = _safe_scalar(scalars, "matched.hit_sentence")
        url = _safe_scalar(scalars, "url")
        evidence = hit_sentence or title or body or url
        match_text = " ".join(part for part in [hit_sentence, title, body] if part)
        rows[str(occurrence_id)] = OccurrenceMeta(
            occurrence_id=str(occurrence_id),
            document_id=str(document_id),
            category=str(category),
            published_date=str(published_date or ""),
            week_start=_parse_week_start(str(published_date or "")),
            sentiment=normalize_text(scalars.get("enrichments.sentiment") or "unknown"),
            source_type=_safe_scalar(scalars, "source.type") or "unknown",
            content_type=_safe_scalar(scalars, "content_type") or "unknown",
            language_code=_safe_scalar(scalars, "enrichments.language_code") or "unknown",
            country_code=_safe_scalar(scalars, "location.country_code") or "unknown",
            url=url,
            evidence_text=_shorten(evidence),
            match_text=match_text,
        )
    return rows


def _create_mart_schema(db: sqlite3.Connection) -> None:
    db.executescript(
        """
        CREATE TABLE mart_search_quality(
            category TEXT NOT NULL,
            search_id TEXT NOT NULL,
            search_name TEXT NOT NULL,
            input_type TEXT NOT NULL,
            total_occurrences INTEGER NOT NULL,
            matched_keyword_rows INTEGER NOT NULL,
            noise_keyword_rows INTEGER NOT NULL,
            estimated_precision REAL,
            noise_rate REAL,
            quality_status TEXT NOT NULL,
            top_noise_terms_json TEXT NOT NULL,
            sample_occurrence_ids_json TEXT NOT NULL,
            noise_samples_json TEXT NOT NULL,
            PRIMARY KEY(category, search_id, search_name)
        );

        CREATE TABLE mart_product_pain_radar(
            category TEXT NOT NULL,
            topic_id TEXT NOT NULL,
            topic_label TEXT NOT NULL,
            owner_domain TEXT NOT NULL,
            valid_mentions INTEGER NOT NULL,
            negative_mentions INTEGER NOT NULL,
            negative_rate REAL NOT NULL,
            category_negative_rate REAL NOT NULL,
            negative_lift REAL NOT NULL,
            priority_score REAL NOT NULL,
            evidence_count INTEGER NOT NULL,
            readiness TEXT NOT NULL,
            evidence_samples_json TEXT NOT NULL,
            PRIMARY KEY(category, topic_id)
        );

        CREATE TABLE mart_category_health_weekly(
            category TEXT NOT NULL,
            week_start TEXT NOT NULL,
            occurrences INTEGER NOT NULL,
            unique_documents INTEGER NOT NULL,
            positive_mentions INTEGER NOT NULL,
            neutral_mentions INTEGER NOT NULL,
            negative_mentions INTEGER NOT NULL,
            unknown_mentions INTEGER NOT NULL,
            negative_rate REAL NOT NULL,
            source_type_mix_json TEXT NOT NULL,
            PRIMARY KEY(category, week_start)
        );

        CREATE TABLE fact_action_register(
            action_id TEXT PRIMARY KEY,
            insight_id TEXT,
            action_type TEXT NOT NULL,
            source_action TEXT NOT NULL,
            owner_domain TEXT NOT NULL,
            status TEXT NOT NULL,
            expected_metric TEXT NOT NULL,
            baseline_value TEXT,
            target_value TEXT,
            due_date TEXT,
            shipped_at TEXT,
            review_date TEXT,
            actual_metric TEXT,
            close_reason TEXT
        );
        """
    )


def _build_search_quality(
    stage_db: sqlite3.Connection,
    mart_db: sqlite3.Connection,
    meta: dict[str, OccurrenceMeta],
    config: InsightConfig,
) -> list[dict[str, Any]]:
    occurrence_inputs: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
    groups: dict[tuple[str, str, str], SearchGroup] = {}
    cursor = stage_db.execute(
        """
        SELECT occurrence_id, item_id, item_name, item_type
        FROM array_items
        WHERE field_path = 'matched.inputs'
        ORDER BY occurrence_id, ordinal
        """
    )
    for occurrence_id, item_id, item_name, item_type in cursor:
        occurrence_key = str(occurrence_id)
        occurrence = meta.get(occurrence_key)
        if occurrence is None:
            continue
        search_id = str(item_id or "")
        search_name = str(item_name or "")
        input_type = str(item_type or "")
        occurrence_inputs[occurrence_key].append((search_id, search_name, input_type))
        key = (occurrence.category, search_id, search_name)
        group = groups.setdefault(
            key,
            SearchGroup(
                category=occurrence.category,
                search_id=search_id,
                search_name=search_name,
                input_type=input_type,
            ),
        )
        group.total_occurrences += 1
        if len(group.samples) < 10:
            group.samples.append(occurrence_key)

    keyword_cursor = stage_db.execute(
        """
        SELECT occurrence_id, item_text
        FROM array_items
        WHERE field_path = 'matched.keywords'
        ORDER BY occurrence_id, ordinal
        """
    )
    for occurrence_id, item_text in keyword_cursor:
        occurrence_key = str(occurrence_id)
        occurrence = meta.get(occurrence_key)
        if occurrence is None:
            continue
        inputs = occurrence_inputs.get(occurrence_key, [])
        if not inputs:
            continue
        keyword = str(item_text or "")
        for search_id, search_name, _input_type in inputs:
            group = groups[(occurrence.category, search_id, search_name)]
            group.matched_keyword_rows += 1
            matched_noise = is_noise_match(
                occurrence.category,
                [keyword, occurrence.match_text],
                config.query_noise,
            )
            if matched_noise is None:
                continue
            group.noise_keyword_rows += 1
            group.noise_terms[matched_noise] += 1
            if len(group.noise_samples) < 10:
                group.noise_samples.append(
                    {
                        "occurrence_id": occurrence_key,
                        "document_id": occurrence.document_id,
                        "keyword": keyword,
                        "matched_noise": matched_noise,
                        "evidence": occurrence.evidence_text,
                        "url": occurrence.url,
                    }
                )

    rows: list[dict[str, Any]] = []
    for group in groups.values():
        if group.matched_keyword_rows:
            noise_rate = group.noise_keyword_rows / group.matched_keyword_rows
            precision = 1.0 - noise_rate
        else:
            noise_rate = 0.0
            precision = None
        if group.total_occurrences < config.thresholds.search_sample_min or precision is None:
            status = "weak_signal"
        elif precision < config.thresholds.search_precision_min:
            status = "blocked_by_query_noise"
        elif precision < min(config.thresholds.search_precision_min + 0.1, 1.0):
            status = "review"
        else:
            status = "pass"
        rows.append(
            {
                "category": group.category,
                "search_id": group.search_id,
                "search_name": group.search_name,
                "input_type": group.input_type,
                "total_occurrences": group.total_occurrences,
                "matched_keyword_rows": group.matched_keyword_rows,
                "noise_keyword_rows": group.noise_keyword_rows,
                "estimated_precision": precision,
                "noise_rate": noise_rate,
                "quality_status": status,
                "top_noise_terms_json": _json_text(group.noise_terms.most_common(10)),
                "sample_occurrence_ids_json": _json_text(group.samples),
                "noise_samples_json": _json_text(group.noise_samples),
            }
        )
    rows.sort(
        key=lambda row: (
            row["quality_status"] != "blocked_by_query_noise",
            -int(row["noise_keyword_rows"]),
            -int(row["total_occurrences"]),
        )
    )
    mart_db.executemany(
        """
        INSERT INTO mart_search_quality VALUES (
            :category, :search_id, :search_name, :input_type, :total_occurrences,
            :matched_keyword_rows, :noise_keyword_rows, :estimated_precision,
            :noise_rate, :quality_status, :top_noise_terms_json,
            :sample_occurrence_ids_json, :noise_samples_json
        )
        """,
        rows,
    )
    return rows


def _topic_ids_for_texts(texts: list[str], config: InsightConfig) -> dict[str, str]:
    matches: dict[str, str] = {}
    for topic in config.topics:
        matched_term = topic_matches(topic, texts)
        if matched_term is not None:
            matches[topic.id] = matched_term
    return matches


def _build_product_pain_radar(
    stage_db: sqlite3.Connection,
    mart_db: sqlite3.Connection,
    meta: dict[str, OccurrenceMeta],
    config: InsightConfig,
    blocked_categories: set[str],
) -> list[dict[str, Any]]:
    occurrence_topics: dict[str, set[str]] = defaultdict(set)
    matched_terms: dict[tuple[str, str], str] = {}
    for occurrence_id, occurrence in meta.items():
        for topic_id, term in _topic_ids_for_texts([occurrence.match_text], config).items():
            occurrence_topics[occurrence_id].add(topic_id)
            matched_terms[(occurrence_id, topic_id)] = term

    relation_cursor = stage_db.execute(
        """
        SELECT occurrence_id, field_path, item_text, item_name
        FROM array_items
        WHERE field_path IN ('matched.keywords', 'enrichments.keyphrases')
        ORDER BY occurrence_id, field_path, ordinal
        """
    )
    for occurrence_id, _field_path, item_text, item_name in relation_cursor:
        occurrence_key = str(occurrence_id)
        text = str(item_text or item_name or "")
        for topic_id, term in _topic_ids_for_texts([text], config).items():
            occurrence_topics[occurrence_key].add(topic_id)
            matched_terms.setdefault((occurrence_key, topic_id), term)

    category_counts: Counter[str] = Counter()
    category_negative_counts: Counter[str] = Counter()
    for occurrence in meta.values():
        category_counts[occurrence.category] += 1
        if occurrence.sentiment == "negative":
            category_negative_counts[occurrence.category] += 1

    topics_by_id = {topic.id: topic for topic in config.topics}
    groups: dict[tuple[str, str], PainGroup] = {}
    for occurrence_id, topic_ids in occurrence_topics.items():
        matched_occurrence = meta.get(occurrence_id)
        if matched_occurrence is None:
            continue
        for topic_id in topic_ids:
            topic = topics_by_id[topic_id]
            key = (matched_occurrence.category, topic_id)
            group = groups.setdefault(
                key,
                PainGroup(
                    category=matched_occurrence.category,
                    topic_id=topic.id,
                    topic_label=topic.label,
                    owner_domain=topic.owner_domain,
                    strategic_relevance=topic.strategic_relevance,
                ),
            )
            group.valid_mentions += 1
            if matched_occurrence.sentiment == "negative":
                group.negative_mentions += 1
            if len(group.samples) < config.thresholds.formal_insight_min_samples:
                group.samples.append(
                    {
                        "occurrence_id": occurrence_id,
                        "document_id": matched_occurrence.document_id,
                        "sentiment": matched_occurrence.sentiment,
                        "matched_term": matched_terms.get((occurrence_id, topic_id), ""),
                        "evidence": matched_occurrence.evidence_text,
                        "url": matched_occurrence.url,
                    }
                )

    max_by_category: Counter[str] = Counter()
    for group in groups.values():
        max_by_category[group.category] = max(max_by_category[group.category], group.valid_mentions)

    rows: list[dict[str, Any]] = []
    for group in groups.values():
        category_total = category_counts[group.category]
        category_negative_rate = (
            category_negative_counts[group.category] / category_total if category_total else 0.0
        )
        negative_rate = group.negative_mentions / group.valid_mentions if group.valid_mentions else 0.0
        negative_lift = negative_rate - category_negative_rate
        volume_score = group.valid_mentions / max_by_category[group.category]
        negative_lift_score = max(0.0, min(1.0, negative_lift / max(1.0 - category_negative_rate, 0.01)))
        evidence_confidence = min(
            1.0,
            len(group.samples) / max(config.thresholds.formal_insight_min_samples, 1),
        )
        priority_score = (
            volume_score * 0.25
            + negative_lift_score * 0.25
            + 0.5 * 0.20
            + min(group.strategic_relevance, 1.0) * 0.20
            + evidence_confidence * 0.10
        )
        if group.category in blocked_categories:
            readiness = "blocked_by_query_noise"
        elif group.valid_mentions < config.thresholds.weak_signal_min_mentions:
            readiness = "weak_signal"
        elif group.valid_mentions < config.thresholds.formal_insight_min_samples:
            readiness = "ready_for_review"
        else:
            readiness = "ready_for_action"
        rows.append(
            {
                "category": group.category,
                "topic_id": group.topic_id,
                "topic_label": group.topic_label,
                "owner_domain": group.owner_domain,
                "valid_mentions": group.valid_mentions,
                "negative_mentions": group.negative_mentions,
                "negative_rate": negative_rate,
                "category_negative_rate": category_negative_rate,
                "negative_lift": negative_lift,
                "priority_score": priority_score,
                "evidence_count": len(group.samples),
                "readiness": readiness,
                "evidence_samples_json": _json_text(group.samples),
            }
        )
    rows.sort(key=lambda row: (-float(row["priority_score"]), row["category"], row["topic_id"]))
    mart_db.executemany(
        """
        INSERT INTO mart_product_pain_radar VALUES (
            :category, :topic_id, :topic_label, :owner_domain, :valid_mentions,
            :negative_mentions, :negative_rate, :category_negative_rate,
            :negative_lift, :priority_score, :evidence_count, :readiness,
            :evidence_samples_json
        )
        """,
        rows,
    )
    return rows


def _build_category_health_weekly(
    mart_db: sqlite3.Connection,
    meta: dict[str, OccurrenceMeta],
) -> list[dict[str, Any]]:
    groups: dict[tuple[str, str], dict[str, Any]] = {}
    for occurrence in meta.values():
        key = (occurrence.category, occurrence.week_start)
        group = groups.setdefault(
            key,
            {
                "category": occurrence.category,
                "week_start": occurrence.week_start,
                "occurrences": 0,
                "documents": set(),
                "positive_mentions": 0,
                "neutral_mentions": 0,
                "negative_mentions": 0,
                "unknown_mentions": 0,
                "source_type_mix": Counter(),
            },
        )
        group["occurrences"] += 1
        group["documents"].add(occurrence.document_id)
        sentiment_key = f"{occurrence.sentiment}_mentions"
        if sentiment_key not in group:
            sentiment_key = "unknown_mentions"
        group[sentiment_key] += 1
        group["source_type_mix"][occurrence.source_type or "unknown"] += 1

    rows: list[dict[str, Any]] = []
    for group in groups.values():
        rows.append(
            {
                "category": group["category"],
                "week_start": group["week_start"],
                "occurrences": group["occurrences"],
                "unique_documents": len(group["documents"]),
                "positive_mentions": group["positive_mentions"],
                "neutral_mentions": group["neutral_mentions"],
                "negative_mentions": group["negative_mentions"],
                "unknown_mentions": group["unknown_mentions"],
                "negative_rate": group["negative_mentions"] / group["occurrences"]
                if group["occurrences"]
                else 0.0,
                "source_type_mix_json": _json_text(group["source_type_mix"].most_common()),
            }
        )
    rows.sort(key=lambda row: (row["category"], row["week_start"]))
    mart_db.executemany(
        """
        INSERT INTO mart_category_health_weekly VALUES (
            :category, :week_start, :occurrences, :unique_documents,
            :positive_mentions, :neutral_mentions, :negative_mentions,
            :unknown_mentions, :negative_rate, :source_type_mix_json
        )
        """,
        rows,
    )
    return rows


ACTION_REGISTER_ROWS = [
    (
        "act-query-update-warmer",
        "",
        "query_update",
        "重写暖奶器 query",
        "Data",
        "Proposed",
        "precision >= 80%; noise term share decreases",
    ),
    (
        "act-pain-radar-pump",
        "",
        "pain_radar",
        "建立吸奶器痛点雷达",
        "Product/Data",
        "Proposed",
        "Top 10 pain points refreshed monthly",
    ),
    (
        "act-competitor-matrix-pump",
        "",
        "competitor_matrix",
        "吸奶器品牌/竞品矩阵",
        "Marketing/Data",
        "Proposed",
        "Each core competitor battlecard shows sample count and weak-signal flag",
    ),
    (
        "act-weekly-brief",
        "",
        "weekly_brief",
        "搭建 weekly VOC brief",
        "Data/Business Leads",
        "Proposed",
        "One-page weekly brief with owner and due date",
    ),
    (
        "act-noise-taxonomy",
        "",
        "noise_taxonomy",
        "建立 query 噪声词库",
        "Data",
        "Proposed",
        "False positives are written back into query quality rules",
    ),
    (
        "act-closed-loop",
        "",
        "closed_loop",
        "建立 closed-loop 机制",
        "Data/PMO",
        "Proposed",
        "Every important VOC insight receives an action_id",
    ),
    (
        "act-feedback-integration",
        "",
        "feedback_integration",
        "补充交易型反馈数据",
        "CX/Data",
        "Proposed",
        "VOC issues align with tickets, returns, and reviews",
    ),
    (
        "act-crisis-thresholds",
        "",
        "crisis_thresholds",
        "建立危机预警阈值",
        "PR/Data",
        "Proposed",
        "Every alert has evidence, severity, and review path",
    ),
]


def _write_action_register(mart_db: sqlite3.Connection, output_dir: Path) -> None:
    mart_db.executemany(
        """
        INSERT INTO fact_action_register(
            action_id, insight_id, action_type, source_action, owner_domain,
            status, expected_metric, baseline_value, target_value, due_date,
            shipped_at, review_date, actual_metric, close_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
        """,
        ACTION_REGISTER_ROWS,
    )
    csv_path = output_dir / "action_register.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "action_id",
                "insight_id",
                "action_type",
                "source_action",
                "owner_domain",
                "status",
                "expected_metric",
                "baseline_value",
                "target_value",
                "due_date",
                "shipped_at",
                "review_date",
                "actual_metric",
                "close_reason",
            ]
        )
        for row in ACTION_REGISTER_ROWS:
            writer.writerow([*row, "", "", "", "", "", "", ""])
    csv_path.chmod(0o600)


def _markdown_table(headers: list[str], rows: list[list[str]]) -> str:
    output = ["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
    output.extend("| " + " | ".join(cell.replace("\n", " ") for cell in row) + " |" for row in rows)
    return "\n".join(output)


def _write_search_quality_report(output_dir: Path, rows: list[dict[str, Any]]) -> None:
    top_rows = rows[:20]
    table_rows = [
        [
            str(row["category"]),
            str(row["search_name"] or row["search_id"]),
            str(row["total_occurrences"]),
            str(row["matched_keyword_rows"]),
            str(row["noise_keyword_rows"]),
            "n/a"
            if row["estimated_precision"] is None
            else f"{float(row['estimated_precision']):.2%}",
            str(row["quality_status"]),
        ]
        for row in top_rows
    ]
    report = [
        "# Search Precision Report",
        "",
        "本报告由 `build-marts` 自动生成，用于判断各 search/query 是否可进入业务洞察。",
        "",
        _markdown_table(
            [
                "Category",
                "Search",
                "Occurrences",
                "Keyword Rows",
                "Noise Rows",
                "Estimated Precision",
                "Status",
            ],
            table_rows,
        ),
        "",
        "规则：precision 低于阈值时标记为 `blocked_by_query_noise`；样本不足时标记为 `weak_signal`。",
        "",
    ]
    path = output_dir / "search_precision_report.md"
    path.write_text("\n".join(report), encoding="utf-8")
    path.chmod(0o600)


def _write_pain_cards(output_dir: Path, rows: list[dict[str, Any]]) -> None:
    table_rows = [
        [
            str(row["category"]),
            str(row["topic_label"]),
            str(row["valid_mentions"]),
            str(row["negative_mentions"]),
            f"{float(row['negative_rate']):.2%}",
            f"{float(row['priority_score']):.3f}",
            str(row["readiness"]),
            str(row["owner_domain"]),
        ]
        for row in rows[:30]
    ]
    report = [
        "# Product Pain Point Cards",
        "",
        "本报告按 playbook 的产品痛点雷达生成，优先展示高优先级、高证据量的问题主题。",
        "",
        _markdown_table(
            [
                "Category",
                "Issue",
                "Valid Mentions",
                "Negative",
                "Negative Rate",
                "Priority",
                "Readiness",
                "Owner",
            ],
            table_rows,
        ),
        "",
    ]
    path = output_dir / "pain_point_cards.md"
    path.write_text("\n".join(report), encoding="utf-8")
    path.chmod(0o600)

    csv_path = output_dir / "pain_point_cards.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()) if rows else ["category"])
        writer.writeheader()
        writer.writerows(rows)
    csv_path.chmod(0o600)


def _write_weekly_brief(
    output_dir: Path,
    health_rows: list[dict[str, Any]],
    pain_rows: list[dict[str, Any]],
    search_rows: list[dict[str, Any]],
) -> None:
    latest_week = max((str(row["week_start"]) for row in health_rows), default="unknown")
    health_latest = [row for row in health_rows if row["week_start"] == latest_week]
    health_table = [
        [
            str(row["category"]),
            str(row["occurrences"]),
            str(row["unique_documents"]),
            f"{float(row['negative_rate']):.2%}",
        ]
        for row in health_latest
    ]
    pain_table = [
        [
            str(row["category"]),
            str(row["topic_label"]),
            str(row["valid_mentions"]),
            f"{float(row['priority_score']):.3f}",
            str(row["readiness"]),
        ]
        for row in pain_rows[:10]
    ]
    blocked = [row for row in search_rows if row["quality_status"] == "blocked_by_query_noise"]
    search_table = [
        [
            str(row["category"]),
            str(row["search_name"] or row["search_id"]),
            "n/a"
            if row["estimated_precision"] is None
            else f"{float(row['estimated_precision']):.2%}",
            str(row["quality_status"]),
        ]
        for row in (blocked or search_rows[:10])[:10]
    ]
    report = [
        "# Weekly VOC Brief",
        "",
        f"生成时间：{datetime.now(timezone.utc).isoformat()}",
        f"最新周：{latest_week}",
        "",
        "## 数据质量",
        "",
        _markdown_table(["Category", "Search", "Estimated Precision", "Status"], search_table),
        "",
        "## 品类健康",
        "",
        _markdown_table(["Category", "Occurrences", "Unique Docs", "Negative Rate"], health_table),
        "",
        "## Top Pain Signals",
        "",
        _markdown_table(["Category", "Issue", "Mentions", "Priority", "Readiness"], pain_table),
        "",
        "## Action Loop",
        "",
        "初始 action register 已生成到 `action_register.csv`，后续洞察应写回 owner、due date 和复盘指标。",
        "",
    ]
    path = output_dir / "weekly_voc_brief.md"
    path.write_text("\n".join(report), encoding="utf-8")
    path.chmod(0o600)


def _write_manifest(
    output_dir: Path,
    inventory: dict[str, Any],
    config: InsightConfig,
    counts: dict[str, int],
) -> None:
    manifest = {
        "status": "PASS",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_count": inventory["source_count"],
        "document_count": inventory["document_count"],
        "taxonomy_versions": {
            "topics": config.topic_version,
            "brands": config.brand_version,
            "query_noise": config.query_noise_version,
            "thresholds": config.threshold_version,
        },
        "counts": counts,
        "outputs": [
            "voc_mart.sqlite",
            "search_precision_report.md",
            "pain_point_cards.md",
            "pain_point_cards.csv",
            "weekly_voc_brief.md",
            "action_register.csv",
        ],
    }
    path = output_dir / "mart_manifest.json"
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    path.chmod(0o600)


def _build_mart_outputs(
    stage_db_path: Path,
    output_dir: Path,
    inventory: dict[str, Any],
    insight_config: InsightConfig,
) -> None:
    mart_path = output_dir / "voc_mart.sqlite"
    with sqlite3.connect(stage_db_path) as stage_db, sqlite3.connect(mart_path) as mart_db:
        _create_mart_schema(mart_db)
        meta = _load_occurrence_meta(stage_db)
        search_rows = _build_search_quality(stage_db, mart_db, meta, insight_config)
        blocked_categories = {
            str(row["category"])
            for row in search_rows
            if row["quality_status"] == "blocked_by_query_noise"
        }
        pain_rows = _build_product_pain_radar(
            stage_db,
            mart_db,
            meta,
            insight_config,
            blocked_categories,
        )
        health_rows = _build_category_health_weekly(mart_db, meta)
        _write_action_register(mart_db, output_dir)
        mart_db.commit()

    _write_search_quality_report(output_dir, search_rows)
    _write_pain_cards(output_dir, pain_rows)
    _write_weekly_brief(output_dir, health_rows, pain_rows, search_rows)
    _write_manifest(
        output_dir,
        inventory,
        insight_config,
        {
            "mart_search_quality": len(search_rows),
            "mart_product_pain_radar": len(pain_rows),
            "mart_category_health_weekly": len(health_rows),
            "fact_action_register": len(ACTION_REGISTER_ROWS),
        },
    )
    mart_path.chmod(0o600)


def build_marts(
    config_path: Path | str,
    output_dir: Path | str,
    insights_config_dir: Path | str = "config/insights",
) -> Path:
    source_config = load_source_config(config_path)
    final = Path(output_dir).resolve()
    final.parent.mkdir(parents=True, exist_ok=True)
    if final.exists():
        raise FileExistsError(f"output directory already exists: {final}")
    build_dir = Path(tempfile.mkdtemp(prefix=f".{final.name}.building-", dir=final.parent))
    os.chmod(build_dir, 0o700)
    stage_db_path = build_dir / "stage.sqlite"
    try:
        inventory = build_inventory(source_config)
        write_inventory(inventory, build_dir / "source_inventory.json")
        stage_sources(source_config, stage_db_path)
        build_canonical(stage_db_path)
        insight_config = load_insight_config(insights_config_dir)
        _build_mart_outputs(stage_db_path, build_dir, inventory, insight_config)
        stage_db_path.unlink()
        os.replace(build_dir, final)
        os.chmod(final, 0o700)
        return final
    except Exception:
        failed = build_dir.with_name(build_dir.name.replace(".building-", ".failed-"))
        if build_dir.exists():
            shutil.move(str(build_dir), str(failed))
        raise

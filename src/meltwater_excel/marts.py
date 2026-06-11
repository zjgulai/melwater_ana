from __future__ import annotations

import csv
import hashlib
import json
import os
import shutil
import sqlite3
import tempfile
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from .canonical import build_canonical
from .inventory import build_inventory, load_source_config, write_inventory
from .staging import stage_sources
from .taxonomy import (
    BrandRule,
    InsightConfig,
    contains_term,
    is_noise_match,
    load_insight_config,
    normalize_text,
    topic_matches,
)


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


ACTION_STATUSES = ("Proposed", "Accepted", "In Progress", "Shipped", "Measured", "Closed", "Rejected")
ACTION_TERMINAL_STATUSES = {"Closed", "Rejected"}
ACTION_ACTIVE_STATUSES = {"Proposed", "Accepted", "In Progress"}
ACTION_STATUS_ALIASES = {
    "proposed": "Proposed",
    "accepted": "Accepted",
    "in progress": "In Progress",
    "in_progress": "In Progress",
    "shipped": "Shipped",
    "measured": "Measured",
    "closed": "Closed",
    "rejected": "Rejected",
}
ACTION_FEEDBACK_EDITABLE_FIELDS = {
    "owner_domain",
    "owner_name",
    "status",
    "expected_metric",
    "baseline_value",
    "target_value",
    "due_date",
    "shipped_at",
    "review_date",
    "actual_metric",
    "close_reason",
}
ACTION_REGISTER_FIELDS = [
    "action_id",
    "insight_id",
    "action_type",
    "source_action",
    "owner_domain",
    "owner_name",
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


def _parse_date(value: str) -> str:
    if not value:
        return "unknown"
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        return "unknown"


def _parse_month(value: str) -> str:
    day = _parse_date(value)
    return "unknown" if day == "unknown" else day[:7]


def _readiness(count: int, threshold: int, blocked: bool = False) -> str:
    if blocked:
        return "blocked_by_query_noise"
    if count < threshold:
        return "weak_signal"
    return "ready_for_review"


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

        CREATE TABLE mart_competitor_battlecard(
            category TEXT NOT NULL,
            brand_id TEXT NOT NULL,
            brand_label TEXT NOT NULL,
            brand_role TEXT NOT NULL,
            valid_mentions INTEGER NOT NULL,
            positive_mentions INTEGER NOT NULL,
            neutral_mentions INTEGER NOT NULL,
            negative_mentions INTEGER NOT NULL,
            negative_rate REAL NOT NULL,
            top_topics_json TEXT NOT NULL,
            evidence_samples_json TEXT NOT NULL,
            readiness TEXT NOT NULL,
            PRIMARY KEY(category, brand_id)
        );

        CREATE TABLE mart_content_opportunity(
            category TEXT NOT NULL,
            source_type TEXT NOT NULL,
            topic_id TEXT NOT NULL,
            topic_label TEXT NOT NULL,
            positive_mentions INTEGER NOT NULL,
            total_mentions INTEGER NOT NULL,
            positive_rate REAL NOT NULL,
            top_terms_json TEXT NOT NULL,
            evidence_samples_json TEXT NOT NULL,
            readiness TEXT NOT NULL,
            PRIMARY KEY(category, source_type, topic_id)
        );

        CREATE TABLE mart_crisis_watch_daily(
            category TEXT NOT NULL,
            day TEXT NOT NULL,
            occurrences INTEGER NOT NULL,
            negative_mentions INTEGER NOT NULL,
            negative_rate REAL NOT NULL,
            alert_level TEXT NOT NULL,
            source_type_mix_json TEXT NOT NULL,
            negative_samples_json TEXT NOT NULL,
            PRIMARY KEY(category, day)
        );

        CREATE TABLE mart_region_language_priority(
            category TEXT NOT NULL,
            language_code TEXT NOT NULL,
            country_code TEXT NOT NULL,
            country_known INTEGER NOT NULL,
            mentions INTEGER NOT NULL,
            positive_mentions INTEGER NOT NULL,
            negative_mentions INTEGER NOT NULL,
            negative_rate REAL NOT NULL,
            readiness TEXT NOT NULL,
            PRIMARY KEY(category, language_code, country_code)
        );

        CREATE TABLE mart_concept_candidates(
            category TEXT NOT NULL,
            topic_id TEXT NOT NULL,
            topic_label TEXT NOT NULL,
            evidence_mentions INTEGER NOT NULL,
            negative_mentions INTEGER NOT NULL,
            concept_score REAL NOT NULL,
            suggested_test TEXT NOT NULL,
            readiness TEXT NOT NULL,
            evidence_samples_json TEXT NOT NULL,
            PRIMARY KEY(category, topic_id)
        );

        CREATE TABLE mart_executive_monthly(
            month TEXT NOT NULL,
            category TEXT NOT NULL,
            occurrences INTEGER NOT NULL,
            unique_documents INTEGER NOT NULL,
            negative_mentions INTEGER NOT NULL,
            negative_rate REAL NOT NULL,
            blocked_search_count INTEGER NOT NULL,
            ready_action_count INTEGER NOT NULL,
            top_pain_json TEXT NOT NULL,
            PRIMARY KEY(month, category)
        );

        CREATE TABLE mart_query_rewrite_recommendation(
            category TEXT NOT NULL,
            search_id TEXT NOT NULL,
            search_name TEXT NOT NULL,
            current_precision REAL,
            top_noise_terms_json TEXT NOT NULL,
            must_include_terms_json TEXT NOT NULL,
            exclude_terms_json TEXT NOT NULL,
            watch_terms_json TEXT NOT NULL,
            sample_noise_examples_json TEXT NOT NULL,
            expected_precision_lift REAL NOT NULL,
            PRIMARY KEY(category, search_id, search_name)
        );

        CREATE TABLE fact_insight(
            insight_id TEXT PRIMARY KEY,
            play_id TEXT NOT NULL,
            category TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            period TEXT NOT NULL,
            readiness TEXT NOT NULL,
            priority_score REAL NOT NULL,
            confidence_score REAL NOT NULL,
            source_table TEXT NOT NULL,
            source_key_json TEXT NOT NULL,
            recommended_action_type TEXT NOT NULL,
            owner_domain TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE fact_evidence_sample(
            sample_id TEXT PRIMARY KEY,
            insight_id TEXT NOT NULL,
            occurrence_id TEXT NOT NULL,
            document_id TEXT NOT NULL,
            evidence_text TEXT NOT NULL,
            url TEXT NOT NULL,
            sentiment TEXT NOT NULL,
            sample_rank INTEGER NOT NULL,
            sample_reason TEXT NOT NULL
        );

        CREATE TABLE fact_sample_review(
            sample_id TEXT PRIMARY KEY,
            review_status TEXT NOT NULL,
            sample_verdict TEXT,
            noise_reason TEXT,
            business_relevance TEXT,
            reviewer TEXT,
            reviewed_at TEXT
        );

        CREATE TABLE fact_query_sample_review(
            sample_id TEXT PRIMARY KEY,
            category TEXT NOT NULL,
            search_id TEXT NOT NULL,
            search_name TEXT NOT NULL,
            occurrence_id TEXT NOT NULL,
            document_id TEXT NOT NULL,
            evidence_text TEXT NOT NULL,
            url TEXT NOT NULL,
            matched_noise TEXT NOT NULL,
            review_status TEXT NOT NULL,
            sample_verdict TEXT,
            noise_reason TEXT,
            reviewer TEXT,
            reviewed_at TEXT
        );

        CREATE TABLE fact_action_register(
            action_id TEXT PRIMARY KEY,
            insight_id TEXT,
            action_type TEXT NOT NULL,
            source_action TEXT NOT NULL,
            owner_domain TEXT NOT NULL,
            owner_name TEXT,
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

        CREATE TABLE mart_action_status_summary(
            owner_domain TEXT NOT NULL,
            owner_name TEXT NOT NULL,
            status TEXT NOT NULL,
            action_count INTEGER NOT NULL,
            overdue_count INTEGER NOT NULL,
            due_next_7d_count INTEGER NOT NULL,
            measured_count INTEGER NOT NULL,
            closed_count INTEGER NOT NULL,
            rejected_count INTEGER NOT NULL,
            PRIMARY KEY(owner_domain, owner_name, status)
        );

        CREATE TABLE fact_action_feedback_unmatched(
            action_id TEXT PRIMARY KEY,
            reason TEXT NOT NULL,
            payload_json TEXT NOT NULL
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
        if len(group.samples) < config.thresholds.search_sample_min:
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
            if len(group.noise_samples) < config.thresholds.search_sample_min:
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


def _brand_match(brand: BrandRule, texts: list[str]) -> str | None:
    for text in texts:
        for alias in brand.aliases:
            if contains_term(text, alias):
                return alias
    return None


def _build_competitor_battlecards(
    stage_db: sqlite3.Connection,
    mart_db: sqlite3.Connection,
    meta: dict[str, OccurrenceMeta],
    config: InsightConfig,
    blocked_categories: set[str],
) -> list[dict[str, Any]]:
    occurrence_brands: dict[str, set[str]] = defaultdict(set)
    brand_terms: dict[tuple[str, str], str] = {}
    brands_by_id = {brand.id: brand for brand in config.brands}
    brands_by_search_id: dict[str, list[BrandRule]] = defaultdict(list)
    for brand in config.brands:
        for search_id in brand.search_ids:
            brands_by_search_id[str(search_id)].append(brand)

    input_cursor = stage_db.execute(
        """
        SELECT occurrence_id, item_id, item_name
        FROM array_items
        WHERE field_path = 'matched.inputs'
        ORDER BY occurrence_id, ordinal
        """
    )
    for occurrence_id, item_id, item_name in input_cursor:
        occurrence_key = str(occurrence_id)
        for brand in brands_by_search_id.get(str(item_id or ""), []):
            occurrence_brands[occurrence_key].add(brand.id)
            brand_terms[(occurrence_key, brand.id)] = str(item_id or "")
        for brand in config.brands:
            matched = _brand_match(brand, [str(item_name or "")])
            if matched is not None:
                occurrence_brands[occurrence_key].add(brand.id)
                brand_terms.setdefault((occurrence_key, brand.id), matched)

    text_cursor = stage_db.execute(
        """
        SELECT occurrence_id, field_path, item_text, item_name
        FROM array_items
        WHERE field_path IN ('matched.keywords', 'enrichments.keyphrases', 'enrichments.named_entities')
        ORDER BY occurrence_id, field_path, ordinal
        """
    )
    for occurrence_id, _field_path, item_text, item_name in text_cursor:
        occurrence_key = str(occurrence_id)
        text = str(item_text or item_name or "")
        for brand in config.brands:
            matched = _brand_match(brand, [text])
            if matched is not None:
                occurrence_brands[occurrence_key].add(brand.id)
                brand_terms.setdefault((occurrence_key, brand.id), matched)

    for occurrence_id, occurrence in meta.items():
        for brand in config.brands:
            matched = _brand_match(brand, [occurrence.match_text])
            if matched is not None:
                occurrence_brands[occurrence_id].add(brand.id)
                brand_terms.setdefault((occurrence_id, brand.id), matched)

    groups: dict[tuple[str, str], dict[str, Any]] = {}
    for occurrence_id, brand_ids in occurrence_brands.items():
        brand_occurrence = meta.get(occurrence_id)
        if brand_occurrence is None:
            continue
        for brand_id in brand_ids:
            brand = brands_by_id[brand_id]
            key = (brand_occurrence.category, brand_id)
            group = groups.setdefault(
                key,
                {
                    "category": brand_occurrence.category,
                    "brand_id": brand.id,
                    "brand_label": brand.label,
                    "brand_role": brand.role,
                    "mentions": 0,
                    "positive": 0,
                    "neutral": 0,
                    "negative": 0,
                    "topics": Counter(),
                    "samples": [],
                },
            )
            group["mentions"] += 1
            if brand_occurrence.sentiment == "positive":
                group["positive"] += 1
            elif brand_occurrence.sentiment == "negative":
                group["negative"] += 1
            else:
                group["neutral"] += 1
            for topic in config.topics:
                if topic_matches(topic, [brand_occurrence.match_text]):
                    group["topics"][topic.label] += 1
            if len(group["samples"]) < config.thresholds.competitor_min_samples:
                group["samples"].append(
                    {
                        "occurrence_id": occurrence_id,
                        "document_id": brand_occurrence.document_id,
                        "matched_brand_term": brand_terms.get((occurrence_id, brand_id), ""),
                        "sentiment": brand_occurrence.sentiment,
                        "evidence": brand_occurrence.evidence_text,
                        "url": brand_occurrence.url,
                    }
                )

    rows: list[dict[str, Any]] = []
    for group in groups.values():
        mentions = int(group["mentions"])
        rows.append(
            {
                "category": group["category"],
                "brand_id": group["brand_id"],
                "brand_label": group["brand_label"],
                "brand_role": group["brand_role"],
                "valid_mentions": mentions,
                "positive_mentions": group["positive"],
                "neutral_mentions": group["neutral"],
                "negative_mentions": group["negative"],
                "negative_rate": group["negative"] / mentions if mentions else 0.0,
                "top_topics_json": _json_text(group["topics"].most_common(10)),
                "evidence_samples_json": _json_text(group["samples"]),
                "readiness": _readiness(
                    mentions,
                    config.thresholds.competitor_min_samples,
                    group["category"] in blocked_categories,
                ),
            }
        )
    rows.sort(key=lambda row: (-int(row["valid_mentions"]), row["category"], row["brand_id"]))
    mart_db.executemany(
        """
        INSERT INTO mart_competitor_battlecard VALUES (
            :category, :brand_id, :brand_label, :brand_role, :valid_mentions,
            :positive_mentions, :neutral_mentions, :negative_mentions, :negative_rate,
            :top_topics_json, :evidence_samples_json, :readiness
        )
        """,
        rows,
    )
    return rows


def _build_content_opportunities(
    stage_db: sqlite3.Connection,
    mart_db: sqlite3.Connection,
    meta: dict[str, OccurrenceMeta],
    config: InsightConfig,
    blocked_categories: set[str],
) -> list[dict[str, Any]]:
    occurrence_topics: dict[str, dict[str, Counter[str]]] = defaultdict(lambda: defaultdict(Counter))
    text_cursor = stage_db.execute(
        """
        SELECT occurrence_id, field_path, item_text, item_name
        FROM array_items
        WHERE field_path IN ('matched.keywords', 'enrichments.keyphrases', 'content.hashtags')
        ORDER BY occurrence_id, field_path, ordinal
        """
    )
    for occurrence_id, _field_path, item_text, item_name in text_cursor:
        occurrence_key = str(occurrence_id)
        text = str(item_text or item_name or "")
        for topic in config.topics:
            if topic_matches(topic, [text]):
                occurrence_topics[occurrence_key][topic.id][text] += 1

    groups: dict[tuple[str, str, str], dict[str, Any]] = {}
    topics_by_id = {topic.id: topic for topic in config.topics}
    for occurrence_id, topic_terms in occurrence_topics.items():
        occurrence = meta.get(occurrence_id)
        if occurrence is None:
            continue
        for topic_id, terms in topic_terms.items():
            topic = topics_by_id[topic_id]
            key = (occurrence.category, occurrence.source_type, topic_id)
            group = groups.setdefault(
                key,
                {
                    "category": occurrence.category,
                    "source_type": occurrence.source_type,
                    "topic_id": topic.id,
                    "topic_label": topic.label,
                    "positive": 0,
                    "total": 0,
                    "terms": Counter(),
                    "samples": [],
                },
            )
            group["total"] += 1
            group["terms"].update(terms)
            if occurrence.sentiment == "positive":
                group["positive"] += 1
            if occurrence.sentiment == "positive" and len(group["samples"]) < 10:
                group["samples"].append(
                    {
                        "occurrence_id": occurrence_id,
                        "document_id": occurrence.document_id,
                        "evidence": occurrence.evidence_text,
                        "url": occurrence.url,
                    }
                )

    rows: list[dict[str, Any]] = []
    for group in groups.values():
        total = int(group["total"])
        rows.append(
            {
                "category": group["category"],
                "source_type": group["source_type"],
                "topic_id": group["topic_id"],
                "topic_label": group["topic_label"],
                "positive_mentions": group["positive"],
                "total_mentions": total,
                "positive_rate": group["positive"] / total if total else 0.0,
                "top_terms_json": _json_text(group["terms"].most_common(10)),
                "evidence_samples_json": _json_text(group["samples"]),
                "readiness": _readiness(
                    group["positive"],
                    config.thresholds.formal_insight_min_samples,
                    group["category"] in blocked_categories,
                ),
            }
        )
    rows.sort(key=lambda row: (-int(row["positive_mentions"]), row["category"], row["source_type"]))
    mart_db.executemany(
        """
        INSERT INTO mart_content_opportunity VALUES (
            :category, :source_type, :topic_id, :topic_label, :positive_mentions,
            :total_mentions, :positive_rate, :top_terms_json, :evidence_samples_json,
            :readiness
        )
        """,
        rows,
    )
    return rows


def _build_crisis_watch_daily(
    mart_db: sqlite3.Connection,
    meta: dict[str, OccurrenceMeta],
    blocked_categories: set[str],
) -> list[dict[str, Any]]:
    groups: dict[tuple[str, str], dict[str, Any]] = {}
    for occurrence in meta.values():
        key = (occurrence.category, _parse_date(occurrence.published_date))
        group = groups.setdefault(
            key,
            {
                "category": occurrence.category,
                "day": key[1],
                "occurrences": 0,
                "negative": 0,
                "source_type_mix": Counter(),
                "negative_samples": [],
            },
        )
        group["occurrences"] += 1
        group["source_type_mix"][occurrence.source_type] += 1
        if occurrence.sentiment == "negative":
            group["negative"] += 1
            if len(group["negative_samples"]) < 10:
                group["negative_samples"].append(
                    {
                        "occurrence_id": occurrence.occurrence_id,
                        "document_id": occurrence.document_id,
                        "evidence": occurrence.evidence_text,
                        "url": occurrence.url,
                    }
                )

    rows: list[dict[str, Any]] = []
    for group in groups.values():
        occurrences = int(group["occurrences"])
        negative = int(group["negative"])
        negative_rate = negative / occurrences if occurrences else 0.0
        if str(group["category"]) in blocked_categories:
            alert_level = "data_quality_alert"
        elif negative >= 100 and negative_rate >= 0.2:
            alert_level = "red"
        elif negative >= 20 and negative_rate >= 0.1:
            alert_level = "orange"
        elif negative >= 5 and negative_rate >= 0.05:
            alert_level = "yellow"
        else:
            alert_level = "green"
        rows.append(
            {
                "category": group["category"],
                "day": group["day"],
                "occurrences": occurrences,
                "negative_mentions": negative,
                "negative_rate": negative_rate,
                "alert_level": alert_level,
                "source_type_mix_json": _json_text(group["source_type_mix"].most_common()),
                "negative_samples_json": _json_text(group["negative_samples"]),
            }
        )
    rows.sort(key=lambda row: (row["alert_level"] == "green", -int(row["negative_mentions"])))
    mart_db.executemany(
        """
        INSERT INTO mart_crisis_watch_daily VALUES (
            :category, :day, :occurrences, :negative_mentions, :negative_rate,
            :alert_level, :source_type_mix_json, :negative_samples_json
        )
        """,
        rows,
    )
    return rows


def _build_region_language_priority(
    mart_db: sqlite3.Connection,
    meta: dict[str, OccurrenceMeta],
    blocked_categories: set[str],
) -> list[dict[str, Any]]:
    groups: dict[tuple[str, str, str], dict[str, Any]] = {}
    for occurrence in meta.values():
        key = (occurrence.category, occurrence.language_code, occurrence.country_code)
        group = groups.setdefault(
            key,
            {
                "category": occurrence.category,
                "language_code": occurrence.language_code,
                "country_code": occurrence.country_code,
                "mentions": 0,
                "positive": 0,
                "negative": 0,
            },
        )
        group["mentions"] += 1
        if occurrence.sentiment == "positive":
            group["positive"] += 1
        if occurrence.sentiment == "negative":
            group["negative"] += 1

    rows: list[dict[str, Any]] = []
    for group in groups.values():
        mentions = int(group["mentions"])
        country_known = group["country_code"] not in {"", "unknown", "zz"}
        rows.append(
            {
                "category": group["category"],
                "language_code": group["language_code"],
                "country_code": group["country_code"],
                "country_known": int(country_known),
                "mentions": mentions,
                "positive_mentions": group["positive"],
                "negative_mentions": group["negative"],
                "negative_rate": group["negative"] / mentions if mentions else 0.0,
                "readiness": _readiness(
                    mentions,
                    30,
                    group["category"] in blocked_categories,
                ),
            }
        )
    rows.sort(key=lambda row: (-int(row["mentions"]), row["category"], row["language_code"]))
    mart_db.executemany(
        """
        INSERT INTO mart_region_language_priority VALUES (
            :category, :language_code, :country_code, :country_known, :mentions,
            :positive_mentions, :negative_mentions, :negative_rate, :readiness
        )
        """,
        rows,
    )
    return rows


def _build_concept_candidates(
    mart_db: sqlite3.Connection,
    pain_rows: list[dict[str, Any]],
    config: InsightConfig,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for pain in pain_rows:
        evidence_mentions = int(pain["valid_mentions"])
        negative_mentions = int(pain["negative_mentions"])
        concept_score = min(1.0, float(pain["priority_score"]) + min(negative_mentions / 1000, 0.2))
        if pain["readiness"] == "blocked_by_query_noise":
            readiness = "blocked_by_query_noise"
        elif evidence_mentions < config.thresholds.concept_min_samples:
            readiness = "weak_signal"
        else:
            readiness = "ready_for_review"
        rows.append(
            {
                "category": pain["category"],
                "topic_id": pain["topic_id"],
                "topic_label": pain["topic_label"],
                "evidence_mentions": evidence_mentions,
                "negative_mentions": negative_mentions,
                "concept_score": concept_score,
                "suggested_test": "Create concept card and validate with VOC samples plus review/CS data.",
                "readiness": readiness,
                "evidence_samples_json": pain["evidence_samples_json"],
            }
        )
    rows.sort(key=lambda row: (-float(row["concept_score"]), row["category"], row["topic_id"]))
    mart_db.executemany(
        """
        INSERT INTO mart_concept_candidates VALUES (
            :category, :topic_id, :topic_label, :evidence_mentions,
            :negative_mentions, :concept_score, :suggested_test,
            :readiness, :evidence_samples_json
        )
        """,
        rows,
    )
    return rows


def _build_executive_monthly(
    mart_db: sqlite3.Connection,
    meta: dict[str, OccurrenceMeta],
    search_rows: list[dict[str, Any]],
    pain_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    blocked_by_category = Counter(
        str(row["category"]) for row in search_rows if row["quality_status"] == "blocked_by_query_noise"
    )
    ready_by_category = Counter(
        str(row["category"]) for row in pain_rows if row["readiness"] == "ready_for_action"
    )
    pain_by_category: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in pain_rows:
        pain_by_category[str(row["category"])].append(
            {
                "topic": row["topic_label"],
                "mentions": row["valid_mentions"],
                "readiness": row["readiness"],
            }
        )

    groups: dict[tuple[str, str], dict[str, Any]] = {}
    for occurrence in meta.values():
        key = (_parse_month(occurrence.published_date), occurrence.category)
        group = groups.setdefault(
            key,
            {
                "month": key[0],
                "category": occurrence.category,
                "occurrences": 0,
                "documents": set(),
                "negative": 0,
            },
        )
        group["occurrences"] += 1
        group["documents"].add(occurrence.document_id)
        if occurrence.sentiment == "negative":
            group["negative"] += 1

    rows: list[dict[str, Any]] = []
    for group in groups.values():
        occurrences = int(group["occurrences"])
        category = str(group["category"])
        rows.append(
            {
                "month": group["month"],
                "category": category,
                "occurrences": occurrences,
                "unique_documents": len(group["documents"]),
                "negative_mentions": group["negative"],
                "negative_rate": group["negative"] / occurrences if occurrences else 0.0,
                "blocked_search_count": blocked_by_category[category],
                "ready_action_count": ready_by_category[category],
                "top_pain_json": _json_text(pain_by_category[category][:5]),
            }
        )
    rows.sort(key=lambda row: (row["month"], row["category"]))
    mart_db.executemany(
        """
        INSERT INTO mart_executive_monthly VALUES (
            :month, :category, :occurrences, :unique_documents,
            :negative_mentions, :negative_rate, :blocked_search_count,
            :ready_action_count, :top_pain_json
        )
        """,
        rows,
    )
    return rows


def _stable_id(prefix: str, *parts: object) -> str:
    payload = json.dumps(parts, ensure_ascii=False, sort_keys=True, default=str)
    return f"{prefix}-{hashlib.sha256(payload.encode('utf-8')).hexdigest()[:16]}"


def _write_dict_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    path.chmod(0o600)


def _sample_rows_from_json(
    insight_id: str,
    samples_json: str,
    sample_reason: str,
    max_samples: int = 20,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    try:
        samples = json.loads(samples_json)
    except json.JSONDecodeError:
        samples = []
    if not isinstance(samples, list):
        return rows
    for rank, sample in enumerate(samples[:max_samples], start=1):
        if not isinstance(sample, dict):
            continue
        occurrence_id = str(sample.get("occurrence_id") or "")
        if not occurrence_id:
            continue
        rows.append(
            {
                "sample_id": _stable_id("sample", insight_id, occurrence_id, rank, sample_reason),
                "insight_id": insight_id,
                "occurrence_id": occurrence_id,
                "document_id": str(sample.get("document_id") or ""),
                "evidence_text": _shorten(str(sample.get("evidence") or "")),
                "url": str(sample.get("url") or ""),
                "sentiment": str(sample.get("sentiment") or "unknown"),
                "sample_rank": rank,
                "sample_reason": sample_reason,
            }
        )
    return rows


def _default_due_dates() -> tuple[str, str]:
    today = datetime.now(timezone.utc).date()
    return (today + timedelta(days=14)).isoformat(), (today + timedelta(days=28)).isoformat()


def _normalize_action_status(value: str) -> str:
    normalized = " ".join(value.strip().split())
    if not normalized:
        return ""
    status = ACTION_STATUS_ALIASES.get(normalized.lower(), normalized)
    if status not in ACTION_STATUSES:
        allowed = ", ".join(ACTION_STATUSES)
        raise ValueError(f"unsupported action status {value!r}; allowed values: {allowed}")
    return status


def _load_action_feedback(action_feedback_path: Path | str | None) -> dict[str, dict[str, str]]:
    if action_feedback_path is None:
        return {}
    path = Path(action_feedback_path)
    if not path.exists():
        raise FileNotFoundError(f"action feedback file does not exist: {path}")

    if path.suffix.lower() == ".json":
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, dict) and isinstance(payload.get("actions"), list):
            raw_rows = payload["actions"]
        elif isinstance(payload, list):
            raw_rows = payload
        elif isinstance(payload, dict):
            raw_rows = [{**value, "action_id": action_id} for action_id, value in payload.items() if isinstance(value, dict)]
        else:
            raise ValueError("action feedback JSON must be a list, an object with actions, or an action_id mapping")
    else:
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            raw_rows = list(csv.DictReader(handle))

    feedback: dict[str, dict[str, str]] = {}
    for index, raw_row in enumerate(raw_rows, start=2):
        if not isinstance(raw_row, dict):
            raise ValueError(f"action feedback row {index} must be an object")
        row = {str(key): "" if value is None else str(value).strip() for key, value in raw_row.items()}
        action_id = row.get("action_id", "")
        if not action_id:
            raise ValueError(f"action feedback row {index} is missing action_id")
        if action_id in feedback:
            raise ValueError(f"duplicate action feedback for action_id={action_id}")
        if row.get("status"):
            row["status"] = _normalize_action_status(row["status"])
        feedback[action_id] = row
    return feedback


def _merge_action_feedback(
    action_rows: list[dict[str, Any]],
    feedback_by_action_id: dict[str, dict[str, str]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], int]:
    if not feedback_by_action_id:
        return action_rows, [], 0

    rows_by_action_id = {str(row["action_id"]): row for row in action_rows}
    applied_count = 0
    unmatched_rows: list[dict[str, Any]] = []

    for action_id, feedback in feedback_by_action_id.items():
        action = rows_by_action_id.get(action_id)
        if action is None:
            unmatched_rows.append(
                {
                    "action_id": action_id,
                    "reason": "action_id_not_generated",
                    "payload_json": _json_text(feedback),
                }
            )
            continue
        feedback_insight_id = feedback.get("insight_id", "")
        if feedback_insight_id and feedback_insight_id != action.get("insight_id"):
            raise ValueError(
                "action feedback insight_id mismatch for "
                f"action_id={action_id}: {feedback_insight_id} != {action.get('insight_id')}"
            )
        for field_name in ACTION_FEEDBACK_EDITABLE_FIELDS:
            value = feedback.get(field_name)
            if value is not None and value != "":
                action[field_name] = value
        applied_count += 1

    return action_rows, unmatched_rows, applied_count


def _parse_iso_date(value: Any) -> date | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        try:
            return datetime.strptime(text, "%Y-%m-%d").date()
        except ValueError as exc:
            raise ValueError(f"invalid ISO date value: {text}") from exc


def _build_action_status_summary(action_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    today = datetime.now(timezone.utc).date()
    next_week = today + timedelta(days=7)
    grouped: dict[tuple[str, str, str], dict[str, Any]] = {}
    for row in action_rows:
        owner_domain = str(row.get("owner_domain") or "")
        owner_name = str(row.get("owner_name") or "")
        status = str(row.get("status") or "Proposed")
        key = (owner_domain, owner_name, status)
        summary = grouped.setdefault(
            key,
            {
                "owner_domain": owner_domain,
                "owner_name": owner_name,
                "status": status,
                "action_count": 0,
                "overdue_count": 0,
                "due_next_7d_count": 0,
                "measured_count": 0,
                "closed_count": 0,
                "rejected_count": 0,
            },
        )
        due_date = _parse_iso_date(row.get("due_date"))
        active = status in ACTION_ACTIVE_STATUSES
        measured = status in {"Measured", "Closed"} or bool(str(row.get("actual_metric") or "").strip())
        summary["action_count"] += 1
        summary["overdue_count"] += int(bool(active and due_date and due_date < today))
        summary["due_next_7d_count"] += int(bool(active and due_date and today <= due_date <= next_week))
        summary["measured_count"] += int(measured)
        summary["closed_count"] += int(status == "Closed")
        summary["rejected_count"] += int(status == "Rejected")

    return sorted(
        grouped.values(),
        key=lambda item: (str(item["owner_domain"]), str(item["owner_name"]), str(item["status"])),
    )


def _action_expected_metric(action_type: str) -> str:
    return {
        "query_update": "reviewed precision >= 80%; blocked business conclusions can be re-enabled",
        "product_backlog": "issue negative share or related CS tickets decrease after shipped action",
        "competitor_matrix": "battlecard reviewed and converted into claim/objection handling guidance",
        "content_brief": "content brief shipped and engagement/positive theme lift reviewed",
        "pr_triage": "alert triaged within 24h and 72h review completed",
        "concept_test": "concept card reviewed with VOC samples plus external feedback",
        "executive_decision": "decision owner and next experiment recorded",
    }.get(action_type, "owner reviews insight and records next measurable action")


def _insert_closure_rows(
    mart_db: sqlite3.Connection,
    output_dir: Path,
    insight_rows: list[dict[str, Any]],
    sample_rows: list[dict[str, Any]],
    action_rows: list[dict[str, Any]],
    unmatched_feedback_rows: list[dict[str, Any]],
) -> None:
    mart_db.executemany(
        """
        INSERT INTO fact_insight VALUES (
            :insight_id, :play_id, :category, :entity_type, :entity_id,
            :period, :readiness, :priority_score, :confidence_score,
            :source_table, :source_key_json, :recommended_action_type,
            :owner_domain, :created_at
        )
        """,
        insight_rows,
    )
    if sample_rows:
        mart_db.executemany(
            """
            INSERT INTO fact_evidence_sample VALUES (
                :sample_id, :insight_id, :occurrence_id, :document_id,
                :evidence_text, :url, :sentiment, :sample_rank, :sample_reason
            )
            """,
            sample_rows,
        )
        mart_db.executemany(
            """
            INSERT INTO fact_sample_review(
                sample_id, review_status, sample_verdict, noise_reason,
                business_relevance, reviewer, reviewed_at
            ) VALUES (:sample_id, 'pending', NULL, NULL, NULL, NULL, NULL)
            """,
            sample_rows,
        )
    if action_rows:
        mart_db.executemany(
            """
            INSERT INTO fact_action_register(
                action_id, insight_id, action_type, source_action, owner_domain,
                owner_name, status, expected_metric, baseline_value, target_value, due_date,
                shipped_at, review_date, actual_metric, close_reason
            ) VALUES (
                :action_id, :insight_id, :action_type, :source_action,
                :owner_domain, :owner_name, :status, :expected_metric, :baseline_value,
                :target_value, :due_date, :shipped_at, :review_date, :actual_metric, :close_reason
            )
            """,
            action_rows,
        )
    summary_rows = _build_action_status_summary(action_rows)
    if summary_rows:
        mart_db.executemany(
            """
            INSERT INTO mart_action_status_summary VALUES (
                :owner_domain, :owner_name, :status, :action_count,
                :overdue_count, :due_next_7d_count, :measured_count,
                :closed_count, :rejected_count
            )
            """,
            summary_rows,
        )
    if unmatched_feedback_rows:
        mart_db.executemany(
            """
            INSERT INTO fact_action_feedback_unmatched VALUES (
                :action_id, :reason, :payload_json
            )
            """,
            unmatched_feedback_rows,
        )

    _write_dict_csv(
        output_dir / "insight_register.csv",
        insight_rows,
        [
            "insight_id",
            "play_id",
            "category",
            "entity_type",
            "entity_id",
            "period",
            "readiness",
            "priority_score",
            "confidence_score",
            "source_table",
            "source_key_json",
            "recommended_action_type",
            "owner_domain",
            "created_at",
        ],
    )
    _write_dict_csv(
        output_dir / "sample_review_queue.csv",
        [
            {
                **sample,
                "review_status": "pending",
                "sample_verdict": "",
                "noise_reason": "",
                "business_relevance": "",
                "reviewer": "",
                "reviewed_at": "",
            }
            for sample in sample_rows
        ],
        [
            "sample_id",
            "insight_id",
            "occurrence_id",
            "document_id",
            "evidence_text",
            "url",
            "sentiment",
            "sample_rank",
            "sample_reason",
            "review_status",
            "sample_verdict",
            "noise_reason",
            "business_relevance",
            "reviewer",
            "reviewed_at",
        ],
    )
    _write_dict_csv(
        output_dir / "action_register.csv",
        action_rows,
        ACTION_REGISTER_FIELDS,
    )
    _write_dict_csv(
        output_dir / "action_status_summary.csv",
        summary_rows,
        [
            "owner_domain",
            "owner_name",
            "status",
            "action_count",
            "overdue_count",
            "due_next_7d_count",
            "measured_count",
            "closed_count",
            "rejected_count",
        ],
    )
    _write_dict_csv(
        output_dir / "action_feedback_unmatched.csv",
        unmatched_feedback_rows,
        [
            "action_id",
            "reason",
            "payload_json",
        ],
    )


def _add_insight(
    insight_rows: list[dict[str, Any]],
    sample_rows: list[dict[str, Any]],
    action_rows: list[dict[str, Any]],
    *,
    play_id: str,
    category: str,
    entity_type: str,
    entity_id: str,
    period: str,
    readiness: str,
    priority_score: float,
    confidence_score: float,
    source_table: str,
    source_key: dict[str, Any],
    recommended_action_type: str,
    owner_domain: str,
    samples_json: str = "[]",
    sample_reason: str = "evidence",
    create_action: bool = False,
) -> str:
    insight_id = _stable_id("insight", play_id, category, entity_type, entity_id, period, source_table)
    created_at = datetime.now(timezone.utc).isoformat()
    insight_rows.append(
        {
            "insight_id": insight_id,
            "play_id": play_id,
            "category": category,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "period": period,
            "readiness": readiness,
            "priority_score": priority_score,
            "confidence_score": confidence_score,
            "source_table": source_table,
            "source_key_json": _json_text(source_key),
            "recommended_action_type": recommended_action_type,
            "owner_domain": owner_domain,
            "created_at": created_at,
        }
    )
    sample_rows.extend(_sample_rows_from_json(insight_id, samples_json, sample_reason))
    if create_action:
        due_date, review_date = _default_due_dates()
        action_id = _stable_id("action", insight_id, recommended_action_type)
        action_rows.append(
            {
                "action_id": action_id,
                "insight_id": insight_id,
                "action_type": recommended_action_type,
                "source_action": f"{play_id} {category} {entity_type}:{entity_id}",
                "owner_domain": owner_domain,
                "owner_name": "",
                "status": "Proposed",
                "expected_metric": _action_expected_metric(recommended_action_type),
                "baseline_value": "",
                "target_value": "",
                "due_date": due_date,
                "shipped_at": "",
                "review_date": review_date,
                "actual_metric": "",
                "close_reason": "",
            }
        )
    return insight_id


def _build_query_rewrite_recommendations(
    mart_db: sqlite3.Connection,
    search_rows: list[dict[str, Any]],
    config: InsightConfig,
) -> list[dict[str, Any]]:
    must_include_by_category = {
        "暖奶器": ["bottle", "baby", "milk", "warmer"],
        "消毒器": ["bottle", "baby", "sterilizer", "dryer", "sanitizer"],
        "吸奶器": ["breast", "pump", "pumping"],
    }
    rows: list[dict[str, Any]] = []
    for row in search_rows:
        if row["quality_status"] not in {"blocked_by_query_noise", "review"}:
            continue
        category = str(row["category"])
        top_noise = [str(term) for term, _count in json.loads(str(row["top_noise_terms_json"]))]
        configured_noise = list(config.query_noise.category_noise_terms.get(category, ()))
        exclude_terms = sorted(set(top_noise + configured_noise))
        watch_terms = list(config.query_noise.watch_terms.get(category, ()))
        current_precision = row["estimated_precision"]
        precision_value = float(current_precision) if current_precision is not None else 0.0
        rows.append(
            {
                "category": category,
                "search_id": str(row["search_id"]),
                "search_name": str(row["search_name"]),
                "current_precision": current_precision,
                "top_noise_terms_json": row["top_noise_terms_json"],
                "must_include_terms_json": _json_text(must_include_by_category.get(category, [])),
                "exclude_terms_json": _json_text(exclude_terms),
                "watch_terms_json": _json_text(watch_terms),
                "sample_noise_examples_json": row["noise_samples_json"],
                "expected_precision_lift": max(0.0, min(1.0 - precision_value, float(row["noise_rate"]) * 0.75)),
            }
        )
    if rows:
        mart_db.executemany(
            """
            INSERT INTO mart_query_rewrite_recommendation VALUES (
                :category, :search_id, :search_name, :current_precision,
                :top_noise_terms_json, :must_include_terms_json,
                :exclude_terms_json, :watch_terms_json,
                :sample_noise_examples_json, :expected_precision_lift
            )
            """,
            rows,
        )
    return rows


def _build_query_sample_review_queue(
    mart_db: sqlite3.Connection,
    output_dir: Path,
    search_rows: list[dict[str, Any]],
    meta: dict[str, OccurrenceMeta],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for row in search_rows:
        if row["quality_status"] not in {"blocked_by_query_noise", "review"}:
            continue
        seen: set[str] = set()
        try:
            noise_samples = json.loads(str(row["noise_samples_json"]))
        except json.JSONDecodeError:
            noise_samples = []
        for sample in noise_samples:
            if not isinstance(sample, dict):
                continue
            occurrence_id = str(sample.get("occurrence_id") or "")
            if not occurrence_id or occurrence_id in seen:
                continue
            seen.add(occurrence_id)
            occurrence = meta.get(occurrence_id)
            rows.append(
                {
                    "sample_id": _stable_id("query-sample", row["category"], row["search_id"], occurrence_id),
                    "category": row["category"],
                    "search_id": row["search_id"],
                    "search_name": row["search_name"],
                    "occurrence_id": occurrence_id,
                    "document_id": str(sample.get("document_id") or (occurrence.document_id if occurrence else "")),
                    "evidence_text": _shorten(str(sample.get("evidence") or (occurrence.evidence_text if occurrence else ""))),
                    "url": str(sample.get("url") or (occurrence.url if occurrence else "")),
                    "matched_noise": str(sample.get("matched_noise") or ""),
                    "review_status": "pending",
                    "sample_verdict": "",
                    "noise_reason": "",
                    "reviewer": "",
                    "reviewed_at": "",
                }
            )
        try:
            occurrence_ids = json.loads(str(row["sample_occurrence_ids_json"]))
        except json.JSONDecodeError:
            occurrence_ids = []
        for occurrence_id_raw in occurrence_ids:
            occurrence_id = str(occurrence_id_raw)
            if occurrence_id in seen:
                continue
            seen.add(occurrence_id)
            occurrence = meta.get(occurrence_id)
            if occurrence is None:
                continue
            rows.append(
                {
                    "sample_id": _stable_id("query-sample", row["category"], row["search_id"], occurrence_id),
                    "category": row["category"],
                    "search_id": row["search_id"],
                    "search_name": row["search_name"],
                    "occurrence_id": occurrence_id,
                    "document_id": occurrence.document_id,
                    "evidence_text": occurrence.evidence_text,
                    "url": occurrence.url,
                    "matched_noise": "",
                    "review_status": "pending",
                    "sample_verdict": "",
                    "noise_reason": "",
                    "reviewer": "",
                    "reviewed_at": "",
                }
            )
    if rows:
        mart_db.executemany(
            """
            INSERT INTO fact_query_sample_review VALUES (
                :sample_id, :category, :search_id, :search_name, :occurrence_id,
                :document_id, :evidence_text, :url, :matched_noise,
                :review_status, :sample_verdict, :noise_reason, :reviewer, :reviewed_at
            )
            """,
            rows,
        )
    _write_dict_csv(
        output_dir / "query_sample_review_queue.csv",
        rows,
        [
            "sample_id",
            "category",
            "search_id",
            "search_name",
            "occurrence_id",
            "document_id",
            "evidence_text",
            "url",
            "matched_noise",
            "review_status",
            "sample_verdict",
            "noise_reason",
            "reviewer",
            "reviewed_at",
        ],
    )
    return rows


def _build_insight_closure(
    mart_db: sqlite3.Connection,
    output_dir: Path,
    *,
    action_feedback: dict[str, dict[str, str]],
    search_rows: list[dict[str, Any]],
    pain_rows: list[dict[str, Any]],
    competitor_rows: list[dict[str, Any]],
    content_rows: list[dict[str, Any]],
    crisis_rows: list[dict[str, Any]],
    region_rows: list[dict[str, Any]],
    concept_rows: list[dict[str, Any]],
    executive_rows: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], int]:
    insight_rows: list[dict[str, Any]] = []
    sample_rows: list[dict[str, Any]] = []
    action_rows: list[dict[str, Any]] = []

    for row in search_rows:
        status = str(row["quality_status"])
        _add_insight(
            insight_rows,
            sample_rows,
            action_rows,
            play_id="play_1_search_quality",
            category=str(row["category"]),
            entity_type="search",
            entity_id=str(row["search_id"] or row["search_name"]),
            period="all",
            readiness=status,
            priority_score=float(row["noise_rate"]),
            confidence_score=min(1.0, int(row["total_occurrences"]) / 50),
            source_table="mart_search_quality",
            source_key={"search_id": row["search_id"], "search_name": row["search_name"]},
            recommended_action_type="query_update" if status != "pass" else "monitor",
            owner_domain="Data",
            samples_json=str(row["noise_samples_json"]),
            sample_reason="query_noise",
            create_action=status in {"blocked_by_query_noise", "review"},
        )

    for row in pain_rows:
        readiness = str(row["readiness"])
        _add_insight(
            insight_rows,
            sample_rows,
            action_rows,
            play_id="play_3_product_pain_radar",
            category=str(row["category"]),
            entity_type="topic",
            entity_id=str(row["topic_id"]),
            period="all",
            readiness=readiness,
            priority_score=float(row["priority_score"]),
            confidence_score=min(1.0, int(row["evidence_count"]) / 20),
            source_table="mart_product_pain_radar",
            source_key={"topic_id": row["topic_id"]},
            recommended_action_type="product_backlog",
            owner_domain=str(row["owner_domain"]),
            samples_json=str(row["evidence_samples_json"]),
            sample_reason="product_pain",
            create_action=readiness == "ready_for_action",
        )

    for row in competitor_rows:
        readiness = str(row["readiness"])
        _add_insight(
            insight_rows,
            sample_rows,
            action_rows,
            play_id="play_4_competitor_battlecard",
            category=str(row["category"]),
            entity_type="brand",
            entity_id=str(row["brand_id"]),
            period="all",
            readiness=readiness,
            priority_score=float(row["valid_mentions"]),
            confidence_score=min(1.0, int(row["valid_mentions"]) / 20),
            source_table="mart_competitor_battlecard",
            source_key={"brand_id": row["brand_id"]},
            recommended_action_type="competitor_matrix",
            owner_domain="Marketing/Data",
            samples_json=str(row["evidence_samples_json"]),
            sample_reason="competitor_evidence",
            create_action=readiness == "ready_for_review",
        )

    for row in content_rows:
        readiness = str(row["readiness"])
        _add_insight(
            insight_rows,
            sample_rows,
            action_rows,
            play_id="play_5_content_opportunity",
            category=str(row["category"]),
            entity_type="source_topic",
            entity_id=f"{row['source_type']}:{row['topic_id']}",
            period="all",
            readiness=readiness,
            priority_score=float(row["positive_mentions"]),
            confidence_score=min(1.0, int(row["positive_mentions"]) / 20),
            source_table="mart_content_opportunity",
            source_key={"source_type": row["source_type"], "topic_id": row["topic_id"]},
            recommended_action_type="content_brief",
            owner_domain="Content/Marketing",
            samples_json=str(row["evidence_samples_json"]),
            sample_reason="positive_content",
            create_action=readiness == "ready_for_review",
        )

    for row in crisis_rows:
        alert_level = str(row["alert_level"])
        if alert_level == "green":
            continue
        readiness = "blocked_by_query_noise" if alert_level == "data_quality_alert" else "ready_for_review"
        _add_insight(
            insight_rows,
            sample_rows,
            action_rows,
            play_id="play_6_crisis_watch",
            category=str(row["category"]),
            entity_type="daily_alert",
            entity_id=str(row["day"]),
            period=str(row["day"]),
            readiness=readiness,
            priority_score=float(row["negative_rate"]),
            confidence_score=min(1.0, int(row["negative_mentions"]) / 20),
            source_table="mart_crisis_watch_daily",
            source_key={"day": row["day"], "alert_level": alert_level},
            recommended_action_type="data_quality_triage" if alert_level == "data_quality_alert" else "pr_triage",
            owner_domain="Data" if alert_level == "data_quality_alert" else "PR/CX",
            samples_json=str(row["negative_samples_json"]),
            sample_reason="crisis_negative",
            create_action=alert_level in {"yellow", "orange", "red"},
        )

    for row in region_rows:
        if int(row["mentions"]) < 30:
            continue
        _add_insight(
            insight_rows,
            sample_rows,
            action_rows,
            play_id="play_7_region_language",
            category=str(row["category"]),
            entity_type="language_country",
            entity_id=f"{row['language_code']}:{row['country_code']}",
            period="all",
            readiness=str(row["readiness"]),
            priority_score=float(row["mentions"]),
            confidence_score=1.0 if row["country_known"] else 0.5,
            source_table="mart_region_language_priority",
            source_key={"language_code": row["language_code"], "country_code": row["country_code"]},
            recommended_action_type="localization_review",
            owner_domain="Marketing/Data",
        )

    for row in concept_rows:
        readiness = str(row["readiness"])
        _add_insight(
            insight_rows,
            sample_rows,
            action_rows,
            play_id="play_8_concept_candidates",
            category=str(row["category"]),
            entity_type="topic",
            entity_id=str(row["topic_id"]),
            period="all",
            readiness=readiness,
            priority_score=float(row["concept_score"]),
            confidence_score=min(1.0, int(row["evidence_mentions"]) / 30),
            source_table="mart_concept_candidates",
            source_key={"topic_id": row["topic_id"]},
            recommended_action_type="concept_test",
            owner_domain="Product/Research",
            samples_json=str(row["evidence_samples_json"]),
            sample_reason="concept_candidate",
            create_action=readiness == "ready_for_review",
        )

    latest_month = max((str(row["month"]) for row in executive_rows), default="")
    for row in executive_rows:
        month = str(row["month"])
        _add_insight(
            insight_rows,
            sample_rows,
            action_rows,
            play_id="play_10_executive_monthly",
            category=str(row["category"]),
            entity_type="month",
            entity_id=month,
            period=month,
            readiness="ready_for_review",
            priority_score=float(row["negative_rate"]),
            confidence_score=1.0,
            source_table="mart_executive_monthly",
            source_key={"month": month},
            recommended_action_type="executive_decision",
            owner_domain="Data/Business Leads",
            create_action=month == latest_month,
        )

    action_rows, unmatched_feedback_rows, action_feedback_applied = _merge_action_feedback(action_rows, action_feedback)
    _insert_closure_rows(mart_db, output_dir, insight_rows, sample_rows, action_rows, unmatched_feedback_rows)
    return insight_rows, sample_rows, action_rows, unmatched_feedback_rows, action_feedback_applied


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


def _write_query_rewrite_recommendations(output_dir: Path, rows: list[dict[str, Any]]) -> None:
    table_rows = [
        [
            str(row["category"]),
            str(row["search_name"]),
            "n/a" if row["current_precision"] is None else f"{float(row['current_precision']):.2%}",
            ", ".join(json.loads(str(row["must_include_terms_json"]))),
            ", ".join(json.loads(str(row["exclude_terms_json"]))[:8]),
            f"{float(row['expected_precision_lift']):.2%}",
        ]
        for row in rows
    ]
    report = [
        "# Query Rewrite Recommendations",
        "",
        "本报告只针对 `blocked_by_query_noise` 或 `review` search 输出，供 Meltwater query 配置和复测使用。",
        "",
        _markdown_table(
            [
                "Category",
                "Search",
                "Current Precision",
                "Must Include",
                "Suggested Excludes",
                "Expected Lift",
            ],
            table_rows,
        ),
        "",
    ]
    path = output_dir / "query_rewrite_recommendations.md"
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
        "动态 action register 已生成到 `action_register.csv`，后续应写回 owner、due date 和复盘指标。",
        "",
    ]
    path = output_dir / "weekly_voc_brief.md"
    path.write_text("\n".join(report), encoding="utf-8")
    path.chmod(0o600)


def _write_competitor_battlecards(output_dir: Path, rows: list[dict[str, Any]]) -> None:
    table_rows = [
        [
            str(row["category"]),
            str(row["brand_label"]),
            str(row["brand_role"]),
            str(row["valid_mentions"]),
            f"{float(row['negative_rate']):.2%}",
            str(row["readiness"]),
        ]
        for row in rows[:30]
    ]
    path = output_dir / "competitor_battlecards.md"
    path.write_text(
        "\n".join(
            [
                "# Competitor Battlecards",
                "",
                "按品牌/竞品聚合有效提及、情感和样本门槛；样本不足或 query 未达标时不可解释为市场份额。",
                "",
                _markdown_table(
                    ["Category", "Brand", "Role", "Mentions", "Negative Rate", "Readiness"],
                    table_rows,
                ),
                "",
            ]
        ),
        encoding="utf-8",
    )
    path.chmod(0o600)


def _write_content_opportunities(output_dir: Path, rows: list[dict[str, Any]]) -> None:
    table_rows = [
        [
            str(row["category"]),
            str(row["source_type"]),
            str(row["topic_label"]),
            str(row["positive_mentions"]),
            f"{float(row['positive_rate']):.2%}",
            str(row["readiness"]),
        ]
        for row in rows[:30]
    ]
    path = output_dir / "content_opportunities.md"
    path.write_text(
        "\n".join(
            [
                "# Content Opportunities",
                "",
                "按平台/渠道和主题沉淀可进入内容 brief 的正向机会。",
                "",
                _markdown_table(
                    ["Category", "Source Type", "Topic", "Positive", "Positive Rate", "Readiness"],
                    table_rows,
                ),
                "",
            ]
        ),
        encoding="utf-8",
    )
    path.chmod(0o600)


def _write_crisis_watch(output_dir: Path, rows: list[dict[str, Any]]) -> None:
    table_rows = [
        [
            str(row["category"]),
            str(row["day"]),
            str(row["occurrences"]),
            str(row["negative_mentions"]),
            f"{float(row['negative_rate']):.2%}",
            str(row["alert_level"]),
        ]
        for row in rows[:30]
    ]
    path = output_dir / "crisis_watch_daily.md"
    path.write_text(
        "\n".join(
            [
                "# Crisis Watch Daily",
                "",
                "按日监控负面集中度和预警等级；每个非 green 事件应进入 PR/CX triage。",
                "",
                _markdown_table(
                    ["Category", "Day", "Occurrences", "Negative", "Negative Rate", "Alert"],
                    table_rows,
                ),
                "",
            ]
        ),
        encoding="utf-8",
    )
    path.chmod(0o600)


def _write_region_language_priority(output_dir: Path, rows: list[dict[str, Any]]) -> None:
    table_rows = [
        [
            str(row["category"]),
            str(row["language_code"]),
            str(row["country_code"]),
            "yes" if row["country_known"] else "no",
            str(row["mentions"]),
            f"{float(row['negative_rate']):.2%}",
            str(row["readiness"]),
        ]
        for row in rows[:30]
    ]
    path = output_dir / "region_language_priority.md"
    path.write_text(
        "\n".join(
            [
                "# Region And Language Priority",
                "",
                "`country_known=no` 的行只能做语言和内容线索，不能直接做地域市场结论。",
                "",
                _markdown_table(
                    ["Category", "Language", "Country", "Country Known", "Mentions", "Negative Rate", "Readiness"],
                    table_rows,
                ),
                "",
            ]
        ),
        encoding="utf-8",
    )
    path.chmod(0o600)


def _write_concept_candidates(output_dir: Path, rows: list[dict[str, Any]]) -> None:
    table_rows = [
        [
            str(row["category"]),
            str(row["topic_label"]),
            str(row["evidence_mentions"]),
            str(row["negative_mentions"]),
            f"{float(row['concept_score']):.3f}",
            str(row["readiness"]),
        ]
        for row in rows[:30]
    ]
    path = output_dir / "concept_candidates.md"
    path.write_text(
        "\n".join(
            [
                "# Concept Candidates",
                "",
                "从痛点雷达反向生成产品共创/概念验证候选，仍需评论、客服和退货数据交叉验证。",
                "",
                _markdown_table(
                    ["Category", "Concept Theme", "Evidence", "Negative", "Score", "Readiness"],
                    table_rows,
                ),
                "",
            ]
        ),
        encoding="utf-8",
    )
    path.chmod(0o600)


def _write_executive_monthly(output_dir: Path, rows: list[dict[str, Any]]) -> None:
    table_rows = [
        [
            str(row["month"]),
            str(row["category"]),
            str(row["occurrences"]),
            f"{float(row['negative_rate']):.2%}",
            str(row["blocked_search_count"]),
            str(row["ready_action_count"]),
        ]
        for row in rows[-30:]
    ]
    path = output_dir / "executive_monthly_brief.md"
    path.write_text(
        "\n".join(
            [
                "# Executive Monthly Brief",
                "",
                "管理层月会入口：先看数据质量阻断，再看可行动洞察和待关闭 action。",
                "",
                _markdown_table(
                    ["Month", "Category", "Occurrences", "Negative Rate", "Blocked Searches", "Ready Actions"],
                    table_rows,
                ),
                "",
            ]
        ),
        encoding="utf-8",
    )
    path.chmod(0o600)


def _write_action_closed_loop_summary(
    output_dir: Path,
    action_rows: list[dict[str, Any]],
    summary_rows: list[dict[str, Any]],
    unmatched_feedback_rows: list[dict[str, Any]],
    action_feedback_applied: int,
) -> None:
    status_counts = Counter(str(row.get("status") or "Proposed") for row in action_rows)
    total_actions = len(action_rows)
    measured_actions = sum(
        1
        for row in action_rows
        if str(row.get("status") or "") in {"Measured", "Closed"} or bool(str(row.get("actual_metric") or "").strip())
    )
    terminal_actions = sum(1 for row in action_rows if str(row.get("status") or "") in ACTION_TERMINAL_STATUSES)
    overdue_actions = sum(int(row["overdue_count"]) for row in summary_rows)
    summary_table = [
        [
            str(row["owner_domain"]),
            str(row["owner_name"] or "-"),
            str(row["status"]),
            str(row["action_count"]),
            str(row["overdue_count"]),
            str(row["due_next_7d_count"]),
            str(row["measured_count"]),
            str(row["closed_count"]),
            str(row["rejected_count"]),
        ]
        for row in summary_rows
    ]
    overdue_table = []
    today = datetime.now(timezone.utc).date()
    for row in action_rows:
        due_date = _parse_iso_date(row.get("due_date"))
        status = str(row.get("status") or "Proposed")
        if status in ACTION_ACTIVE_STATUSES and due_date and due_date < today:
            overdue_table.append(
                [
                    str(row["action_id"]),
                    str(row["owner_domain"]),
                    str(row.get("owner_name") or "-"),
                    status,
                    str(row.get("due_date") or ""),
                    str(row["source_action"]),
                ]
            )
    overdue_table = overdue_table[:20]
    status_line = ", ".join(f"{status}: {status_counts[status]}" for status in ACTION_STATUSES if status_counts[status])
    path = output_dir / "action_closed_loop_summary.md"
    path.write_text(
        "\n".join(
            [
                "# Action Closed-Loop Summary",
                "",
                f"Total actions: {total_actions}",
                f"Feedback rows applied: {action_feedback_applied}",
                f"Unmatched feedback rows: {len(unmatched_feedback_rows)}",
                f"Measured rate: {(measured_actions / total_actions):.2%}" if total_actions else "Measured rate: n/a",
                f"Terminal close/reject rate: {(terminal_actions / total_actions):.2%}"
                if total_actions
                else "Terminal close/reject rate: n/a",
                f"Overdue active actions: {overdue_actions}",
                f"Status mix: {status_line or 'none'}",
                "",
                "## Owner / Status Summary",
                "",
                _markdown_table(
                    [
                        "Owner Domain",
                        "Owner",
                        "Status",
                        "Actions",
                        "Overdue",
                        "Due Next 7d",
                        "Measured",
                        "Closed",
                        "Rejected",
                    ],
                    summary_table,
                ),
                "",
                "## Overdue Active Actions",
                "",
                _markdown_table(
                    ["Action ID", "Owner Domain", "Owner", "Status", "Due Date", "Source Action"],
                    overdue_table,
                )
                if overdue_table
                else "No overdue active actions.",
                "",
            ]
        ),
        encoding="utf-8",
    )
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
            "query_rewrite_recommendations.md",
            "pain_point_cards.md",
            "pain_point_cards.csv",
            "weekly_voc_brief.md",
            "competitor_battlecards.md",
            "content_opportunities.md",
            "crisis_watch_daily.md",
            "region_language_priority.md",
            "concept_candidates.md",
            "executive_monthly_brief.md",
            "insight_register.csv",
            "sample_review_queue.csv",
            "query_sample_review_queue.csv",
            "action_register.csv",
            "action_status_summary.csv",
            "action_feedback_unmatched.csv",
            "action_closed_loop_summary.md",
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
    action_feedback: dict[str, dict[str, str]],
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
        competitor_rows = _build_competitor_battlecards(
            stage_db,
            mart_db,
            meta,
            insight_config,
            blocked_categories,
        )
        content_rows = _build_content_opportunities(
            stage_db,
            mart_db,
            meta,
            insight_config,
            blocked_categories,
        )
        crisis_rows = _build_crisis_watch_daily(mart_db, meta, blocked_categories)
        region_rows = _build_region_language_priority(mart_db, meta, blocked_categories)
        concept_rows = _build_concept_candidates(mart_db, pain_rows, insight_config)
        executive_rows = _build_executive_monthly(mart_db, meta, search_rows, pain_rows)
        query_rewrite_rows = _build_query_rewrite_recommendations(mart_db, search_rows, insight_config)
        query_sample_rows = _build_query_sample_review_queue(mart_db, output_dir, search_rows, meta)
        insight_rows, sample_rows, action_rows, unmatched_feedback_rows, action_feedback_applied = _build_insight_closure(
            mart_db,
            output_dir,
            action_feedback=action_feedback,
            search_rows=search_rows,
            pain_rows=pain_rows,
            competitor_rows=competitor_rows,
            content_rows=content_rows,
            crisis_rows=crisis_rows,
            region_rows=region_rows,
            concept_rows=concept_rows,
            executive_rows=executive_rows,
        )
        action_summary_rows = _build_action_status_summary(action_rows)
        mart_db.commit()

    _write_search_quality_report(output_dir, search_rows)
    _write_query_rewrite_recommendations(output_dir, query_rewrite_rows)
    _write_pain_cards(output_dir, pain_rows)
    _write_weekly_brief(output_dir, health_rows, pain_rows, search_rows)
    _write_competitor_battlecards(output_dir, competitor_rows)
    _write_content_opportunities(output_dir, content_rows)
    _write_crisis_watch(output_dir, crisis_rows)
    _write_region_language_priority(output_dir, region_rows)
    _write_concept_candidates(output_dir, concept_rows)
    _write_executive_monthly(output_dir, executive_rows)
    _write_action_closed_loop_summary(
        output_dir,
        action_rows,
        action_summary_rows,
        unmatched_feedback_rows,
        action_feedback_applied,
    )
    _write_manifest(
        output_dir,
        inventory,
        insight_config,
        {
            "mart_search_quality": len(search_rows),
            "mart_product_pain_radar": len(pain_rows),
            "mart_category_health_weekly": len(health_rows),
            "mart_competitor_battlecard": len(competitor_rows),
            "mart_content_opportunity": len(content_rows),
            "mart_crisis_watch_daily": len(crisis_rows),
            "mart_region_language_priority": len(region_rows),
            "mart_concept_candidates": len(concept_rows),
            "mart_executive_monthly": len(executive_rows),
            "mart_query_rewrite_recommendation": len(query_rewrite_rows),
            "fact_query_sample_review": len(query_sample_rows),
            "fact_insight": len(insight_rows),
            "fact_evidence_sample": len(sample_rows),
            "fact_sample_review": len(sample_rows),
            "fact_action_register": len(action_rows),
            "mart_action_status_summary": len(action_summary_rows),
            "fact_action_feedback_unmatched": len(unmatched_feedback_rows),
            "action_feedback_applied": action_feedback_applied,
        },
    )
    mart_path.chmod(0o600)


def build_marts(
    config_path: Path | str,
    output_dir: Path | str,
    insights_config_dir: Path | str = "config/insights",
    action_feedback_path: Path | str | None = None,
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
        action_feedback = _load_action_feedback(action_feedback_path)
        _build_mart_outputs(stage_db_path, build_dir, inventory, insight_config, action_feedback)
        stage_db_path.unlink()
        os.replace(build_dir, final)
        os.chmod(final, 0o700)
        return final
    except Exception:
        failed = build_dir.with_name(build_dir.name.replace(".building-", ".failed-"))
        if build_dir.exists():
            shutil.move(str(build_dir), str(failed))
        raise

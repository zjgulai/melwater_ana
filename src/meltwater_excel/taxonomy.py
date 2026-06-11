from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class TopicRule:
    id: str
    label: str
    terms: tuple[str, ...]
    exclude_terms: tuple[str, ...]
    strategic_relevance: float
    owner_domain: str


@dataclass(frozen=True)
class BrandRule:
    id: str
    label: str
    aliases: tuple[str, ...]
    search_ids: tuple[str, ...]
    role: str


@dataclass(frozen=True)
class QueryNoiseRules:
    global_noise_terms: tuple[str, ...]
    category_noise_terms: dict[str, tuple[str, ...]]
    watch_terms: dict[str, tuple[str, ...]]


@dataclass(frozen=True)
class InsightThresholds:
    search_precision_min: float
    search_sample_min: int
    formal_insight_min_samples: int
    product_pain_min_representative_samples: int
    competitor_min_samples: int
    concept_min_samples: int
    weak_signal_min_mentions: int


@dataclass(frozen=True)
class InsightConfig:
    config_dir: Path
    topic_version: int
    brand_version: int
    query_noise_version: int
    threshold_version: int
    topics: tuple[TopicRule, ...]
    brands: tuple[BrandRule, ...]
    query_noise: QueryNoiseRules
    thresholds: InsightThresholds


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _strings(value: object) -> tuple[str, ...]:
    if not isinstance(value, list):
        return ()
    return tuple(str(item).strip() for item in value if str(item).strip())


def _string_tuple_map(value: object) -> dict[str, tuple[str, ...]]:
    if not isinstance(value, dict):
        return {}
    return {str(key): _strings(child) for key, child in value.items()}


def load_insight_config(config_dir: Path | str) -> InsightConfig:
    root = Path(config_dir)
    topics_raw = _load_json(root / "topic_taxonomy.json")
    brands_raw = _load_json(root / "brand_taxonomy.json")
    noise_raw = _load_json(root / "query_noise_rules.json")
    thresholds_raw = _load_json(root / "insight_thresholds.json")

    topics = tuple(
        TopicRule(
            id=str(item["id"]),
            label=str(item.get("label", item["id"])),
            terms=_strings(item.get("terms", [])),
            exclude_terms=_strings(item.get("exclude_terms", [])),
            strategic_relevance=float(item.get("strategic_relevance", 0.5)),
            owner_domain=str(item.get("owner_domain", "Data")),
        )
        for item in topics_raw.get("topics", [])
        if isinstance(item, dict)
    )
    brands = tuple(
        BrandRule(
            id=str(item["id"]),
            label=str(item.get("label", item["id"])),
            aliases=_strings(item.get("aliases", [])),
            search_ids=_strings(item.get("search_ids", [])),
            role=str(item.get("role", "unknown")),
        )
        for item in brands_raw.get("brands", [])
        if isinstance(item, dict)
    )
    thresholds = InsightThresholds(
        search_precision_min=float(thresholds_raw.get("search_precision_min", 0.8)),
        search_sample_min=int(thresholds_raw.get("search_sample_min", 50)),
        formal_insight_min_samples=int(thresholds_raw.get("formal_insight_min_samples", 20)),
        product_pain_min_representative_samples=int(
            thresholds_raw.get("product_pain_min_representative_samples", 5)
        ),
        competitor_min_samples=int(thresholds_raw.get("competitor_min_samples", 20)),
        concept_min_samples=int(thresholds_raw.get("concept_min_samples", 30)),
        weak_signal_min_mentions=int(thresholds_raw.get("weak_signal_min_mentions", 5)),
    )
    return InsightConfig(
        config_dir=root,
        topic_version=int(topics_raw.get("version", 1)),
        brand_version=int(brands_raw.get("version", 1)),
        query_noise_version=int(noise_raw.get("version", 1)),
        threshold_version=int(thresholds_raw.get("version", 1)),
        topics=topics,
        brands=brands,
        query_noise=QueryNoiseRules(
            global_noise_terms=_strings(noise_raw.get("global_noise_terms", [])),
            category_noise_terms=_string_tuple_map(noise_raw.get("category_noise_terms", {})),
            watch_terms=_string_tuple_map(noise_raw.get("watch_terms", {})),
        ),
        thresholds=thresholds,
    )


def normalize_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").casefold()).strip()


def contains_term(text: str, term: str) -> bool:
    normalized = normalize_text(text)
    normalized_term = normalize_text(term)
    if not normalized or not normalized_term:
        return False
    if re.fullmatch(r"[a-z0-9][a-z0-9 _/-]*", normalized_term):
        pattern = rf"(?<![a-z0-9]){re.escape(normalized_term)}(?![a-z0-9])"
        return re.search(pattern, normalized) is not None
    return normalized_term in normalized


def any_term_match(texts: list[str], terms: tuple[str, ...]) -> str | None:
    for text in texts:
        for term in terms:
            if contains_term(text, term):
                return term
    return None


def topic_matches(topic: TopicRule, texts: list[str]) -> str | None:
    if any_term_match(texts, topic.exclude_terms):
        return None
    return any_term_match(texts, topic.terms)


def is_noise_match(category: str, texts: list[str], rules: QueryNoiseRules) -> str | None:
    category_terms = rules.category_noise_terms.get(category, ())
    return any_term_match(texts, rules.global_noise_terms + category_terms)


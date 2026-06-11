from __future__ import annotations

from collections.abc import Mapping
from typing import Any


ARRAY_PATHS = (
    "content.emojis",
    "content.hashtags",
    "content.links",
    "content.mentions",
    "enrichments.keyphrases",
    "enrichments.named_entities",
    "matched.inputs",
    "matched.keywords",
    "source.outlet_types",
)

OBJECT_PATHS = (
    "",
    "author",
    "content",
    "custom",
    "enrichments",
    "enrichments.named_entities[]",
    "location",
    "location.geo",
    "matched",
    "matched.inputs[]",
    "metrics",
    "metrics.engagement",
    "metrics.social_echo",
    "parent",
    "source",
    "source.metrics",
    "thread",
)

OBSERVED_FIELD_PATHS = (
    "author.external_id",
    "author.handle",
    "author.name",
    "author.profile_url",
    "content.body",
    "content.byline",
    "content.emojis",
    "content.emojis[]",
    "content.hashtags",
    "content.hashtags[]",
    "content.image",
    "content.links",
    "content.links[]",
    "content.mentions",
    "content.mentions[]",
    "content.opening_text",
    "content.title",
    "content_type",
    "custom.custom_categories",
    "custom.custom_fields",
    "custom.hidden",
    "custom.tags",
    "custom.visible",
    "enrichments.keyphrases",
    "enrichments.keyphrases[]",
    "enrichments.language_code",
    "enrichments.named_entities",
    "enrichments.named_entities[].name",
    "enrichments.named_entities[].sentiment",
    "enrichments.named_entities[].type",
    "enrichments.sentiment",
    "external_id",
    "id",
    "indexed_date",
    "location.city",
    "location.country_code",
    "location.geo",
    "location.geo.latitude",
    "location.geo.longitude",
    "location.region",
    "location.state",
    "matched.hit_sentence",
    "matched.inputs[].id",
    "matched.inputs[].name",
    "matched.inputs[].type",
    "matched.keywords",
    "matched.keywords[]",
    "metrics.earned_media_value",
    "metrics.editorial_echo",
    "metrics.engagement.comments",
    "metrics.engagement.likes",
    "metrics.engagement.quotes",
    "metrics.engagement.reactions",
    "metrics.engagement.replies",
    "metrics.engagement.reposts",
    "metrics.engagement.shares",
    "metrics.engagement.total",
    "metrics.episode_reach",
    "metrics.estimated_views",
    "metrics.social_echo.facebook",
    "metrics.social_echo.reddit",
    "metrics.social_echo.total",
    "metrics.social_echo.x",
    "metrics.views",
    "parent.url",
    "published_date",
    "source.domain",
    "source.id",
    "source.information_type",
    "source.metrics.ave",
    "source.metrics.national_viewership",
    "source.metrics.reach",
    "source.metrics.reach_desktop",
    "source.metrics.reach_mobile",
    "source.name",
    "source.outlet_types",
    "source.outlet_types[]",
    "source.type",
    "source.url",
    "thread.title",
    "thread.url",
    "url",
)

SCALAR_PATHS = tuple(
    path
    for path in OBSERVED_FIELD_PATHS
    if "[]" not in path and path not in ARRAY_PATHS and path != "location.geo"
)

DATE_PATHS = ("published_date", "indexed_date")
PRECISE_DECIMAL_PATHS = (
    "location.geo.latitude",
    "location.geo.longitude",
    "metrics.earned_media_value",
    "source.metrics.ave",
)
ID_PATHS = (
    "id",
    "external_id",
    "author.external_id",
    "source.id",
)
NUMERIC_PATHS = tuple(
    path
    for path in SCALAR_PATHS
    if path.startswith("metrics.")
    or path.startswith("source.metrics.")
    or path.startswith("location.geo.")
)

ALLOWED_PATHS = set(OBSERVED_FIELD_PATHS) | set(OBJECT_PATHS) | set(ARRAY_PATHS)


def collect_document_paths(value: Any, prefix: str = "") -> set[str]:
    paths: set[str] = set()
    if isinstance(value, Mapping):
        paths.add(prefix)
        for key, child in value.items():
            child_path = f"{prefix}.{key}" if prefix else str(key)
            paths.update(collect_document_paths(child, child_path))
    elif isinstance(value, list):
        paths.add(prefix)
        for child in value:
            item_path = f"{prefix}[]"
            paths.update(collect_document_paths(child, item_path))
    else:
        paths.add(prefix)
    return paths


def validate_document_schema(document: Mapping[str, Any]) -> None:
    unknown = sorted(collect_document_paths(document) - ALLOWED_PATHS)
    if unknown:
        raise ValueError(f"unknown Meltwater schema paths: {', '.join(unknown)}")


def get_path(document: Mapping[str, Any], path: str, missing: Any) -> Any:
    current: Any = document
    for part in path.split("."):
        if not isinstance(current, Mapping) or part not in current:
            return missing
        current = current[part]
    return current


def field_dictionary_rows() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for path in OBJECT_PATHS:
        rows.append({"path": path or "<document_root>", "kind": "object", "target": "Field_Dictionary"})
    for path in sorted(set(OBSERVED_FIELD_PATHS) | set(ARRAY_PATHS)):
        if path in ARRAY_PATHS:
            kind = "array"
            target = "Occurrences + relation workbook"
        elif "[]" in path:
            kind = "array_item_field" if not path.endswith("[]") else "array_item"
            target = "relation workbook"
        else:
            kind = "scalar"
            target = "Mentions / Scalar_Variants"
        rows.append({"path": path, "kind": kind, "target": target})
    return rows

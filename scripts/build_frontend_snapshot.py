"""Build a static frontend data snapshot from the latest VOC marts."""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MART_DIR = ROOT / "data" / "marts" / "20260611"
OUT = ROOT / "outputs" / "prototypes" / "playbook-pain-radar-lab" / "src" / "data" / "vocData.json"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def as_float(value: str, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def as_int(value: str, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def as_percent(value: str, default: float = 0.0) -> float:
    return as_float(str(value or "").rstrip("%"), default * 100) / 100


def parse_search_precision(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    table_re = re.compile(r"^\| (?P<cells>.+) \|$")
    for line in path.read_text(encoding="utf-8").splitlines():
        match = table_re.match(line)
        if not match:
            continue
        cells = [cell.strip() for cell in match.group("cells").split("|")]
        if not cells or cells[0] in {"Category", "---"}:
            continue
        if len(cells) < 7:
            continue
        precision = as_float(cells[5].rstrip("%")) / 100
        rows.append(
            {
                "category": cells[0],
                "search": cells[1],
                "occurrences": as_int(cells[2]),
                "keywordRows": as_int(cells[3]),
                "noiseRows": as_int(cells[4]),
                "precision": precision,
                "status": cells[6],
            }
        )
    return rows


def parse_markdown_table(path: Path) -> list[dict[str, str]]:
    table_rows: list[list[str]] = []
    table_re = re.compile(r"^\| (?P<cells>.+) \|$")
    for line in path.read_text(encoding="utf-8").splitlines():
        match = table_re.match(line)
        if not match:
            continue
        cells = [cell.strip() for cell in match.group("cells").split("|")]
        if cells and not all(set(cell) <= {"-", ":"} for cell in cells):
            table_rows.append(cells)
    if len(table_rows) < 2:
        return []
    headers = table_rows[0]
    return [dict(zip(headers, row, strict=False)) for row in table_rows[1:]]


def parse_evidence(raw: str) -> list[str]:
    return [item["evidence"] for item in parse_evidence_details(raw) if item.get("evidence")]


def parse_evidence_details(raw: str) -> list[dict[str, str]]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if isinstance(parsed, list):
        values: list[dict[str, str]] = []
        for item in parsed[:6]:
            if isinstance(item, dict):
                evidence = item.get("evidence") or item.get("text") or item.get("quote_text")
                values.append(
                    {
                        "evidence": str(evidence or ""),
                        "url": str(item.get("url") or ""),
                        "sentiment": str(item.get("sentiment") or ""),
                        "documentId": str(item.get("document_id") or ""),
                        "occurrenceId": str(item.get("occurrence_id") or ""),
                        "matchedTerm": str(item.get("matched_term") or ""),
                        "reviewStatus": str(item.get("review_status") or "pending"),
                    }
                )
            else:
                values.append(
                    {
                        "evidence": str(item),
                        "url": "",
                        "sentiment": "",
                        "documentId": "",
                        "occurrenceId": "",
                        "matchedTerm": "",
                        "reviewStatus": "pending",
                    }
                )
        return values
    return []


def main() -> None:
    manifest = json.loads((MART_DIR / "mart_manifest.json").read_text(encoding="utf-8"))
    pain_cards = []
    for row in read_csv(MART_DIR / "pain_point_cards.csv"):
        pain_cards.append(
            {
                "category": row["category"],
                "topicId": row["topic_id"],
                "topicLabel": row["topic_label"],
                "ownerDomain": row["owner_domain"],
                "validMentions": as_int(row["valid_mentions"]),
                "negativeMentions": as_int(row["negative_mentions"]),
                "negativeRate": as_float(row["negative_rate"]),
                "categoryNegativeRate": as_float(row["category_negative_rate"]),
                "negativeLift": as_float(row["negative_lift"]),
                "priorityScore": as_float(row["priority_score"]),
                "evidenceCount": as_int(row["evidence_count"]),
                "readiness": row["readiness"],
                "evidenceSamples": parse_evidence(row.get("evidence_samples_json", "")),
                "evidenceDetails": parse_evidence_details(row.get("evidence_samples_json", "")),
            }
        )

    action_register = read_csv(MART_DIR / "action_register.csv")
    action_status = read_csv(MART_DIR / "action_status_summary.csv")
    query_samples = read_csv(MART_DIR / "query_sample_review_queue.csv")
    insights = read_csv(MART_DIR / "insight_register.csv")
    search_quality = parse_search_precision(MART_DIR / "search_precision_report.md")
    competitor_battlecards = [
        {
            "category": row.get("Category", ""),
            "brand": row.get("Brand", ""),
            "role": row.get("Role", ""),
            "mentions": as_int(row.get("Mentions", "")),
            "negativeRate": as_float(row.get("Negative Rate", "").rstrip("%")) / 100,
            "readiness": row.get("Readiness", ""),
        }
        for row in parse_markdown_table(MART_DIR / "competitor_battlecards.md")
    ]
    content_opportunities = [
        {
            "category": row.get("Category", ""),
            "sourceType": row.get("Source Type", ""),
            "topic": row.get("Topic", ""),
            "positive": as_int(row.get("Positive", "")),
            "positiveRate": as_float(row.get("Positive Rate", "").rstrip("%")) / 100,
            "readiness": row.get("Readiness", ""),
        }
        for row in parse_markdown_table(MART_DIR / "content_opportunities.md")
    ]
    concept_candidates = [
        {
            "category": row.get("Category", ""),
            "conceptTheme": row.get("Concept Theme", ""),
            "evidence": as_int(row.get("Evidence", "")),
            "negative": as_int(row.get("Negative", "")),
            "score": as_float(row.get("Score", "")),
            "readiness": row.get("Readiness", ""),
        }
        for row in parse_markdown_table(MART_DIR / "concept_candidates.md")
    ]
    crisis_watch = [
        {
            "category": row.get("Category", ""),
            "day": row.get("Day", ""),
            "occurrences": as_int(row.get("Occurrences", "")),
            "negative": as_int(row.get("Negative", "")),
            "negativeRate": as_percent(row.get("Negative Rate", "")),
            "alert": row.get("Alert", ""),
        }
        for row in parse_markdown_table(MART_DIR / "crisis_watch_daily.md")
    ]
    region_priorities = [
        {
            "category": row.get("Category", ""),
            "language": row.get("Language", ""),
            "country": row.get("Country", ""),
            "countryKnown": row.get("Country Known", ""),
            "mentions": as_int(row.get("Mentions", "")),
            "negativeRate": as_percent(row.get("Negative Rate", "")),
            "readiness": row.get("Readiness", ""),
        }
        for row in parse_markdown_table(MART_DIR / "region_language_priority.md")
    ]
    executive_monthly = [
        {
            "month": row.get("Month", ""),
            "category": row.get("Category", ""),
            "occurrences": as_int(row.get("Occurrences", "")),
            "negativeRate": as_percent(row.get("Negative Rate", "")),
            "blockedSearches": as_int(row.get("Blocked Searches", "")),
            "readyActions": as_int(row.get("Ready Actions", "")),
        }
        for row in parse_markdown_table(MART_DIR / "executive_monthly_brief.md")
    ]
    content_brief_queue = [
        {
            "briefId": row.get("Brief ID", ""),
            "category": row.get("Category", ""),
            "platform": row.get("Platform", ""),
            "topic": row.get("Topic", ""),
            "positive": as_int(row.get("Positive", "")),
            "positiveRate": as_percent(row.get("Positive Rate", "")),
            "quotes": as_int(row.get("Quotes", "")),
            "readiness": row.get("Readiness", ""),
            "suggestedAngle": row.get("Suggested Angle", ""),
        }
        for row in parse_markdown_table(MART_DIR / "content_brief_queue.md")
    ]
    weekly_change_points = [
        {
            "category": row.get("Category", ""),
            "week": row.get("Week", ""),
            "mentions": as_int(row.get("Mentions", "")),
            "wowVolume": as_percent(row.get("WoW Volume", "")),
            "negativeRate": as_percent(row.get("Negative Rate", "")),
            "wowNegative": as_percent(row.get("WoW Negative", "")),
            "level": row.get("Level", ""),
            "reason": row.get("Reason", ""),
        }
        for row in parse_markdown_table(MART_DIR / "weekly_change_points.md")
    ]
    quote_library = [
        {
            "quoteId": row["quote_id"],
            "briefId": row["brief_id"],
            "category": row["category"],
            "sourceType": row["source_type"],
            "topicId": row["topic_id"],
            "topicLabel": row["topic_label"],
            "sentiment": row["sentiment"],
            "occurrenceId": row["occurrence_id"],
            "documentId": row["document_id"],
            "quoteText": row["quote_text"],
            "url": row["url"],
            "usageType": row["usage_type"],
        }
        for row in read_csv(MART_DIR / "user_voice_quote_library.csv")[:120]
    ]

    snapshot = {
        "generatedFrom": str(MART_DIR.relative_to(ROOT)),
        "manifest": manifest,
        "searchQuality": search_quality,
        "painCards": pain_cards,
        "actions": action_register,
        "actionStatusSummary": action_status,
        "querySamples": query_samples[:40],
        "insights": insights[:120],
        "competitorBattlecards": competitor_battlecards,
        "contentOpportunities": content_opportunities,
        "conceptCandidates": concept_candidates,
        "crisisWatch": crisis_watch,
        "regionPriorities": region_priorities,
        "executiveMonthly": executive_monthly,
        "contentBriefQueue": content_brief_queue,
        "weeklyChangePoints": weekly_change_points,
        "quoteLibrary": quote_library,
        "summaries": {
            "blockedSearches": sum(1 for item in search_quality if item["status"] != "pass"),
            "readyPainCards": sum(1 for item in pain_cards if item["readiness"] in {"ready_for_review", "ready_for_action"}),
            "proposedActions": sum(1 for item in action_register if item["status"] == "Proposed"),
            "measuredActions": sum(1 for item in action_register if item.get("actual_metric")),
            "readyCompetitors": sum(1 for item in competitor_battlecards if item["readiness"] == "ready_for_review"),
            "readyContentBriefs": sum(1 for item in content_opportunities if item["readiness"] == "ready_for_review"),
            "readyConcepts": sum(1 for item in concept_candidates if item["readiness"] == "ready_for_review"),
            "crisisAlerts": sum(1 for item in crisis_watch if item["alert"] != "green"),
            "knownRegionRows": sum(1 for item in region_priorities if item["countryKnown"] == "yes"),
            "monthlyRows": len(executive_monthly),
            "quotes": len(quote_library),
        },
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(OUT)


if __name__ == "__main__":
    main()

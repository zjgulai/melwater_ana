# Meltwater VOC Reliability Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前一次性 Meltwater 脚本升级为日期正确、失败关闭、可续跑、可去重、可审计并能安全生成 Excel 的可靠数据管道。

**Architecture:** 保留 `scripts/collect.py` 和 `scripts/analytics.py` 作为兼容入口，将配置、日期、HTTP、Export 协调、暂存、规范化、Excel 和 CLI 拆入 `src/meltwater_voc/`。每次采集由 manifest 驱动，顺序执行 Export 批次，原始数据流式落盘并进入 SQLite 暂存；只有所有批次完成且校验通过后才发布 Excel。

**Tech Stack:** Python 3.12、uv、httpx、ijson、openpyxl、SQLite、pytest、pytest-cov、ruff、mypy

---

## Locked Decisions

1. CLI 的 `--start` 和 `--end` 都是用户可理解的包含日期；调用 Meltwater 时转换为 UTC 半开区间 `[start, end + 1 day)`。
2. `document.id` 是 Mention 主键；命中搜索是多对多关系，跨批重复必须合并匹配信息。
3. 任一批次未完成、失败或数量不一致时，运行非零退出且不发布最终 Excel。
4. 相同品类、搜索集合、日期区间和 schema 版本生成确定性 `run_id`；默认不重复创建 Export。
5. 原始 JSON 是完整事实来源；Excel 是版本化精选视图，不再宣称包含所有 API 字段。
6. 最终 VOC 工作簿不得包含公式；所有外部文本按纯文本写入。
7. 现有两个脚本路径和主要参数继续可用，新增 `--dry-run`、`--resume`、`--force`、`--yes`。
8. 线上 Export 测试永不在 CI 自动执行，只能通过显式环境变量和人工确认运行。

## Target File Structure

```text
meltwater/
├── .env.example
├── .gitignore
├── .python-version
├── Makefile
├── pyproject.toml
├── uv.lock
├── config/
│   └── categories.json
├── src/meltwater_voc/
│   ├── __init__.py
│   ├── api.py
│   ├── cli.py
│   ├── config.py
│   ├── dates.py
│   ├── excel.py
│   ├── exports.py
│   ├── manifest.py
│   ├── normalize.py
│   ├── schema.py
│   └── staging.py
├── scripts/
│   ├── analytics.py
│   └── collect.py
├── tests/
│   ├── fixtures/
│   │   ├── batch_core.json
│   │   ├── batch_secondary.json
│   │   └── formula_text.json
│   ├── integration/
│   │   ├── test_collect_pipeline.py
│   │   └── test_excel_output.py
│   ├── unit/
│   │   ├── test_api.py
│   │   ├── test_config.py
│   │   ├── test_dates.py
│   │   ├── test_exports.py
│   │   ├── test_manifest.py
│   │   ├── test_normalize.py
│   │   └── test_staging.py
│   └── conftest.py
└── docs/
    ├── data-governance.md
    ├── operations-runbook.md
    └── schema-v1.md
```

## Task 0: Immediate Containment

**Files:**
- Modify permissions only: `.env`, `data/`, `exports_20260520/`
- Create outside Git: `exports_20260520/SHA256SUMS`

- [ ] **Step 1: Restrict local secret and data permissions**

Run:

```bash
chmod 600 .env
chmod 700 data exports_20260520
find data exports_20260520 -type d -exec chmod 700 {} +
find data exports_20260520 -type f -exec chmod 600 {} +
```

Expected: `stat -f '%Sp %N' .env exports_20260520` reports `-rw-------` and `drwx------`.

- [ ] **Step 2: Record checksums for the source JSON files**

Run:

```bash
cd exports_20260520
shasum -a 256 *.json > SHA256SUMS
shasum -a 256 -c SHA256SUMS
```

Expected: all four JSON files report `OK`.

- [ ] **Step 3: Rotate the Meltwater API key**

Create a new key in Meltwater, replace only `MELTWATER_API_KEY` in `.env`, revoke the prior key, then run:

```bash
stat -f '%Sp %N' .env
```

Expected: `.env` remains `-rw-------`.

- [ ] **Step 4: Do not commit raw data or secrets**

Run:

```bash
git init
git status --short --ignored
```

Expected: `.env`, `data/`, `exports_20260520/`, JSON and XLSX files appear ignored.

## Task 1: Reproducible Project and Quality Baseline

**Files:**
- Create: `.python-version`
- Create: `.env.example`
- Create: `pyproject.toml`
- Create: `Makefile`
- Create: `src/meltwater_voc/__init__.py`
- Create: `tests/conftest.py`
- Modify: `.gitignore`

- [ ] **Step 1: Create the project metadata**

Create `pyproject.toml` with:

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "meltwater-voc"
version = "0.1.0"
requires-python = ">=3.12,<3.13"
dependencies = [
  "httpx>=0.27,<1",
  "ijson>=3.3,<4",
  "openpyxl>=3.1,<4",
]

[project.optional-dependencies]
dev = [
  "mypy>=1.10,<2",
  "pytest>=8,<10",
  "pytest-cov>=5,<8",
  "ruff>=0.9,<1",
]

[project.scripts]
meltwater-voc = "meltwater_voc.cli:main"

[tool.hatch.build.targets.wheel]
packages = ["src/meltwater_voc"]

[tool.pytest.ini_options]
addopts = "-q --strict-markers --disable-warnings"
testpaths = ["tests"]
markers = ["live: requires explicit live Meltwater access"]

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP", "SIM", "S"]

[tool.mypy]
python_version = "3.12"
strict = true
packages = ["meltwater_voc"]
```

- [ ] **Step 2: Create environment and command helpers**

Create `.python-version`:

```text
3.12
```

Create `.env.example`:

```text
MELTWATER_API_KEY=
MELTWATER_BASE_URL=https://api.meltwater.com
MELTWATER_DOWNLOAD_HOSTS=api.meltwater.com
```

Create `Makefile`:

```make
.PHONY: check test lint type

test:
	uv run pytest

lint:
	uv run ruff check .

type:
	uv run mypy

check: lint type test
```

- [ ] **Step 3: Extend ignore rules**

Ensure `.gitignore` includes:

```gitignore
.env
.venv/
.pytest_cache/
.ruff_cache/
.mypy_cache/
__pycache__/
*.pyc
*.xlsx
*.json
*.sqlite3
*.part
data/
exports_*/
!config/*.json
!tests/fixtures/*.json
!*.md
!docs/**/*.md
```

- [ ] **Step 4: Lock and verify the environment**

Run:

```bash
uv lock
uv sync --extra dev
uv run python --version
uv run python -c "import httpx, ijson, openpyxl"
```

Expected: Python reports 3.12.x and imports exit 0.

- [ ] **Step 5: Commit**

```bash
git add .gitignore .python-version .env.example pyproject.toml uv.lock Makefile src tests
git commit -m "chore: establish reproducible Python project"
```

## Task 2: Date Range and Config Contracts

**Files:**
- Create: `src/meltwater_voc/dates.py`
- Create: `src/meltwater_voc/config.py`
- Create: `tests/unit/test_dates.py`
- Create: `tests/unit/test_config.py`
- Modify: `config/categories.json`

- [ ] **Step 1: Write date contract tests**

Create `tests/unit/test_dates.py`:

```python
from datetime import date

import pytest

from meltwater_voc.dates import DateRange, resolve_date_range


def test_explicit_dates_are_inclusive_for_user_and_exclusive_for_api() -> None:
    result = resolve_date_range(start="2026-06-01", end="2026-06-30", days=None, today=date(2026, 7, 1))

    assert result == DateRange(
        start_inclusive=date(2026, 6, 1),
        end_inclusive=date(2026, 6, 30),
    )
    assert result.api_start == "2026-06-01T00:00:00Z"
    assert result.api_end_exclusive == "2026-07-01T00:00:00Z"
    assert result.day_count == 30


def test_end_only_is_relative_to_end() -> None:
    result = resolve_date_range(start=None, end="2026-02-21", days=30, today=date(2026, 6, 4))
    assert result.start_inclusive == date(2026, 1, 23)
    assert result.end_inclusive == date(2026, 2, 21)


@pytest.mark.parametrize("days", [0, -1])
def test_non_positive_days_are_rejected(days: int) -> None:
    with pytest.raises(ValueError, match="days must be positive"):
        resolve_date_range(start=None, end=None, days=days, today=date(2026, 6, 4))


def test_reversed_range_is_rejected() -> None:
    with pytest.raises(ValueError, match="start must not be after end"):
        resolve_date_range(start="2026-06-30", end="2026-06-01", days=None, today=date(2026, 6, 4))
```

- [ ] **Step 2: Run date tests and confirm failure**

Run:

```bash
uv run pytest tests/unit/test_dates.py
```

Expected: collection fails because `meltwater_voc.dates` does not exist.

- [ ] **Step 3: Implement the date model**

Create `src/meltwater_voc/dates.py`:

```python
from dataclasses import dataclass
from datetime import date, datetime, timedelta


@dataclass(frozen=True)
class DateRange:
    start_inclusive: date
    end_inclusive: date

    @property
    def api_start(self) -> str:
        return f"{self.start_inclusive.isoformat()}T00:00:00Z"

    @property
    def api_end_exclusive(self) -> str:
        return f"{(self.end_inclusive + timedelta(days=1)).isoformat()}T00:00:00Z"

    @property
    def day_count(self) -> int:
        return (self.end_inclusive - self.start_inclusive).days + 1


def parse_date(value: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError(f"invalid date: {value}; expected YYYY-MM-DD") from exc


def resolve_date_range(*, start: str | None, end: str | None, days: int | None, today: date) -> DateRange:
    if days is not None and days <= 0:
        raise ValueError("days must be positive")
    end_date = parse_date(end) if end else today
    start_date = parse_date(start) if start else end_date - timedelta(days=(days or 30) - 1)
    if start_date > end_date:
        raise ValueError("start must not be after end")
    return DateRange(start_inclusive=start_date, end_inclusive=end_date)
```

- [ ] **Step 4: Add strict config validation**

Implement immutable `Category` and `Settings` models in `src/meltwater_voc/config.py`. Validation must reject missing API key for network commands, non-HTTPS base URLs, empty/duplicate search IDs within one category, and missing category descriptions. Derive all search IDs from categories; remove `all_search_ids` from `config/categories.json`.

- [ ] **Step 5: Add config tests**

Tests must prove:

- `test_all_search_ids_are_derived_from_categories`
- `test_duplicate_search_id_inside_category_is_rejected`
- `test_http_base_url_is_rejected`
- `test_help_and_list_do_not_require_api_key`

- [ ] **Step 6: Verify and commit**

Run:

```bash
uv run pytest tests/unit/test_dates.py tests/unit/test_config.py
uv run ruff check src/meltwater_voc/dates.py src/meltwater_voc/config.py tests/unit
git add src/meltwater_voc/dates.py src/meltwater_voc/config.py tests/unit config/categories.json
git commit -m "feat: define date and configuration contracts"
```

Expected: tests and lint pass.

## Task 3: Testable and Resilient HTTP Client

**Files:**
- Create: `src/meltwater_voc/api.py`
- Create: `tests/unit/test_api.py`

- [ ] **Step 1: Write API client failure tests**

Create tests using `httpx.MockTransport` for:

- `test_retries_429_then_returns_success`
- `test_retries_503_then_returns_success`
- `test_does_not_retry_400_or_403`
- `test_non_json_error_body_is_safely_reported`
- `test_timeout_is_raised_as_typed_api_error`
- `test_api_key_is_never_present_in_exception_text`
- `test_download_url_must_be_https_and_allowed_host`

The 429/503 tests must assert exactly three total attempts when the first two fail and the third succeeds.

- [ ] **Step 2: Run API tests and confirm failure**

Run:

```bash
uv run pytest tests/unit/test_api.py
```

Expected: collection fails because `meltwater_voc.api` does not exist.

- [ ] **Step 3: Implement the API client**

Expose this public interface:

- `ApiError(RuntimeError)`: typed, redacted API failure.
- `RetryPolicy(max_attempts: int = 4, base_delay_seconds: float = 1.0)`: immutable retry configuration.
- `MeltwaterClient(api_key, base_url, download_hosts, transport, retry_policy)`: injectable client.
- `MeltwaterClient.request_json(method, path, body) -> dict[str, Any]`: JSON request method.
- `MeltwaterClient.download_to(url, destination_part) -> tuple[int, str]`: returns byte count and SHA-256.

Implementation rules:

- `httpx.Timeout(connect=10, read=60, write=60, pool=10)`.
- Retry only timeout/network failures and HTTP 429/503.
- Honor numeric `Retry-After` when present; otherwise exponential delay capped at 30 seconds.
- Redact API key and truncate response bodies to 300 safe characters.
- Validate download URL scheme and host before sending credentials.
- Stream download to `.part` while calculating SHA-256.

- [ ] **Step 4: Verify and commit**

Run:

```bash
uv run pytest tests/unit/test_api.py
uv run ruff check src/meltwater_voc/api.py tests/unit/test_api.py
uv run mypy
git add src/meltwater_voc/api.py tests/unit/test_api.py
git commit -m "feat: add resilient Meltwater API client"
```

Expected: all API tests pass and no secret appears in captured output.

## Task 4: Manifest and Fail-Closed Export Coordinator

**Files:**
- Create: `src/meltwater_voc/manifest.py`
- Create: `src/meltwater_voc/exports.py`
- Create: `tests/unit/test_manifest.py`
- Create: `tests/unit/test_exports.py`

- [ ] **Step 1: Define manifest state tests**

Tests must cover this state sequence:

```text
PLANNED -> EXPORTING -> DOWNLOADED -> INGESTED -> VALIDATED -> PUBLISHED
```

And these failure states:

```text
RESUMABLE_TIMEOUT
FAILED_INCOMPLETE
FAILED_CANCELLED
FAILED_VALIDATION
```

Required tests:

- `test_same_request_produces_same_run_id`
- `test_changed_dates_or_schema_produce_different_run_id`
- `test_manifest_write_is_atomic`
- `test_published_manifest_cannot_return_to_exporting`

- [ ] **Step 2: Define coordinator behavior tests**

Use a fake `MeltwaterClient`. Required tests:

- `test_batches_are_created_and_completed_sequentially`
- `test_partial_completion_never_publishes`
- `test_incomplete_status_fails_the_run`
- `test_cancelled_status_fails_the_run`
- `test_timeout_records_export_id_and_is_resumable`
- `test_resume_reuses_existing_export_id`
- `test_existing_published_run_requires_force`

- [ ] **Step 3: Implement manifest records**

`RunManifest` must contain:

```python
run_id: str
schema_version: str
category: str
search_ids: list[int]
user_start: str
user_end: str
api_start: str
api_end_exclusive: str
status: str
batches: list[dict[str, object]]
raw_document_count: int
unique_document_count: int
duplicate_document_count: int
outputs: list[dict[str, object]]
```

Write each update to `<manifest>.part`, `fsync`, then `os.replace`.

- [ ] **Step 4: Implement sequential coordination**

`ExportCoordinator.run()` must:

1. Split search IDs into batches of at most five.
2. Process one batch through create, poll, download, ingest before creating the next.
3. Treat only `FINISHED` as success.
4. Treat `INCOMPLETE` and `CANCELLED` as terminal failures.
5. On timeout, save `RESUMABLE_TIMEOUT` and exit without publishing.
6. Verify all expected batches reached `FINISHED` before validation.

- [ ] **Step 5: Verify and commit**

Run:

```bash
uv run pytest tests/unit/test_manifest.py tests/unit/test_exports.py
git add src/meltwater_voc/manifest.py src/meltwater_voc/exports.py tests/unit
git commit -m "feat: coordinate exports with resumable fail-closed manifests"
```

Expected: partial completion test exits through a failure state and publishes no output.

## Task 5: SQLite Staging, Deduplication, and Match Merging

**Files:**
- Create: `src/meltwater_voc/staging.py`
- Create: `tests/fixtures/batch_core.json`
- Create: `tests/fixtures/batch_secondary.json`
- Create: `tests/unit/test_staging.py`

- [ ] **Step 1: Create minimal sanitized overlap fixtures**

`batch_core.json` and `batch_secondary.json` must each contain two documents. Exactly one `document.id` appears in both files; its core record matches two search IDs and its secondary record matches one different search ID. All names, URLs and text must be synthetic.

- [ ] **Step 2: Write staging tests**

Required assertions:

- `test_cross_batch_duplicate_becomes_one_document`
- `test_duplicate_merges_all_matched_inputs`
- `test_duplicate_merges_keywords_without_reordering_existing_values`
- `test_raw_and_unique_counts_are_recorded`
- `test_ingesting_same_batch_twice_is_idempotent`

- [ ] **Step 3: Implement staging schema**

Use SQLite tables:

```sql
CREATE TABLE documents (
    document_id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE document_matches (
    document_id TEXT NOT NULL,
    search_id INTEGER NOT NULL,
    search_name TEXT NOT NULL,
    search_type TEXT NOT NULL,
    PRIMARY KEY (document_id, search_id),
    FOREIGN KEY (document_id) REFERENCES documents(document_id)
);

CREATE TABLE ingest_batches (
    export_id TEXT PRIMARY KEY,
    raw_count INTEGER NOT NULL,
    sha256 TEXT NOT NULL
);
```

Use `ijson.items(file_handle, "documents.item")` to stream documents. When duplicate IDs are encountered, merge `matched.inputs`, `matched.keywords`, and distinct hit sentences before updating `payload_json`.

- [ ] **Step 4: Verify and commit**

Run:

```bash
uv run pytest tests/unit/test_staging.py
git add src/meltwater_voc/staging.py tests/fixtures tests/unit/test_staging.py
git commit -m "feat: stage and merge unique Meltwater mentions"
```

Expected: the two fixture files produce three unique documents and one duplicate count.

## Task 6: Versioned Schema and Normalization

**Files:**
- Create: `src/meltwater_voc/schema.py`
- Create: `src/meltwater_voc/normalize.py`
- Create: `tests/unit/test_normalize.py`
- Create: `docs/schema-v1.md`
- Modify: `docs/Meltwater_API_可用字段清单.md`

- [ ] **Step 1: Write schema consistency tests**

Required tests:

- `test_every_column_has_unique_key_and_header`
- `test_normalized_row_length_matches_schema`
- `test_matched_search_ids_and_names_are_both_preserved`
- `test_named_entity_type_is_preserved`
- `test_missing_numeric_values_remain_none`
- `test_invalid_numeric_values_raise_data_quality_error`

- [ ] **Step 2: Define schema as the single source of truth**

Create immutable `Column` records with `key`, `header`, `width`, and `extractor` fields. Define `SCHEMA_VERSION = "voc-v1"` and build `COLUMNS` from the existing 47 output columns plus `外部ID`、`来源ID`、`命中搜索ID`、`命中搜索类型`.

`COLUMNS` must generate table headers, value extraction, column widths and `docs/schema-v1.md`. Include at minimum the current 47 columns plus `外部ID`、`来源ID`、`命中搜索ID`、`命中搜索类型`.

- [ ] **Step 3: Clarify the field contract**

Update documentation to state:

- Raw JSON preserves the complete Meltwater response.
- VOC Excel is a curated, versioned view.
- Fields not in Excel remain available in raw JSON.
- Schema changes require a new schema version and migration note.

- [ ] **Step 4: Verify and commit**

Run:

```bash
uv run pytest tests/unit/test_normalize.py
uv run python -m meltwater_voc.schema --check-docs
git add src/meltwater_voc/schema.py src/meltwater_voc/normalize.py tests/unit/test_normalize.py docs
git commit -m "feat: define versioned VOC output schema"
```

Expected: generated schema documentation matches committed `docs/schema-v1.md`.

## Task 7: Safe, Streaming, and Validated Excel Output

**Files:**
- Create: `src/meltwater_voc/excel.py`
- Create: `tests/fixtures/formula_text.json`
- Create: `tests/integration/test_excel_output.py`

- [ ] **Step 1: Write formula and workbook tests**

Fixture `formula_text.json` must contain text values beginning with `=`, `+`, `-`, `@`, a normal negative number metric, and leading whitespace before `=`.

Required tests:

- `test_untrusted_text_is_written_as_text_not_formula`
- `test_generated_workbook_contains_zero_formula_nodes`
- `test_all_schema_columns_receive_widths`
- `test_negative_output_contains_only_negative_mentions`
- `test_workbook_row_count_matches_unique_document_count`
- `test_rows_over_excel_limit_are_split_across_sheets`
- `test_failed_validation_does_not_replace_existing_output`

The formula-node assertion must inspect XLSX XML:

```python
from zipfile import ZipFile


def count_formula_nodes(path: Path) -> int:
    with ZipFile(path) as archive:
        return sum(
            archive.read(name).count(b"<f")
            for name in archive.namelist()
            if name.startswith("xl/worksheets/") and name.endswith(".xml")
        )
```

- [ ] **Step 2: Implement safe text conversion**

Expose:

```python
DANGEROUS_FORMULA_PREFIXES = ("=", "+", "-", "@")


def excel_safe_text(value: str) -> str:
    if value.lstrip().startswith(DANGEROUS_FORMULA_PREFIXES):
        return "'" + value
    return value
```

Apply only to text fields. Numeric schema fields remain numeric.

- [ ] **Step 3: Implement streaming writer and validation**

Use openpyxl `Workbook(write_only=True)`. Reuse named styles rather than creating styles per cell. Write to `.part`, close the workbook, validate row count, header count and zero formulas, then atomically replace the final path.

When unique records exceed 1,048,575 data rows, create `VOC_001`, `VOC_002`, and subsequent sheets. Record sheet row counts in the manifest.

- [ ] **Step 4: Verify and commit**

Run:

```bash
uv run pytest tests/integration/test_excel_output.py
git add src/meltwater_voc/excel.py tests/fixtures/formula_text.json tests/integration/test_excel_output.py
git commit -m "feat: generate safe validated VOC workbooks"
```

Expected: formula-node count is 0 for every generated test workbook.

## Task 8: Correct Analytics Semantics

**Files:**
- Create: `src/meltwater_voc/cli.py`
- Create: `tests/integration/test_collect_pipeline.py`
- Modify: `scripts/analytics.py`

- [ ] **Step 1: Write Analytics behavior tests**

Required tests:

- `test_custom_range_uses_derived_day_count`
- `test_single_search_category_reports_unique_voice_volume`
- `test_multi_search_category_labels_sum_as_match_count`
- `test_multi_search_category_does_not_claim_unique_total`
- `test_api_failure_is_reported_as_failure_not_no_data`
- `test_sentiment_categories_close_to_total`

For a multi-search category, the CLI must print a line equivalent to:

```text
搜索命中次数合计: 93,698（可能重复，不代表唯一 Mention 数）
```

It must not label that number as “总声量” or “唯一 Mention” unless configuration supplies a dedicated aggregate search ID.

- [ ] **Step 2: Implement Analytics command**

Use the shared date model and API client. Display positive, negative, neutral, unknown and missing counts. Use a nonzero exit code if any required search request fails.

- [ ] **Step 3: Replace the legacy Analytics script with a wrapper**

`scripts/analytics.py` must contain only:

```python
#!/usr/bin/env python3
from meltwater_voc.cli import main


if __name__ == "__main__":
    raise SystemExit(main(["analytics"]))
```

- [ ] **Step 4: Verify and commit**

Run:

```bash
uv run pytest tests/integration/test_collect_pipeline.py -k analytics
git add src/meltwater_voc/cli.py scripts/analytics.py tests/integration/test_collect_pipeline.py
git commit -m "fix: report honest analytics metrics"
```

Expected: custom range tests use actual inclusive days and multi-search totals carry a duplicate warning.

## Task 9: Collection CLI, Dry Run, Resume, and Quota Guard

**Files:**
- Modify: `src/meltwater_voc/cli.py`
- Modify: `scripts/collect.py`
- Modify: `tests/integration/test_collect_pipeline.py`

- [ ] **Step 1: Write end-to-end offline collection tests**

Required tests:

- `test_dry_run_makes_no_network_requests`
- `test_collect_requires_confirmation_without_yes`
- `test_partial_batch_failure_publishes_no_excel`
- `test_resume_reuses_timed_out_export`
- `test_same_completed_request_is_refused_without_force`
- `test_success_writes_manifest_raw_staging_and_excel`
- `test_manifest_counts_reconcile`

- [ ] **Step 2: Implement collection command output**

Before network access, print:

```text
品类: 吸奶器
用户日期: 2026-06-01 .. 2026-06-30（包含结束日，共 30 天）
API 区间: [2026-06-01T00:00:00Z, 2026-07-01T00:00:00Z)
搜索数: 7
Export 批次数: 2
run_id: 5b74b0f8d652
```

`--dry-run` exits 0 after this plan. Without `--yes`, an interactive terminal requires explicit confirmation. Non-interactive execution without `--yes` exits nonzero before creating an Export.

- [ ] **Step 3: Replace the legacy collection script with a wrapper**

`scripts/collect.py` must contain only:

```python
#!/usr/bin/env python3
from meltwater_voc.cli import main


if __name__ == "__main__":
    raise SystemExit(main(["collect"]))
```

- [ ] **Step 4: Verify and commit**

Run:

```bash
uv run pytest tests/integration/test_collect_pipeline.py
git add src/meltwater_voc/cli.py scripts/collect.py tests/integration/test_collect_pipeline.py
git commit -m "feat: add guarded resumable collection CLI"
```

Expected: partial completion test creates no final XLSX and exits nonzero.

## Task 10: Security, Data Governance, Operations, and CI

**Files:**
- Create: `docs/data-governance.md`
- Create: `docs/operations-runbook.md`
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`
- Modify: `TODO.md`

- [ ] **Step 1: Document data governance**

`docs/data-governance.md` must define:

- API key storage and rotation.
- Directory and file permission requirements.
- VOC data classification.
- Raw and Excel retention periods.
- Rules for sharing, redaction and deletion.
- Incident response for leaked keys or data.

- [ ] **Step 2: Document operations**

`docs/operations-runbook.md` must include exact commands for:

```bash
uv sync --extra dev
uv run meltwater-voc collect --list
uv run meltwater-voc collect 吸奶器 --start 2026-06-01 --end 2026-06-30 --dry-run
RUN_ID="$(uv run meltwater-voc runs --latest-resumable --format id)"
uv run meltwater-voc collect --resume "$RUN_ID"
uv run meltwater-voc analytics --all --days 7
make check
```

It must explain every manifest state and the operator action for `RESUMABLE_TIMEOUT`, `FAILED_INCOMPLETE`, `FAILED_CANCELLED`, and `FAILED_VALIDATION`.

- [ ] **Step 3: Add CI**

Create `.github/workflows/ci.yml` that:

1. Checks out code.
2. Installs uv.
3. Installs Python 3.12 from `.python-version`.
4. Runs `uv sync --locked --extra dev`.
5. Runs `make check`.
6. Scans committed files to reject `.env`, API-key patterns, JSON exports and XLSX files.

- [ ] **Step 4: Update README and operational backlog**

README must remove the “45 个完整字段” claim, explain inclusive CLI dates and exclusive API dates, distinguish unique Mention from search match counts, and link the runbook/schema/governance docs.

Move remaining actionable items from `TODO.md` into dated runbook procedures. The file must no longer contain an unverified “after June 1 execute” instruction.

- [ ] **Step 5: Verify and commit**

Run:

```bash
make check
git status --short --ignored
git add README.md TODO.md docs .github/workflows/ci.yml
git commit -m "docs: add operations governance and CI"
```

Expected: no secret or data artifact is staged.

## Task 11: Repair and Reconcile Historical Outputs

**Files:**
- Read: `exports_20260520/*.json`
- Create: `data/manifests/history-20260220-20260519.json`
- Create: `data/excel_repaired/`
- Create: `docs/history-reconciliation-20260520.md`

- [ ] **Step 1: Verify source checksums**

Run:

```bash
cd exports_20260520
shasum -a 256 -c SHA256SUMS
```

Expected: all source JSON files report `OK`.

- [ ] **Step 2: Import historical JSON without network access**

Run the migration command:

```bash
uv run meltwater-voc migrate-history \
  --category 消毒器=exports_20260520/sterilizer_3months.json \
  --category 暖奶器=exports_20260520/warmer_3months.json \
  --category 吸奶器=exports_20260520/pump_core_3months.json \
  --category 吸奶器=exports_20260520/pump_secondary_3months.json \
  --output data/excel_repaired
```

Expected:

- Raw input rows: 223,415.
- Absorption pump raw rows: 87,514.
- Absorption pump unique Mention count: 87,467.
- Cross-batch duplicates merged: 47.
- Final workbook formula cells: 0.

- [ ] **Step 3: Produce reconciliation report**

`docs/history-reconciliation-20260520.md` must list, for each category:

- Original raw rows.
- Unique Mention rows.
- Duplicate rows.
- Formula-damaged cells in old XLSX.
- Formula cells in repaired XLSX.
- Sentiment counts including unknown and missing.
- API request period and user-facing included dates.
- SHA-256 for repaired outputs.

- [ ] **Step 4: Run final historical validation**

Run:

```bash
uv run meltwater-voc validate-run data/manifests/history-20260220-20260519.json
```

Expected: exit 0 with `VALIDATED`, `formula_cells=0`, and all counts reconciled.

## Task 12: Final Verification and Release Gate

**Files:**
- Verify all project files
- Create release tag only after all checks pass

- [ ] **Step 1: Run the full offline quality gate**

Run:

```bash
uv sync --locked --extra dev
make check
uv run pytest --cov=meltwater_voc --cov-report=term-missing
```

Expected:

- lint exit 0
- mypy exit 0
- pytest exit 0
- branch coverage covers every Export terminal state and all date-validation branches

- [ ] **Step 2: Run data and artifact validation**

Run:

```bash
uv run meltwater-voc validate-run data/manifests/history-20260220-20260519.json
```

Expected:

```text
status=VALIDATED
raw_rows=223415
pump_unique_mentions=87467
pump_cross_batch_duplicates=47
formula_cells=0
```

- [ ] **Step 3: Run one approved live canary**

After explicit owner approval, run one search for one completed UTC day:

```bash
MELTWATER_LIVE_TEST=1 uv run meltwater-voc collect 消毒器 \
  --start 2026-06-01 \
  --end 2026-06-01 \
  --yes
```

Expected:

- exactly one Export batch
- manifest reaches `PUBLISHED`
- request API end is `2026-06-02T00:00:00Z`
- raw count, unique count and Excel row count reconcile
- formula count is 0

- [ ] **Step 4: Perform clean-machine runbook verification**

From a fresh clone without `.env`, run:

```bash
uv sync --locked --extra dev
uv run meltwater-voc collect --list
uv run meltwater-voc collect --help
make check
```

Expected: list/help work without API key; all offline checks pass.

- [ ] **Step 5: Tag the release**

```bash
git status --short
git tag -a v1.0.0-reliable -m "Reliable Meltwater VOC pipeline"
```

Expected: working tree is clean before tagging.

## Acceptance Checklist

- [ ] No final output is published from a partial, incomplete, cancelled or timed-out run.
- [ ] CLI included dates are converted to the correct API-exclusive end.
- [ ] `days <= 0`, invalid dates and reversed ranges fail before network access.
- [ ] Multi-search Analytics never labels a sum of search matches as unique voice volume.
- [ ] Mention deduplication merges all matched search IDs and keywords.
- [ ] Current and repaired workbooks contain zero formulas.
- [ ] Workbook rows, unique Mention count, negative subset and sentiment counts reconcile.
- [ ] Raw files and final outputs have SHA-256 values in the manifest.
- [ ] Repeating a completed request does not create a new Export without `--force`.
- [ ] Timeout runs can resume using the existing Export ID.
- [ ] Secret and data files are user-only.
- [ ] README, schema, runbook and data-governance docs match implemented behavior.
- [ ] Full offline quality gate and approved one-day canary pass.

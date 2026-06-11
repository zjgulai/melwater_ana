# Meltwater Debt Remediation and Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前 Meltwater 数据项目升级为可版本化、可审计、可补采、可生产观测的数据产品，并补齐腾讯云生产状态验证入口。

**Architecture:** 先建立事实源和门禁，不直接重写生产逻辑；再把老采集脚本冻结为兼容入口，把下一轮 API 获取迁移到 manifest 驱动的新采集管线；最后建立腾讯云资源清单、健康检查、监控和发布记录，让生产状态可以由命令验证。

**Tech Stack:** Python 3.12、uv、pytest、ruff、mypy、bandit、ijson、openpyxl、SQLite、httpx、Tencent Cloud CLI 或 COS CLI、Markdown runbooks

---

## Execution Log

- 2026-06-10: Phase 0 已执行。本次新增腾讯云生产资产清单模板、`config/production.example.json`、本地数据 `SHA256SUMS`；收紧历史数据目录权限；冻结旧 `scripts/collect.py` live API 默认路径，要求显式设置 `LEGACY_COLLECT_LIVE=1`；新增 2 个 guard 测试。验证结果：`pytest` 21 passed、Excel validate PASS、`shasum -a 256 -c data/SHA256SUMS` 全部 OK。
- 2026-06-10: Phase 1 质量门禁已落地并通过。本次新增 `Makefile` 与 `docs/runbooks/quality-gates.md`；将 Python 文件规范化为 ruff 可读取状态；修复旧脚本 lint 问题；将 Excel XML 解析切换为 `defusedxml`；收敛 mypy 类型错误；对旧 urllib 调用增加 HTTPS scheme 校验和精确 Bandit 说明。验证结果：`make quality` 通过，包含测试、Excel validate、checksum、ruff、mypy、bandit。
- 2026-06-11: Phase 2 已执行。本次新增 manifest 驱动补采配置、backfill 校验、manifest 模块、live API 客户端、CLI `backfill-plan`/`backfill-run`、目标补采 runbook；真实补采吸奶器次要搜索 `28546470`、`28546475`，生成 Export `17860010`，下载 247 条原始文档；将 `pump_secondary_new` 加入 Excel 来源配置并清空 known gap；重建完整 Excel 包 `data/excel_complete_20260611`。验证结果：新版 Excel validate PASS，`make quality` 全部通过。

## Phase 0: 生产事实源和本地止血

### Task 0.1: 建立生产资产清单模板

**Files:**

- Create: `docs/production/tencent-cloud-inventory.md`
- Create: `config/production.example.json`

- [ ] **Step 1: 创建生产目录**

Run:

```bash
mkdir -p docs/production
```

Expected:

```text
docs/production exists
```

- [ ] **Step 2: 写入 `config/production.example.json`**

Create exact content:

```json
{
  "environment": "production",
  "cloud": "tencent",
  "region": "ap-guangzhou",
  "service_type": "unknown",
  "healthcheck_urls": [],
  "resources": {
    "cvm_instance_ids": [],
    "clb_instance_ids": [],
    "cos_buckets": [],
    "scf_functions": [],
    "tke_clusters": [],
    "cloudbase_environments": []
  },
  "release": {
    "current_version": "",
    "deployed_at": "",
    "source_revision": ""
  },
  "slos": {
    "availability_percent": 99.5,
    "p95_latency_ms": 2000,
    "error_rate_percent": 1.0,
    "data_freshness_hours": 24
  }
}
```

Expected:

```bash
python -m json.tool config/production.example.json >/dev/null
```

passes.

- [ ] **Step 3: 写入 `docs/production/tencent-cloud-inventory.md`**

Create exact sections:

```markdown
# Tencent Cloud Production Inventory

## Required Before Production Audit

- Production domain or healthcheck URL
- Tencent Cloud region
- Service type: CVM, CLB, COS, SCF, TKE, CloudBase, or other
- Resource IDs
- Read-only CAM credential owner
- Current release identifier
- Rollback owner and procedure

## Current Local Finding

The local workspace does not contain Tencent Cloud deployment configuration.
`coscli` is installed, but `coscli ls` returns `secretID is missing`.
`tccli` is not installed in this environment.

## Resource Inventory

| Resource Type | Region | Resource ID | Name | Purpose | Owner | Verification Command |
|---|---|---|---|---|---|---|
| Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown |

## Healthchecks

| Name | URL | Expected Status | Expected Body | Timeout |
|---|---|---:|---|---:|
| Unknown | Unknown | 200 | Unknown | 5s |
```

Expected: file exists and contains `secretID is missing`.

### Task 0.2: 收紧历史数据权限并记录校验

**Files:**

- Modify permissions: `exports_20260520/`
- Create: `exports_20260520/SHA256SUMS`
- Create: `docs/audits/2026-06-10-local-data-permissions.md`

- [ ] **Step 1: 收紧历史目录权限**

Run:

```bash
chmod 700 exports_20260520
find exports_20260520 -type d -exec chmod 700 {} +
find exports_20260520 -type f -exec chmod 600 {} +
```

Expected:

```bash
stat -f '%Sp %N' exports_20260520
```

prints `drwx------ exports_20260520`.

- [ ] **Step 2: 生成历史 JSON 校验和**

Run:

```bash
cd exports_20260520
shasum -a 256 *.json > SHA256SUMS
shasum -a 256 -c SHA256SUMS
```

Expected: all JSON files report `OK`.

- [ ] **Step 3: 写入权限审计记录**

Create `docs/audits/2026-06-10-local-data-permissions.md`:

```markdown
# Local Data Permissions Audit

## Result

- `.env`: 0600
- `data/`: 0700
- `data/excel_complete_20260604/`: 0700
- `exports_20260520/`: 0700
- `exports_20260520/SHA256SUMS`: 0600

## Verification Commands

```bash
stat -f '%Sp %N' .env data data/excel_complete_20260604 exports_20260520
cd exports_20260520 && shasum -a 256 -c SHA256SUMS
```
```

Expected: no raw secret or API key appears in the document.

### Task 0.3: 冻结老采集脚本默认路径

**Files:**

- Modify: `scripts/collect.py`
- Modify: `scripts/analytics.py`
- Create: `tests/test_legacy_scripts_guard.py`

- [ ] **Step 1: 写 failing test，确认旧脚本默认拒绝 live API**

Create `tests/test_legacy_scripts_guard.py`:

```python
import subprocess
import sys


def test_collect_requires_explicit_legacy_live_flag():
    result = subprocess.run(
        [sys.executable, "scripts/collect.py", "--list"],
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0


def test_collect_live_category_requires_legacy_flag():
    result = subprocess.run(
        [sys.executable, "scripts/collect.py", "消毒器", "--days", "1"],
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 2
    assert "LEGACY_COLLECT_LIVE=1" in result.stderr
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
uv run --python 3.12 pytest tests/test_legacy_scripts_guard.py -q
```

Expected: second test fails because current script still allows live execution.

- [ ] **Step 3: Add guard to `scripts/collect.py`**

At the beginning of `main()`, after `args = parser.parse_args()`, insert:

```python
    if not args.list and os.environ.get("LEGACY_COLLECT_LIVE") != "1":
        parser.error(
            "Legacy collect.py is frozen. Set LEGACY_COLLECT_LIVE=1 only after "
            "reading docs/runbooks/json-to-complete-excel.md and confirming that "
            "you are not duplicating already collected Meltwater exports."
        )
```

- [ ] **Step 4: Run tests**

Run:

```bash
uv run --python 3.12 pytest tests/test_legacy_scripts_guard.py -q
uv run --python 3.12 pytest -q
```

Expected: all tests pass.

## Phase 1: 工程门禁和可维护性

### Task 1.1: 建立统一 check 命令

**Files:**

- Create: `Makefile`
- Modify: `pyproject.toml`
- Create: `docs/runbooks/quality-gates.md`

- [ ] **Step 1: Add lint/type/security dependencies**

Modify `pyproject.toml` dev dependency group to:

```toml
[dependency-groups]
dev = [
  "bandit>=1.9.1",
  "mypy>=1.19.0",
  "pytest>=8.4.0",
  "ruff>=0.14.0",
  "types-openpyxl>=3.1.5.20241126"
]
```

Expected: `uv sync --group dev` succeeds.

- [ ] **Step 2: Add tool config**

Append to `pyproject.toml`:

```toml
[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP", "SIM"]

[tool.mypy]
python_version = "3.12"
strict = true
ignore_missing_imports = true
packages = ["meltwater_excel"]
```

- [ ] **Step 3: Create Makefile**

Create exact content:

```make
.PHONY: test lint type security validate check

test:
	uv run --python 3.12 pytest -q

lint:
	uv run --python 3.12 ruff check src scripts tests

type:
	uv run --python 3.12 mypy src/meltwater_excel scripts/json_to_complete_excel.py

security:
	uv run --python 3.12 bandit -q -r src scripts -x .venv,data,exports_20260520

validate:
	uv run --python 3.12 python -m meltwater_excel.cli validate --config config/excel_export_sources.json --output-dir data/excel_complete_20260604

check: test lint type security validate
```

- [ ] **Step 4: Document known initial failures**

Create `docs/runbooks/quality-gates.md`:

```markdown
# Quality Gates

## Commands

```bash
make test
make lint
make type
make security
make validate
make check
```

## Current Debt Baseline

- `make test`: expected pass
- `make validate`: expected pass
- `make lint`: must be made pass before CI is introduced
- `make type`: must be made pass before strict refactors
- `make security`: must either pass or carry documented `# nosec` justifications
```

### Task 1.2: 消除当前静态检查失败

**Files:**

- Modify: `scripts/collect.py`
- Modify: `scripts/analytics.py`
- Modify: `src/meltwater_excel/writer.py`
- Modify: `src/meltwater_excel/checks.py`
- Modify: `src/meltwater_excel/sample_audit.py`

- [ ] **Step 1: Fix ruff errors in old scripts**

Replace one-line `if` and bare `except` in `scripts/collect.py`:

```python
    def s(v):
        if v is None:
            return ""
        if isinstance(v, list):
            return "; ".join(str(x) for x in v if x)
        return str(v).strip()

    def n(v):
        if v is None:
            return ""
        try:
            return float(v)
        except (TypeError, ValueError):
            return str(v)
```

Remove unnecessary `f` prefix from static strings in both old scripts.

- [ ] **Step 2: Fix mypy concrete errors**

In `src/meltwater_excel/writer.py`, guard XML sheet list:

```python
        sheets_node = workbook_root.find("m:sheets", namespace)
        if sheets_node is None:
            raise ValueError("workbook.xml has no sheets node")
        for sheet in sheets_node:
```

In `src/meltwater_excel/sample_audit.py`, annotate:

```python
    actual: dict[str, dict[str, list[tuple[int, str | None]]]] = {
```

In `src/meltwater_excel/checks.py`, cast relation rows before `.items()`:

```python
    relation_rows = dict(summary["relation_rows"])
    for field_path, expected in relation_rows.items():
```

- [ ] **Step 3: Run quality commands**

Run:

```bash
make lint
make type
make test
make validate
```

Expected: all pass.

## Phase 2: 下一轮 API 补采可靠化

### Task 2.1: 新增补采配置，禁止重复拉取已完成来源

**Files:**

- Create: `config/backfill_20260101_20260220_pump_secondary.json`
- Create: `src/meltwater_excel/backfill_config.py`
- Create: `tests/test_backfill_config.py`

- [ ] **Step 1: Create targeted backfill config**

Create:

```json
{
  "run_name": "backfill_20260101_20260220_pump_secondary",
  "category": "吸奶器",
  "search_ids": [28546470, 28546475],
  "start": "2026-01-01T00:00:00Z",
  "end_exclusive": "2026-02-20T00:00:00Z",
  "expected_reason": "Known gap from 2026-06-04 quota exhaustion",
  "forbidden_search_ids": [18922074, 18922087, 18913527, 28546460, 28546462],
  "forbidden_existing_exports": [17774723]
}
```

- [ ] **Step 2: Test that full pump rerun is rejected**

Create test:

```python
from meltwater_excel.backfill_config import validate_targeted_backfill


def test_backfill_rejects_forbidden_search_ids():
    config = {
        "search_ids": [18922074, 28546470],
        "forbidden_search_ids": [18922074],
        "start": "2026-01-01T00:00:00Z",
        "end_exclusive": "2026-02-20T00:00:00Z",
    }
    try:
        validate_targeted_backfill(config)
    except ValueError as exc:
        assert "forbidden search ids" in str(exc)
    else:
        raise AssertionError("expected ValueError")
```

- [ ] **Step 3: Implement validator**

Create function:

```python
def validate_targeted_backfill(config: dict) -> None:
    forbidden = set(config.get("forbidden_search_ids", []))
    selected = set(config.get("search_ids", []))
    overlap = sorted(selected & forbidden)
    if overlap:
        raise ValueError(f"forbidden search ids selected: {overlap}")
    if config["start"] >= config["end_exclusive"]:
        raise ValueError("start must be earlier than end_exclusive")
```

- [ ] **Step 4: Run tests**

Run:

```bash
uv run --python 3.12 pytest tests/test_backfill_config.py -q
```

Expected: pass.

### Task 2.2: 设计 manifest 驱动采集管线

**Files:**

- Create: `src/meltwater_excel/live_api.py`
- Create: `src/meltwater_excel/export_manifest.py`
- Create: `tests/test_export_manifest.py`

- [ ] **Step 1: Define manifest schema**

Create manifest fields:

```python
REQUIRED_MANIFEST_FIELDS = [
    "run_name",
    "category",
    "search_ids",
    "start",
    "end_exclusive",
    "status",
    "exports",
    "created_at",
    "updated_at",
]
```

- [ ] **Step 2: Ensure incomplete runs cannot publish**

Write test:

```python
from meltwater_excel.export_manifest import can_publish


def test_manifest_with_blocked_export_cannot_publish():
    manifest = {
        "status": "PARTIAL_QUOTA_EXHAUSTED",
        "exports": [{"status": "DOWNLOADED"}, {"status": "BLOCKED_QUOTA"}],
    }
    assert can_publish(manifest) is False
```

- [ ] **Step 3: Implement `can_publish`**

```python
def can_publish(manifest: dict) -> bool:
    return manifest.get("status") == "READY_TO_PUBLISH" and all(
        item.get("status") == "DOWNLOADED" for item in manifest.get("exports", [])
    )
```

Expected: test passes.

## Phase 3: 腾讯云生产可观测性

### Task 3.1: 建立只读生产状态检查脚本

**Files:**

- Create: `scripts/tencent_prod_status.py`
- Create: `tests/test_tencent_prod_status.py`

- [ ] **Step 1: Test missing config returns explicit blocked status**

Create test:

```python
from pathlib import Path
from scripts.tencent_prod_status import load_production_config, summarize_status


def test_missing_production_config_is_blocked(tmp_path: Path):
    config = tmp_path / "missing.json"
    result = summarize_status(load_production_config(config))
    assert result["status"] == "BLOCKED"
    assert "production config missing" in result["reasons"]
```

- [ ] **Step 2: Implement missing-config behavior**

Create script:

```python
from __future__ import annotations

import json
from pathlib import Path


def load_production_config(path: Path) -> dict:
    if not path.exists():
        return {"status": "BLOCKED", "reasons": ["production config missing"]}
    return json.loads(path.read_text(encoding="utf-8"))


def summarize_status(config: dict) -> dict:
    if config.get("status") == "BLOCKED":
        return config
    if not config.get("healthcheck_urls"):
        return {"status": "BLOCKED", "reasons": ["healthcheck_urls missing"]}
    return {"status": "READY", "reasons": []}
```

- [ ] **Step 3: Add CLI output**

Append:

```python
if __name__ == "__main__":
    result = summarize_status(load_production_config(Path("config/production.json")))
    print(json.dumps(result, ensure_ascii=False))
```

Expected:

```bash
uv run --python 3.12 python scripts/tencent_prod_status.py
```

prints blocked until real production config exists.

### Task 3.2: 生产状态验收标准

**Files:**

- Create: `docs/production/status-check-runbook.md`

- [ ] **Step 1: Write runbook**

Create:

```markdown
# Tencent Cloud Production Status Check Runbook

## Required Inputs

- `config/production.json`
- Read-only Tencent Cloud credential configured for `tccli` or service-specific CLI
- At least one HTTPS healthcheck URL

## Checks

1. DNS resolves production domain.
2. HTTPS healthcheck returns expected status within 5 seconds.
3. Tencent Cloud resource status is running.
4. Last deployment release matches `config/production.json`.
5. Cloud monitoring has no active P0/P1 alarms.
6. Data freshness is within SLO.

## Result States

- `PASS`: all checks pass.
- `DEGRADED`: healthcheck passes but monitoring or freshness violates SLO.
- `FAIL`: healthcheck fails or resource is not running.
- `BLOCKED`: required production identifiers or credentials are missing.
```

Expected: runbook gives explicit `BLOCKED` state instead of guessing.

## Phase 4: 文档整合

### Task 4.1: 更新 README 为真实入口

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Add current status block at top**

Insert after title:

```markdown
## 当前推荐入口

- 已采集 JSON 到完整 Excel：使用 `scripts/json_to_complete_excel.py`
- 下一轮 API 补采：不要直接运行旧 `scripts/collect.py`；先阅读 `TODO.md` 中的缺口说明
- 生产状态检查：当前缺少 `config/production.json`，状态为 BLOCKED
```

- [ ] **Step 2: Replace “45 列完整字段” claim**

Replace with:

```markdown
旧版 Excel 是兼容视图，不代表完整 API 字段。完整无损数据包位于 `data/excel_complete_20260604/`，字段字典见 `Meltwater_VOC_00_目录与校验.xlsx`。
```

- [ ] **Step 3: Run link and command smoke checks**

Run:

```bash
rg -n "45 列完整字段|python3 scripts/collect.py 吸奶器" README.md
uv run --python 3.12 pytest -q
```

Expected: old unsafe guidance no longer appears; tests pass.

### Task 4.2: 创建项目状态总索引

**Files:**

- Create: `docs/PROJECT_STATUS.md`

- [ ] **Step 1: Write status index**

Create:

```markdown
# Project Status

## Verified Local Artifacts

- `data/excel_complete_20260604/validation_manifest.json`: PASS
- `docs/audits/2026-06-04-json-to-excel-acceptance.md`: final Excel acceptance
- `docs/audits/2026-06-10-debt-and-production-readiness-audit.md`: debt audit

## Known Gaps

- Pump secondary searches `28546470` and `28546475` are missing for `[2026-01-01T00:00:00Z, 2026-02-20T00:00:00Z)`.
- Tencent Cloud production status is BLOCKED until `config/production.json` and read-only cloud access are provided.

## Current Safe Commands

```bash
uv run --python 3.12 pytest -q
uv run --python 3.12 python -m meltwater_excel.cli validate --config config/excel_export_sources.json --output-dir data/excel_complete_20260604
uv run --python 3.12 python -m meltwater_excel.cli sample-audit --config config/excel_export_sources.json --output-dir data/excel_complete_20260604 --samples-per-source 20 --seed 20260604
```
```

Expected: a new engineer can find the current safe path in one document.

## Phase 5: 长期数据资产化

### Task 5.1: 增加非 Excel 资产出口

**Files:**

- Create: `src/meltwater_excel/export_sqlite_package.py`
- Create: `tests/test_export_sqlite_package.py`
- Create: `docs/runbooks/data-assets.md`

- [ ] **Step 1: Define artifact target**

Target file:

```text
data/assets/meltwater_voc_20260604.sqlite
```

Tables:

- `mentions`
- `occurrences`
- `scalar_variants`
- `array_items`
- `sources`
- `known_gaps`

- [ ] **Step 2: Test package can be queried**

Create test:

```python
import sqlite3
from pathlib import Path


def test_sqlite_asset_has_required_tables(tmp_path: Path):
    db_path = tmp_path / "asset.sqlite"
    with sqlite3.connect(db_path) as db:
        db.execute("CREATE TABLE mentions(document_id TEXT PRIMARY KEY)")
    with sqlite3.connect(db_path) as db:
        tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert "mentions" in tables
```

- [ ] **Step 3: Implement after current staging code is generalized**

Use the existing staging schema as the source of truth. Export only after Phase 1 and Phase 2 pass, so this task does not duplicate current Excel-only implementation.

Expected: downstream users can query data without opening multi-sheet Excel.

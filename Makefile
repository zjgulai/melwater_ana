PYTHON ?= 3.12
CONFIG ?= config/excel_export_sources.json
OUTPUT_DIR ?= data/excel_complete_20260611
INSIGHTS_OUTPUT_DIR ?= data/marts/20260611
INSIGHTS_ACTION_FEEDBACK ?=
INSIGHTS_ACTION_FEEDBACK_ARG := $(if $(INSIGHTS_ACTION_FEEDBACK),--action-feedback $(INSIGHTS_ACTION_FEEDBACK),)
STAGE_DB ?= data/stage.sqlite

.PHONY: test validate checksum lint type security insights insights-from-stage quality

test:
	uv run --python $(PYTHON) --group dev pytest -q

validate:
	uv run --python $(PYTHON) python -m meltwater_excel.cli validate --config $(CONFIG) --output-dir $(OUTPUT_DIR)

checksum:
	shasum -a 256 -c data/SHA256SUMS

lint:
	uv run --python $(PYTHON) --group dev python scripts/run_ruff_stdin.py src scripts tests

type:
	uv run --python $(PYTHON) --group dev mypy src/meltwater_excel scripts/json_to_complete_excel.py

security:
	uv run --python $(PYTHON) --group dev bandit -q -r src scripts -x .venv,data,exports_20260520

insights:
	uv run --python $(PYTHON) python -m meltwater_excel.cli build-marts --config $(CONFIG) --output-dir $(INSIGHTS_OUTPUT_DIR) $(INSIGHTS_ACTION_FEEDBACK_ARG)

insights-from-stage:
	uv run --python $(PYTHON) python -m meltwater_excel.cli build-marts-from-stage --config $(CONFIG) --stage-db $(STAGE_DB) --output-dir $(INSIGHTS_OUTPUT_DIR) $(INSIGHTS_ACTION_FEEDBACK_ARG)

quality: test validate checksum lint type security

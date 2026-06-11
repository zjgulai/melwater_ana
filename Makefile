PYTHON ?= 3.12
CONFIG ?= config/excel_export_sources.json
OUTPUT_DIR ?= data/excel_complete_20260611
INSIGHTS_OUTPUT_DIR ?= data/marts/20260611

.PHONY: test validate checksum lint type security insights quality

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
	uv run --python $(PYTHON) python -m meltwater_excel.cli build-marts --config $(CONFIG) --output-dir $(INSIGHTS_OUTPUT_DIR)

quality: test validate checksum lint type security

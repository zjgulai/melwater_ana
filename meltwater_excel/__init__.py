"""Local module shim so `python -m meltwater_excel.cli` resolves the src package."""

from pathlib import Path


__path__ = [str(Path(__file__).resolve().parents[1] / "src" / "meltwater_excel")]

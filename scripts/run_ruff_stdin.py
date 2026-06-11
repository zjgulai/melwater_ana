from __future__ import annotations

import argparse
import subprocess  # nosec B404
import sys
from pathlib import Path


def _iter_python_files(paths: list[Path]) -> list[Path]:
    files: list[Path] = []
    for path in paths:
        if path.is_dir():
            files.extend(sorted(child for child in path.rglob("*.py") if ".venv" not in child.parts))
        elif path.suffix == ".py":
            files.append(path)
    return files


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Run Ruff through stdin for environments where path reads fail."
    )
    parser.add_argument("paths", nargs="+")
    args = parser.parse_args(argv)

    failed = False
    checked = 0
    for path in _iter_python_files([Path(item) for item in args.paths]):
        checked += 1
        source = path.read_text(encoding="utf-8")
        result = subprocess.run(  # nosec B603
            [sys.executable, "-m", "ruff", "check", "--stdin-filename", str(path), "-"],
            input=source,
            text=True,
            capture_output=True,
            check=False,
        )
        if result.returncode != 0 and result.stdout:
            print(result.stdout, end="")
        if result.returncode != 0 and result.stderr:
            print(result.stderr, end="", file=sys.stderr)
        failed = failed or result.returncode != 0
    if not failed:
        print(f"Ruff passed {checked} files.")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

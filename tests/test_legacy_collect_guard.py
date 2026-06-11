import importlib.util
from pathlib import Path

import pytest


def load_collect_module(project_root: Path):
    path = project_root / "scripts" / "collect.py"
    spec = importlib.util.spec_from_file_location("legacy_collect", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_legacy_collect_live_guard_blocks_by_default(project_root: Path):
    collect = load_collect_module(project_root)

    with pytest.raises(SystemExit) as exc:
        collect.require_legacy_live_enabled({})

    assert exc.value.code == collect.LIVE_API_EXIT_CODE


def test_legacy_collect_live_guard_allows_explicit_runtime_flag(project_root: Path):
    collect = load_collect_module(project_root)

    collect.require_legacy_live_enabled({collect.LIVE_API_ENV_VAR: "1"})


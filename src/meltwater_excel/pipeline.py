from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path

from .build_catalog import build_catalog_workbook
from .build_core import build_core_workbook
from .build_relations import build_relation_workbooks
from .canonical import build_canonical
from .checks import validate_package
from .inventory import build_inventory, load_source_config, write_inventory
from .staging import stage_sources


def build_all(config_path: Path | str, output_dir: Path | str) -> Path:
    config = load_source_config(config_path)
    final = Path(output_dir).resolve()
    final.parent.mkdir(parents=True, exist_ok=True)
    if final.exists():
        raise FileExistsError(f"output directory already exists: {final}")
    build_dir = Path(tempfile.mkdtemp(prefix=f".{final.name}.building-", dir=final.parent))
    os.chmod(build_dir, 0o700)
    db_path = build_dir / "stage.sqlite"
    try:
        inventory = build_inventory(config)
        write_inventory(inventory, build_dir / "source_inventory.json")
        stage_sources(config, db_path)
        build_canonical(db_path)
        build_core_workbook(db_path, build_dir / "Meltwater_VOC_01_核心主表.xlsx")
        build_relation_workbooks(db_path, build_dir)
        build_catalog_workbook(db_path, inventory, build_dir)
        validate_package(config, db_path, build_dir)
        db_path.unlink()
        os.replace(build_dir, final)
        os.chmod(final, 0o700)
        return final
    except Exception:
        failed = build_dir.with_name(build_dir.name.replace(".building-", ".failed-"))
        if build_dir.exists():
            shutil.move(str(build_dir), str(failed))
        raise


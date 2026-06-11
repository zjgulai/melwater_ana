from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Iterator

import ijson


def load_source_config(path: Path | str) -> dict[str, Any]:
    config_path = Path(path).resolve()
    config = json.loads(config_path.read_text(encoding="utf-8"))
    project_root = config_path.parent.parent if config_path.parent.name == "config" else config_path.parent
    config["_project_root"] = str(project_root)
    return config


def resolve_source_path(raw_path: str, allowed_root: Path) -> Path:
    root = allowed_root.resolve()
    candidate = Path(raw_path)
    resolved = candidate.resolve() if candidate.is_absolute() else (root / candidate).resolve()
    if resolved.suffix.lower() != ".json":
        raise ValueError(f"source path must end in .json: {resolved}")
    if not resolved.is_relative_to(root):
        raise ValueError(f"source path escapes allowed root: {resolved}")
    if not resolved.is_file():
        raise FileNotFoundError(resolved)
    return resolved


def iter_documents(path: Path) -> Iterator[dict[str, Any]]:
    with path.open("rb") as handle:
        yield from ijson.items(handle, "documents.item")


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def build_inventory(
    config: dict[str, Any],
    allowed_root: Path | None = None,
) -> dict[str, Any]:
    root = (allowed_root or Path(config.get("_project_root", Path.cwd()))).resolve()
    sources = []
    total = 0
    for source in config["sources"]:
        path = resolve_source_path(source["path"], root)
        document_count = sum(1 for _ in iter_documents(path))
        if document_count != source["expected_documents"]:
            raise ValueError(
                f"{source['alias']} expected {source['expected_documents']} documents, "
                f"found {document_count}"
            )
        stat = path.stat()
        item = {
            **{key: value for key, value in source.items() if key != "path"},
            "path": str(path.relative_to(root)),
            "absolute_path": str(path),
            "bytes": stat.st_size,
            "mtime_ns": stat.st_mtime_ns,
            "sha256": sha256_file(path),
            "document_count": document_count,
        }
        sources.append(item)
        total += document_count
    return {
        "version": config.get("version", 1),
        "project_root": str(root),
        "source_count": len(sources),
        "document_count": total,
        "sources": sources,
        "known_gaps": config.get("known_gaps", []),
    }


def write_inventory(inventory: dict[str, Any], output: Path | str) -> None:
    path = Path(output)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(inventory, ensure_ascii=False, indent=2), encoding="utf-8")
    path.chmod(0o600)


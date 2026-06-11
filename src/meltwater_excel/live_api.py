from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from .backfill_config import planned_output_dir, validate_targeted_backfill
from .export_manifest import new_manifest, update_manifest_status, write_manifest
from .inventory import sha256_file


LIVE_API_ENV_VAR = "MELTWATER_LIVE_API"
DEFAULT_BASE_URL = "https://api.meltwater.com"


class MeltwaterApiError(RuntimeError):
    def __init__(self, status: int, body: str):
        super().__init__(f"HTTP {status}: {body[:500]}")
        self.status = status
        self.body = body


class LiveApiBlocked(RuntimeError):
    pass


class MeltwaterClientProtocol(Protocol):
    def create_export(self, search_ids: list[int], start: str, end_exclusive: str) -> dict[str, Any]:
        ...

    def get_export(self, export_id: int) -> dict[str, Any]:
        ...

    def download_json(self, data_url: str) -> dict[str, Any]:
        ...


def load_env_file(path: Path | str = ".env") -> None:
    env_path = Path(path)
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def require_live_api_enabled(execute: bool, environ: dict[str, str] | None = None) -> None:
    if not execute:
        return
    env = os.environ if environ is None else environ
    if env.get(LIVE_API_ENV_VAR) != "1":
        raise LiveApiBlocked(f"set {LIVE_API_ENV_VAR}=1 and pass --execute to call Meltwater live API")


def require_https_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise ValueError(f"only HTTPS URLs are allowed: {url}")
    return url


class MeltwaterClient:
    def __init__(self, api_key: str, base_url: str = DEFAULT_BASE_URL):
        self.api_key = api_key
        self.base_url = require_https_url(base_url.rstrip("/"))

    @classmethod
    def from_env(cls) -> MeltwaterClient:
        load_env_file()
        api_key = os.environ.get("MELTWATER_API_KEY", "")
        if not api_key:
            raise LiveApiBlocked("MELTWATER_API_KEY is missing")
        return cls(api_key=api_key, base_url=os.environ.get("MELTWATER_BASE_URL", DEFAULT_BASE_URL))

    def request(self, method: str, path_or_url: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
        url = path_or_url if path_or_url.startswith("https://") else f"{self.base_url}{path_or_url}"
        url = require_https_url(url)
        headers = {"Accept": "application/json", "apikey": self.api_key}
        data = json.dumps(body).encode("utf-8") if body is not None else None
        if body is not None:
            headers["Content-Type"] = "application/json"
        request = Request(url, data=data, headers=headers, method=method)
        try:
            # URL scheme is validated as HTTPS before the request is created.
            with urlopen(request) as response:  # nosec B310
                payload = response.read().decode("utf-8")
        except HTTPError as exc:
            raise MeltwaterApiError(exc.code, exc.read().decode("utf-8", errors="replace")) from exc
        return json.loads(payload)

    def create_export(self, search_ids: list[int], start: str, end_exclusive: str) -> dict[str, Any]:
        body = {
            "onetime_export": {
                "search_ids": search_ids,
                "start_date": start,
                "end_date": end_exclusive,
                "template": {"name": "api.json"},
            }
        }
        return self.request("POST", "/v3/exports/one-time", body)["onetime_export"]

    def get_export(self, export_id: int) -> dict[str, Any]:
        return self.request("GET", f"/v3/exports/one-time/{export_id}")["onetime_export"]

    def download_json(self, data_url: str) -> dict[str, Any]:
        return self.request("GET", require_https_url(data_url))


def _safe_date(value: str) -> str:
    return value[:10].replace("-", "")


def _count_documents(payload: dict[str, Any]) -> tuple[int, int, str | None, str | None]:
    documents = payload.get("documents", payload.get("docs", []))
    seen: set[str] = set()
    published_values = []
    for document in documents:
        document_id = document.get("id")
        if document_id is not None:
            seen.add(str(document_id))
        published = document.get("published_date")
        if published:
            published_values.append(str(published))
    return (
        len(documents),
        len(seen),
        min(published_values) if published_values else None,
        max(published_values) if published_values else None,
    )


def _write_download(payload: dict[str, Any], output_dir: Path, filename: str) -> dict[str, Any]:
    path = output_dir / filename
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    os.chmod(path, 0o600)
    document_count, unique_document_ids, published_min, published_max = _count_documents(payload)
    return {
        "path": str(path),
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
        "document_count": document_count,
        "unique_document_ids": unique_document_ids,
        "published_min": published_min,
        "published_max": published_max,
    }


def run_targeted_backfill(
    config: dict[str, Any],
    output_root: Path | str = "data/exports",
    execute: bool = False,
    poll_interval: float = 15.0,
    max_wait: float = 600.0,
    client: MeltwaterClientProtocol | None = None,
    environ: dict[str, str] | None = None,
    sleep=time.sleep,
) -> dict[str, Any]:
    validate_targeted_backfill(config)
    output_dir = planned_output_dir(config, output_root)
    manifest = new_manifest(config, status="DRY_RUN" if not execute else "RUNNING")
    manifest["output_dir"] = str(output_dir)
    manifest["execute"] = execute

    if not execute:
        write_manifest(manifest, output_dir)
        return manifest

    require_live_api_enabled(execute=True, environ=environ)
    active_client = client or MeltwaterClient.from_env()

    export_item: dict[str, Any] = {
        "category": config["category"],
        "batch_no": 1,
        "search_ids": list(config["search_ids"]),
        "status": "CREATING",
        "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    manifest["exports"].append(export_item)
    write_manifest(manifest, output_dir)

    try:
        created = active_client.create_export(config["search_ids"], config["start"], config["end_exclusive"])
    except MeltwaterApiError as exc:
        export_item["status"] = "BLOCKED_QUOTA" if exc.status == 429 else "ERROR"
        export_item["error"] = str(exc)
        update_manifest_status(manifest, "PARTIAL_QUOTA_EXHAUSTED" if exc.status == 429 else "FAILED")
        write_manifest(manifest, output_dir)
        return manifest

    export_id = int(created["id"])
    export_item.update(
        {
            "status": "CREATED",
            "export_id": export_id,
            "search_names": [item.get("name") for item in created.get("searches", [])],
        }
    )
    write_manifest(manifest, output_dir)

    waited = 0.0
    latest = created
    while waited <= max_wait:
        latest = active_client.get_export(export_id)
        export_item["last_status"] = latest.get("status")
        export_item["last_checked_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        write_manifest(manifest, output_dir)
        if latest.get("status") == "FINISHED":
            break
        sleep(poll_interval)
        waited += poll_interval
    else:
        export_item["status"] = "TIMEOUT"
        update_manifest_status(manifest, "FAILED")
        write_manifest(manifest, output_dir)
        return manifest

    data_url = latest.get("data_url") or created.get("data_url")
    if not data_url:
        export_item["status"] = "ERROR"
        export_item["error"] = "finished export did not include data_url"
        update_manifest_status(manifest, "FAILED")
        write_manifest(manifest, output_dir)
        return manifest

    payload = active_client.download_json(data_url)
    filename = (
        f"{config['category']}_batch1_{export_id}_"
        f"{_safe_date(config['start'])}_{_safe_date(config['end_exclusive'])}.json"
    )
    export_item["download"] = _write_download(payload, output_dir, filename)
    export_item["status"] = "DOWNLOADED"
    export_item["finished_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    update_manifest_status(manifest, "READY_TO_PUBLISH")
    write_manifest(manifest, output_dir)
    return manifest

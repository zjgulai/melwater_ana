#!/usr/bin/env python3
"""Meltwater VOC 快速分析概览脚本。

用法:
    python3 scripts/analytics.py 消毒器
    python3 scripts/analytics.py --all
    python3 scripts/analytics.py 吸奶器 --start 2026-04-01 --end 2026-05-01
"""
import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = PROJECT_ROOT / "config" / "categories.json"


def load_env():
    env_path = PROJECT_ROOT / ".env"
    if not env_path.exists():
        print("\u274c 缺少 .env 文件")
        sys.exit(1)
    for line in env_path.read_text().strip().split("\n"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


def load_config():
    with open(CONFIG_PATH) as f:
        return json.load(f)


def require_https_url(url):
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise ValueError(f"only HTTPS URLs are allowed: {url}")
    return url


def api_get(path_with_params):
    api_key = os.environ.get("MELTWATER_API_KEY", "")
    base = os.environ.get("MELTWATER_BASE_URL", "https://api.meltwater.com")
    url = require_https_url(f"{base}{path_with_params}")
    req = Request(url, headers={"Accept": "application/json", "apikey": api_key})
    try:
        # URL scheme is validated as HTTPS before the request is created.
        with urlopen(req) as resp:  # nosec B310
            return json.loads(resp.read()), resp.status
    except HTTPError as e:
        return json.loads(e.read()), e.code


def analytics_for_search(search_id, name, start, end):
    tz = "Asia/Shanghai"
    path = f"/v3/analytics/{search_id}?start={start}T00:00:00&end={end}T00:00:00&tz={tz}"
    data, code = api_get(path)
    if code != 200:
        return None
    return data


def print_bar(label, pos, neg, neu, total):
    if total == 0:
        return
    pct_p = pos * 100 / total
    pct_n = neg * 100 / total
    bar_w = 30
    p_w = int(bar_w * pos / total)
    n_w = int(bar_w * neg / total)
    u_w = bar_w - p_w - n_w
    bar = "🟢" * p_w + "🔴" * n_w + "⚪" * u_w
    print(f"  {label:<12} {total:>6,}条 | {bar} | +{pct_p:.0f}% / -{pct_n:.0f}%")


def main():
    load_env()
    config = load_config()

    parser = argparse.ArgumentParser(description="Meltwater VOC 快速分析")
    parser.add_argument("category", nargs="?", help="品类名称 或 --all")
    parser.add_argument("--all", action="store_true", help="分析所有品类")
    parser.add_argument("--start", help="开始日期 YYYY-MM-DD（默认7天前）")
    parser.add_argument("--end", help="结束日期 YYYY-MM-DD（默认今天）")
    parser.add_argument("--days", type=int, default=7, help="分析最近N天（默认7）")
    args = parser.parse_args()

    end_date = args.end or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    start_date = args.start or (datetime.now(timezone.utc) - timedelta(days=args.days)).strftime("%Y-%m-%d")

    if args.all:
        categories = config["categories"].keys()
    elif args.category:
        if args.category not in config["categories"]:
            print(f"\u274c 未知品类: {args.category}")
            print(f"可用: {', '.join(config['categories'].keys())}")
            sys.exit(1)
        categories = [args.category]
    else:
        parser.print_help()
        return

    print("\n📊 Meltwater VOC 声量概览")
    print(f"  时间: {start_date} ~ {end_date} ({args.days}天)\n")

    for cat_name in categories:
        cfg = config["categories"][cat_name]
        total_vol = 0
        total_pos = 0
        total_neg = 0
        total_neu = 0

        for sid in cfg["search_ids"]:
            data = analytics_for_search(sid, cfg.get("label", cat_name), start_date, end_date)
            if not data:
                continue
            vol = data.get("volume", {})
            sent = data.get("sentiment", {})
            total_vol += vol.get("document_count", 0)
            total_pos += sent.get("positive", {}).get("document_count", 0)
            total_neg += sent.get("negative", {}).get("document_count", 0)
            total_neu += sent.get("neutral", {}).get("document_count", 0)

        if total_vol > 0:
            daily = total_vol // args.days
            label = f"{cat_name}(日{daily})"
            print_bar(label, total_pos, total_neg, total_neu, total_vol)
        else:
            print(f"  {cat_name:<12} 无数据")

    print()


if __name__ == "__main__":
    main()

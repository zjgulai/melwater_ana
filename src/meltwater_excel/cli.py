from __future__ import annotations

import argparse
import json

from .backfill_config import load_backfill_config, planned_output_dir
from .build_catalog import build_catalog_workbook
from .build_core import build_core_workbook
from .build_relations import build_relation_workbooks
from .canonical import build_canonical, summarize_stage, write_stage_summary
from .checks import validate_existing_package, validate_package
from .export_manifest import can_publish
from .inventory import build_inventory, load_source_config, write_inventory
from .live_api import LiveApiBlocked, run_targeted_backfill
from .marts import build_marts
from .pipeline import build_all
from .sample_audit import audit_random_samples
from .staging import stage_sources


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Complete Meltwater JSON to Excel pipeline")
    subparsers = parser.add_subparsers(dest="command", required=True)

    inventory = subparsers.add_parser("inventory")
    inventory.add_argument("--config", required=True)
    inventory.add_argument("--output", required=True)

    stage = subparsers.add_parser("stage")
    stage.add_argument("--config", required=True)
    stage.add_argument("--db", required=True)

    summarize = subparsers.add_parser("summarize")
    summarize.add_argument("--db", required=True)
    summarize.add_argument("--output")

    core = subparsers.add_parser("build-core")
    core.add_argument("--db", required=True)
    core.add_argument("--output", required=True)

    relations = subparsers.add_parser("build-relations")
    relations.add_argument("--db", required=True)
    relations.add_argument("--output-dir", required=True)

    catalog = subparsers.add_parser("build-catalog")
    catalog.add_argument("--db", required=True)
    catalog.add_argument("--config", required=True)
    catalog.add_argument("--output-dir", required=True)

    validate = subparsers.add_parser("validate")
    validate.add_argument("--config", required=True)
    validate.add_argument("--output-dir", required=True)
    validate.add_argument("--db")

    all_parser = subparsers.add_parser("build-all")
    all_parser.add_argument("--config", required=True)
    all_parser.add_argument("--output-dir", required=True)

    marts = subparsers.add_parser("build-marts")
    marts.add_argument("--config", required=True)
    marts.add_argument("--output-dir", required=True)
    marts.add_argument("--insights-config-dir", default="config/insights")

    sample = subparsers.add_parser("sample-audit")
    sample.add_argument("--config", required=True)
    sample.add_argument("--output-dir", required=True)
    sample.add_argument("--samples-per-source", type=int, default=20)
    sample.add_argument("--seed", type=int, default=20260604)
    sample.add_argument("--output")

    backfill_plan = subparsers.add_parser("backfill-plan")
    backfill_plan.add_argument("--config", required=True)
    backfill_plan.add_argument("--output-root", default="data/exports")

    backfill_run = subparsers.add_parser("backfill-run")
    backfill_run.add_argument("--config", required=True)
    backfill_run.add_argument("--output-root", default="data/exports")
    backfill_run.add_argument("--execute", action="store_true")
    backfill_run.add_argument("--poll-interval", type=float, default=15.0)
    backfill_run.add_argument("--max-wait", type=float, default=600.0)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "inventory":
        config = load_source_config(args.config)
        inventory = build_inventory(config)
        write_inventory(inventory, args.output)
        print(json.dumps({"source_count": inventory["source_count"], "document_count": inventory["document_count"]}, ensure_ascii=False))
    elif args.command == "stage":
        config = load_source_config(args.config)
        stage_sources(config, args.db)
        build_canonical(args.db)
        print(json.dumps(summarize_stage(args.db), ensure_ascii=False))
    elif args.command == "summarize":
        if args.output:
            write_stage_summary(args.db, args.output)
        print(json.dumps(summarize_stage(args.db), ensure_ascii=False))
    elif args.command == "build-core":
        print(build_core_workbook(args.db, args.output))
    elif args.command == "build-relations":
        print("\n".join(str(path) for path in build_relation_workbooks(args.db, args.output_dir)))
    elif args.command == "build-catalog":
        inventory = build_inventory(load_source_config(args.config))
        print(build_catalog_workbook(args.db, inventory, args.output_dir))
    elif args.command == "validate":
        config = load_source_config(args.config)
        result = validate_package(config, args.db, args.output_dir) if args.db else validate_existing_package(config, args.output_dir)
        print(json.dumps({"status": result["status"]}, ensure_ascii=False))
    elif args.command == "build-all":
        print(build_all(args.config, args.output_dir))
    elif args.command == "build-marts":
        print(build_marts(args.config, args.output_dir, args.insights_config_dir))
    elif args.command == "sample-audit":
        result = audit_random_samples(
            args.config,
            args.output_dir,
            samples_per_source=args.samples_per_source,
            seed=args.seed,
            output=args.output,
        )
        print(json.dumps(result, ensure_ascii=False))
    elif args.command == "backfill-plan":
        config = load_backfill_config(args.config)
        output_dir = planned_output_dir(config, args.output_root)
        manifest = run_targeted_backfill(config, output_root=args.output_root, execute=False)
        print(
            json.dumps(
                {
                    "status": manifest["status"],
                    "run_name": manifest["run_name"],
                    "output_dir": str(output_dir),
                    "can_publish": can_publish(manifest),
                },
                ensure_ascii=False,
            )
        )
    elif args.command == "backfill-run":
        config = load_backfill_config(args.config)
        try:
            manifest = run_targeted_backfill(
                config,
                output_root=args.output_root,
                execute=args.execute,
                poll_interval=args.poll_interval,
                max_wait=args.max_wait,
            )
        except LiveApiBlocked as exc:
            print(json.dumps({"status": "BLOCKED_LIVE_GUARD", "error": str(exc)}, ensure_ascii=False))
            return 2
        print(
            json.dumps(
                {
                    "status": manifest["status"],
                    "run_name": manifest["run_name"],
                    "can_publish": can_publish(manifest),
                },
                ensure_ascii=False,
            )
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

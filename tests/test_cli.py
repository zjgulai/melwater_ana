from meltwater_excel.cli import build_parser


def test_cli_exposes_all_planned_commands():
    parser = build_parser()
    help_text = parser.format_help()
    for command in [
        "inventory",
        "stage",
        "summarize",
        "build-core",
        "build-relations",
        "build-catalog",
        "validate",
        "build-all",
        "build-marts",
        "backfill-plan",
        "backfill-run",
    ]:
        assert command in help_text

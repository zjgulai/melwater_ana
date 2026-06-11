from decimal import Decimal

from meltwater_excel.excel_safe import (
    chunk_text,
    excel_safe_text,
    excel_utc_datetime,
    precision_pair,
)


def test_dangerous_prefixes_are_written_as_literal_text():
    for value in ["=SUM(A1:A2)", "+1", "-danger", "@handle"]:
        safe = excel_safe_text(value)
        assert safe.startswith("'")
        assert safe[1:] == value


def test_long_text_chunks_round_trip():
    text = "x" * 70001
    chunks = chunk_text(text)
    assert all(len(chunk) <= 30000 for chunk in chunks)
    assert "".join(chunks) == text


def test_precision_pair_preserves_raw_decimal():
    raw, number = precision_pair(Decimal("0.123456789012345678"))
    assert raw == "0.123456789012345678"
    assert number == float(raw)


def test_excel_utc_datetime_is_naive_utc():
    result = excel_utc_datetime("2026-01-01T00:00:00.123Z")
    assert result.tzinfo is None
    assert result.microsecond == 123000


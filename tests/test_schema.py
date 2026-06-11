import pytest

from meltwater_excel.schema import (
    ARRAY_PATHS,
    OBJECT_PATHS,
    OBSERVED_FIELD_PATHS,
    validate_document_schema,
)


def test_schema_contains_all_exploration_paths():
    assert len(OBSERVED_FIELD_PATHS) == 82
    assert len(ARRAY_PATHS) == 9
    assert len(OBJECT_PATHS) == 17


def test_unknown_path_fails_closed():
    with pytest.raises(ValueError, match="unknown_field"):
        validate_document_schema({"id": "x", "unknown_field": 1})


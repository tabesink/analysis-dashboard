import pytest

from server.modules.filter_semantics import build_filter_plan
from server.modules.filter_semantics.errors import UnknownFilterFieldError


FILTER_COLUMN_MAP = {
    "Program": "program_id",
    "program_id": "program_id",
    "suspension_component": "suspension_component",
}


def test_builds_schema_field_condition_from_column_name() -> None:
    plan = build_filter_plan(
        filters={"suspension_component": ["air", "coil"]},
        purpose="event_grid",
        filter_column_map=FILTER_COLUMN_MAP,
    )

    assert plan.purpose == "event_grid"
    assert plan.conditions[0].sql == "suspension_component IN (?, ?)"
    assert plan.conditions[0].params == ("air", "coil")


def test_builds_schema_field_condition_from_display_name() -> None:
    plan = build_filter_plan(
        filters={"Program": ["P1"]},
        purpose="program_list",
        filter_column_map=FILTER_COLUMN_MAP,
    )

    assert plan.conditions[0].sql == "program_id IN (?)"
    assert plan.conditions[0].params == ("P1",)


def test_normalizes_boolean_filter_values_in_one_plan() -> None:
    plan = build_filter_plan(
        filters={"rfq": ["Applicable", "no"]},
        purpose="event_grid",
        filter_column_map=FILTER_COLUMN_MAP,
    )

    assert plan.conditions[0].sql == "(rfq = ? OR rfq = ?)"
    assert plan.conditions[0].params == (True, False)


def test_builds_weight_range_filter_condition() -> None:
    plan = build_filter_plan(
        filters={"gross_vehicle_weight_range_lbs": ["1000-1500"]},
        purpose="version_list",
        filter_column_map=FILTER_COLUMN_MAP,
    )

    assert "TRY_CAST(NULLIF(TRIM(gvw), '') AS DOUBLE)" in plan.conditions[0].sql
    assert plan.conditions[0].params == (1000.0, 1500.0)


def test_builds_custom_field_condition() -> None:
    plan = build_filter_plan(
        filters={"test_owner": ["team-a"]},
        purpose="event_grid",
        filter_column_map=FILTER_COLUMN_MAP,
        custom_field_keys={"test_owner"},
    )

    assert "event_custom_field_values" in plan.conditions[0].sql
    assert plan.conditions[0].params == ("test_owner", "team-a")


def test_unknown_field_fails_before_query_execution() -> None:
    with pytest.raises(UnknownFilterFieldError):
        build_filter_plan(
            filters={"does_not_exist": ["x"]},
            purpose="event_grid",
            filter_column_map=FILTER_COLUMN_MAP,
        )

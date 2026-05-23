"""Build validated Dashboard filter plans from request filter input."""

from __future__ import annotations

from typing import Any

from server.utils.boolean_filters import build_boolean_filter_condition
from server.utils.weight_filters import build_weight_range_condition

from .errors import UnknownFilterFieldError
from .models import FilterCondition, FilterPlan, FilterPurpose


def _condition(sql: str, params: list[Any] | tuple[Any, ...]) -> FilterCondition:
    return FilterCondition(sql=sql, params=tuple(params))


def build_filter_plan(
    *,
    filters: dict[str, list[str] | str],
    purpose: FilterPurpose,
    filter_column_map: dict[str, str],
    custom_field_keys: set[str] | None = None,
) -> FilterPlan:
    """Convert user-facing Dashboard filters into validated query predicates."""
    custom_field_keys = custom_field_keys or set()
    conditions: list[FilterCondition] = []

    for filter_key, filter_values in filters.items():
        if filter_key == "event_id_query":
            if isinstance(filter_values, str) and filter_values.strip():
                conditions.append(
                    _condition(
                        "LOWER(event_id) LIKE ?",
                        [f"%{filter_values.strip().lower()}%"],
                    )
                )
            continue

        if not isinstance(filter_values, list) or not filter_values:
            continue

        boolean_condition = build_boolean_filter_condition(filter_key, filter_values)
        if boolean_condition is not None:
            condition_sql, condition_params = boolean_condition
            conditions.append(_condition(condition_sql, condition_params))
            continue

        weight_condition = build_weight_range_condition(filter_key, filter_values)
        if weight_condition is not None:
            condition_sql, condition_params = weight_condition
            conditions.append(_condition(condition_sql, condition_params))
            continue

        if filter_key in filter_column_map:
            column = filter_column_map[filter_key]
            placeholders = ", ".join(["?"] * len(filter_values))
            conditions.append(_condition(f"{column} IN ({placeholders})", filter_values))
            continue

        if filter_key in custom_field_keys:
            placeholders = ", ".join(["?"] * len(filter_values))
            conditions.append(
                _condition(
                    "event_id IN ("
                    "SELECT event_id FROM event_custom_field_values "
                    f"WHERE field_key = ? AND value IN ({placeholders})"
                    ")",
                    [filter_key, *filter_values],
                )
            )
            continue

        raise UnknownFilterFieldError(filter_key)

    return FilterPlan(purpose=purpose, conditions=tuple(conditions))

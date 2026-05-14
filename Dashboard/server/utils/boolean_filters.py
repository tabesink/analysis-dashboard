"""Helpers for applying boolean metadata filters from UI string selections."""

from typing import Any

BOOLEAN_FILTER_COLUMNS = {"rfq", "dv", "pv", "post_prod"}


def _to_bool_value(raw: str) -> bool | None:
    text = raw.strip().lower()
    if text in {"true", "1", "yes", "y", "applicable"}:
        return True
    if text in {"false", "0", "no", "n", "not applicable"}:
        return False
    return None


def build_boolean_filter_condition(
    filter_key: str, filter_values: list[str]
) -> tuple[str, list[Any]] | None:
    """Build SQL condition for boolean filter keys."""
    if filter_key not in BOOLEAN_FILTER_COLUMNS or not filter_values:
        return None

    bool_values = {
        parsed
        for parsed in (_to_bool_value(value) for value in filter_values if isinstance(value, str))
        if parsed is not None
    }
    if not bool_values:
        return "1 = 0", []

    predicates = []
    params: list[Any] = []
    if True in bool_values:
        predicates.append(f"{filter_key} = ?")
        params.append(True)
    if False in bool_values:
        predicates.append(f"{filter_key} = ?")
        params.append(False)
    return f"({' OR '.join(predicates)})", params

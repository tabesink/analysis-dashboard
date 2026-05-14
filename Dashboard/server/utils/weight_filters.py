"""Helpers for applying weight range filters to raw numeric metadata."""

from typing import Any

WEIGHT_RANGE_FILTER_TO_RAW_COLUMN: dict[str, str] = {
    "gross_vehicle_weight_range_lbs": "gvw",
    "fgawr_range_lbs": "fgawr",
    "rgawr_range_lbs": "rgawr",
}


def _parse_range_label(range_label: str) -> tuple[float, float] | None:
    """Parse a range label like '1000-1500' into numeric bounds."""
    text = range_label.strip()
    if not text:
        return None
    parts = text.split("-", maxsplit=1)
    if len(parts) != 2:
        return None
    low_text = parts[0].strip()
    high_text = parts[1].strip()
    if not low_text or not high_text:
        return None
    try:
        low = float(low_text)
        high = float(high_text)
    except ValueError:
        return None
    if high < low:
        return None
    return low, high


def build_weight_range_condition(
    filter_key: str, selected_ranges: list[str]
) -> tuple[str, list[Any]] | None:
    """
    Build SQL condition/params for matching raw numeric value against selected ranges.

    Returns None for non-weight filters or empty values.
    """
    raw_column = WEIGHT_RANGE_FILTER_TO_RAW_COLUMN.get(filter_key)
    if raw_column is None or not selected_ranges:
        return None

    parsed_ranges = [
        parsed
        for parsed in (_parse_range_label(label) for label in selected_ranges)
        if parsed is not None
    ]
    if not parsed_ranges:
        # Fail closed: if all selected labels are invalid, match no rows.
        return "1 = 0", []

    value_expr = f"TRY_CAST(NULLIF(TRIM({raw_column}), '') AS DOUBLE)"
    predicates = []
    params: list[Any] = []
    for low, high in parsed_ranges:
        predicates.append(f"({value_expr} >= ? AND {value_expr} <= ?)")
        params.extend([low, high])

    condition = f"({value_expr} IS NOT NULL AND ({' OR '.join(predicates)}))"
    return condition, params

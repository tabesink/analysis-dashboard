"""Shared helpers for deriving weight range bucket metadata."""

from typing import Any

WEIGHT_RANGE_BUCKETS: tuple[tuple[int, int], ...] = (
    (0, 500),
    (500, 1000),
    (1000, 1500),
    (1500, 2000),
    (2000, 2500),
    (2500, 3000),
    (3000, 3500),
    (3500, 4000),
    (4000, 4500),
    (4500, 5000),
    (5000, 5500),
    (5500, 6000),
    (6000, 6500),
    (6500, 7000),
    (7000, 7500),
    (7500, 8000),
    (8000, 8500),
    (8500, 9000),
    (9000, 9500),
    (9500, 10000),
)

RANGE_MAPPING: tuple[tuple[str, str], ...] = (
    ("gvw", "gross_vehicle_weight_range_lbs"),
    ("fgawr", "fgawr_range_lbs"),
    ("rgawr", "rgawr_range_lbs"),
)


def derive_range_bucket(raw_value: Any) -> str | None:
    """Map a numeric weight-like input to a fixed bucket label."""
    if raw_value is None:
        return None
    text = str(raw_value).strip()
    if not text:
        return None
    try:
        value = float(text)
    except ValueError:
        return None
    for index, (low, high) in enumerate(WEIGHT_RANGE_BUCKETS):
        is_last_bucket = index == len(WEIGHT_RANGE_BUCKETS) - 1
        if low <= value < high or (is_last_bucket and value == high):
            return f"{low}-{high}"
    return None


def apply_derived_weight_ranges(
    metadata: dict[str, Any],
    *,
    include_nulls: bool = False,
) -> dict[str, Any]:
    """Add derived range fields for gvw/fgawr/rgawr values."""
    next_metadata = dict(metadata)
    for raw_key, range_key in RANGE_MAPPING:
        if raw_key not in next_metadata:
            continue
        derived = derive_range_bucket(next_metadata.get(raw_key))
        if derived is not None or include_nulls:
            next_metadata[range_key] = derived
    return next_metadata

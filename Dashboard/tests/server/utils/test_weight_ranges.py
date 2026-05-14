from server.utils.weight_ranges import apply_derived_weight_ranges, derive_range_bucket


def test_derive_range_bucket_maps_numeric_text() -> None:
    assert derive_range_bucket("1499") == "1000-1500"
    assert derive_range_bucket("1500") == "1500-2000"
    assert derive_range_bucket("abc") is None
    assert derive_range_bucket(None) is None


def test_apply_derived_weight_ranges_updates_known_weight_fields() -> None:
    updated = apply_derived_weight_ranges(
        {"gvw": "1450", "fgawr": "6100", "rgawr": "not-a-number", "status": "Pending"},
        include_nulls=True,
    )

    assert updated["gross_vehicle_weight_range_lbs"] == "1000-1500"
    assert updated["fgawr_range_lbs"] == "6000-6500"
    assert updated["rgawr_range_lbs"] is None
    assert updated["status"] == "Pending"

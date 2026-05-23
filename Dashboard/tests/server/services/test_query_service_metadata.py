from server.services.query import QueryService


def _make_query_service(test_database, test_cache, test_settings) -> QueryService:
    return QueryService(test_database, test_cache, test_settings)


def test_update_event_metadata_applies_ownership_and_derived_ranges(
    test_database, test_cache, test_settings
) -> None:
    query_service = _make_query_service(test_database, test_cache, test_settings)
    owner = test_database.create_user("owner_user")
    other_user = test_database.create_user("other_user")
    test_database.insert_event(
        event_id="event-1",
        program_id="P1",
        version="V1",
        uploaded_by_user_id=owner["id"],
        status="Pending",
    )

    try:
        query_service.update_event_metadata(
            "event-1",
            updates={"job_number": "A1"},
            current_user={"id": other_user["id"], "role": "user"},
            if_unmodified_since=None,
        )
    except PermissionError:
        pass
    else:
        raise AssertionError("Expected PermissionError for non-owner update")

    updated = query_service.update_event_metadata(
        "event-1",
        updates={"gvw": "1800", "job_number": "JOB-2"},
        current_user={"id": owner["id"], "role": "user"},
        if_unmodified_since=None,
    )

    assert updated["job_number"] == "JOB-2"
    assert updated["gross_vehicle_weight_range_lbs"] == "1500-2000"
    assert updated["last_updated_by_user_id"] == owner["id"]


def test_update_event_metadata_rejects_stale_if_unmodified_since(
    test_database, test_cache, test_settings
) -> None:
    query_service = _make_query_service(test_database, test_cache, test_settings)
    owner = test_database.create_user("owner_occ")
    test_database.insert_event(
        event_id="event-occ-1",
        program_id="P1",
        version="V1",
        uploaded_by_user_id=owner["id"],
        status="Pending",
    )

    first_update = query_service.update_event_metadata(
        "event-occ-1",
        updates={"job_number": "FIRST"},
        current_user={"id": owner["id"], "role": "user"},
        if_unmodified_since=None,
    )
    assert first_update["job_number"] == "FIRST"
    assert first_update["updated_at"] is not None

    stale_error: Exception | None = None
    try:
        query_service.update_event_metadata(
            "event-occ-1",
            updates={"job_number": "SECOND"},
            current_user={"id": owner["id"], "role": "user"},
            if_unmodified_since=None,
        )
    except RuntimeError as exc:
        stale_error = exc

    assert stale_error is not None
    assert "modified by another user" in str(stale_error)


def test_update_program_version_metadata_returns_summary(test_database, test_cache, test_settings) -> None:
    query_service = _make_query_service(test_database, test_cache, test_settings)
    owner = test_database.create_user("batch_owner")
    test_database.insert_event(
        event_id="event-a",
        program_id="P2",
        version="V2",
        uploaded_by_user_id=owner["id"],
        status="Pending",
    )
    test_database.insert_event(
        event_id="event-b",
        program_id="P2",
        version="V2",
        uploaded_by_user_id=owner["id"],
        status="Pending",
    )

    summary = query_service.update_program_version_metadata(
        program_id="P2",
        version="V2",
        updates={"status": "Approved", "fgawr": "2200"},
        current_user={"id": owner["id"], "role": "admin"},
    )

    assert summary["program_id"] == "P2"
    assert summary["version"] == "V2"
    assert summary["updated_event_count"] == 2
    assert summary["status"] == "Approved"

    refreshed = test_database.get_events(program_id="P2", version="V2")
    assert all(event.get("status") == "Approved" for event in refreshed)
    assert all(event.get("fgawr_range_lbs") == "2000-2500" for event in refreshed)


def test_invalidate_filter_option_caches_clears_filter_prefix(
    test_database, test_cache, test_settings
) -> None:
    query_service = _make_query_service(test_database, test_cache, test_settings)
    test_cache.set("filter_options:all", {"status": ["Approved"]})
    assert test_cache.get("filter_options:all") is not None

    query_service.invalidate_filter_option_caches()

    assert test_cache.get("filter_options:all") is None

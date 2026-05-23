from server.services.query import QueryService


def test_global_filter_contract_matches_events_programs_and_versions(
    test_database, test_cache, test_settings
) -> None:
    query_service = QueryService(test_database, test_cache, test_settings)
    test_database.insert_event(
        event_id="event-1",
        program_id="P1",
        version="V1",
        status="Approved",
        rfq=True,
        gvw="1250",
    )
    test_database.insert_event(
        event_id="event-2",
        program_id="P2",
        version="V2",
        status="Approved",
        rfq=False,
        gvw="1250",
    )
    test_database.insert_event(
        event_id="event-3",
        program_id="P3",
        version="V3",
        status="Approved",
        rfq=True,
        gvw="2750",
    )

    filters = {
        "rfq": ["Applicable"],
        "gross_vehicle_weight_range_lbs": ["1000-1500"],
    }

    events, total = query_service.get_events(global_filters=filters)

    assert total == 1
    assert [event["event_id"] for event in events] == ["event-1"]
    assert query_service.get_program_ids(global_filters=filters) == ["P1"]
    assert query_service.get_versions(global_filters=filters) == ["V1"]

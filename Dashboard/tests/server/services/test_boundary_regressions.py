import pytest

from server.modules.filter_semantics.errors import UnknownFilterFieldError
from server.services.query import QueryService
from server.services.session import SessionManager
from server.services.upload_query import UploadQueryService


def test_get_all_events_enriches_usernames_and_hides_deleted(
    test_database, test_cache, test_settings
) -> None:
    query_service = QueryService(test_database, test_cache, test_settings)
    owner = test_database.create_user("events_owner")

    test_database.insert_event(
        event_id="event-visible",
        program_id="P1",
        version="V1",
        uploaded_by_user_id=owner["id"],
        status="Pending",
    )
    test_database.insert_event(
        event_id="event-deleted",
        program_id="P1",
        version="V1",
        uploaded_by_user_id=owner["id"],
        status="Pending",
    )
    assert test_database.soft_delete_event("event-deleted")

    result = query_service.get_all_events(global_filters={}, limit=100, offset=0)

    assert result["total_count"] == 1
    assert [event["event_id"] for event in result["events"]] == ["event-visible"]
    assert result["events"][0]["uploaded_by_username"] == "events_owner"


def test_list_datasets_uses_service_boundary_and_returns_facets(test_database) -> None:
    service = UploadQueryService(test_database)
    owner = test_database.create_user("dataset_owner")

    test_database.insert_event(
        event_id="dataset-1",
        program_id="P1",
        version="V1",
        uploaded_by_user_id=owner["id"],
        status="Approved",
        suspension_component="Front",
    )
    test_database.insert_event(
        event_id="dataset-2",
        program_id="P2",
        version="V1",
        uploaded_by_user_id=owner["id"],
        status="Pending",
        suspension_component="Rear",
    )

    payload = service.list_datasets()

    assert payload["total"] == 2
    assert len(payload["items"]) == 2
    assert set(payload["facets"]["program_id"]) == {"P1", "P2"}
    assert set(payload["facets"]["status"]) == {"Approved", "Pending"}
    assert set(payload["facets"]["suspension_component"]) == {"Front", "Rear"}


def test_session_manager_enforces_user_scoped_access(test_database) -> None:
    session_manager = SessionManager(test_database)
    user_a = test_database.create_user("session_user_a")
    user_b = test_database.create_user("session_user_b")

    session_id = session_manager.create(
        user_a["id"],
        {"global_filters": {"program_id": ["P1"]}},
    )

    assert session_manager.get(session_id, user_a["id"]) is not None
    assert session_manager.get(session_id, user_b["id"]) is None
    assert session_manager.update(session_id, user_b["id"], {"global_filters": {}}) is False


def test_session_manager_persists_inspect_damage_state_without_wiping_data_state(
    test_database,
) -> None:
    session_manager = SessionManager(test_database)
    user = test_database.create_user("inspect_damage_session_user")

    session_id = session_manager.create(
        user["id"],
        {
            "data_state": {
                "program_ids": [],
                "versions": [],
                "selected_event_ids": ["dashboard-event"],
            },
            "inspect_damage_state": {
                "selected_event_ids": ["inspect-event"],
                "table_preferences": {
                    "expanded_versions": ["P1::V1"],
                    "sort_field": "work_order",
                },
            },
        },
    )

    assert session_manager.update(
        session_id,
        user["id"],
        {"inspect_damage_state": {"selected_event_ids": ["inspect-event-2"]}},
    )

    session = session_manager.get(session_id, user["id"])
    assert session is not None
    assert session["data_state"]["selected_event_ids"] == ["dashboard-event"]
    assert session["inspect_damage_state"]["selected_event_ids"] == ["inspect-event-2"]
    assert session["inspect_damage_state"]["table_preferences"]["expanded_versions"] == [
        "P1::V1"
    ]
    assert session["inspect_damage_state"]["table_preferences"]["sort_field"] == "work_order"


def test_get_events_rejects_program_scope_in_global_filters(
    test_database, test_cache, test_settings
) -> None:
    query_service = QueryService(test_database, test_cache, test_settings)
    test_database.insert_event(
        event_id="scope-key-regression",
        program_id="P1",
        version="V1",
        status="Pending",
    )

    with pytest.raises(UnknownFilterFieldError):
        query_service.get_events(global_filters={"program_id": ["P1"]})

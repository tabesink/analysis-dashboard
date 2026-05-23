"""Route tests for dashboard metadata updates."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_update_event_metadata_returns_409_on_optimistic_concurrency_conflict(
    auth_client: TestClient,
) -> None:
    register = auth_client.post(
        "/api/v1/auth/register",
        json={"username": "occ_user", "password": "occpassword123"},
    )
    assert register.status_code == 201, register.text
    owner_id = register.json()["id"]

    auth_client.app.state.db.insert_event(
        event_id="event-router-occ-1",
        program_id="P-ROUTER",
        version="V1",
        uploaded_by_user_id=owner_id,
        status="Pending",
    )

    first = auth_client.put(
        "/api/v1/dashboard/events/event-router-occ-1/metadata",
        json={
            "job_number": "FIRST",
            "if_unmodified_since": None,
        },
    )
    assert first.status_code == 200, first.text

    stale = auth_client.put(
        "/api/v1/dashboard/events/event-router-occ-1/metadata",
        json={
            "job_number": "SECOND",
            "if_unmodified_since": None,
        },
    )
    assert stale.status_code == 409
    assert "modified by another user" in stale.json()["detail"]

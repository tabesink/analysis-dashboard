"""Route tests for dashboard metadata updates."""

from __future__ import annotations

from fastapi.testclient import TestClient

from .conftest import login

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "test-admin-secret"


def _login_admin(client: TestClient) -> dict:
    return login(client, ADMIN_USERNAME, ADMIN_PASSWORD)


def _logout(client: TestClient) -> None:
    client.post("/api/v1/auth/logout")


def test_update_program_version_metadata_forbids_read_only_user(
    auth_client: TestClient,
) -> None:
    """Read-only users cannot bypass the UI route guard via direct API calls."""
    register = auth_client.post(
        "/api/v1/auth/register",
        json={"username": "metadata_reader", "password": "password1234"},
    )
    assert register.status_code == 201, register.text
    reader_id = register.json()["id"]
    assert register.json()["can_write"] is False

    auth_client.app.state.db.insert_event(
        event_id="event-pv-meta-readonly",
        program_id="P-READONLY",
        version="V1",
        uploaded_by_user_id=reader_id,
        status="Pending",
    )

    response = auth_client.put(
        "/api/v1/dashboard/program-version/metadata",
        json={
            "program_id": "P-READONLY",
            "version": "V1",
            "updates": {"job_number": "BLOCKED"},
        },
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Write access required"


def test_update_program_version_metadata_allows_write_user_for_own_uploads(
    auth_client: TestClient,
) -> None:
    """Users with can_write can update metadata for program/versions they own."""
    _login_admin(auth_client)
    create = auth_client.post(
        "/api/v1/admin/users",
        json={
            "username": "metadata_writer",
            "password": "password1234",
            "role": "user",
            "can_write": True,
        },
    )
    assert create.status_code == 201, create.text
    writer_id = create.json()["id"]
    _logout(auth_client)

    login_response = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "metadata_writer", "password": "password1234"},
    )
    assert login_response.status_code == 200

    auth_client.app.state.db.insert_event(
        event_id="event-pv-meta-writer-a",
        program_id="P-WRITER",
        version="V1",
        uploaded_by_user_id=writer_id,
        status="Pending",
    )
    auth_client.app.state.db.insert_event(
        event_id="event-pv-meta-writer-b",
        program_id="P-WRITER",
        version="V1",
        uploaded_by_user_id=writer_id,
        status="Pending",
    )

    response = auth_client.put(
        "/api/v1/dashboard/program-version/metadata",
        json={
            "program_id": "P-WRITER",
            "version": "V1",
            "updates": {"job_number": "WRITER-JOB"},
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["program_id"] == "P-WRITER"
    assert body["version"] == "V1"
    assert body["updated_event_count"] == 2

    refreshed = auth_client.app.state.db.get_events(program_id="P-WRITER", version="V1")
    assert all(event.get("job_number") == "WRITER-JOB" for event in refreshed)


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

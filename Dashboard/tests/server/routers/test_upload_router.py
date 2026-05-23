"""Endpoint tests for upload write-path ownership boundaries."""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient
from server.utils.cache import CacheKeys

from .conftest import login

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "test-admin-secret"
WRITER_PASSWORD = "password1234"


def _logout(client: TestClient) -> None:
    client.post("/api/v1/auth/logout")


def _login_admin(client: TestClient) -> dict[str, Any]:
    return login(client, ADMIN_USERNAME, ADMIN_PASSWORD)


def _create_writer(client: TestClient, username: str) -> dict[str, Any]:
    _login_admin(client)
    response = client.post(
        "/api/v1/admin/users",
        json={
            "username": username,
            "password": WRITER_PASSWORD,
            "role": "user",
            "can_write": True,
        },
    )
    assert response.status_code == 201, response.text
    _logout(client)
    return response.json()


def _login_writer(client: TestClient, username: str) -> dict[str, Any]:
    return login(client, username, WRITER_PASSWORD)


def _insert_event(
    client: TestClient,
    *,
    event_id: str,
    owner_user_id: str,
    program_id: str = "P-ROUTE-SCOPE",
    version: str = "V1",
) -> None:
    client.app.state.db.insert_event(
        event_id=event_id,
        program_id=program_id,
        version=version,
        uploaded_by_user_id=owner_user_id,
        status="Pending",
        source_file=f"{event_id}.csv",
    )


def _seed_event_cache_groups(client: TestClient) -> dict[str, str]:
    keys = {
        "events": f"{CacheKeys.EVENTS}:scope",
        "event_count": f"{CacheKeys.EVENT_COUNT}:scope",
        "program_ids": f"{CacheKeys.PROGRAM_IDS}:scope",
        "versions": f"{CacheKeys.VERSIONS}:scope",
        "filter_options": f"{CacheKeys.FILTER_OPTIONS}:scope",
    }
    for key in keys.values():
        client.app.state.cache.set(key, "stale")
    return keys


def _assert_event_cache_groups_invalidated(
    client: TestClient,
    keys: dict[str, str],
) -> None:
    assert client.app.state.cache.get(keys["events"]) is None
    assert client.app.state.cache.get(keys["event_count"]) is None
    assert client.app.state.cache.get(keys["program_ids"]) is None
    assert client.app.state.cache.get(keys["versions"]) is None
    assert client.app.state.cache.get(keys["filter_options"]) == "stale"


def test_writer_can_delete_scope_owned_entirely_by_self(
    auth_client: TestClient,
) -> None:
    owner = _create_writer(auth_client, "scope_owner")
    _insert_event(
        auth_client,
        event_id="owner-event",
        owner_user_id=owner["id"],
    )
    cache_keys = _seed_event_cache_groups(auth_client)

    _login_writer(auth_client, "scope_owner")
    response = auth_client.post(
        "/api/v1/upload/program-version/delete",
        json={"program_id": "P-ROUTE-SCOPE", "version": "V1"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["event_count"] == 1
    assert auth_client.app.state.db.get_event("owner-event") is None
    _assert_event_cache_groups_invalidated(auth_client, cache_keys)


def test_writer_cannot_delete_mixed_ownership_scope_and_admin_can(
    auth_client: TestClient,
) -> None:
    owner = _create_writer(auth_client, "mixed_owner")
    other_owner = _create_writer(auth_client, "mixed_other_owner")
    _insert_event(
        auth_client,
        event_id="mixed-owner-event",
        owner_user_id=owner["id"],
        program_id="P-ROUTE-MIXED",
    )
    _insert_event(
        auth_client,
        event_id="mixed-other-event",
        owner_user_id=other_owner["id"],
        program_id="P-ROUTE-MIXED",
    )

    _login_writer(auth_client, "mixed_owner")
    cache_keys = _seed_event_cache_groups(auth_client)
    forbidden = auth_client.post(
        "/api/v1/upload/program-version/delete",
        json={"program_id": "P-ROUTE-MIXED", "version": "V1"},
    )

    assert forbidden.status_code == 403
    assert auth_client.app.state.db.get_event("mixed-owner-event") is not None
    assert auth_client.app.state.db.get_event("mixed-other-event") is not None
    assert auth_client.app.state.cache.get(cache_keys["events"]) == "stale"
    assert auth_client.app.state.cache.get(cache_keys["event_count"]) == "stale"
    assert auth_client.app.state.cache.get(cache_keys["program_ids"]) == "stale"
    assert auth_client.app.state.cache.get(cache_keys["versions"]) == "stale"

    _logout(auth_client)
    _login_admin(auth_client)
    allowed = auth_client.post(
        "/api/v1/upload/program-version/delete",
        json={"program_id": "P-ROUTE-MIXED", "version": "V1"},
    )

    assert allowed.status_code == 200, allowed.text
    assert allowed.json()["event_count"] == 2
    assert auth_client.app.state.db.get_event("mixed-owner-event") is None
    assert auth_client.app.state.db.get_event("mixed-other-event") is None
    _assert_event_cache_groups_invalidated(auth_client, cache_keys)

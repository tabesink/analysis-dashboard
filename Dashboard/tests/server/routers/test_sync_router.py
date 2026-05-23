"""Route tests for sync/version endpoint."""

from __future__ import annotations

from fastapi.testclient import TestClient

from .conftest import login


def test_sync_version_requires_authentication(auth_client: TestClient) -> None:
    response = auth_client.get("/api/v1/sync/version")
    assert response.status_code == 401


def test_sync_version_returns_monotonic_data_version(auth_client: TestClient) -> None:
    login(auth_client, "admin", "test-admin-secret")

    first = auth_client.get("/api/v1/sync/version")
    assert first.status_code == 200
    first_value = first.json()["data_version"]
    assert isinstance(first_value, int)

    create_user = auth_client.post(
        "/api/v1/auth/register",
        json={"username": "sync_user", "password": "syncpassword123"},
    )
    assert create_user.status_code == 201, create_user.text

    second = auth_client.get("/api/v1/sync/version")
    assert second.status_code == 200
    second_value = second.json()["data_version"]
    assert second_value > first_value

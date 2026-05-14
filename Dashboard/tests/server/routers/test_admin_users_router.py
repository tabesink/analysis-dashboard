"""Endpoint tests for /admin/users and the require_write_or_admin gate."""

from __future__ import annotations

from fastapi.testclient import TestClient

from .conftest import login

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "test-admin-secret"


def _login_admin(client: TestClient) -> dict:
    return login(client, ADMIN_USERNAME, ADMIN_PASSWORD)


def _logout(client: TestClient) -> None:
    client.post("/api/v1/auth/logout")


def test_list_users_requires_admin(auth_client: TestClient) -> None:
    response = auth_client.get("/api/v1/admin/users")
    assert response.status_code == 401

    auth_client.post(
        "/api/v1/auth/register",
        json={"username": "regular", "password": "password1234"},
    )
    response = auth_client.get("/api/v1/admin/users")
    assert response.status_code == 403


def test_admin_can_list_create_and_delete_users(auth_client: TestClient) -> None:
    _login_admin(auth_client)

    create = auth_client.post(
        "/api/v1/admin/users",
        json={
            "username": "new_writer",
            "password": "freshpassword1",
            "role": "user",
            "can_write": True,
        },
    )
    assert create.status_code == 201, create.text
    created = create.json()
    assert created["role"] == "user"
    assert created["can_write"] is True
    assert created["has_password"] is True

    listed = auth_client.get("/api/v1/admin/users").json()
    usernames = {u["username"] for u in listed}
    assert {"admin", "new_writer"}.issubset(usernames)

    deleted = auth_client.delete(f"/api/v1/admin/users/{created['id']}")
    assert deleted.status_code == 204

    listed_after = auth_client.get("/api/v1/admin/users").json()
    assert "new_writer" not in {u["username"] for u in listed_after}


def test_admin_cannot_delete_self(auth_client: TestClient) -> None:
    admin = _login_admin(auth_client)
    response = auth_client.delete(f"/api/v1/admin/users/{admin['id']}")
    assert response.status_code == 400


def test_admin_reset_password_lets_user_log_in_with_new_password(
    auth_client: TestClient,
) -> None:
    _login_admin(auth_client)
    create = auth_client.post(
        "/api/v1/admin/users",
        json={
            "username": "resetme",
            "password": "originalpassword1",
            "role": "user",
            "can_write": False,
        },
    )
    assert create.status_code == 201
    user_id = create.json()["id"]

    reset = auth_client.post(
        f"/api/v1/admin/users/{user_id}/reset-password",
        json={"new_password": "brandnewpassword1"},
    )
    assert reset.status_code == 204

    _logout(auth_client)

    relogin = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "resetme", "password": "brandnewpassword1"},
    )
    assert relogin.status_code == 200


def test_promote_to_admin_forces_can_write_true(auth_client: TestClient) -> None:
    _login_admin(auth_client)
    create = auth_client.post(
        "/api/v1/admin/users",
        json={
            "username": "promote_me",
            "password": "password1234",
            "role": "user",
            "can_write": False,
        },
    )
    user_id = create.json()["id"]

    promoted = auth_client.patch(
        f"/api/v1/admin/users/{user_id}",
        json={"role": "admin"},
    )
    assert promoted.status_code == 200
    assert promoted.json()["role"] == "admin"
    assert promoted.json()["can_write"] is True


def test_pending_count_drops_after_mark_visited(auth_client: TestClient) -> None:
    _login_admin(auth_client)

    auth_client.post(
        "/api/v1/admin/users",
        json={
            "username": "registrant",
            "password": "password1234",
            "role": "user",
            "can_write": False,
        },
    )

    count = auth_client.get("/api/v1/admin/users/pending-count").json()["count"]
    assert count >= 1

    visited = auth_client.post("/api/v1/admin/users/mark-visited")
    assert visited.status_code == 204

    after = auth_client.get("/api/v1/admin/users/pending-count").json()["count"]
    assert after == 0


def test_purge_deleted_endpoint_requires_write_or_admin(auth_client: TestClient) -> None:
    """`require_write_or_admin` forbids read-only users on write surfaces."""
    auth_client.post(
        "/api/v1/auth/register",
        json={"username": "reader", "password": "password1234"},
    )

    forbidden = auth_client.post(
        "/api/v1/upload/events/purge-deleted",
        json={"event_ids": []},
    )
    assert forbidden.status_code == 403

    _logout(auth_client)
    _login_admin(auth_client)
    allowed_admin = auth_client.post(
        "/api/v1/upload/events/purge-deleted",
        json={"event_ids": []},
    )
    assert allowed_admin.status_code == 200, allowed_admin.text

    _logout(auth_client)
    _login_admin(auth_client)
    create = auth_client.post(
        "/api/v1/admin/users",
        json={
            "username": "writer",
            "password": "password1234",
            "role": "user",
            "can_write": True,
        },
    )
    assert create.status_code == 201
    _logout(auth_client)

    write_login = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "writer", "password": "password1234"},
    )
    assert write_login.status_code == 200

    allowed_writer = auth_client.post(
        "/api/v1/upload/events/purge-deleted",
        json={"event_ids": []},
    )
    assert allowed_writer.status_code == 200, allowed_writer.text

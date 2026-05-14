"""Endpoint tests for the closed-registration auth router."""

from __future__ import annotations

from fastapi.testclient import TestClient

from .conftest import login

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "test-admin-secret"


def test_login_rejects_unknown_user(auth_client: TestClient) -> None:
    response = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "ghost", "password": "irrelevant1234"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid username or password"


def test_login_rejects_short_password(auth_client: TestClient) -> None:
    response = auth_client.post(
        "/api/v1/auth/login",
        json={"username": ADMIN_USERNAME, "password": "short"},
    )
    assert response.status_code == 422


def test_login_succeeds_for_bootstrapped_admin(auth_client: TestClient) -> None:
    user = login(auth_client, ADMIN_USERNAME, ADMIN_PASSWORD)
    assert user["username"] == ADMIN_USERNAME
    assert user["role"] == "admin"
    assert user["can_write"] is True


def test_register_creates_read_only_user_and_logs_in(auth_client: TestClient) -> None:
    response = auth_client.post(
        "/api/v1/auth/register",
        json={"username": "newbie", "password": "freshpassword1"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["username"] == "newbie"
    assert body["role"] == "user"
    assert body["can_write"] is False

    me = auth_client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["username"] == "newbie"


def test_register_rejects_duplicate_username(auth_client: TestClient) -> None:
    first = auth_client.post(
        "/api/v1/auth/register",
        json={"username": "dup", "password": "freshpassword1"},
    )
    assert first.status_code == 201
    auth_client.post("/api/v1/auth/logout")

    second = auth_client.post(
        "/api/v1/auth/register",
        json={"username": "dup", "password": "freshpassword1"},
    )
    assert second.status_code == 409


def test_change_password_requires_correct_current(auth_client: TestClient) -> None:
    auth_client.post(
        "/api/v1/auth/register",
        json={"username": "changer", "password": "oldpassword12"},
    )

    wrong = auth_client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "wrongpassword", "new_password": "newpassword12"},
    )
    assert wrong.status_code == 401

    right = auth_client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "oldpassword12", "new_password": "newpassword12"},
    )
    assert right.status_code == 204

    auth_client.post("/api/v1/auth/logout")

    relogin = auth_client.post(
        "/api/v1/auth/login",
        json={"username": "changer", "password": "newpassword12"},
    )
    assert relogin.status_code == 200


def test_change_password_requires_authentication(auth_client: TestClient) -> None:
    response = auth_client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "oldpassword12", "new_password": "newpassword12"},
    )
    assert response.status_code == 401

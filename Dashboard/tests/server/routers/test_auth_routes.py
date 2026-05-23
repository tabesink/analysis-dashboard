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


def test_login_sets_http_only_cookie(auth_client: TestClient) -> None:
    response = auth_client.post(
        "/api/v1/auth/login",
        json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
    )

    assert response.status_code == 200, response.text
    set_cookie = response.headers["set-cookie"]
    assert "rsp_auth=" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "SameSite=lax" in set_cookie
    assert "Max-Age=86400" in set_cookie


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


def test_logout_clears_auth_cookie(auth_client: TestClient) -> None:
    login(auth_client, ADMIN_USERNAME, ADMIN_PASSWORD)

    response = auth_client.post("/api/v1/auth/logout")

    assert response.status_code == 204
    set_cookie = response.headers["set-cookie"]
    assert "rsp_auth=" in set_cookie
    assert "Max-Age=0" in set_cookie


def test_second_login_invalidates_previous_token(auth_client: TestClient) -> None:
    first_login = auth_client.post(
        "/api/v1/auth/login",
        json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
    )
    assert first_login.status_code == 200, first_login.text
    first_token = first_login.cookies.get("rsp_auth")
    assert first_token

    second_login = auth_client.post(
        "/api/v1/auth/login",
        json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
    )
    assert second_login.status_code == 200, second_login.text
    second_token = second_login.cookies.get("rsp_auth")
    assert second_token
    assert first_token != second_token

    auth_client.cookies.set("rsp_auth", first_token)
    stale_me = auth_client.get("/api/v1/auth/me")
    assert stale_me.status_code == 401

    auth_client.cookies.set("rsp_auth", second_token)
    latest_me = auth_client.get("/api/v1/auth/me")
    assert latest_me.status_code == 200
    assert latest_me.json()["username"] == ADMIN_USERNAME


def test_logout_invalidates_all_outstanding_tokens(auth_client: TestClient) -> None:
    first_login = auth_client.post(
        "/api/v1/auth/login",
        json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
    )
    assert first_login.status_code == 200, first_login.text
    first_token = first_login.cookies.get("rsp_auth")
    assert first_token

    second_login = auth_client.post(
        "/api/v1/auth/login",
        json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
    )
    assert second_login.status_code == 200, second_login.text
    second_token = second_login.cookies.get("rsp_auth")
    assert second_token

    auth_client.cookies.set("rsp_auth", second_token)
    logout_response = auth_client.post("/api/v1/auth/logout")
    assert logout_response.status_code == 204

    auth_client.cookies.set("rsp_auth", first_token)
    stale_me = auth_client.get("/api/v1/auth/me")
    assert stale_me.status_code == 401

    auth_client.cookies.set("rsp_auth", second_token)
    latest_me = auth_client.get("/api/v1/auth/me")
    assert latest_me.status_code == 401

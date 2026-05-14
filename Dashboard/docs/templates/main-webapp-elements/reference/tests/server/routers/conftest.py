"""Shared fixtures for router-level tests.

Router tests boot the FastAPI app via lifespan (so admin bootstrap, db
initialization, and middleware all run end-to-end). The lifespan calls
`server.config.get_settings()` directly, bypassing FastAPI dependency
injection, so we patch the cached settings factory + clear the lru_cache
to surface the isolated `test_settings` everywhere.
"""

from __future__ import annotations

import json
import secrets
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from server import config as server_config
from server.config import Settings


@pytest.fixture
def auth_settings(test_settings: Settings) -> Settings:
    """Settings with non-empty JWT secret + plain cookies for TestClient."""
    test_settings.jwt_secret = secrets.token_hex(32)
    test_settings.auth_cookie_secure = False
    return test_settings


@pytest.fixture
def auth_client(
    monkeypatch: pytest.MonkeyPatch, auth_settings: Settings
) -> Iterator[TestClient]:
    """TestClient whose lifespan + DI both see `auth_settings`."""

    monkeypatch.setattr(
        server_config, "create_settings_from_yaml", lambda: auth_settings
    )
    server_config.get_settings.cache_clear()

    from server.dependencies import get_settings as deps_get_settings
    from server.main import create_app

    app = create_app()
    app.dependency_overrides[deps_get_settings] = lambda: auth_settings

    with TestClient(app) as client:
        yield client

    server_config.get_settings.cache_clear()


def login(client: TestClient, username: str, password: str) -> dict[str, Any]:
    """Helper: POST /auth/login and return the parsed user response."""
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200, response.text
    return json.loads(response.text)

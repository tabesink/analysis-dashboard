from __future__ import annotations

from fastapi.testclient import TestClient


def test_info_includes_runtime_and_database_schema_status(auth_client: TestClient) -> None:
    response = auth_client.get("/api/v1/info")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["server_version"]
    assert body["api_version"] == "v1"
    assert body["client_min_version"]
    assert body["app_env"] == "development"
    assert body["database_status"] == "connected"
    assert body["database_schema_version"] == 1
    assert body["database_schema_target_version"] == 1
    assert body["database_schema_needs_migration"] is False

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.routers.health import router


def test_readiness_returns_503_when_database_is_unavailable() -> None:
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json()["status"] == "not_ready"

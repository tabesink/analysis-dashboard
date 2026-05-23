"""Endpoint tests for admin-only database export/import routes."""

from __future__ import annotations

import time
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from server.dependencies import get_export_service
from server.services.export import TaskStatus, _put_task, get_task

from .conftest import login

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "test-admin-secret"


class StubExportService:
    """Small route-test double that avoids real DuckDB export/import work."""

    def get_database_info(self) -> dict[str, Any]:
        return {
            "path": "/tmp/dashboard-test.db",
            "size_mb": 0.0,
            "event_count": 0,
            "program_count": 0,
        }

    def start_export_task(self) -> str:
        return "export-task-1"

    def mark_export_downloading(self, _task_id: str) -> bool:
        return True

    def validate_import_zip(self, _tmp_path: Any) -> dict[str, Any]:
        return {
            "valid": True,
            "event_count": 0,
            "size_mb": 0.01,
            "tables": [],
            "schema_compatibility": {
                "is_compatible": True,
                "is_legacy": False,
                "imported_schema_version": 1,
                "current_schema_version": 1,
                "schema_version_match": True,
                "missing_columns": [],
                "extra_columns": [],
            },
        }

    def register_upload(self, _tmp_path: Any) -> str:
        return "staged-upload"

    def cancel_task(self, task_id: str) -> bool:
        return task_id == "running-task"

    def cancel_pending_upload(self, upload_id: str) -> None:
        return None

    def start_import_task(self, upload_id: str) -> str:
        return f"import-{upload_id}"

    def cleanup_export_zip(self, _task_id: str) -> None:
        return None


@pytest.fixture(autouse=True)
def stub_export_service(auth_client: TestClient) -> Iterator[None]:
    auth_client.app.dependency_overrides[get_export_service] = StubExportService
    yield
    auth_client.app.dependency_overrides.pop(get_export_service, None)


def _login_admin(client: TestClient) -> dict[str, Any]:
    return login(client, ADMIN_USERNAME, ADMIN_PASSWORD)


def _logout(client: TestClient) -> None:
    client.post("/api/v1/auth/logout")


def _create_writer(client: TestClient) -> None:
    _login_admin(client)
    response = client.post(
        "/api/v1/admin/users",
        json={
            "username": "writer",
            "password": "password1234",
            "role": "user",
            "can_write": True,
        },
    )
    assert response.status_code == 201, response.text
    _logout(client)


def _zip_file() -> dict[str, tuple[str, bytes, str]]:
    return {"file": ("portable.zip", b"stub archive", "application/zip")}


def test_admin_can_download_completed_export_without_logging_reserved_field_error(
    auth_client: TestClient,
    tmp_path: Path,
) -> None:
    _login_admin(auth_client)
    zip_path = tmp_path / "dashboard_export.zip"
    zip_path.write_bytes(b"zip-bytes")
    _put_task(
        TaskStatus(
            task_id="completed-export",
            kind="export",
            status="completed",
            progress="Ready to download",
            zip_path=zip_path,
        )
    )

    response = auth_client.get(
        "/api/v1/export/database/parquet/download/completed-export"
    )

    assert response.status_code == 200, response.text
    assert response.content == b"zip-bytes"
    assert response.headers["content-disposition"] == "attachment; filename=dashboard_export.zip"


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/v1/export/database/info"),
        ("POST", "/api/v1/export/database/parquet/export/start"),
        ("GET", "/api/v1/export/database/parquet/task/unknown-task"),
        ("GET", "/api/v1/export/database/parquet/download/unknown-task"),
        ("DELETE", "/api/v1/export/database/parquet/task/unknown-task"),
        ("DELETE", "/api/v1/export/database/parquet/upload/staged-upload"),
        ("POST", "/api/v1/export/database/parquet/import/staged-upload"),
    ],
)
def test_export_routes_reject_unauthenticated_callers(
    auth_client: TestClient,
    method: str,
    path: str,
) -> None:
    response = auth_client.request(method, path)
    assert response.status_code == 401


@pytest.mark.parametrize("username", ["reader", "writer"])
def test_export_database_info_rejects_non_admin_users(
    auth_client: TestClient,
    username: str,
) -> None:
    if username == "writer":
        _create_writer(auth_client)
        response = auth_client.post(
            "/api/v1/auth/login",
            json={"username": "writer", "password": "password1234"},
        )
    else:
        response = auth_client.post(
            "/api/v1/auth/register",
            json={"username": "reader", "password": "password1234"},
        )
    assert response.status_code in {200, 201}, response.text

    forbidden = auth_client.get("/api/v1/export/database/info")
    assert forbidden.status_code == 403


def test_admin_can_reach_export_route_contract(auth_client: TestClient) -> None:
    _login_admin(auth_client)

    info = auth_client.get("/api/v1/export/database/info")
    assert info.status_code == 200, info.text
    assert info.json() == {
        "path": "/tmp/dashboard-test.db",
        "size_mb": 0.0,
        "event_count": 0,
        "program_count": 0,
        "max_upload_size_mb": 61440,
    }

    started = auth_client.post("/api/v1/export/database/parquet/export/start")
    assert started.status_code == 200, started.text
    assert started.json() == {"task_id": "export-task-1"}


def test_parquet_upload_rejects_non_admins_before_validation(
    auth_client: TestClient,
) -> None:
    unauthenticated = auth_client.post(
        "/api/v1/export/database/parquet/upload",
        files=_zip_file(),
    )
    assert unauthenticated.status_code == 401

    response = auth_client.post(
        "/api/v1/auth/register",
        json={"username": "reader", "password": "password1234"},
    )
    assert response.status_code == 201, response.text

    forbidden = auth_client.post(
        "/api/v1/export/database/parquet/upload",
        files=_zip_file(),
    )
    assert forbidden.status_code == 403


def test_admin_can_reach_upload_route_contract(auth_client: TestClient) -> None:
    _login_admin(auth_client)

    uploaded = auth_client.post(
        "/api/v1/export/database/parquet/upload",
        files=_zip_file(),
    )
    assert uploaded.status_code == 200, uploaded.text
    assert uploaded.json() == {
        "upload_id": "staged-upload",
        "validation": {
            "valid": True,
            "event_count": 0,
            "size_mb": 0.01,
            "tables": [],
            "schema_compatibility": {
                "is_compatible": True,
                "is_legacy": False,
                "imported_schema_version": 1,
                "current_schema_version": 1,
                "schema_version_match": True,
                "missing_columns": [],
                "extra_columns": [],
            },
            "warnings": [],
        },
    }


def test_task_status_includes_import_progress_fields(auth_client: TestClient) -> None:
    _login_admin(auth_client)
    task = TaskStatus(
        task_id="progress-task",
        kind="import",
        phase="importing",
        sub_phase="loading",
        progress="Loading measurements_raw (12/16)…",
        current=12,
        total=16,
        current_table="measurements_raw",
    )
    _put_task(task)

    response = auth_client.get("/api/v1/export/database/parquet/task/progress-task")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["sub_phase"] == "loading"
    assert body["updated_at"] > 0
    assert body["current"] == 12
    assert body["total"] == 16


def test_import_task_has_longer_stall_threshold_than_export(
    auth_client: TestClient,
) -> None:
    _login_admin(auth_client)
    _put_task(TaskStatus(task_id="slow-import", kind="import", progress="Backing up"))
    _put_task(TaskStatus(task_id="slow-export", kind="export", progress="Exporting"))
    for task_id in ("slow-import", "slow-export"):
        task = get_task(task_id)
        assert task is not None
        task.updated_at = time.time() - 180

    import_response = auth_client.get("/api/v1/export/database/parquet/task/slow-import")
    export_response = auth_client.get("/api/v1/export/database/parquet/task/slow-export")

    assert import_response.status_code == 200, import_response.text
    assert import_response.json()["status"] == "running"
    assert export_response.status_code == 200, export_response.text
    assert export_response.json()["status"] == "failed"
    assert "2 minutes" in export_response.json()["error"]


def test_admin_can_reach_import_and_cleanup_route_contract(
    auth_client: TestClient,
) -> None:
    _login_admin(auth_client)

    imported = auth_client.post("/api/v1/export/database/parquet/import/staged-upload")
    assert imported.status_code == 200, imported.text
    assert imported.json() == {"task_id": "import-staged-upload"}

    cancelled_upload = auth_client.delete(
        "/api/v1/export/database/parquet/upload/staged-upload"
    )
    assert cancelled_upload.status_code == 200, cancelled_upload.text
    assert cancelled_upload.json() == {"ok": True}

    cancelled_task = auth_client.delete(
        "/api/v1/export/database/parquet/task/running-task"
    )
    assert cancelled_task.status_code == 200, cancelled_task.text
    assert cancelled_task.json() == {"ok": True}


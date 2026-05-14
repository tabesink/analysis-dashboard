"""Database export/import endpoints for portability (Parquet ZIP)."""

import tempfile
import time
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from server.config import get_settings
from server.dependencies import AdminRequiredDep, get_export_service
from server.exceptions import ValidationError
from server.services.export import ExportService, _update_task, get_task
from server.utils.logging import get_audit_logger

router = APIRouter(prefix="/export")
settings = get_settings()
audit_log = get_audit_logger()
MAX_UPLOAD_BYTES = settings.max_upload_size_mb * 1024 * 1024
CHUNK_SIZE = 8 * 1024 * 1024
STALL_THRESHOLD_SEC = 120  # 2 minutes with no heartbeat = likely dead thread


class DatabaseInfoResponse(BaseModel):
    """Database information response."""

    path: str
    size_mb: float
    event_count: int
    program_count: int
    max_upload_size_mb: int = Field(
        description="Maximum allowed size for database import ZIP uploads (MB)",
    )


class SchemaCompatibility(BaseModel):
    """Schema compatibility information."""

    is_compatible: bool = Field(description="Whether the schema is compatible")
    is_legacy: bool = Field(description="Whether this is a legacy database without schema metadata")
    imported_schema_version: int | None = Field(description="Schema version in imported database")
    current_schema_version: int = Field(description="Current schema version")
    schema_version_match: bool = Field(description="Whether schema versions match")
    missing_columns: list[str] = Field(description="Filter columns in current but not in imported")
    extra_columns: list[str] = Field(description="Filter columns in imported but not in current")


class ValidationResponse(BaseModel):
    """Database validation response."""

    valid: bool = Field(description="Whether the database is valid for import")
    event_count: int = Field(description="Number of events in database")
    size_mb: float = Field(description="Size of archive in MB")
    tables: list[str] = Field(description="Parquet tables found in archive")
    schema_compatibility: SchemaCompatibility = Field(description="Schema compatibility info")
    warnings: list[str] = Field(default_factory=list, description="Validation warnings")


class UploadResponse(BaseModel):
    """Registered upload ready for import confirmation."""

    upload_id: str
    validation: ValidationResponse


class StartTaskResponse(BaseModel):
    """Background task started."""

    task_id: str


class TaskStatusResponse(BaseModel):
    """Pollable task status."""

    task_id: str
    kind: str
    status: str
    progress: str
    phase: str = ""
    current: int
    total: int
    current_table: str | None = None
    events_loaded: int | None = None
    error: str | None = None
    result: dict[str, Any] | None = None


def _validation_warnings(compat: dict[str, Any]) -> list[str]:
    warnings: list[str] = []
    if compat.get("is_legacy"):
        warnings.append(
            "Legacy export without schema metadata — current schema configuration will be applied after import",
        )
    if compat.get("missing_columns"):
        warnings.append(f"Missing filter columns: {', '.join(compat['missing_columns'])}")
    if compat.get("extra_columns"):
        warnings.append(f"Extra filter columns in export: {', '.join(compat['extra_columns'])}")
    if not compat.get("schema_version_match") and not compat.get("is_legacy"):
        warnings.append(
            f"Schema version mismatch: imported={compat.get('imported_schema_version')}, "
            f"current={compat.get('current_schema_version')}",
        )
    return warnings


async def stream_upload_to_disk(file: UploadFile, max_bytes: int) -> Path:
    """Stream upload to a temp file; enforce max compressed size."""
    tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    tmp_path = Path(tmp.name)
    total = 0
    try:
        while chunk := await file.read(CHUNK_SIZE):
            total += len(chunk)
            if total > max_bytes:
                tmp.close()
                tmp_path.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"Upload exceeds max size of {settings.max_upload_size_mb} MB",
                )
            tmp.write(chunk)
        tmp.close()
        return tmp_path
    except HTTPException:
        raise
    except Exception:
        tmp.close()
        tmp_path.unlink(missing_ok=True)
        raise


@router.get(
    "/database/info",
    response_model=DatabaseInfoResponse,
)
async def get_database_info(
    _: AdminRequiredDep,
    export_service: Annotated[ExportService, Depends(get_export_service)],
) -> DatabaseInfoResponse:
    """Get information about the current database (admin)."""
    info = export_service.get_database_info()
    return DatabaseInfoResponse(
        **info,
        max_upload_size_mb=settings.max_upload_size_mb,
    )


@router.post(
    "/database/parquet/export/start",
    response_model=StartTaskResponse,
)
async def start_parquet_export(
    _: AdminRequiredDep,
    export_service: Annotated[ExportService, Depends(get_export_service)],
) -> StartTaskResponse:
    """Start background export to Parquet ZIP (admin)."""
    task_id = export_service.start_export_task()
    audit_log.info(
        "db export started",
        extra={"event": "db_export_started", "request_id": task_id},
    )
    return StartTaskResponse(task_id=task_id)


@router.get(
    "/database/parquet/task/{task_id}",
    response_model=TaskStatusResponse,
)
async def get_parquet_task_status(
    _: AdminRequiredDep,
    task_id: str,
) -> TaskStatusResponse:
    """Poll export or import task status (admin)."""
    t = get_task(task_id)
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown task_id")

    if t.status == "running" and t.updated_at > 0:
        elapsed = time.time() - t.updated_at
        if elapsed > STALL_THRESHOLD_SEC:
            _update_task(
                task_id,
                status="failed",
                error="Task stalled — no progress for 2 minutes",
                progress="Failed (stalled)",
                phase="failed",
            )
            t = get_task(task_id)
            if not t:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown task_id")

    return TaskStatusResponse(
        task_id=t.task_id,
        kind=t.kind,
        status=t.status,
        progress=t.progress,
        phase=t.phase,
        current=t.current,
        total=t.total,
        current_table=t.current_table,
        events_loaded=t.events_loaded,
        error=t.error,
        result=t.result,
    )


def _schedule_cleanup(export_service: ExportService, task_id: str) -> None:
    export_service.cleanup_export_zip(task_id)


@router.get(
    "/database/parquet/download/{task_id}",
    response_class=FileResponse,
)
async def download_parquet_export(
    _: AdminRequiredDep,
    task_id: str,
    background_tasks: BackgroundTasks,
    export_service: Annotated[ExportService, Depends(get_export_service)],
) -> FileResponse:
    """Download completed Parquet ZIP; removes artifact after send (admin)."""
    t = get_task(task_id)
    if not t or t.kind != "export":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown export task")
    if t.status != "completed" or not t.zip_path or not t.zip_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Export not ready or already downloaded",
        )
    export_service.mark_export_downloading(task_id)
    zp = t.zip_path
    background_tasks.add_task(_schedule_cleanup, export_service, task_id)
    audit_log.info(
        "db export completed",
        extra={
            "event": "db_export_completed",
            "request_id": task_id,
            "filename": zp.name,
            "bytes": zp.stat().st_size if zp.is_file() else None,
        },
    )
    return FileResponse(
        path=str(zp),
        filename="dashboard_export.zip",
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=dashboard_export.zip"},
    )


@router.post(
    "/database/parquet/upload",
    response_model=UploadResponse,
)
async def upload_parquet_export_for_import(
    _: AdminRequiredDep,
    export_service: Annotated[ExportService, Depends(get_export_service)],
    file: UploadFile = File(..., description="Parquet export ZIP"),
) -> UploadResponse:
    """Stream ZIP to disk, validate once, return upload_id for confirm/import (admin)."""
    tmp_path = await stream_upload_to_disk(file, MAX_UPLOAD_BYTES)
    try:
        result = export_service.validate_import_zip(tmp_path)
    except ValidationError as e:
        tmp_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except Exception:
        tmp_path.unlink(missing_ok=True)
        raise

    compat = result.get("schema_compatibility", {})
    warnings = _validation_warnings(compat)
    validation = ValidationResponse(
        valid=result["valid"],
        event_count=result["event_count"],
        size_mb=result["size_mb"],
        tables=result["tables"],
        schema_compatibility=SchemaCompatibility(**compat),
        warnings=warnings,
    )
    upload_id = export_service.register_upload(tmp_path)
    audit_log.info(
        "db import upload received",
        extra={
            "event": "db_import_started",
            "request_id": upload_id,
            "filename": file.filename,
            "bytes": tmp_path.stat().st_size if tmp_path.is_file() else None,
            "rows": result.get("event_count"),
        },
    )
    return UploadResponse(upload_id=upload_id, validation=validation)


@router.delete(
    "/database/parquet/task/{task_id}",
    response_model=dict[str, bool],
)
async def cancel_parquet_task(
    _: AdminRequiredDep,
    task_id: str,
    export_service: Annotated[ExportService, Depends(get_export_service)],
) -> dict[str, bool]:
    """Cancel a running export or import background task (admin)."""
    ok = export_service.cancel_task(task_id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unknown task_id or task is not running",
        )
    return {"ok": True}


@router.delete("/database/parquet/upload/{upload_id}")
async def cancel_parquet_upload(
    _: AdminRequiredDep,
    upload_id: str,
    export_service: Annotated[ExportService, Depends(get_export_service)],
) -> dict[str, bool]:
    """Discard a validated upload ZIP without importing (admin)."""
    export_service.cancel_pending_upload(upload_id)
    return {"ok": True}


@router.post(
    "/database/parquet/import/{upload_id}",
    response_model=StartTaskResponse,
)
async def start_parquet_import(
    _: AdminRequiredDep,
    upload_id: str,
    export_service: Annotated[ExportService, Depends(get_export_service)],
) -> StartTaskResponse:
    """Start background import from a prior upload (admin)."""
    try:
        task_id = export_service.start_import_task(upload_id)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    audit_log.info(
        "db import completed",
        extra={
            "event": "db_import_completed",
            "request_id": task_id,
            "reason": f"upload={upload_id}",
        },
    )
    return StartTaskResponse(task_id=task_id)

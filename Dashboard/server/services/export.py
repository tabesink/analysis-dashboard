"""Database export/import service for portability (Parquet + ZIP)."""

from __future__ import annotations

import json
import logging
import shutil
import tempfile
import threading
import time
import uuid
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import duckdb

from server.config import Settings
from server.exceptions import ValidationError
from server.storage.database import UnifiedStore
from server.storage.schema_loader import get_schema_loader

logger = logging.getLogger(__name__)


class TaskCancelled(Exception):
    """Raised when a background export/import task is cancelled."""


def _decode_metadata_json(raw: Any) -> Any:
    if raw is None:
        return None
    if isinstance(raw, (dict, list)):
        return raw
    if isinstance(raw, memoryview):
        raw = raw.tobytes()
    if isinstance(raw, (bytes, bytearray)):
        raw = raw.decode("utf-8")
    if isinstance(raw, str):
        return json.loads(raw)
    return json.loads(str(raw))


EXTRACT_CHUNK = 4 * 1024 * 1024  # 4 MB — granularity for cancel checks and progress during extraction


@dataclass
class TaskStatus:
    """In-memory export/import job state (single-process admin use)."""

    task_id: str
    kind: str  # "export" | "import"
    status: str = "running"  # running | completed | failed | cancelled
    progress: str = ""
    phase: str = ""
    current: int = 0
    total: int = 0
    current_table: str | None = None
    events_loaded: int | None = None
    result: dict[str, Any] | None = None
    error: str | None = None
    zip_path: Path | None = None
    updated_at: float = field(default_factory=time.time)


_tasks_lock = threading.Lock()
_tasks: dict[str, TaskStatus] = {}
_uploads_lock = threading.Lock()
_pending_uploads: dict[str, Path] = {}
_cancel_events_lock = threading.Lock()
_cancel_events: dict[str, threading.Event] = {}


def _new_task_id() -> str:
    return uuid.uuid4().hex


def _put_task(task: TaskStatus) -> None:
    task.updated_at = time.time()
    with _tasks_lock:
        _tasks[task.task_id] = task


def get_task(task_id: str) -> TaskStatus | None:
    with _tasks_lock:
        return _tasks.get(task_id)


def _register_cancel_event(task_id: str) -> threading.Event:
    ev = threading.Event()
    with _cancel_events_lock:
        _cancel_events[task_id] = ev
    return ev


def _unregister_cancel_event(task_id: str) -> None:
    with _cancel_events_lock:
        _cancel_events.pop(task_id, None)


def _check_cancel(task_id: str) -> None:
    with _cancel_events_lock:
        ev = _cancel_events.get(task_id)
    if ev is not None and ev.is_set():
        raise TaskCancelled()


def _update_task(
    task_id: str,
    *,
    progress: str | None = None,
    phase: str | None = None,
    current: int | None = None,
    total: int | None = None,
    current_table: str | None = None,
    events_loaded: int | None = None,
    status: str | None = None,
    result: dict[str, Any] | None = None,
    error: str | None = None,
    zip_path: Path | None = None,
) -> None:
    with _tasks_lock:
        t = _tasks.get(task_id)
        if not t:
            return
        t.updated_at = time.time()
        if progress is not None:
            t.progress = progress
        if phase is not None:
            t.phase = phase
        if current is not None:
            t.current = current
        if total is not None:
            t.total = total
        if current_table is not None:
            t.current_table = current_table
        if events_loaded is not None:
            t.events_loaded = events_loaded
        if status is not None:
            t.status = status
        if result is not None:
            t.result = result
        if error is not None:
            t.error = error
        if zip_path is not None:
            t.zip_path = zip_path


def _find_parquet_export_root(root: Path) -> Path:
    if (root / "schema.sql").is_file() and (root / "load.sql").is_file():
        return root
    for child in root.iterdir():
        if child.is_dir() and (child / "schema.sql").is_file() and (child / "load.sql").is_file():
            return child
    raise ValidationError(
        "Invalid archive: missing schema.sql / load.sql at zip root or single subfolder",
        details={},
    )


class ExportService:
    """
    Service for database export/import operations.

    Exports Parquet (zstd) + schema/load SQL, zipped. Imports the same format.
    """

    def __init__(self, db: UnifiedStore, settings: Settings):
        self.db = db
        self.settings = settings

    def get_database_path(self) -> Path:
        """Get path to the current database file."""
        return self.db.db_path

    def get_database_info(self) -> dict[str, Any]:
        """Get metadata about the current database."""
        db_path = self.db.db_path

        event_count = self.db.read_connection.execute(
            "SELECT COUNT(*) FROM dim_event WHERE is_deleted = false"
        ).fetchone()[0]

        size_mb = db_path.stat().st_size / (1024 * 1024) if db_path.exists() else 0

        program_count = len(self.db.get_program_ids())

        return {
            "path": str(db_path),
            "size_mb": round(size_mb, 2),
            "event_count": event_count,
            "program_count": program_count,
        }

    def start_export_task(self) -> str:
        """Create export task and run it in a background thread."""
        task_id = _new_task_id()
        _register_cancel_event(task_id)
        task = TaskStatus(task_id=task_id, kind="export", phase="exporting")
        _put_task(task)
        thread = threading.Thread(target=self._run_export, args=(task_id,), daemon=True)
        thread.start()
        return task_id

    def cancel_task(self, task_id: str) -> bool:
        """Request cancellation of a running export/import task. Returns False if unknown or not running."""
        t = get_task(task_id)
        if not t or t.status != "running":
            return False
        with _cancel_events_lock:
            ev = _cancel_events.get(task_id)
        if ev is not None:
            ev.set()
        t_after = get_task(task_id)
        if t_after and t_after.status == "running":
            _update_task(task_id, progress="Cancellation requested…")
        return True

    def mark_export_downloading(self, task_id: str) -> bool:
        """Mark export task as in the client download phase (HTTP download started)."""
        t = get_task(task_id)
        if not t or t.kind != "export" or t.status != "completed":
            return False
        _update_task(task_id, phase="downloading")
        return True

    def _run_export(self, task_id: str) -> None:
        work = Path(tempfile.mkdtemp(prefix="export-parquet-"))
        export_dir = work / "data"
        success = False
        try:
            _check_cancel(task_id)
            export_dir.mkdir()
            _update_task(task_id, phase="exporting", progress="Starting export…")

            def on_progress(table: str | None, cur: int, tot: int) -> None:
                _check_cancel(task_id)
                if table:
                    msg = f"Exporting {table} ({cur}/{tot})"
                else:
                    msg = f"Preparing export ({cur}/{tot})"
                _update_task(
                    task_id,
                    progress=msg,
                    phase="exporting",
                    current=cur,
                    total=tot,
                    current_table=table,
                )

            self.db.export_to_parquet(export_dir, on_progress=on_progress)
            artifact_root = self.settings.data_root / "artifacts" / "channel-map"
            if artifact_root.exists():
                target = export_dir / "managed_artifacts" / "channel-map"
                shutil.copytree(artifact_root, target, dirs_exist_ok=True)

            _check_cancel(task_id)
            _update_task(
                task_id,
                phase="compressing",
                progress="Creating ZIP archive…",
                current=1,
                total=1,
            )
            zip_base = work / "dashboard_export"
            shutil.make_archive(str(zip_base), "zip", root_dir=str(export_dir))
            zip_path = Path(str(zip_base) + ".zip")

            _update_task(
                task_id,
                status="completed",
                progress="Ready to download",
                phase="pending_download",
                zip_path=zip_path,
                result={
                    "filename": "dashboard_export.zip",
                    "size_mb": round(zip_path.stat().st_size / (1024 * 1024), 2),
                },
            )
            success = True
        except TaskCancelled:
            logger.info("Export task cancelled: %s", task_id)
            _update_task(
                task_id,
                status="cancelled",
                error="Cancelled",
                progress="Cancelled",
                phase="cancelled",
            )
        except Exception as e:
            logger.exception("Export task failed")
            _update_task(
                task_id,
                status="failed",
                error=str(e),
                progress="Failed",
                phase="failed",
            )
        finally:
            _unregister_cancel_event(task_id)
            try:
                if export_dir.exists():
                    shutil.rmtree(export_dir, ignore_errors=True)
            except Exception:
                pass
            if not success:
                shutil.rmtree(work, ignore_errors=True)

    def register_upload(self, zip_path: Path) -> str:
        """Store a validated upload zip on disk; return upload_id."""
        upload_id = _new_task_id()
        with _uploads_lock:
            _pending_uploads[upload_id] = zip_path
        return upload_id

    def pop_upload(self, upload_id: str) -> Path | None:
        with _uploads_lock:
            return _pending_uploads.pop(upload_id, None)

    def cancel_pending_upload(self, upload_id: str) -> None:
        """Remove a staged upload ZIP if import was cancelled (admin)."""
        with _uploads_lock:
            path = _pending_uploads.pop(upload_id, None)
        if path and path.is_file():
            try:
                path.unlink()
            except OSError:
                logger.warning("Could not delete cancelled upload %s", path)

    def validate_import_zip(self, zip_path: Path) -> dict[str, Any]:
        """
        Validate a Parquet export ZIP without replacing the live database.

        Returns the same shape as before for API compatibility.
        """
        if not zipfile.is_zipfile(zip_path):
            raise ValidationError("Not a valid ZIP file", details={})

        with tempfile.TemporaryDirectory(prefix="validate-parquet-") as tmp:
            extract_root = Path(tmp)
            shutil.unpack_archive(str(zip_path), extract_dir=str(extract_root), format="zip")
            export_root = _find_parquet_export_root(extract_root)

            dim_event_pq = export_root / "dim_event.parquet"
            ml_pq = export_root / "measurements_lttb.parquet"
            if not dim_event_pq.is_file():
                raise ValidationError("Invalid export: missing dim_event.parquet", details={})
            if not ml_pq.is_file():
                raise ValidationError("Invalid export: missing measurements_lttb.parquet", details={})

            conn = duckdb.connect(":memory:")
            try:
                event_count = conn.execute(
                    """
                    SELECT COUNT(*) FROM read_parquet(?)
                    WHERE COALESCE(try_cast(is_deleted AS BOOLEAN), false) = false
                    """,
                    [str(dim_event_pq)],
                ).fetchone()[0]
            except duckdb.Error:
                event_count = conn.execute(
                    "SELECT COUNT(*) FROM read_parquet(?)",
                    [str(dim_event_pq)],
                ).fetchone()[0]

            table_names: set[str] = {p.stem for p in export_root.glob("*.parquet")}

            schema_info: dict[str, Any] = {}
            is_legacy = True
            meta_pq = export_root / "_schema_metadata.parquet"
            if meta_pq.is_file():
                try:
                    rows = conn.execute("SELECT key, value FROM read_parquet(?)", [str(meta_pq)]).fetchall()
                    schema_info = {row[0]: _decode_metadata_json(row[1]) for row in rows}
                    is_legacy = len(schema_info) == 0
                except (duckdb.Error, json.JSONDecodeError, TypeError):
                    is_legacy = True

            current_loader = get_schema_loader()
            current_filter_columns = set(current_loader.get_filter_column_names())
            imported_filter_columns = set(schema_info.get("filter_columns") or [])

            compatibility = {
                "is_compatible": True,
                "is_legacy": is_legacy,
                "imported_schema_version": schema_info.get("schema_version"),
                "current_schema_version": current_loader.version,
                "schema_version_match": schema_info.get("schema_version") == current_loader.version,
                "missing_columns": list(current_filter_columns - imported_filter_columns),
                "extra_columns": list(imported_filter_columns - current_filter_columns),
            }

            if is_legacy:
                logger.warning("Importing legacy export without readable schema metadata")
            elif compatibility["missing_columns"] or compatibility["extra_columns"]:
                logger.warning(
                    "Schema difference in import: missing=%s extra=%s",
                    compatibility["missing_columns"],
                    compatibility["extra_columns"],
                )

            zip_size_mb = zip_path.stat().st_size / (1024 * 1024)

            return {
                "valid": True,
                "event_count": int(event_count),
                "size_mb": round(zip_size_mb, 2),
                "tables": sorted(table_names),
                "schema_compatibility": compatibility,
            }

    def start_import_task(self, upload_id: str) -> str:
        """Spawn import from a registered upload zip path."""
        zip_path = self.pop_upload(upload_id)
        if zip_path is None or not zip_path.is_file():
            raise ValidationError("Unknown or expired upload_id", details={"upload_id": upload_id})

        task_id = _new_task_id()
        _register_cancel_event(task_id)
        task = TaskStatus(task_id=task_id, kind="import", phase="extracting")
        _put_task(task)
        thread = threading.Thread(
            target=self._run_import,
            args=(task_id, zip_path),
            daemon=True,
        )
        thread.start()
        return task_id

    def _run_import(self, task_id: str, zip_path: Path) -> None:
        work = Path(tempfile.mkdtemp(prefix="import-parquet-"))
        extract_root = work / "extract"
        try:
            _check_cancel(task_id)
            extract_root.mkdir()
            with zipfile.ZipFile(str(zip_path), "r") as zf:
                members = zf.namelist()
                total_members = len(members)
                _update_task(
                    task_id,
                    phase="extracting",
                    progress=f"Extracting 0 of {total_members} files",
                    current=0,
                    total=total_members,
                )
                for i, member in enumerate(members):
                    _check_cancel(task_id)
                    info = zf.getinfo(member)
                    target = extract_root / member
                    if info.is_dir():
                        target.mkdir(parents=True, exist_ok=True)
                    else:
                        target.parent.mkdir(parents=True, exist_ok=True)
                        file_size = info.file_size
                        file_mb = file_size / (1024 * 1024)
                        is_large = file_size > 50 * 1024 * 1024
                        if file_mb > 10:
                            logger.info("Extracting %s (%.1f MB)…", member, file_mb)
                        with zf.open(member) as src, open(target, "wb") as dst:
                            written = 0
                            while True:
                                _check_cancel(task_id)
                                chunk = src.read(EXTRACT_CHUNK)
                                if not chunk:
                                    break
                                dst.write(chunk)
                                written += len(chunk)
                                if is_large:
                                    pct = int(100 * written / file_size) if file_size else 100
                                    _update_task(
                                        task_id,
                                        progress=f"Extracting {member} ({pct}%)",
                                    )
                    _update_task(
                        task_id,
                        phase="extracting",
                        progress=f"Extracting {i + 1} of {total_members} files",
                        current=i + 1,
                        total=total_members,
                    )
            export_root = _find_parquet_export_root(extract_root)

            def on_progress(table: str | None, cur: int, tot: int) -> None:
                _check_cancel(task_id)
                if table:
                    msg = f"Importing {table} ({cur}/{tot})"
                else:
                    msg = f"Starting import ({cur}/{tot})"
                _update_task(
                    task_id,
                    progress=msg,
                    phase="importing",
                    current=cur,
                    total=tot,
                    current_table=table,
                )

            self.db.log_audit(
                action="DATABASE_IMPORT_START",
                details={"zip_mb": round(zip_path.stat().st_size / (1024 * 1024), 2)},
            )

            _update_task(task_id, phase="importing", progress="Loading database…")
            result = self.db.import_from_parquet(export_root, on_progress=on_progress)
            imported_artifacts = export_root / "managed_artifacts" / "channel-map"
            if imported_artifacts.exists():
                target = self.settings.data_root / "artifacts" / "channel-map"
                target.parent.mkdir(parents=True, exist_ok=True)
                if target.exists():
                    shutil.rmtree(target)
                shutil.copytree(imported_artifacts, target)

            _update_task(
                task_id,
                status="completed",
                progress="Import complete",
                phase="completed",
                events_loaded=result.get("events"),
                result=result,
            )

            self.db.log_audit(action="DATABASE_IMPORTED", details=result)
            logger.info(
                "Database imported: %s events, %s MB",
                result.get("events"),
                result.get("size_mb"),
            )
        except TaskCancelled:
            logger.info("Import task cancelled: %s", task_id)
            _update_task(
                task_id,
                status="cancelled",
                error="Cancelled",
                progress="Cancelled",
                phase="cancelled",
            )
        except Exception as e:
            logger.exception("Import task failed")
            _update_task(
                task_id,
                status="failed",
                error=str(e),
                progress="Failed",
                phase="failed",
            )
        finally:
            _unregister_cancel_event(task_id)
            try:
                shutil.rmtree(work, ignore_errors=True)
            except Exception:
                pass
            try:
                zip_path.unlink(missing_ok=True)
            except Exception:
                pass

    def cleanup_export_zip(self, task_id: str) -> None:
        """Remove export artifact and working files after download."""
        _unregister_cancel_event(task_id)
        with _tasks_lock:
            t = _tasks.pop(task_id, None)
        if not t or not t.zip_path:
            return
        zp = t.zip_path
        try:
            parent = zp.parent
            zp.unlink(missing_ok=True)
            shutil.rmtree(parent, ignore_errors=True)
        except Exception:
            logger.warning("Could not cleanup export zip for task %s", task_id)

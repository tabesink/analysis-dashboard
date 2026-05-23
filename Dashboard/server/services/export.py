"""Database export/import service for portability (Parquet + ZIP)."""

from __future__ import annotations

import json
import logging
import os
import shutil
import tempfile
import threading
import time
import uuid
import zipfile
from contextlib import contextmanager
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import Any

import duckdb

from server.config import Settings
from server.exceptions import ValidationError
from server.storage.database import (
    LOAD_DATA_PORTABILITY_TABLES,
    PRESERVED_PORTABILITY_TABLES,
    UnifiedStore,
    _copy_file_with_progress,
)
from server.storage.schema_loader import get_schema_loader

logger = logging.getLogger(__name__)


class TaskCancelledError(Exception):
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
    sub_phase: str = ""
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
_TASK_PERSIST_KINDS = frozenset({"import", "export"})
_uploads_lock = threading.Lock()
_pending_uploads: dict[str, Path] = {}
_cancel_events_lock = threading.Lock()
_cancel_events: dict[str, threading.Event] = {}
_import_active_lock = threading.Lock()
_import_active_count = 0


def is_database_import_in_progress() -> bool:
    """True while a background Parquet import is mutating or swapping the database."""
    with _import_active_lock:
        return _import_active_count > 0


@contextmanager
def database_import_guard() -> Iterator[None]:
    """Mark import in progress so readiness checks avoid blocking on the live DB."""
    global _import_active_count
    with _import_active_lock:
        _import_active_count += 1
    try:
        yield
    finally:
        with _import_active_lock:
            _import_active_count -= 1


def cleanup_stale_import_staging_file(live_db_path: Path) -> None:
    """Remove leftover staging DB from an interrupted import."""
    staging_path = live_db_path.with_suffix(".db.staging")
    if staging_path.is_file():
        try:
            staging_path.unlink()
            logger.warning("Removed stale import staging file: %s", staging_path)
        except OSError:
            logger.warning("Could not remove stale staging file %s", staging_path, exc_info=True)


def _new_task_id() -> str:
    return uuid.uuid4().hex


def _parquet_task_state_dir() -> Path:
    from server.config import get_settings

    directory = get_settings().scratch_dir / "parquet-tasks"
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def _task_to_json_dict(task: TaskStatus) -> dict[str, Any]:
    return {
        "task_id": task.task_id,
        "kind": task.kind,
        "status": task.status,
        "progress": task.progress,
        "phase": task.phase,
        "sub_phase": task.sub_phase,
        "current": task.current,
        "total": task.total,
        "current_table": task.current_table,
        "events_loaded": task.events_loaded,
        "result": task.result,
        "error": task.error,
        "zip_path": str(task.zip_path) if task.zip_path else None,
        "updated_at": task.updated_at,
    }


def _task_from_json_dict(data: dict[str, Any]) -> TaskStatus:
    zip_raw = data.get("zip_path")
    return TaskStatus(
        task_id=str(data["task_id"]),
        kind=str(data["kind"]),
        status=str(data.get("status", "running")),
        progress=str(data.get("progress", "")),
        phase=str(data.get("phase", "")),
        sub_phase=str(data.get("sub_phase", "")),
        current=int(data.get("current", 0)),
        total=int(data.get("total", 0)),
        current_table=data.get("current_table"),
        events_loaded=data.get("events_loaded"),
        result=data.get("result"),
        error=data.get("error"),
        zip_path=Path(zip_raw) if zip_raw else None,
        updated_at=float(data.get("updated_at", time.time())),
    )


def _persist_task_to_disk(task: TaskStatus) -> None:
    if task.kind not in _TASK_PERSIST_KINDS:
        return
    directory = _parquet_task_state_dir()
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{task.task_id}.json"
    tmp = path.with_suffix(".json.tmp")
    payload = json.dumps(_task_to_json_dict(task), indent=None)
    tmp.write_text(payload, encoding="utf-8")
    tmp.replace(path)


def _load_task_from_disk(task_id: str) -> TaskStatus | None:
    path = _parquet_task_state_dir() / f"{task_id}.json"
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return None
        return _task_from_json_dict(data)
    except Exception:
        logger.warning("Could not load persisted task %s", task_id, exc_info=True)
        return None


def _delete_persisted_task(task_id: str) -> None:
    path = _parquet_task_state_dir() / f"{task_id}.json"
    path.unlink(missing_ok=True)
    path.with_suffix(".json.tmp").unlink(missing_ok=True)


def reconcile_persisted_parquet_tasks() -> None:
    """Mark orphaned running tasks failed after a process restart."""
    task_dir = _parquet_task_state_dir()
    for path in sorted(task_dir.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(data, dict):
                continue
            task = _task_from_json_dict(data)
            if task.status != "running":
                continue
            task.status = "failed"
            task.phase = "failed"
            task.progress = "Failed (server restarted)"
            task.error = (
                "Server restarted while this task was running. "
                "Check server logs for Database imported or Import task failed before retrying."
            )
            task.updated_at = time.time()
            _persist_task_to_disk(task)
            with _tasks_lock:
                _tasks[task.task_id] = task
            logger.warning(
                "Marked orphaned %s task %s as failed after restart",
                task.kind,
                task.task_id,
            )
        except Exception:
            logger.warning("Could not reconcile persisted task file %s", path, exc_info=True)


def _put_task(task: TaskStatus) -> None:
    task.updated_at = time.time()
    with _tasks_lock:
        _tasks[task.task_id] = task
    _persist_task_to_disk(task)


def get_task(task_id: str) -> TaskStatus | None:
    with _tasks_lock:
        task = _tasks.get(task_id)
    if task is not None:
        return task
    loaded = _load_task_from_disk(task_id)
    if loaded is None:
        return None
    with _tasks_lock:
        _tasks[task_id] = loaded
    return loaded


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
        raise TaskCancelledError()


def _update_task(
    task_id: str,
    *,
    progress: str | None = None,
    phase: str | None = None,
    sub_phase: str | None = None,
    current: int | None = None,
    total: int | None = None,
    current_table: str | None = None,
    clear_current_table: bool = False,
    events_loaded: int | None = None,
    status: str | None = None,
    result: dict[str, Any] | None = None,
    error: str | None = None,
    zip_path: Path | None = None,
) -> None:
    with _tasks_lock:
        t = _tasks.get(task_id)
    if not t:
        t = _load_task_from_disk(task_id)
        if t:
            with _tasks_lock:
                _tasks[task_id] = t
    if not t:
        return
    with _tasks_lock:
        t.updated_at = time.time()
        if progress is not None:
            t.progress = progress
        if phase is not None:
            t.phase = phase
        if sub_phase is not None:
            t.sub_phase = sub_phase
        if current is not None:
            t.current = current
        if total is not None:
            t.total = total
        if clear_current_table:
            t.current_table = None
        elif current_table is not None:
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
    _persist_task_to_disk(t)


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


def _safe_zip_member_target(extract_root: Path, member: str) -> Path:
    raw_parts = member.split("/")
    member_path = PurePosixPath(member)
    if (
        not member
        or "\\" in member
        or member_path.is_absolute()
        or any(part in {".", ".."} for part in raw_parts)
        or any(part == "" for part in raw_parts[:-1])
        or raw_parts == [""]
    ):
        raise ValidationError(f"Invalid archive: unsafe path {member!r}", details={})

    root = extract_root.resolve()
    target = (root / Path(*member_path.parts)).resolve()
    if target != root and root not in target.parents:
        raise ValidationError(f"Invalid archive: unsafe path {member!r}", details={})
    return target


def _is_managed_artifact_member(member: str) -> bool:
    parts = PurePosixPath(member).parts
    return "managed_artifacts" in parts


def _extract_zip_member(zf: zipfile.ZipFile, info: zipfile.ZipInfo, extract_root: Path) -> Path:
    target = _safe_zip_member_target(extract_root, info.filename)
    if info.is_dir():
        target.mkdir(parents=True, exist_ok=True)
        return target

    target.parent.mkdir(parents=True, exist_ok=True)
    with zf.open(info) as src, open(target, "wb") as dst:
        shutil.copyfileobj(src, dst)
    return target


class ExportService:
    """
    Service for database export/import operations.

    Exports Parquet (zstd) + schema/load SQL, zipped. Imports the same format.
    """

    def __init__(self, db: UnifiedStore, settings: Settings):
        self.db = db
        self.settings = settings

    def _mk_scratch_dir(self, prefix: str) -> Path:
        """Create a temp directory under data_root/tmp (not container /tmp tmpfs)."""
        scratch = self.settings.scratch_dir
        scratch.mkdir(parents=True, exist_ok=True)
        return Path(tempfile.mkdtemp(prefix=prefix, dir=str(scratch)))

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

    def _checkpoint_live_database(self) -> None:
        with self.db._db_lock:
            self.db._ensure_connection_unlocked()
            if self.db._connection is not None:
                self.db._connection.execute("CHECKPOINT")

    def _copy_database_file(
        self,
        source: Path,
        destination: Path,
        *,
        on_chunk: Callable[[int, int], None] | None,
    ) -> None:
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not source.is_file():
            raise ValidationError(f"Database file not found: {source}", details={})
        total_bytes = source.stat().st_size
        if total_bytes > 0 and on_chunk is not None:
            _copy_file_with_progress(source, destination, total_bytes, on_chunk)
        else:
            shutil.copy2(source, destination)

    def _swap_staging_database_into_place(self, staging_path: Path) -> None:
        """Atomically replace the live DuckDB file after a successful staging import."""
        live_path = self.db.db_path
        with self.db._db_lock:
            self.db.close()
            os.replace(staging_path, live_path)

    def mark_export_downloading(self, task_id: str) -> bool:
        """Mark export task as in the client download phase (HTTP download started)."""
        t = get_task(task_id)
        if not t or t.kind != "export" or t.status != "completed":
            return False
        _update_task(task_id, phase="downloading")
        return True

    def _run_export(self, task_id: str) -> None:
        work = self._mk_scratch_dir("export-parquet-")
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
        except TaskCancelledError:
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

        scratch = self.settings.scratch_dir
        scratch.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="validate-parquet-", dir=str(scratch)) as tmp:
            extract_root = Path(tmp)
            with zipfile.ZipFile(str(zip_path), "r") as zf:
                for info in zf.infolist():
                    _safe_zip_member_target(extract_root, info.filename)
                    if _is_managed_artifact_member(info.filename):
                        continue
                    _extract_zip_member(zf, info, extract_root)
            export_root = _find_parquet_export_root(extract_root)

            dim_event_pq = export_root / "dim_event.parquet"
            ml_pq = export_root / "measurements_lttb.parquet"
            if not dim_event_pq.is_file():
                raise ValidationError("Invalid export: missing dim_event.parquet", details={})
            if not ml_pq.is_file():
                raise ValidationError("Invalid export: missing measurements_lttb.parquet", details={})

            table_names: set[str] = {p.stem for p in export_root.glob("*.parquet")}
            preserved_tables = sorted(table_names & PRESERVED_PORTABILITY_TABLES)
            if preserved_tables:
                raise ValidationError(
                    "Invalid load-data export: contains target-local tables "
                    + ", ".join(preserved_tables),
                    details={"tables": preserved_tables},
                )

            missing_load_tables = [
                table
                for table in LOAD_DATA_PORTABILITY_TABLES
                if not (export_root / f"{table}.parquet").is_file()
            ]
            if missing_load_tables:
                raise ValidationError(
                    "Invalid load-data export: missing load-data tables "
                    + ", ".join(missing_load_tables),
                    details={"tables": missing_load_tables},
                )

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
        work = self._mk_scratch_dir("import-parquet-")
        extract_root = work / "extract"
        staging_path = self.db.db_path.with_suffix(".db.staging")
        cleanup_stale_import_staging_file(self.db.db_path)
        with database_import_guard():
            self._run_import_guarded(task_id, zip_path, work, extract_root, staging_path)

    def _run_import_guarded(
        self,
        task_id: str,
        zip_path: Path,
        work: Path,
        extract_root: Path,
        staging_path: Path,
    ) -> None:
        try:
            _check_cancel(task_id)
            extract_root.mkdir()
            with zipfile.ZipFile(str(zip_path), "r") as zf:
                members = zf.infolist()
                total_members = len(members)
                _update_task(
                    task_id,
                    phase="extracting",
                    progress=f"Extracting 0 of {total_members} files",
                    current=0,
                    total=total_members,
                )
                for i, info in enumerate(members):
                    _check_cancel(task_id)
                    member = info.filename
                    target = _safe_zip_member_target(extract_root, member)
                    if _is_managed_artifact_member(member):
                        _update_task(
                            task_id,
                            phase="extracting",
                            progress=f"Extracting {i + 1} of {total_members} files",
                            current=i + 1,
                            total=total_members,
                        )
                        continue
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

            def on_import_progress(
                sub_phase: str,
                progress_msg: str,
                cur: int,
                tot: int,
                table: str | None,
            ) -> None:
                _check_cancel(task_id)
                _update_task(
                    task_id,
                    progress=progress_msg,
                    phase="importing",
                    sub_phase=sub_phase,
                    current=cur,
                    total=tot,
                    current_table=table,
                    clear_current_table=table is None,
                )

            self.db.log_audit(
                action="DATABASE_IMPORT_START",
                details={"zip_mb": round(zip_path.stat().st_size / (1024 * 1024), 2)},
            )

            live_path = self.db.db_path
            backup_path = live_path.with_suffix(".db.bak")

            self.db.configure_live_session_for_background_import(
                memory_limit=self.settings.duckdb_live_memory_limit_during_import,
                threads=self.settings.duckdb_import_threads,
            )

            def on_file_copy_chunk(copied: int, total: int) -> None:
                pct = min(99, int(100 * copied / total)) if total else 0
                _check_cancel(task_id)
                _update_task(
                    task_id,
                    progress=f"Copying database ({pct}%)…",
                    phase="importing",
                    sub_phase="backing_up",
                )

            _update_task(
                task_id,
                phase="importing",
                sub_phase="backing_up",
                progress="Backing up live database to dashboard.db.bak…",
                current=0,
                total=1,
                clear_current_table=True,
            )
            self._checkpoint_live_database()
            self._copy_database_file(
                live_path,
                backup_path,
                on_chunk=on_file_copy_chunk,
            )

            _update_task(
                task_id,
                phase="importing",
                sub_phase="backing_up",
                progress="Preparing isolated import copy…",
                clear_current_table=True,
            )
            self._copy_database_file(
                live_path,
                staging_path,
                on_chunk=on_file_copy_chunk,
            )

            staging_store = UnifiedStore(staging_path, initialize_schema=False)
            try:
                staging_store.configure_bulk_import_session(
                    memory_limit=self.settings.duckdb_import_memory_limit,
                    threads=self.settings.duckdb_import_threads,
                )
                result = staging_store.import_from_parquet(
                    export_root,
                    on_import_progress=on_import_progress,
                    skip_backup=True,
                )
            finally:
                staging_store.close()

            _update_task(
                task_id,
                phase="importing",
                sub_phase="finalizing",
                progress="Applying imported database…",
                clear_current_table=True,
            )
            self._swap_staging_database_into_place(staging_path)

            target = self.settings.data_root / "artifacts" / "channel-map"
            if target.exists():
                _update_task(
                    task_id,
                    phase="importing",
                    sub_phase="finalizing",
                    progress="Removing target retained upload artifacts…",
                    clear_current_table=True,
                )
                shutil.rmtree(target, ignore_errors=True)

            _update_task(
                task_id,
                status="completed",
                progress="Import complete",
                phase="completed",
                sub_phase="",
                events_loaded=result.get("events"),
                result=result,
            )

            self.db.log_audit(action="DATABASE_IMPORTED", details=result)
            logger.info(
                "Database imported: %s events, %s MB",
                result.get("events"),
                result.get("size_mb"),
            )
        except TaskCancelledError:
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
            staging_path.unlink(missing_ok=True)
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
        _delete_persisted_task(task_id)
        if not t or not t.zip_path:
            return
        zp = t.zip_path
        try:
            parent = zp.parent
            zp.unlink(missing_ok=True)
            shutil.rmtree(parent, ignore_errors=True)
        except Exception:
            logger.warning("Could not cleanup export zip for task %s", task_id)

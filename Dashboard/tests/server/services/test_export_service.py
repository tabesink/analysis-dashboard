import shutil
import time
import zipfile
from pathlib import Path

import pandas as pd
import pytest
from server.exceptions import ValidationError
from server.services.export import (
    ExportService,
    TaskStatus,
    _is_managed_artifact_member,
    _tasks,
    _tasks_lock,
    get_task,
    reconcile_persisted_parquet_tasks,
)
from server.storage.database import UnifiedStore


def _write_zip(path: Path, members: dict[str, bytes]) -> Path:
    with zipfile.ZipFile(path, "w") as archive:
        for name, content in members.items():
            archive.writestr(name, content)
    return path


def _count_rows(store: UnifiedStore, table: str) -> int:
    return int(store.read_connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])


def _insert_program(store: UnifiedStore, program_id: str) -> None:
    with store.write_connection() as conn:
        conn.execute(
            "INSERT INTO dim_program (program_id, name) VALUES (?, ?)",
            [program_id, program_id],
        )


def _insert_measurements(store: UnifiedStore, event_id: str) -> None:
    store.insert_measurements(
        event_id,
        pd.DataFrame(
            [
                {"timestamp": 0.0, "channel_name": "Force_X", "value": 1.0},
                {"timestamp": 0.1, "channel_name": "Force_X", "value": 2.0},
            ]
        ),
    )
    with store.write_connection() as conn:
        conn.execute(
            """
            INSERT INTO measurements_lttb (event_id, plot_key, x, y)
            VALUES (?, ?, ?, ?)
            """,
            [event_id, "plot_1", 0.0, 1.0],
        )


def _insert_event_with_load_data(
    store: UnifiedStore,
    *,
    event_id: str,
    program_id: str,
    user_id: str,
) -> None:
    _insert_program(store, program_id)
    store.insert_event(
        event_id=event_id,
        program_id=program_id,
        version="V1",
        uploaded_by_user_id=user_id,
        status="Approved",
        source_file=f"{event_id}.csv",
        file_hash=event_id[:16],
    )
    store.upsert_channel_map(
        program_id=program_id,
        version="V1",
        plot_key="plot_1",
        x_channel="Time",
        y_channel="Force_X",
        x_col=0,
        y_col=1,
        x_unit="s",
        y_unit="N",
    )
    _insert_measurements(store, event_id)
    store.upsert_event_custom_field_values(event_id, {"source_field": "source value"})


@pytest.mark.parametrize("unsafe_member", ["../escaped.txt", "/escaped.txt", "dir//escaped.txt", "dir\\escaped.txt"])
def test_validate_import_zip_rejects_unsafe_member_path(
    unsafe_member: str,
    test_database,
    test_settings,
    tmp_path: Path,
) -> None:
    service = ExportService(test_database, test_settings)
    outside_path = tmp_path / "escaped.txt"
    malicious_zip = _write_zip(
        tmp_path / "malicious.zip",
        {
            unsafe_member: b"should not be written",
            "schema.sql": b"-- schema",
            "load.sql": b"-- load",
            "dim_event.parquet": b"not reached",
            "measurements_lttb.parquet": b"not reached",
        },
    )

    with pytest.raises(ValidationError, match="unsafe path"):
        service.validate_import_zip(malicious_zip)

    assert not outside_path.exists()


def test_load_data_export_import_preserves_target_users_and_excludes_preserved_tables(
    test_database,
    test_settings,
    tmp_path: Path,
) -> None:
    source_owner = test_database.create_user("source_owner")
    _insert_event_with_load_data(
        test_database,
        event_id="source-event",
        program_id="P-SOURCE",
        user_id=source_owner["id"],
    )
    test_database.export_to_parquet(tmp_path / "source-export")

    exported_files = {p.name for p in (tmp_path / "source-export").glob("*.parquet")}
    assert "dim_event.parquet" in exported_files
    assert "measurements_raw.parquet" in exported_files
    assert "measurements_lttb.parquet" in exported_files
    assert "ingestion_artifacts.parquet" not in exported_files
    assert "users.parquet" not in exported_files
    assert "sessions.parquet" not in exported_files
    assert "audit_log.parquet" not in exported_files
    assert "custom_field_definitions.parquet" not in exported_files

    target = UnifiedStore(tmp_path / "target.db")
    try:
        target_admin = target.create_user(
            "target_admin",
            role="admin",
            password_hash="target-password-hash",
            can_write=True,
        )
        _insert_event_with_load_data(
            target,
            event_id="target-event",
            program_id="P-TARGET",
            user_id=target_admin["id"],
        )

        result = target.import_from_parquet(tmp_path / "source-export")

        assert result["events"] == 1
        assert target.get_user_by_username("target_admin") is not None
        assert target.get_user_by_username("source_owner") is None
        assert target.get_event("source-event") is not None
        assert target.get_event("target-event") is None
        assert _count_rows(target, "measurements_raw") == 2
        assert _count_rows(target, "measurements_lttb") == 1
        assert target.get_event_custom_field_values(["source-event"]) == {
            "source-event": {"source_field": "source value"}
        }
        assert _count_rows(target, "ingestion_artifacts") == 0
    finally:
        target.close()


def test_load_data_import_reports_granular_progress(
    test_database,
    tmp_path: Path,
) -> None:
    source_owner = test_database.create_user("progress_source_owner")
    _insert_event_with_load_data(
        test_database,
        event_id="progress-source-event",
        program_id="P-PROGRESS",
        user_id=source_owner["id"],
    )
    export_dir = tmp_path / "progress-export"
    test_database.export_to_parquet(export_dir)

    target = UnifiedStore(tmp_path / "target-progress.db")
    progress: list[tuple[str, str, int, int, str | None]] = []
    try:
        target.import_from_parquet(
            export_dir,
            on_import_progress=lambda *args: progress.append(args),
        )

        sub_phases = [item[0] for item in progress]
        assert sub_phases[0] == "backing_up"
        assert "clearing" in sub_phases
        assert "loading" in sub_phases
        assert sub_phases[-1] == "finalizing"
        assert progress[0][2] == 0
        assert progress[0][3] == 1 + 7 + 6 + 1
        assert all(current <= total for _, _, current, total, _ in progress)
    finally:
        target.close()


def test_failed_load_data_import_leaves_target_data_and_users_readable(
    test_database,
    tmp_path: Path,
) -> None:
    source_owner = test_database.create_user("failing_source_owner")
    _insert_event_with_load_data(
        test_database,
        event_id="source-event",
        program_id="P-SOURCE",
        user_id=source_owner["id"],
    )
    export_dir = tmp_path / "broken-export"
    test_database.export_to_parquet(export_dir)
    (export_dir / "load.sql").write_text(
        (export_dir / "load.sql").read_text(encoding="utf-8")
        + "\nCOPY missing_table FROM 'missing_table.parquet' (FORMAT 'parquet');\n",
        encoding="utf-8",
    )

    target = UnifiedStore(tmp_path / "target-failure.db")
    try:
        target_admin = target.create_user("target_admin", role="admin", can_write=True)
        _insert_event_with_load_data(
            target,
            event_id="target-event",
            program_id="P-TARGET",
            user_id=target_admin["id"],
        )

        with pytest.raises(Exception):
            target.import_from_parquet(export_dir)

        assert target.get_user_by_username("target_admin") is not None
        assert target.get_event("target-event") is not None
        assert target.get_event("source-event") is None
    finally:
        target.close()


def test_load_data_import_ignores_legacy_ingestion_artifacts_load_statement(
    test_database,
    tmp_path: Path,
) -> None:
    source_owner = test_database.create_user("legacy_source_owner")
    _insert_event_with_load_data(
        test_database,
        event_id="legacy-source-event",
        program_id="P-LEGACY",
        user_id=source_owner["id"],
    )
    export_dir = tmp_path / "legacy-export"
    test_database.export_to_parquet(export_dir)
    (export_dir / "load.sql").write_text(
        (export_dir / "load.sql").read_text(encoding="utf-8")
        + "\nCOPY ingestion_artifacts FROM 'ingestion_artifacts.parquet' (FORMAT 'parquet');\n",
        encoding="utf-8",
    )

    target = UnifiedStore(tmp_path / "target-legacy.db")
    try:
        result = target.import_from_parquet(export_dir)
        assert result["events"] == 1
        assert target.get_event("legacy-source-event") is not None
        assert _count_rows(target, "ingestion_artifacts") == 0
    finally:
        target.close()


def test_validate_import_zip_rejects_archives_with_preserved_tables(
    tmp_path: Path,
    test_database,
    test_settings,
) -> None:
    service = ExportService(test_database, test_settings)
    members = {
        "schema.sql": b"-- schema",
        "load.sql": b"-- load",
        "users.parquet": b"not a load-data table",
    }
    for table in (
        "dim_program",
        "dim_event",
        "dim_channel_map",
        "measurements_raw",
        "measurements_lttb",
        "event_custom_field_values",
    ):
        members[f"{table}.parquet"] = b"not reached"
    archive = _write_zip(tmp_path / "full-db-export.zip", members)

    with pytest.raises(ValidationError, match="target-local tables"):
        service.validate_import_zip(archive)


def test_validate_import_zip_accepts_load_data_export(
    tmp_path: Path,
    test_database,
    test_settings,
) -> None:
    service = ExportService(test_database, test_settings)
    owner = test_database.create_user("validation_owner")
    _insert_event_with_load_data(
        test_database,
        event_id="validation-event",
        program_id="P-VALID",
        user_id=owner["id"],
    )
    export_dir = tmp_path / "valid-export"
    test_database.export_to_parquet(export_dir)
    archive_base = tmp_path / "dashboard_export"
    archive = Path(shutil.make_archive(str(archive_base), "zip", root_dir=export_dir))

    result = service.validate_import_zip(archive)

    assert result["valid"] is True
    assert result["event_count"] == 1
    assert "dim_event" in result["tables"]
    assert "ingestion_artifacts" not in result["tables"]
    assert "users" not in result["tables"]


def test_export_task_excludes_managed_artifacts(
    test_database,
    test_settings,
) -> None:
    service = ExportService(test_database, test_settings)
    owner = test_database.create_user("export_artifact_owner")
    _insert_event_with_load_data(
        test_database,
        event_id="export-artifact-event",
        program_id="P-EXPORT-ARTIFACT",
        user_id=owner["id"],
    )
    retained_file = (
        test_settings.data_root
        / "artifacts"
        / "channel-map"
        / "P-EXPORT-ARTIFACT"
        / "V1"
        / "retained.csv"
    )
    retained_file.parent.mkdir(parents=True)
    retained_file.write_text("raw,retained,data", encoding="utf-8")

    task_id = service.start_export_task()
    deadline = time.monotonic() + 3
    task = get_task(task_id)
    while task and task.status == "running" and time.monotonic() < deadline:
        time.sleep(0.01)
        task = get_task(task_id)

    try:
        assert task is not None
        assert task.status == "completed"
        assert task.zip_path is not None
        with zipfile.ZipFile(task.zip_path) as archive:
            names = set(archive.namelist())
        assert "ingestion_artifacts.parquet" not in names
        assert all(not _is_managed_artifact_member(name) for name in names)
    finally:
        service.cleanup_export_zip(task_id)


def test_validate_import_zip_skips_legacy_managed_artifacts(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    test_database,
    test_settings,
) -> None:
    import server.services.export as export_module

    service = ExportService(test_database, test_settings)
    owner = test_database.create_user("managed_artifact_validation_owner")
    _insert_event_with_load_data(
        test_database,
        event_id="managed-artifact-validation-event",
        program_id="P-MANAGED",
        user_id=owner["id"],
    )
    export_dir = tmp_path / "managed-artifact-export"
    test_database.export_to_parquet(export_dir)
    (export_dir / "managed_artifacts" / "channel-map").mkdir(parents=True)
    (export_dir / "managed_artifacts" / "channel-map" / "retained.csv").write_bytes(b"raw,csv")
    archive = Path(shutil.make_archive(str(tmp_path / "managed_artifact_zip"), "zip", root_dir=export_dir))

    extracted_members: list[str] = []
    real_extract = export_module._extract_zip_member

    def record_extract(zf: zipfile.ZipFile, info: zipfile.ZipInfo, extract_root: Path) -> Path:
        extracted_members.append(info.filename)
        return real_extract(zf, info, extract_root)

    monkeypatch.setattr(export_module, "_extract_zip_member", record_extract)

    result = service.validate_import_zip(archive)

    assert result["valid"] is True
    assert all(not _is_managed_artifact_member(member) for member in extracted_members)


def test_import_task_rejects_path_traversal_without_replacing_current_data(
    test_database,
    test_settings,
    tmp_path: Path,
) -> None:
    service = ExportService(test_database, test_settings)
    owner = test_database.create_user("import_safety_owner")
    test_database.insert_event(
        event_id="existing-event",
        program_id="P-SAFE",
        version="V1",
        uploaded_by_user_id=owner["id"],
        status="Approved",
    )
    outside_path = tmp_path / "escaped.txt"
    malicious_zip = _write_zip(
        tmp_path / "malicious-import.zip",
        {
            "../escaped.txt": b"should not be written",
            "schema.sql": b"-- schema",
            "load.sql": b"-- load",
        },
    )
    upload_id = service.register_upload(malicious_zip)

    task_id = service.start_import_task(upload_id)
    deadline = time.monotonic() + 3
    task = get_task(task_id)
    while task and task.status == "running" and time.monotonic() < deadline:
        time.sleep(0.01)
        task = get_task(task_id)

    assert task is not None
    assert task.status == "failed"
    assert "unsafe path" in (task.error or "")
    assert not outside_path.exists()
    assert test_database.get_event("existing-event") is not None


def test_persisted_import_task_reloads_after_memory_clear(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    import server.services.export as export_module

    task_dir = tmp_path / "scratch" / "parquet-tasks"
    monkeypatch.setattr(export_module, "_parquet_task_state_dir", lambda: task_dir)

    task = TaskStatus(
        task_id="persist-import-1",
        kind="import",
        phase="importing",
        sub_phase="backing_up",
        progress="Backing up database (12%)…",
    )
    with _tasks_lock:
        _tasks.clear()
    from server.services.export import _put_task

    _put_task(task)
    with _tasks_lock:
        _tasks.clear()

    reloaded = get_task("persist-import-1")
    assert reloaded is not None
    assert reloaded.sub_phase == "backing_up"
    assert "12%" in reloaded.progress


def test_reconcile_marks_orphaned_running_tasks_failed(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    import server.services.export as export_module
    from server.services.export import _put_task

    task_dir = tmp_path / "scratch-reconcile" / "parquet-tasks"
    monkeypatch.setattr(export_module, "_parquet_task_state_dir", lambda: task_dir)
    with _tasks_lock:
        _tasks.clear()

    _put_task(TaskStatus(task_id="orphan-import", kind="import", status="running", phase="importing"))
    with _tasks_lock:
        _tasks.clear()

    reconcile_persisted_parquet_tasks()
    reloaded = get_task("orphan-import")
    assert reloaded is not None
    assert reloaded.status == "failed"
    assert "restarted" in (reloaded.error or "").lower()

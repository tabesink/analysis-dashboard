"""Behavior tests for DuckDB schema initialization."""

from __future__ import annotations

import json
import importlib
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from server.storage.database import UnifiedStore
from server.storage.migrations import MigrationRunner
from server.storage.schema_loader import SchemaLoader


def _duckdb_module() -> Any:
    """Load duckdb at runtime to avoid static env resolution warnings."""
    return importlib.import_module("duckdb")


def _table_names(store: UnifiedStore) -> set[str]:
    rows = store.read_connection.execute(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'"
    ).fetchall()
    return {row[0] for row in rows}


def _column_names(store: UnifiedStore, table_name: str) -> set[str]:
    rows = store.read_connection.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = ?
        """,
        [table_name],
    ).fetchall()
    return {row[0] for row in rows}


def _sequence_names(store: UnifiedStore) -> set[str]:
    rows = store.read_connection.execute(
        "SELECT sequence_name FROM duckdb_sequences()"
    ).fetchall()
    return {row[0] for row in rows}


def _index_names(store: UnifiedStore) -> set[str]:
    rows = store.read_connection.execute("SELECT index_name FROM duckdb_indexes()").fetchall()
    return {row[0] for row in rows}


def _table_names_from_path(db_path: Path) -> set[str]:
    conn = _duckdb_module().connect(str(db_path))
    try:
        rows = conn.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'"
        ).fetchall()
        return {row[0] for row in rows}
    finally:
        conn.close()


def test_unified_store_initializes_declared_schema(tmp_path: Path):
    store = UnifiedStore(tmp_path / "dashboard.db")
    try:
        assert {
            "dim_event",
            "users",
            "sessions",
            "upload_tasks",
            "measurements_raw",
            "custom_field_definitions",
            "ingestion_artifacts",
        }.issubset(_table_names(store))
        assert {
            "seq_channel_map_id",
            "seq_meas_raw_id",
            "seq_ingestion_artifact_id",
        }.issubset(_sequence_names(store))
        assert {
            "idx_event_program",
            "idx_sessions_expires",
            "idx_upload_tasks_user",
            "idx_custom_field_definitions_filterable",
        }.issubset(_index_names(store))
        assert {
            "uploaded_by_user_id",
            "phase",
            "rfq",
            "damper_type",
        }.issubset(_column_names(store, "dim_event"))
    finally:
        store.close()


def test_migration_runner_and_unified_store_apply_same_declared_tables(
    tmp_path: Path,
):
    migrated_db = tmp_path / "migrated.db"
    store_db = tmp_path / "store.db"
    declared_tables = set(SchemaLoader().tables.keys())

    result = MigrationRunner(migrated_db).apply_initial_schema()
    assert result["success"] is True

    store = UnifiedStore(store_db)
    try:
        assert declared_tables.issubset(_table_names_from_path(migrated_db))
        assert declared_tables.issubset(_table_names(store))
    finally:
        store.close()


def test_unified_store_adds_declared_columns_without_losing_existing_rows(
    tmp_path: Path,
):
    db_path = tmp_path / "dashboard.db"
    conn = _duckdb_module().connect(str(db_path))
    try:
        conn.execute(
            """
            CREATE TABLE users (
                id VARCHAR PRIMARY KEY,
                username VARCHAR NOT NULL UNIQUE,
                role VARCHAR NOT NULL,
                password_hash VARCHAR,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login_at TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            INSERT INTO users (id, username, role, password_hash)
            VALUES ('admin-id', 'admin', 'admin', 'hashed-password')
            """
        )
        conn.execute(
            """
            CREATE TABLE dim_event (
                event_id VARCHAR PRIMARY KEY,
                program_id VARCHAR NOT NULL,
                version VARCHAR NOT NULL,
                suspension_component VARCHAR,
                axle_location VARCHAR,
                gross_vehicle_weight_range_lbs VARCHAR,
                drive_type VARCHAR,
                steering_position VARCHAR,
                vehicle_type VARCHAR,
                source_file VARCHAR,
                file_hash VARCHAR(16),
                row_count INTEGER,
                is_deleted BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            INSERT INTO dim_event (event_id, program_id, version)
            VALUES ('event-1', 'program-a', 'v1')
            """
        )
    finally:
        conn.close()

    store = UnifiedStore(db_path)
    try:
        assert {"can_write", "last_settings_visit_at"}.issubset(
            _column_names(store, "users")
        )
        assert {
            "uploaded_by_user_id",
            "phase",
            "rfq",
            "dv",
            "pv",
            "post_prod",
            "damper_type",
        }.issubset(_column_names(store, "dim_event"))
        assert store.read_connection.execute(
            "SELECT COUNT(*) FROM dim_event WHERE event_id = 'event-1'"
        ).fetchone()[0] == 1
        admin = store.get_user_by_username("admin")
        assert admin is not None
        assert bool(admin["can_write"]) is True
    finally:
        store.close()


def test_schema_doctor_classifies_ok_missing_type_mismatch_and_drift(tmp_path: Path):
    db_path = tmp_path / "doctor.db"
    runner = MigrationRunner(db_path)
    result = runner.apply_initial_schema()
    assert result["success"] is True

    conn = _duckdb_module().connect(str(db_path))
    try:
        conn.execute("DROP TABLE upload_tasks")
        conn.execute("ALTER TABLE audit_log ALTER COLUMN details TYPE VARCHAR")
        conn.execute("CREATE TABLE unexpected_temp_table (id INTEGER)")
    finally:
        conn.close()

    report = runner.generate_migration_diff()
    statuses_by_table = {
        entry["table"]: entry["status"]
        for entry in report["doctor_report"]
        if entry["object_type"] == "table"
    }

    assert statuses_by_table["dim_program"] == "OK"
    assert statuses_by_table["upload_tasks"] == "MISSING"
    assert statuses_by_table["audit_log"] == "TYPE_MISMATCH"
    assert statuses_by_table["unexpected_temp_table"] == "DRIFT"

    assert "upload_tasks" in report["missing_tables"]
    assert "unexpected_temp_table" in report["extra_tables"]
    assert report["doctor_summary"]["OK"] >= 1
    assert report["doctor_summary"]["MISSING"] >= 1
    assert report["doctor_summary"]["TYPE_MISMATCH"] >= 1
    assert report["doctor_summary"]["DRIFT"] >= 1


def test_unified_store_runs_extracted_startup_backfills_idempotently(tmp_path: Path):
    db_path = tmp_path / "dashboard.db"
    conn = _duckdb_module().connect(str(db_path))
    try:
        conn.execute(
            """
            CREATE TABLE users (
                id VARCHAR PRIMARY KEY,
                username VARCHAR NOT NULL UNIQUE,
                role VARCHAR NOT NULL,
                can_write BOOLEAN DEFAULT FALSE
            )
            """
        )
        conn.execute(
            """
            INSERT INTO users (id, username, role, can_write)
            VALUES ('admin-id', 'admin', 'admin', FALSE)
            """
        )
        conn.execute(
            """
            CREATE TABLE dim_event (
                event_id VARCHAR PRIMARY KEY,
                program_id VARCHAR NOT NULL,
                version VARCHAR NOT NULL,
                status VARCHAR,
                maturity VARCHAR,
                rfq BOOLEAN,
                dv BOOLEAN,
                pv BOOLEAN,
                post_prod BOOLEAN,
                source_file VARCHAR,
                file_hash VARCHAR(16),
                row_count INTEGER,
                is_deleted BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            INSERT INTO dim_event (
                event_id,
                program_id,
                version,
                status,
                maturity,
                rfq,
                dv,
                pv,
                post_prod
            )
            VALUES (
                'event-1',
                'program-a',
                'v1',
                NULL,
                'Approved',
                NULL,
                NULL,
                NULL,
                NULL
            )
            """
        )
    finally:
        conn.close()

    first_store = UnifiedStore(db_path)
    try:
        admin_first = first_store.get_user_by_username("admin")
        assert admin_first is not None
        assert bool(admin_first["can_write"]) is True
        event_row_first = first_store.read_connection.execute(
            """
            SELECT status, rfq, dv, pv, post_prod
            FROM dim_event
            WHERE event_id = 'event-1'
            """
        ).fetchone()
        assert event_row_first == ("Approved", False, False, False, False)
    finally:
        first_store.close()

    second_store = UnifiedStore(db_path)
    try:
        admin_second = second_store.get_user_by_username("admin")
        assert admin_second is not None
        assert bool(admin_second["can_write"]) is True
        event_row_second = second_store.read_connection.execute(
            """
            SELECT status, rfq, dv, pv, post_prod
            FROM dim_event
            WHERE event_id = 'event-1'
            """
        ).fetchone()
        assert event_row_second == ("Approved", False, False, False, False)
    finally:
        second_store.close()


def test_startup_backfill_repairs_generic_channel_map_headers_from_artifacts(
    tmp_path: Path,
):
    db_path = tmp_path / "dashboard.db"
    store = UnifiedStore(db_path)
    try:
        store.upsert_program("P-REPAIR")
        store.upsert_channel_map(
            "P-REPAIR",
            "V1",
            "bj_xy_force_plot",
            "col_2",
            "col_3",
            x_col=2,
            y_col=3,
        )
        store.upsert_ingestion_artifact(
            program_id="P-REPAIR",
            version="V1",
            source_file="event.csv",
            artifact_path="artifacts/channel-map/event.csv",
            artifact_kind="csv",
            file_hash="hash-repair",
            row_count=2,
            column_count=4,
            preview_json=json.dumps(
                {
                    "lines": [
                        "#HEADER",
                        "#TITLES",
                        "Index,Time,BJ X Raw,BJ Y Raw",
                        "#UNITS",
                        ",s,N,N",
                    ]
                }
            ),
            metadata_json="{}",
            custom_fields_json="{}",
            status="processed",
            owner_user_id=None,
        )
    finally:
        store.close()

    repaired = UnifiedStore(db_path)
    try:
        rows = repaired.get_channel_map("P-REPAIR", "V1")
        assert rows[0]["x_channel"] == "BJ X Raw"
        assert rows[0]["y_channel"] == "BJ Y Raw"
        assert rows[0]["x_unit"] == "N"
        assert rows[0]["y_unit"] == "N"
    finally:
        repaired.close()


def test_migration_runner_startup_path_applies_backfills_without_reapplying_schema(
    tmp_path: Path,
):
    db_path = tmp_path / "startup-path.db"
    runner = MigrationRunner(db_path)
    initial_result = runner.apply_initial_schema()
    assert initial_result["success"] is True

    conn = _duckdb_module().connect(str(db_path))
    try:
        conn.execute(
            """
            INSERT INTO users (id, username, role, can_write)
            VALUES ('admin-id', 'admin', 'admin', FALSE)
            """
        )
        conn.execute(
            """
            INSERT INTO dim_event (
                event_id,
                program_id,
                version,
                status,
                rfq,
                dv,
                pv,
                post_prod
            )
            VALUES (
                'event-1',
                'program-a',
                'v1',
                NULL,
                NULL,
                NULL,
                NULL,
                NULL
            )
            """
        )
    finally:
        conn.close()

    store, migration_result = runner.initialize_store_for_startup()
    try:
        assert migration_result["success"] is True
        assert migration_result["current_version"] == migration_result["target_version"]
        admin = store.get_user_by_username("admin")
        assert admin is not None
        assert bool(admin["can_write"]) is True
        event_row = store.read_connection.execute(
            """
            SELECT status, rfq, dv, pv, post_prod
            FROM dim_event
            WHERE event_id = 'event-1'
            """
        ).fetchone()
        assert event_row == (None, False, False, False, False)
    finally:
        store.close()


def test_migration_runner_startup_path_heals_legacy_versioned_schema(tmp_path: Path):
    db_path = tmp_path / "legacy-versioned.db"
    conn = _duckdb_module().connect(str(db_path))
    try:
        conn.execute(
            """
            CREATE TABLE schema_version (
                id INTEGER PRIMARY KEY,
                version INTEGER NOT NULL,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                description VARCHAR
            )
            """
        )
        conn.execute(
            """
            INSERT INTO schema_version (id, version, description)
            VALUES (1, 1, 'legacy version marker')
            """
        )
        conn.execute(
            """
            CREATE TABLE users (
                id VARCHAR PRIMARY KEY,
                username VARCHAR NOT NULL UNIQUE,
                role VARCHAR NOT NULL,
                password_hash VARCHAR,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login_at TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            INSERT INTO users (id, username, role, password_hash)
            VALUES ('admin-id', 'admin', 'admin', 'hashed-password')
            """
        )
    finally:
        conn.close()

    runner = MigrationRunner(db_path)
    store, migration_result = runner.initialize_store_for_startup()
    try:
        assert migration_result["success"] is True
        assert migration_result["current_version"] == migration_result["target_version"]
        assert migration_result["schema_reconcile_statements"] > 0
        assert {"can_write", "last_settings_visit_at"}.issubset(
            _column_names(store, "users")
        )
        admin = store.get_user_by_username("admin")
        assert admin is not None
        assert bool(admin["can_write"]) is True
    finally:
        store.close()


def test_unified_store_session_operations_via_repository_extraction(tmp_path: Path):
    store = UnifiedStore(tmp_path / "sessions.db")
    try:
        initial_data_version = store.get_data_version()
        expires_at = datetime.now(UTC) + timedelta(hours=1)
        store.upsert_session(
            "session-1",
            {
                "user_id": "user-1",
                "data_state": {"selected_event_ids": ["event-1"]},
                "global_filters": {"status": ["Approved"]},
                "rendered_event_ids": ["event-1"],
                "ui_preferences": {"grid_columns": 3},
                "expires_at": expires_at,
            },
        )
        after_upsert_data_version = store.get_data_version()
        assert after_upsert_data_version == initial_data_version

        session = store.get_session("session-1", "user-1")
        assert session is not None
        assert session["user_id"] == "user-1"

        assert store.delete_session("session-1", "user-1") is True
        after_delete_data_version = store.get_data_version()
        assert after_delete_data_version == initial_data_version
        assert store.get_session("session-1", "user-1") is None
    finally:
        store.close()


def test_unified_store_data_version_increments_on_write(tmp_path: Path):
    store = UnifiedStore(tmp_path / "data-version.db")
    try:
        initial = store.get_data_version()
        store.create_user("writer-1", password_hash="hash-1")
        after_create = store.get_data_version()
        assert after_create > initial

        user = store.get_user_by_username("writer-1")
        assert user is not None
        store.update_user_last_login(user["id"])
        after_update = store.get_data_version()
        assert after_update > after_create
    finally:
        store.close()

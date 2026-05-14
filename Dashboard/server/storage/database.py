"""Unified DuckDB store for all application data."""

import json
import logging
import os
import re
import shutil
import threading
import uuid
from collections.abc import Callable, Generator
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import duckdb
import pandas as pd

from server.utils.boolean_filters import build_boolean_filter_condition
from server.utils.weight_filters import build_weight_range_condition

from .schema_loader import SchemaLoader, get_schema_loader

logger = logging.getLogger(__name__)

# (table_name, current_table_index_1_based, total_tables)
ParquetProgressFn = Callable[[str | None, int, int], None]


def _quote_duck_ident(name: str) -> str:
    """Quote a DuckDB identifier for use in SQL."""
    return '"' + name.replace('"', '""') + '"'


def _parse_copy_table(copy_line: str) -> str | None:
    """Extract table name from a COPY ... FROM line."""
    m = re.match(
        r"^\s*COPY\s+(\"[^\"]+\"|\w+)\s+FROM\s+",
        copy_line.strip(),
        flags=re.IGNORECASE,
    )
    if not m:
        return None
    raw = m.group(1)
    if raw.startswith('"') and raw.endswith('"'):
        return raw[1:-1].replace('""', '"')
    return raw


def _normalize_create_sequence_sql(sql: str) -> str:
    """
    Ensure CREATE SEQUENCE uses IF NOT EXISTS so duplicate sequence DDL in schema.sql
    (e.g. from duckdb_sequences()) does not fail on import.
    """
    return re.sub(
        r"(?is)\bCREATE\s+SEQUENCE\s+(?!IF\s+NOT\s+EXISTS\b)",
        "CREATE SEQUENCE IF NOT EXISTS ",
        sql,
    )


class _GuardedResult:
    """Deferred query: execute + fetch run under the store lock (one connection)."""

    __slots__ = ("_store", "_sql", "_params")

    def __init__(self, store: "UnifiedStore", sql: str, params: list[Any]) -> None:
        self._store = store
        self._sql = sql
        self._params = params

    def fetchall(self) -> Any:
        with self._store._db_lock:
            self._store._ensure_connection_unlocked()
            rel = self._store._connection.execute(self._sql, self._params)
            self._store._tls.last_description = self._store._connection.description
            return rel.fetchall()

    def fetchone(self) -> Any:
        with self._store._db_lock:
            self._store._ensure_connection_unlocked()
            rel = self._store._connection.execute(self._sql, self._params)
            self._store._tls.last_description = self._store._connection.description
            return rel.fetchone()

    def fetchdf(self) -> Any:
        with self._store._db_lock:
            self._store._ensure_connection_unlocked()
            rel = self._store._connection.execute(self._sql, self._params)
            self._store._tls.last_description = self._store._connection.description
            return rel.fetchdf()

    def fetch_arrow_table(self) -> Any:
        with self._store._db_lock:
            self._store._ensure_connection_unlocked()
            rel = self._store._connection.execute(self._sql, self._params)
            self._store._tls.last_description = self._store._connection.description
            return rel.fetch_arrow_table()


class _GuardedConnection:
    """Read facade: every execute/fetch and description access is serialized."""

    __slots__ = ("_store",)

    def __init__(self, store: "UnifiedStore") -> None:
        self._store = store

    @property
    def description(self) -> Any:
        with self._store._db_lock:
            self._store._ensure_connection_unlocked()
            ld = getattr(self._store._tls, "last_description", None)
            if ld is not None:
                return ld
            return self._store._connection.description

    def execute(
        self,
        sql: str,
        parameters: list[Any] | tuple[Any, ...] | None = None,
    ) -> _GuardedResult:
        params = list(parameters) if parameters is not None else []
        return _GuardedResult(self._store, sql, params)


class UnifiedStore:
    """
    Single-file DuckDB store for all application data.

    Contains:
    - Metadata tables (dim_program, dim_event, dim_channel_map, audit_log)
    - Measurement tables (measurements_raw, measurements_lttb)
    - User state tables (sessions, saved_filters, user_preferences, event_access_log)

    This design enables portability via Parquet export/import (zstd) or file copy.
    """

    def __init__(self, db_path: Path, schema_loader: SchemaLoader | None = None):
        self.db_path = db_path.resolve()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._connection: duckdb.DuckDBPyConnection | None = None
        self._db_lock = threading.RLock()
        self._tls = threading.local()
        self._read_proxy = _GuardedConnection(self)
        self._schema_loader = schema_loader or get_schema_loader()
        self._init_schema()

    def _ensure_connection_unlocked(self) -> None:
        """Open the shared connection; caller must hold ``_db_lock``."""
        if self._connection is None:
            self._connection = duckdb.connect(str(self.db_path))

    @property
    def read_connection(self) -> _GuardedConnection:
        """Serialized reads via one shared RW connection (see DEC-015 / docs)."""
        return self._read_proxy

    @contextmanager
    def write_connection(self) -> Generator[duckdb.DuckDBPyConnection, None, None]:
        """
        Exclusive write transaction on the shared connection.

        Uses the same DuckDB connection as reads so we never close a connection
        that other threads may still reference (avoids ``bad_weak_ptr``). All
        reads and writes are serialized with ``_db_lock``.
        """
        with self._db_lock:
            self._ensure_connection_unlocked()
            conn = self._connection
            if conn is None:
                msg = "DuckDB connection failed to open"
                raise RuntimeError(msg)
            try:
                conn.begin()
                yield conn
                conn.commit()
            except Exception:
                try:
                    conn.rollback()
                except Exception:
                    pass
                raise

    def _init_schema(self) -> None:
        """Create all tables if they don't exist."""
        with self.write_connection() as conn:
            # ===== SEQUENCES FROM SCHEMA.YAML =====
            for seq_sql in self._schema_loader.generate_all_sequence_sql():
                conn.execute(seq_sql)
            
            # ===== ADDITIONAL SEQUENCES (not in schema.yaml yet) =====
            conn.execute("CREATE SEQUENCE IF NOT EXISTS seq_channel_map_id START 1")
            conn.execute("CREATE SEQUENCE IF NOT EXISTS seq_meas_raw_id START 1")
            conn.execute("CREATE SEQUENCE IF NOT EXISTS seq_custom_field_value_id START 1")
            conn.execute("CREATE SEQUENCE IF NOT EXISTS seq_event_custom_field_value_id START 1")
            conn.execute("CREATE SEQUENCE IF NOT EXISTS seq_ingestion_artifact_id START 1")

            # ===== TABLES FROM SCHEMA.YAML =====
            # dim_program and dim_event are loaded from schema.yaml
            for table_name, table_def in self._schema_loader.tables.items():
                table_sql = self._schema_loader.generate_table_sql(table_name, table_def)
                conn.execute(table_sql)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS dim_channel_map (
                    id BIGINT PRIMARY KEY DEFAULT nextval('seq_channel_map_id'),
                    program_id VARCHAR NOT NULL,
                    version VARCHAR NOT NULL,
                    plot_key VARCHAR NOT NULL,
                    x_col INTEGER,
                    y_col INTEGER,
                    x_channel VARCHAR NOT NULL,
                    y_channel VARCHAR NOT NULL,
                    plot_order INTEGER DEFAULT 0,
                    x_scale_factor DOUBLE DEFAULT 1.0,
                    y_scale_factor DOUBLE DEFAULT 1.0,
                    x_unit VARCHAR,
                    y_unit VARCHAR,
                    UNIQUE (program_id, version, plot_key)
                )
            """)
            conn.execute("ALTER TABLE dim_channel_map ADD COLUMN IF NOT EXISTS x_col INTEGER")
            conn.execute("ALTER TABLE dim_channel_map ADD COLUMN IF NOT EXISTS y_col INTEGER")

            conn.execute("""
                CREATE TABLE IF NOT EXISTS ingestion_artifacts (
                    artifact_id BIGINT PRIMARY KEY DEFAULT nextval('seq_ingestion_artifact_id'),
                    program_id VARCHAR NOT NULL,
                    version VARCHAR NOT NULL,
                    source_file VARCHAR NOT NULL,
                    artifact_path VARCHAR NOT NULL,
                    artifact_kind VARCHAR NOT NULL,
                    file_hash VARCHAR NOT NULL,
                    row_count INTEGER DEFAULT 0,
                    column_count INTEGER DEFAULT 0,
                    preview_json JSON,
                    metadata_json JSON,
                    custom_fields_json JSON,
                    status VARCHAR NOT NULL DEFAULT 'pending',
                    error VARCHAR,
                    event_id VARCHAR,
                    owner_user_id VARCHAR,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (program_id, version, file_hash)
                )
            """)
            conn.execute(
                "ALTER TABLE ingestion_artifacts ADD COLUMN IF NOT EXISTS column_count INTEGER DEFAULT 0"
            )
            conn.execute(
                "ALTER TABLE ingestion_artifacts ADD COLUMN IF NOT EXISTS preview_json JSON"
            )
            conn.execute(
                "ALTER TABLE ingestion_artifacts ADD COLUMN IF NOT EXISTS metadata_json JSON"
            )
            conn.execute(
                "ALTER TABLE ingestion_artifacts ADD COLUMN IF NOT EXISTS custom_fields_json JSON"
            )

            conn.execute("""
                CREATE TABLE IF NOT EXISTS audit_log (
                    id BIGINT PRIMARY KEY DEFAULT nextval('seq_audit_log_id'),
                    action VARCHAR NOT NULL,
                    user_id VARCHAR,
                    event_id VARCHAR,
                    details JSON,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id VARCHAR PRIMARY KEY,
                    username VARCHAR NOT NULL UNIQUE,
                    role VARCHAR NOT NULL,
                    password_hash VARCHAR,
                    can_write BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login_at TIMESTAMP,
                    last_settings_visit_at TIMESTAMP
                )
            """)
            # Idempotent migrations for already-deployed databases.
            conn.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_write BOOLEAN DEFAULT FALSE"
            )
            conn.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_settings_visit_at TIMESTAMP"
            )
            conn.execute(
                "UPDATE users SET can_write = TRUE WHERE role = 'admin' AND can_write IS NOT TRUE"
            )

            # ===== MEASUREMENT TABLES =====
            conn.execute("""
                CREATE TABLE IF NOT EXISTS measurements_raw (
                    id BIGINT PRIMARY KEY DEFAULT nextval('seq_meas_raw_id'),
                    event_id VARCHAR NOT NULL,
                    timestamp DOUBLE NOT NULL,
                    channel_name VARCHAR NOT NULL,
                    value DOUBLE
                )
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS measurements_lttb (
                    id BIGINT PRIMARY KEY DEFAULT nextval('seq_meas_lttb_id'),
                    event_id VARCHAR NOT NULL,
                    plot_key VARCHAR NOT NULL,
                    x FLOAT NOT NULL,
                    y FLOAT NOT NULL
                )
            """)

            # ===== USER STATE TABLES =====
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id VARCHAR PRIMARY KEY,
                    user_id VARCHAR,
                    data_state JSON,
                    baseline_state JSON,
                    new_data_state JSON,
                    global_filters JSON,
                    rendered_event_ids JSON,
                    ui_preferences JSON,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP,
                    expires_at TIMESTAMP
                )
            """)
            conn.execute("""
                ALTER TABLE sessions
                ADD COLUMN IF NOT EXISTS rendered_event_ids JSON
            """)
            conn.execute("""
                ALTER TABLE sessions
                ADD COLUMN IF NOT EXISTS user_id VARCHAR
            """)
            conn.execute("""
                ALTER TABLE sessions
                ADD COLUMN IF NOT EXISTS data_state JSON
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS upload_tasks (
                    task_id VARCHAR PRIMARY KEY,
                    created_by_user_id VARCHAR NOT NULL,
                    status VARCHAR NOT NULL,
                    phase VARCHAR NOT NULL,
                    completed_events INTEGER DEFAULT 0,
                    total_events INTEGER DEFAULT 0,
                    current_event VARCHAR,
                    error VARCHAR,
                    result_json JSON,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL
                )
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS saved_filters (
                    id BIGINT PRIMARY KEY DEFAULT nextval('seq_saved_filter_id'),
                    user_id VARCHAR,
                    name VARCHAR NOT NULL,
                    data_state JSON,
                    baseline_state JSON,
                    new_data_state JSON,
                    global_filters JSON,
                    is_default BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                ALTER TABLE saved_filters
                ADD COLUMN IF NOT EXISTS data_state JSON
            """)
            conn.execute("""
                ALTER TABLE saved_filters
                ADD COLUMN IF NOT EXISTS user_id VARCHAR
            """)
            conn.execute("""
                ALTER TABLE dim_event
                ADD COLUMN IF NOT EXISTS uploaded_by_user_id VARCHAR
            """)
            conn.execute("""
                ALTER TABLE dim_event
                ADD COLUMN IF NOT EXISTS last_updated_by_user_id VARCHAR
            """)
            conn.execute("""
                ALTER TABLE dim_event
                ADD COLUMN IF NOT EXISTS phase VARCHAR
            """)
            conn.execute("""
                ALTER TABLE dim_event
                ADD COLUMN IF NOT EXISTS rfq BOOLEAN
            """)
            conn.execute("""
                ALTER TABLE dim_event
                ADD COLUMN IF NOT EXISTS dv BOOLEAN
            """)
            conn.execute("""
                ALTER TABLE dim_event
                ADD COLUMN IF NOT EXISTS pv BOOLEAN
            """)
            conn.execute("""
                ALTER TABLE dim_event
                ADD COLUMN IF NOT EXISTS post_prod BOOLEAN
            """)
            conn.execute("""
                ALTER TABLE dim_event
                ADD COLUMN IF NOT EXISTS gvw VARCHAR
            """)
            conn.execute("""
                ALTER TABLE dim_event
                ADD COLUMN IF NOT EXISTS fgawr VARCHAR
            """)
            conn.execute("""
                ALTER TABLE dim_event
                ADD COLUMN IF NOT EXISTS fgawr_range_lbs VARCHAR
            """)
            conn.execute("""
                ALTER TABLE dim_event
                ADD COLUMN IF NOT EXISTS rgawr VARCHAR
            """)
            conn.execute("""
                ALTER TABLE dim_event
                ADD COLUMN IF NOT EXISTS rgawr_range_lbs VARCHAR
            """)
            conn.execute("""
                ALTER TABLE dim_event
                ADD COLUMN IF NOT EXISTS material_construction VARCHAR
            """)
            conn.execute("""
                ALTER TABLE dim_event
                ADD COLUMN IF NOT EXISTS job_number VARCHAR
            """)
            conn.execute("""
                ALTER TABLE dim_event
                ADD COLUMN IF NOT EXISTS work_order VARCHAR
            """)
            conn.execute("""
                ALTER TABLE dim_event
                ADD COLUMN IF NOT EXISTS damper_type VARCHAR
            """)
            conn.execute("""
                ALTER TABLE dim_event
                ADD COLUMN IF NOT EXISTS status VARCHAR
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS user_preferences (
                    user_id VARCHAR PRIMARY KEY DEFAULT 'default',
                    pinned_baseline_event_id VARCHAR,
                    default_program_id VARCHAR,
                    grid_columns INTEGER DEFAULT 3,
                    grid_layout_order JSON,
                    theme VARCHAR DEFAULT 'light',
                    baseline_opacity FLOAT DEFAULT 0.5,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP
                )
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS event_access_log (
                    id BIGINT PRIMARY KEY DEFAULT nextval('seq_event_access_id'),
                    event_id VARCHAR NOT NULL,
                    access_type VARCHAR NOT NULL,
                    partition VARCHAR,
                    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS custom_field_definitions (
                    field_key VARCHAR PRIMARY KEY,
                    display_name VARCHAR NOT NULL UNIQUE,
                    data_type VARCHAR NOT NULL DEFAULT 'string',
                    is_filterable BOOLEAN DEFAULT TRUE,
                    created_by_user_id VARCHAR,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP
                )
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS custom_field_allowed_values (
                    id BIGINT PRIMARY KEY DEFAULT nextval('seq_custom_field_value_id'),
                    field_key VARCHAR NOT NULL,
                    program_id VARCHAR NOT NULL,
                    value VARCHAR NOT NULL,
                    sort_order INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (field_key, program_id, value)
                )
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS event_custom_field_values (
                    id BIGINT PRIMARY KEY DEFAULT nextval('seq_event_custom_field_value_id'),
                    event_id VARCHAR NOT NULL,
                    field_key VARCHAR NOT NULL,
                    value VARCHAR NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (event_id, field_key)
                )
            """)

            # ===== SCHEMA METADATA TABLE =====
            # Stores schema info for portability - enables runtime schema discovery
            conn.execute("""
                CREATE TABLE IF NOT EXISTS _schema_metadata (
                    key VARCHAR PRIMARY KEY,
                    value JSON,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # ===== INDEXES =====
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_event_program ON dim_event(program_id)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_event_version ON dim_event(program_id, version)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_event_status ON dim_event(status)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_event_deleted ON dim_event(is_deleted)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_event_file_hash ON dim_event(file_hash)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_channel_map ON dim_channel_map(program_id, version)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_meas_raw_event ON measurements_raw(event_id)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_meas_raw_event_channel "
                "ON measurements_raw(event_id, channel_name)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_meas_lttb_event "
                "ON measurements_lttb(event_id, plot_key)"
            )
            # Covering index for bulk LTTB queries (enables index-only scans)
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_meas_lttb_covering "
                "ON measurements_lttb(plot_key, event_id, x, y)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_upload_tasks_user ON upload_tasks(created_by_user_id)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_upload_tasks_expires ON upload_tasks(expires_at)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_event_uploaded_by_user ON dim_event(uploaded_by_user_id)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_saved_filters_user ON saved_filters(user_id)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_event_access_recent "
                "ON event_access_log(accessed_at DESC)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_filterable "
                "ON custom_field_definitions(is_filterable)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_custom_field_allowed_values_lookup "
                "ON custom_field_allowed_values(field_key, program_id, sort_order)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_event_custom_field_values_event "
                "ON event_custom_field_values(event_id)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_event_custom_field_values_field "
                "ON event_custom_field_values(field_key, value)"
            )
            # Backfill legacy data after index creation. DuckDB can reject CREATE INDEX
            # if DML updates are outstanding earlier in the same transaction.
            maturity_column_exists = conn.execute(
                """
                SELECT COUNT(*)
                FROM information_schema.columns
                WHERE table_name = 'dim_event' AND column_name = 'maturity'
                """
            ).fetchone()[0] > 0
            if maturity_column_exists:
                conn.execute("""
                    UPDATE dim_event
                    SET status = maturity
                    WHERE status IS NULL AND maturity IS NOT NULL
                """)
            conn.execute("""
                UPDATE dim_event
                SET
                    rfq = COALESCE(rfq, FALSE),
                    dv = COALESCE(dv, FALSE),
                    pv = COALESCE(pv, FALSE),
                    post_prod = COALESCE(post_prod, FALSE)
                WHERE
                    rfq IS NULL
                    OR dv IS NULL
                    OR pv IS NULL
                    OR post_prod IS NULL
            """)

        logger.info(f"Unified database initialized: {self.db_path}")

    # ===== PROGRAM OPERATIONS =====

    # ===== USER OPERATIONS =====

    def get_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        """Get user by internal ID."""
        result = self.read_connection.execute(
            "SELECT * FROM users WHERE id = ?",
            [user_id],
        ).fetchone()
        if result is None:
            return None
        columns = [desc[0] for desc in self.read_connection.description]
        return dict(zip(columns, result))

    def get_user_by_username(self, username: str) -> dict[str, Any] | None:
        """Get user by username."""
        result = self.read_connection.execute(
            "SELECT * FROM users WHERE username = ?",
            [username],
        ).fetchone()
        if result is None:
            return None
        columns = [desc[0] for desc in self.read_connection.description]
        return dict(zip(columns, result))

    def create_user(
        self,
        username: str,
        role: str = "user",
        password_hash: str | None = None,
        can_write: bool = False,
    ) -> dict[str, Any]:
        """Create a user record and return it."""
        user_id = str(uuid.uuid4())
        effective_can_write = True if role == "admin" else can_write
        with self.write_connection() as conn:
            conn.execute(
                """
                INSERT INTO users (id, username, role, password_hash, can_write)
                VALUES (?, ?, ?, ?, ?)
                """,
                [user_id, username, role, password_hash, effective_can_write],
            )
        user = self.get_user_by_id(user_id)
        if user is None:
            msg = f"Failed to create user: {username}"
            raise RuntimeError(msg)
        return user

    def update_user_last_login(self, user_id: str) -> None:
        """Update user's last login timestamp."""
        with self.write_connection() as conn:
            conn.execute(
                "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?",
                [user_id],
            )

    def list_users(self) -> list[dict[str, Any]]:
        """Return all users ordered by created_at."""
        result = self.read_connection.execute(
            "SELECT * FROM users ORDER BY created_at ASC, username ASC"
        ).fetchall()
        columns = [desc[0] for desc in self.read_connection.description]
        return [dict(zip(columns, row)) for row in result]

    def update_user_role_and_write(
        self,
        user_id: str,
        role: str | None = None,
        can_write: bool | None = None,
    ) -> dict[str, Any] | None:
        """Patch role and/or can_write. Admin role implies can_write=TRUE."""
        existing = self.get_user_by_id(user_id)
        if existing is None:
            return None
        new_role = role if role is not None else existing["role"]
        if new_role == "admin":
            new_can_write = True
        elif can_write is not None:
            new_can_write = can_write
        else:
            new_can_write = bool(existing.get("can_write"))
        with self.write_connection() as conn:
            conn.execute(
                "UPDATE users SET role = ?, can_write = ? WHERE id = ?",
                [new_role, new_can_write, user_id],
            )
        return self.get_user_by_id(user_id)

    def set_user_password_hash(self, user_id: str, password_hash: str) -> bool:
        """Replace the user's password hash. Returns True if a row was updated."""
        with self.write_connection() as conn:
            conn.execute(
                "UPDATE users SET password_hash = ? WHERE id = ?",
                [password_hash, user_id],
            )
        return self.get_user_by_id(user_id) is not None

    def delete_user(self, user_id: str) -> bool:
        """Hard delete a user row. Returns True if a row was removed."""
        existing = self.get_user_by_id(user_id)
        if existing is None:
            return False
        with self.write_connection() as conn:
            conn.execute("DELETE FROM users WHERE id = ?", [user_id])
        return True

    def count_users_created_after(
        self,
        after: datetime | None,
        exclude_user_id: str,
    ) -> int:
        """Count users created after a timestamp, excluding the caller."""
        if after is None:
            sql = "SELECT COUNT(*) FROM users WHERE id != ?"
            params: list[Any] = [exclude_user_id]
        else:
            sql = "SELECT COUNT(*) FROM users WHERE id != ? AND created_at > ?"
            params = [exclude_user_id, after]
        row = self.read_connection.execute(sql, params).fetchone()
        return int(row[0]) if row and row[0] is not None else 0

    def mark_user_settings_visited(self, user_id: str) -> None:
        """Stamp last_settings_visit_at = now() for an admin."""
        with self.write_connection() as conn:
            conn.execute(
                "UPDATE users SET last_settings_visit_at = CURRENT_TIMESTAMP WHERE id = ?",
                [user_id],
            )

    def get_program_ids(
        self,
        exclude_pending_only: bool = False,
        pending_only: bool = False,
        global_filters: dict[str, list[str] | str] | None = None,
    ) -> list[str]:
        """
        Get all unique program IDs.
        
        Args:
            exclude_pending_only: If True, only return programs with Approved/Obsolete events
            pending_only: If True, only return programs with Pending events
            global_filters: Optional dict of filter column -> values for bidirectional filtering
        """
        conditions = ["is_deleted = false"]
        params: list[Any] = []
        
        # Apply status filter based on partition type
        if exclude_pending_only:
            conditions.append("status IN ('Approved', 'Obsolete')")
        elif pending_only:
            conditions.append("status = 'Pending'")
        
        # Apply global filters for bidirectional filtering
        if global_filters:
            event_id_query = global_filters.get("event_id_query")
            if isinstance(event_id_query, str) and event_id_query.strip():
                conditions.append("LOWER(event_id) LIKE ?")
                params.append(f"%{event_id_query.strip().lower()}%")

            for filter_key, filter_values in global_filters.items():
                if filter_key == "event_id_query":
                    continue
                if isinstance(filter_values, list) and filter_values:
                    boolean_condition = build_boolean_filter_condition(filter_key, filter_values)
                    if boolean_condition is not None:
                        condition_sql, condition_params = boolean_condition
                        conditions.append(condition_sql)
                        params.extend(condition_params)
                        continue
                    weight_condition = build_weight_range_condition(filter_key, filter_values)
                    if weight_condition is not None:
                        condition_sql, condition_params = weight_condition
                        conditions.append(condition_sql)
                        params.extend(condition_params)
                        continue
                    placeholders = ", ".join(["?"] * len(filter_values))
                    conditions.append(f"{filter_key} IN ({placeholders})")
                    params.extend(filter_values)
        
        where_clause = " AND ".join(conditions)
        query = f"""
            SELECT DISTINCT program_id FROM (
                SELECT program_id FROM dim_event WHERE {where_clause}
                UNION
                SELECT program_id FROM ingestion_artifacts WHERE status IN ('pending', 'failed')
            ) programs
            ORDER BY program_id
        """
        result = self.read_connection.execute(query, params).fetchall()
        return [row[0] for row in result]

    def get_program(self, program_id: str) -> dict[str, Any] | None:
        """Get program metadata by ID."""
        query = "SELECT * FROM dim_program WHERE program_id = ?"
        result = self.read_connection.execute(query, [program_id]).fetchone()
        if result is None:
            return None
        columns = [desc[0] for desc in self.read_connection.description]
        return dict(zip(columns, result))

    def upsert_program(self, program_id: str, **kwargs: Any) -> None:
        """Insert or update program metadata."""
        with self.write_connection() as conn:
            existing = conn.execute(
                "SELECT 1 FROM dim_program WHERE program_id = ?", [program_id]
            ).fetchone()

            if existing:
                if kwargs:
                    set_clause = ", ".join(f"{k} = ?" for k in kwargs.keys())
                    conn.execute(
                        f"UPDATE dim_program SET {set_clause} WHERE program_id = ?",
                        list(kwargs.values()) + [program_id],
                    )
            else:
                columns = ["program_id"] + list(kwargs.keys())
                placeholders = ", ".join(["?"] * len(columns))
                conn.execute(
                    f"INSERT INTO dim_program ({', '.join(columns)}) VALUES ({placeholders})",
                    [program_id] + list(kwargs.values()),
                )

    # ===== VERSION OPERATIONS =====

    def get_versions(
        self,
        program_id: str | None = None,
        status_values: list[str] | None = None,
        program_ids: list[str] | None = None,
        global_filters: dict[str, list[str] | str] | None = None,
    ) -> list[str]:
        """
        Get all versions, optionally filtered by program(s), status, and global filters.
        
        Args:
            program_id: Single program ID (for backwards compatibility)
            status_values: List of status values to filter by
            program_ids: List of program IDs (for multi-program support)
            global_filters: Optional dict of filter column -> values for bidirectional filtering
        """
        conditions = ["is_deleted = false"]
        params: list[Any] = []
        
        # Handle program filtering (support both single and multi-program)
        effective_program_ids = program_ids or ([program_id] if program_id else None)
        if effective_program_ids:
            placeholders = ", ".join(["?"] * len(effective_program_ids))
            conditions.append(f"program_id IN ({placeholders})")
            params.extend(effective_program_ids)
        
        # Apply status filter
        if status_values:
            placeholders = ", ".join(["?"] * len(status_values))
            conditions.append(f"status IN ({placeholders})")
            params.extend(status_values)
        
        # Apply global filters for bidirectional filtering
        if global_filters:
            event_id_query = global_filters.get("event_id_query")
            if isinstance(event_id_query, str) and event_id_query.strip():
                conditions.append("LOWER(event_id) LIKE ?")
                params.append(f"%{event_id_query.strip().lower()}%")

            for filter_key, filter_values in global_filters.items():
                if filter_key == "event_id_query":
                    continue
                if isinstance(filter_values, list) and filter_values:
                    boolean_condition = build_boolean_filter_condition(filter_key, filter_values)
                    if boolean_condition is not None:
                        condition_sql, condition_params = boolean_condition
                        conditions.append(condition_sql)
                        params.extend(condition_params)
                        continue
                    weight_condition = build_weight_range_condition(filter_key, filter_values)
                    if weight_condition is not None:
                        condition_sql, condition_params = weight_condition
                        conditions.append(condition_sql)
                        params.extend(condition_params)
                        continue
                    placeholders = ", ".join(["?"] * len(filter_values))
                    conditions.append(f"{filter_key} IN ({placeholders})")
                    params.extend(filter_values)
        
        where_clause = " AND ".join(conditions)
        query = f"""
            SELECT DISTINCT version FROM (
                SELECT version FROM dim_event WHERE {where_clause}
                UNION
                SELECT version FROM ingestion_artifacts
                WHERE status IN ('pending', 'failed')
                {f"AND program_id IN ({', '.join(['?'] * len(effective_program_ids))})" if effective_program_ids else ""}
            ) versions
            ORDER BY version
        """
        if effective_program_ids:
            params.extend(effective_program_ids)
        result = self.read_connection.execute(query, params).fetchall()
        return [row[0] for row in result]

    # ===== EVENT OPERATIONS =====

    def get_events(
        self,
        program_id: str | None = None,
        version: str | None = None,
        status_values: list[str] | None = None,
        include_deleted: bool = False,
    ) -> list[dict[str, Any]]:
        """Get events with optional filtering."""
        conditions = []
        params: list[Any] = []

        if not include_deleted:
            conditions.append("is_deleted = false")

        if program_id:
            conditions.append("program_id = ?")
            params.append(program_id)

        if version:
            conditions.append("version = ?")
            params.append(version)

        if status_values:
            placeholders = ", ".join(["?"] * len(status_values))
            conditions.append(f"status IN ({placeholders})")
            params.extend(status_values)

        where_clause = " AND ".join(conditions) if conditions else "1=1"
        query = f"SELECT * FROM dim_event WHERE {where_clause} ORDER BY program_id, version, event_id"

        result = self.read_connection.execute(query, params).fetchall()
        columns = [desc[0] for desc in self.read_connection.description]
        return [dict(zip(columns, row)) for row in result]

    def get_event(self, event_id: str) -> dict[str, Any] | None:
        """Get single event by ID."""
        query = "SELECT * FROM dim_event WHERE event_id = ?"
        result = self.read_connection.execute(query, [event_id]).fetchone()
        if result is None:
            return None
        columns = [desc[0] for desc in self.read_connection.description]
        return dict(zip(columns, result))

    def insert_event(
        self,
        event_id: str,
        program_id: str,
        version: str,
        **kwargs: Any,
    ) -> None:
        """Insert new event metadata."""
        with self.write_connection() as conn:
            columns = ["event_id", "program_id", "version"] + list(kwargs.keys())
            placeholders = ", ".join(["?"] * len(columns))
            values = [event_id, program_id, version] + list(kwargs.values())
            conn.execute(
                f"INSERT INTO dim_event ({', '.join(columns)}) VALUES ({placeholders})",
                values,
            )

    def update_event(self, event_id: str, **kwargs: Any) -> None:
        """Update event metadata."""
        if not kwargs:
            return
        with self.write_connection() as conn:
            kwargs["updated_at"] = "CURRENT_TIMESTAMP"
            set_clause = ", ".join(
                f"{k} = CURRENT_TIMESTAMP" if k == "updated_at" else f"{k} = ?"
                for k in kwargs.keys()
            )
            values = [v for k, v in kwargs.items() if k != "updated_at"]
            conn.execute(
                f"UPDATE dim_event SET {set_clause} WHERE event_id = ?",
                values + [event_id],
            )

    def update_program_version_events(self, program_id: str, version: str, **kwargs: Any) -> int:
        """Batch update metadata for all non-deleted events in a program/version."""
        if not kwargs:
            return 0
        with self.write_connection() as conn:
            kwargs["updated_at"] = "CURRENT_TIMESTAMP"
            set_clause = ", ".join(
                f"{key} = CURRENT_TIMESTAMP" if key == "updated_at" else f"{key} = ?"
                for key in kwargs.keys()
            )
            values = [value for key, value in kwargs.items() if key != "updated_at"]
            updated_rows = conn.execute(
                f"""
                UPDATE dim_event
                SET {set_clause}
                WHERE program_id = ? AND version = ? AND is_deleted = false
                RETURNING event_id
                """,
                values + [program_id, version],
            ).fetchall()
            return len(updated_rows)

    def soft_delete_event(self, event_id: str) -> bool:
        """Mark event as deleted. Returns True if event existed."""
        with self.write_connection() as conn:
            result = conn.execute(
                "UPDATE dim_event SET is_deleted = true, updated_at = CURRENT_TIMESTAMP "
                "WHERE event_id = ? AND is_deleted = false RETURNING event_id",
                [event_id],
            ).fetchone()
            return result is not None

    def soft_delete_events(self, event_ids: list[str]) -> int:
        """Bulk soft-delete multiple events. Returns count of deleted events."""
        if not event_ids:
            return 0
        with self.write_connection() as conn:
            placeholders = ", ".join(["?"] * len(event_ids))
            result = conn.execute(
                f"UPDATE dim_event SET is_deleted = true, updated_at = CURRENT_TIMESTAMP "
                f"WHERE event_id IN ({placeholders}) AND is_deleted = false",
                event_ids,
            )
            return result.rowcount

    def purge_deleted_events(self, event_ids: list[str] | None = None) -> dict[str, int]:
        """
        Hard-delete soft-deleted events and their measurement rows.

        If event_ids is provided, only those soft-deleted events are purged.
        """
        filters = ["is_deleted = true"]
        params: list[Any] = []
        if event_ids:
            placeholders = ", ".join(["?"] * len(event_ids))
            filters.append(f"event_id IN ({placeholders})")
            params.extend(event_ids)

        where_clause = " AND ".join(filters)

        with self.write_connection() as conn:
            event_ids_to_purge = [
                row[0]
                for row in conn.execute(
                    f"SELECT event_id FROM dim_event WHERE {where_clause}",
                    params,
                ).fetchall()
            ]
            if not event_ids_to_purge:
                return {
                    "purged_events": 0,
                    "purged_raw_rows": 0,
                    "purged_lttb_rows": 0,
                }

            placeholders = ", ".join(["?"] * len(event_ids_to_purge))
            raw_count = conn.execute(
                f"SELECT COUNT(*) FROM measurements_raw WHERE event_id IN ({placeholders})",
                event_ids_to_purge,
            ).fetchone()[0]
            lttb_count = conn.execute(
                f"SELECT COUNT(*) FROM measurements_lttb WHERE event_id IN ({placeholders})",
                event_ids_to_purge,
            ).fetchone()[0]

            conn.execute(
                f"DELETE FROM measurements_raw WHERE event_id IN ({placeholders})",
                event_ids_to_purge,
            )
            conn.execute(
                f"DELETE FROM measurements_lttb WHERE event_id IN ({placeholders})",
                event_ids_to_purge,
            )
            deleted_events = conn.execute(
                f"DELETE FROM dim_event WHERE event_id IN ({placeholders}) RETURNING event_id",
                event_ids_to_purge,
            ).fetchall()

            return {
                "purged_events": len(deleted_events),
                "purged_raw_rows": int(raw_count),
                "purged_lttb_rows": int(lttb_count),
            }

    def get_relationship_orphan_counts(self) -> dict[str, int]:
        """Return orphan row counts to gate safe foreign-key rollout."""
        return {
            "dim_event_without_program": int(
                self.read_connection.execute(
                    """
                    SELECT COUNT(*)
                    FROM dim_event e
                    LEFT JOIN dim_program p ON p.program_id = e.program_id
                    WHERE p.program_id IS NULL
                    """
                ).fetchone()[0]
            ),
            "measurements_raw_without_event": int(
                self.read_connection.execute(
                    """
                    SELECT COUNT(*)
                    FROM measurements_raw r
                    LEFT JOIN dim_event e ON e.event_id = r.event_id
                    WHERE e.event_id IS NULL
                    """
                ).fetchone()[0]
            ),
            "measurements_lttb_without_event": int(
                self.read_connection.execute(
                    """
                    SELECT COUNT(*)
                    FROM measurements_lttb l
                    LEFT JOIN dim_event e ON e.event_id = l.event_id
                    WHERE e.event_id IS NULL
                    """
                ).fetchone()[0]
            ),
        }

    # ===== CHANNEL MAP OPERATIONS =====

    def get_channel_map(self, program_id: str, version: str) -> list[dict[str, Any]]:
        """Get channel map for program/version."""
        query = """
            SELECT * FROM dim_channel_map 
            WHERE program_id = ? AND version = ?
            ORDER BY plot_order, plot_key
        """
        result = self.read_connection.execute(query, [program_id, version]).fetchall()
        columns = [desc[0] for desc in self.read_connection.description]
        return [dict(zip(columns, row)) for row in result]

    def upsert_channel_map(
        self,
        program_id: str,
        version: str,
        plot_key: str,
        x_channel: str,
        y_channel: str,
        plot_order: int = 0,
        **kwargs: Any,
    ) -> None:
        """Insert or update channel map entry."""
        with self.write_connection() as conn:
            conn.execute(
                """
                INSERT INTO dim_channel_map 
                    (program_id, version, plot_key, x_col, y_col, x_channel, y_channel, plot_order,
                     x_scale_factor, y_scale_factor, x_unit, y_unit)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (program_id, version, plot_key) DO UPDATE SET
                    x_col = EXCLUDED.x_col,
                    y_col = EXCLUDED.y_col,
                    x_channel = EXCLUDED.x_channel,
                    y_channel = EXCLUDED.y_channel,
                    plot_order = EXCLUDED.plot_order,
                    x_scale_factor = EXCLUDED.x_scale_factor,
                    y_scale_factor = EXCLUDED.y_scale_factor,
                    x_unit = EXCLUDED.x_unit,
                    y_unit = EXCLUDED.y_unit
                """,
                [
                    program_id,
                    version,
                    plot_key,
                    kwargs.get("x_col"),
                    kwargs.get("y_col"),
                    x_channel,
                    y_channel,
                    plot_order,
                    kwargs.get("x_scale_factor", 1.0),
                    kwargs.get("y_scale_factor", 1.0),
                    kwargs.get("x_unit"),
                    kwargs.get("y_unit"),
                ],
            )

    # ===== INGESTION ARTIFACT OPERATIONS =====

    def upsert_ingestion_artifact(
        self,
        *,
        program_id: str,
        version: str,
        source_file: str,
        artifact_path: str,
        artifact_kind: str,
        file_hash: str,
        row_count: int,
        column_count: int,
        preview_json: str,
        metadata_json: str,
        custom_fields_json: str,
        status: str,
        owner_user_id: str | None,
        event_id: str | None = None,
        error: str | None = None,
    ) -> int:
        """Insert or update the retained CSV artifact used for channel-map processing."""
        with self.write_connection() as conn:
            row = conn.execute(
                """
                INSERT INTO ingestion_artifacts (
                    program_id, version, source_file, artifact_path, artifact_kind,
                    file_hash, row_count, column_count, preview_json, metadata_json,
                    custom_fields_json, status, error, event_id, owner_user_id
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (program_id, version, file_hash) DO UPDATE SET
                    source_file = EXCLUDED.source_file,
                    artifact_path = EXCLUDED.artifact_path,
                    artifact_kind = EXCLUDED.artifact_kind,
                    row_count = EXCLUDED.row_count,
                    column_count = EXCLUDED.column_count,
                    preview_json = EXCLUDED.preview_json,
                    metadata_json = EXCLUDED.metadata_json,
                    custom_fields_json = EXCLUDED.custom_fields_json,
                    status = EXCLUDED.status,
                    error = EXCLUDED.error,
                    event_id = COALESCE(EXCLUDED.event_id, ingestion_artifacts.event_id),
                    owner_user_id = EXCLUDED.owner_user_id,
                    updated_at = now()
                RETURNING artifact_id
                """,
                [
                    program_id,
                    version,
                    source_file,
                    artifact_path,
                    artifact_kind,
                    file_hash,
                    row_count,
                    column_count,
                    preview_json,
                    metadata_json,
                    custom_fields_json,
                    status,
                    error,
                    event_id,
                    owner_user_id,
                ],
            ).fetchone()
            return int(row[0])

    def list_ingestion_artifacts(
        self,
        program_id: str | None = None,
        version: str | None = None,
        statuses: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """List retained ingestion artifacts, optionally scoped by program/version/status."""
        conditions: list[str] = []
        params: list[Any] = []
        if program_id is not None:
            conditions.append("program_id = ?")
            params.append(program_id)
        if version is not None:
            conditions.append("version = ?")
            params.append(version)
        if statuses:
            placeholders = ", ".join(["?"] * len(statuses))
            conditions.append(f"status IN ({placeholders})")
            params.extend(statuses)
        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
        rows = self.read_connection.execute(
            f"""
            SELECT *
            FROM ingestion_artifacts
            {where_clause}
            ORDER BY program_id, version, created_at, artifact_id
            """,
            params,
        ).fetchall()
        columns = [desc[0] for desc in self.read_connection.description]
        return [dict(zip(columns, row)) for row in rows]

    def get_pending_program_versions(self) -> list[dict[str, Any]]:
        """Return program/version summaries for retained artifacts that still need attention."""
        rows = self.read_connection.execute(
            """
            SELECT
                a.program_id,
                a.version,
                COUNT(*) AS artifact_count,
                SUM(CASE WHEN a.status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN a.status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
                BOOL_OR(cm.program_id IS NULL) AS missing_channel_map
            FROM ingestion_artifacts a
            LEFT JOIN (
                SELECT DISTINCT program_id, version
                FROM dim_channel_map
            ) cm ON cm.program_id = a.program_id AND cm.version = a.version
            WHERE a.status IN ('pending', 'failed')
            GROUP BY a.program_id, a.version
            ORDER BY a.program_id, a.version
            """
        ).fetchall()
        return [
            {
                "program_id": str(row[0]),
                "version": str(row[1]),
                "artifact_count": int(row[2] or 0),
                "pending_count": int(row[3] or 0),
                "failed_count": int(row[4] or 0),
                "missing_channel_map": bool(row[5]),
            }
            for row in rows
        ]

    def update_ingestion_artifact_status(
        self,
        artifact_id: int,
        *,
        status: str,
        event_id: str | None = None,
        error: str | None = None,
    ) -> None:
        """Update artifact processing state."""
        with self.write_connection() as conn:
            conn.execute(
                """
                UPDATE ingestion_artifacts
                SET status = ?, event_id = COALESCE(?, event_id), error = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE artifact_id = ?
                """,
                [status, event_id, error, artifact_id],
            )

    def user_can_edit_program_version(
        self,
        program_id: str,
        version: str,
        user_id: str,
        is_admin: bool,
    ) -> bool:
        """Admins can edit anything; writers can edit versions they uploaded."""
        if is_admin:
            return True
        row = self.read_connection.execute(
            """
            SELECT 1
            FROM (
                SELECT uploaded_by_user_id AS owner_user_id
                FROM dim_event
                WHERE program_id = ? AND version = ? AND is_deleted = false
                UNION ALL
                SELECT owner_user_id
                FROM ingestion_artifacts
                WHERE program_id = ? AND version = ?
            ) owners
            WHERE owner_user_id = ?
            LIMIT 1
            """,
            [program_id, version, program_id, version, user_id],
        ).fetchone()
        return row is not None

    def hard_delete_event_data(self, event_id: str, conn: duckdb.DuckDBPyConnection) -> None:
        """Delete an event and its measurements before regenerating from a retained artifact."""
        conn.execute("DELETE FROM measurements_raw WHERE event_id = ?", [event_id])
        conn.execute("DELETE FROM measurements_lttb WHERE event_id = ?", [event_id])
        conn.execute("DELETE FROM event_custom_field_values WHERE event_id = ?", [event_id])
        conn.execute("DELETE FROM dim_event WHERE event_id = ?", [event_id])

    def preview_program_version_scope_delete(
        self,
        program_id: str,
        version: str | None = None,
    ) -> dict[str, Any]:
        """Return counts, owners, and artifact paths for a program/version hard delete."""
        event_filters = ["program_id = ?", "is_deleted = false"]
        artifact_filters = ["program_id = ?"]
        channel_filters = ["program_id = ?"]
        event_params: list[Any] = [program_id]
        artifact_params: list[Any] = [program_id]
        channel_params: list[Any] = [program_id]
        if version is not None:
            event_filters.append("version = ?")
            artifact_filters.append("version = ?")
            channel_filters.append("version = ?")
            event_params.append(version)
            artifact_params.append(version)
            channel_params.append(version)

        event_where = " AND ".join(event_filters)
        artifact_where = " AND ".join(artifact_filters)
        channel_where = " AND ".join(channel_filters)

        event_rows = self.read_connection.execute(
            f"""
            SELECT event_id, uploaded_by_user_id
            FROM dim_event
            WHERE {event_where}
            """,
            event_params,
        ).fetchall()
        event_ids = [str(row[0]) for row in event_rows]
        owners = {
            str(row[1])
            for row in event_rows
            if row[1] is not None
        }

        artifact_rows = self.read_connection.execute(
            f"""
            SELECT artifact_id, artifact_path, owner_user_id
            FROM ingestion_artifacts
            WHERE {artifact_where}
            """,
            artifact_params,
        ).fetchall()
        artifact_paths = [str(row[1]) for row in artifact_rows if row[1] is not None]
        owners.update(str(row[2]) for row in artifact_rows if row[2] is not None)

        raw_rows = 0
        lttb_rows = 0
        custom_field_rows = 0
        if event_ids:
            placeholders = ", ".join(["?"] * len(event_ids))
            raw_rows = int(
                self.read_connection.execute(
                    f"SELECT COUNT(*) FROM measurements_raw WHERE event_id IN ({placeholders})",
                    event_ids,
                ).fetchone()[0]
                or 0
            )
            lttb_rows = int(
                self.read_connection.execute(
                    f"SELECT COUNT(*) FROM measurements_lttb WHERE event_id IN ({placeholders})",
                    event_ids,
                ).fetchone()[0]
                or 0
            )
            custom_field_rows = int(
                self.read_connection.execute(
                    f"SELECT COUNT(*) FROM event_custom_field_values WHERE event_id IN ({placeholders})",
                    event_ids,
                ).fetchone()[0]
                or 0
            )

        channel_map_rows = int(
            self.read_connection.execute(
                f"SELECT COUNT(*) FROM dim_channel_map WHERE {channel_where}",
                channel_params,
            ).fetchone()[0]
            or 0
        )

        return {
            "program_id": program_id,
            "version": version,
            "event_ids": event_ids,
            "event_count": len(event_ids),
            "raw_rows": raw_rows,
            "lttb_rows": lttb_rows,
            "event_custom_field_rows": custom_field_rows,
            "artifact_count": len(artifact_rows),
            "artifact_paths": artifact_paths,
            "channel_map_rows": channel_map_rows,
            "owner_user_ids": sorted(owners),
        }

    def hard_delete_program_version_scope(
        self,
        program_id: str,
        version: str | None = None,
    ) -> dict[str, Any]:
        """Hard-delete a program or program/version scope, including retained files."""
        preview = self.preview_program_version_scope_delete(program_id, version)
        event_ids = preview["event_ids"]
        artifact_paths = preview["artifact_paths"]

        event_filters = ["program_id = ?", "is_deleted = false"]
        artifact_filters = ["program_id = ?"]
        channel_filters = ["program_id = ?"]
        event_params: list[Any] = [program_id]
        artifact_params: list[Any] = [program_id]
        channel_params: list[Any] = [program_id]
        if version is not None:
            event_filters.append("version = ?")
            artifact_filters.append("version = ?")
            channel_filters.append("version = ?")
            event_params.append(version)
            artifact_params.append(version)
            channel_params.append(version)

        event_where = " AND ".join(event_filters)
        artifact_where = " AND ".join(artifact_filters)
        channel_where = " AND ".join(channel_filters)

        with self.write_connection() as conn:
            if event_ids:
                placeholders = ", ".join(["?"] * len(event_ids))
                conn.execute(
                    f"DELETE FROM measurements_raw WHERE event_id IN ({placeholders})",
                    event_ids,
                )
                conn.execute(
                    f"DELETE FROM measurements_lttb WHERE event_id IN ({placeholders})",
                    event_ids,
                )
                conn.execute(
                    f"DELETE FROM event_custom_field_values WHERE event_id IN ({placeholders})",
                    event_ids,
                )
            conn.execute(f"DELETE FROM dim_event WHERE {event_where}", event_params)
            conn.execute(f"DELETE FROM ingestion_artifacts WHERE {artifact_where}", artifact_params)
            conn.execute(f"DELETE FROM dim_channel_map WHERE {channel_where}", channel_params)
            if version is None:
                remaining = conn.execute(
                    "SELECT 1 FROM dim_event WHERE program_id = ? LIMIT 1",
                    [program_id],
                ).fetchone()
                remaining_artifacts = conn.execute(
                    "SELECT 1 FROM ingestion_artifacts WHERE program_id = ? LIMIT 1",
                    [program_id],
                ).fetchone()
                if remaining is None and remaining_artifacts is None:
                    conn.execute("DELETE FROM dim_program WHERE program_id = ?", [program_id])

        deleted_files = 0
        skipped_files: list[str] = []
        artifact_root = (self.db_path.parent / "artifacts" / "channel-map").resolve()
        for artifact_path in artifact_paths:
            path = Path(artifact_path)
            abs_path = path if path.is_absolute() else self.db_path.parent / path
            try:
                resolved = abs_path.resolve()
                if resolved == artifact_root or artifact_root not in resolved.parents:
                    skipped_files.append(artifact_path)
                    continue
                if resolved.is_file():
                    resolved.unlink()
                    deleted_files += 1
            except OSError:
                skipped_files.append(artifact_path)

        return {
            **preview,
            "deleted_files": deleted_files,
            "skipped_files": skipped_files,
        }

    def user_can_delete_program_version_scope(
        self,
        program_id: str,
        version: str | None,
        user_id: str,
        is_admin: bool,
    ) -> bool:
        """Admins can delete any scope; writers must own every event/artifact in it."""
        if is_admin:
            return True
        preview = self.preview_program_version_scope_delete(program_id, version)
        return set(preview["owner_user_ids"]) == {user_id}

    # ===== MEASUREMENT OPERATIONS =====

    def insert_measurements(self, event_id: str, df: pd.DataFrame) -> int:
        """
        Insert raw measurements from a DataFrame.

        Expected columns: timestamp, channel_name, value
        Returns: Number of rows inserted
        """
        with self.write_connection() as conn:
            df_copy = df.copy()
            df_copy["event_id"] = event_id
            conn.execute("""
                INSERT INTO measurements_raw (event_id, timestamp, channel_name, value)
                SELECT event_id, timestamp, channel_name, value FROM df_copy
            """)
            return len(df_copy)

    def get_measurements(
        self,
        event_ids: list[str],
        channel_names: list[str] | None = None,
    ) -> pd.DataFrame:
        """Get raw measurements for events."""
        if not event_ids:
            return pd.DataFrame(columns=["event_id", "timestamp", "channel_name", "value"])

        placeholders = ", ".join(["?"] * len(event_ids))
        if channel_names:
            channel_placeholders = ", ".join(["?"] * len(channel_names))
            query = f"""
                SELECT event_id, timestamp, channel_name, value
                FROM measurements_raw
                WHERE event_id IN ({placeholders}) AND channel_name IN ({channel_placeholders})
                ORDER BY event_id, timestamp
            """
            return self.read_connection.execute(
                query, event_ids + channel_names
            ).fetchdf()
        else:
            query = f"""
                SELECT event_id, timestamp, channel_name, value
                FROM measurements_raw
                WHERE event_id IN ({placeholders})
                ORDER BY event_id, timestamp
            """
            return self.read_connection.execute(query, event_ids).fetchdf()

    # ===== LTTB OPERATIONS =====

    def insert_lttb(self, event_id: str, plot_key: str, df: pd.DataFrame) -> int:
        """
        Insert LTTB-downsampled data for a specific plot.

        Expected columns: x, y
        Returns: Number of rows inserted
        """
        with self.write_connection() as conn:
            df_copy = df.copy()
            df_copy["event_id"] = event_id
            df_copy["plot_key"] = plot_key
            conn.execute("""
                INSERT INTO measurements_lttb (event_id, plot_key, x, y)
                SELECT event_id, plot_key, x, y FROM df_copy
            """)
            return len(df_copy)

    def get_lttb(self, event_ids: list[str], plot_key: str) -> pd.DataFrame:
        """Get LTTB data for specified events and plot key."""
        if not event_ids:
            return pd.DataFrame(columns=["event_id", "x", "y"])

        placeholders = ", ".join(["?"] * len(event_ids))
        query = f"""
            SELECT event_id, x, y 
            FROM measurements_lttb 
            WHERE event_id IN ({placeholders}) AND plot_key = ?
            ORDER BY event_id, id
        """
        return self.read_connection.execute(query, event_ids + [plot_key]).fetchdf()

    def get_lttb_bulk(self, event_ids: list[str], plot_keys: list[str]) -> pd.DataFrame:
        """
        Get LTTB data for specified events and multiple plot keys in ONE query.
        
        Returns DataFrame with columns: event_id, plot_key, x, y
        Uses Arrow export for faster conversion with large result sets.
        """
        if not event_ids or not plot_keys:
            return pd.DataFrame(columns=["event_id", "plot_key", "x", "y"])

        event_placeholders = ", ".join(["?"] * len(event_ids))
        plot_placeholders = ", ".join(["?"] * len(plot_keys))
        query = f"""
            SELECT event_id, plot_key, x, y 
            FROM measurements_lttb 
            WHERE event_id IN ({event_placeholders}) AND plot_key IN ({plot_placeholders})
            ORDER BY plot_key, event_id, id
        """
        # Arrow export is ~2-3x faster than fetchdf() for large result sets
        result = self.read_connection.execute(query, event_ids + plot_keys)
        return result.fetch_arrow_table().to_pandas()

    # ===== AUDIT OPERATIONS =====

    def log_audit(
        self,
        action: str,
        event_id: str | None = None,
        user_id: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        """Log an audit event."""
        import json

        with self.write_connection() as conn:
            conn.execute(
                """
                INSERT INTO audit_log (action, user_id, event_id, details)
                VALUES (?, ?, ?, ?)
                """,
                [action, user_id, event_id, json.dumps(details) if details else None],
            )

    # ===== FILE HASH OPERATIONS =====

    def get_file_hashes(self, program_id: str, version: str) -> set[str]:
        """Get existing file hashes for a program/version."""
        query = """
            SELECT file_hash FROM dim_event
            WHERE program_id = ? AND version = ? AND file_hash IS NOT NULL AND is_deleted = false
        """
        result = self.read_connection.execute(query, [program_id, version]).fetchall()
        return {row[0] for row in result}

    # ===== SESSION OPERATIONS =====

    def get_session(self, session_id: str, user_id: str | None = None) -> dict[str, Any] | None:
        """Get session by ID, optionally scoped to a user."""
        query = "SELECT * FROM sessions WHERE session_id = ?"
        params: list[Any] = [session_id]
        if user_id is not None:
            query += " AND user_id = ?"
            params.append(user_id)
        result = self.read_connection.execute(query, params).fetchone()
        if result is None:
            return None
        columns = [desc[0] for desc in self.read_connection.description]
        return dict(zip(columns, result))

    def upsert_session(self, session_id: str, data: dict[str, Any]) -> None:
        """Insert or update session."""
        import json

        def to_json(value: Any) -> str | None:
            """Convert value to JSON string, or None if value is None."""
            return json.dumps(value) if value is not None else None

        with self.write_connection() as conn:
            conn.execute(
                """
                INSERT INTO sessions (session_id, user_id, data_state,
                                       global_filters, rendered_event_ids, ui_preferences, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (session_id) DO UPDATE SET
                    user_id = COALESCE(EXCLUDED.user_id, sessions.user_id),
                    data_state = EXCLUDED.data_state,
                    global_filters = EXCLUDED.global_filters,
                    rendered_event_ids = EXCLUDED.rendered_event_ids,
                    ui_preferences = EXCLUDED.ui_preferences,
                    updated_at = now(),
                    expires_at = EXCLUDED.expires_at
                """,
                [
                    session_id,
                    data.get("user_id"),
                    to_json(data.get("data_state")),
                    to_json(data.get("global_filters")),
                    to_json(data.get("rendered_event_ids")),
                    to_json(data.get("ui_preferences")),
                    data.get("expires_at"),
                ],
            )

    def delete_session(self, session_id: str, user_id: str | None = None) -> bool:
        """Delete session, optionally scoped to user."""
        with self.write_connection() as conn:
            query = "DELETE FROM sessions WHERE session_id = ?"
            params: list[Any] = [session_id]
            if user_id is not None:
                query += " AND user_id = ?"
                params.append(user_id)
            query += " RETURNING session_id"
            result = conn.execute(query, params).fetchone()
            return result is not None

    # ===== UPLOAD TASK OPERATIONS =====

    def create_upload_task(
        self,
        task_id: str,
        created_by_user_id: str,
        total_events: int,
        ttl_minutes: int = 30,
    ) -> None:
        """Create upload task row."""
        expires_at = datetime.utcnow() + timedelta(minutes=ttl_minutes)
        with self.write_connection() as conn:
            conn.execute(
                """
                INSERT INTO upload_tasks (
                    task_id, created_by_user_id, status, phase,
                    completed_events, total_events, expires_at
                )
                VALUES (?, ?, 'queued', 'upload_received', 0, ?, ?)
                """,
                [task_id, created_by_user_id, total_events, expires_at],
            )

    def update_upload_task(
        self,
        task_id: str,
        *,
        status: str | None = None,
        phase: str | None = None,
        completed_events: int | None = None,
        total_events: int | None = None,
        current_event: Any = "__UNCHANGED__",
        error: str | None = None,
        result: dict[str, Any] | None = None,
    ) -> None:
        """Update upload task status fields."""
        assignments: list[str] = ["updated_at = CURRENT_TIMESTAMP"]
        params: list[Any] = []
        if status is not None:
            assignments.append("status = ?")
            params.append(status)
        if phase is not None:
            assignments.append("phase = ?")
            params.append(phase)
        if completed_events is not None:
            assignments.append("completed_events = ?")
            params.append(completed_events)
        if total_events is not None:
            assignments.append("total_events = ?")
            params.append(total_events)
        if current_event != "__UNCHANGED__":
            assignments.append("current_event = ?")
            params.append(current_event)
        if error is not None:
            assignments.append("error = ?")
            params.append(error)
        if result is not None:
            assignments.append("result_json = ?")
            params.append(json.dumps(result))

        if len(assignments) == 1:
            return

        params.append(task_id)
        with self.write_connection() as conn:
            conn.execute(
                f"UPDATE upload_tasks SET {', '.join(assignments)} WHERE task_id = ?",
                params,
            )

    def get_upload_task(
        self,
        task_id: str,
        created_by_user_id: str | None = None,
    ) -> dict[str, Any] | None:
        """Fetch upload task, optionally scoped to creator user."""
        query = "SELECT * FROM upload_tasks WHERE task_id = ?"
        params: list[Any] = [task_id]
        if created_by_user_id is not None:
            query += " AND created_by_user_id = ?"
            params.append(created_by_user_id)
        row = self.read_connection.execute(query, params).fetchone()
        if row is None:
            return None
        columns = [desc[0] for desc in self.read_connection.description]
        result = dict(zip(columns, row))
        raw = result.get("result_json")
        if raw is not None:
            if isinstance(raw, memoryview):
                raw = raw.tobytes()
            if isinstance(raw, (bytes, bytearray)):
                raw = raw.decode("utf-8")
            if isinstance(raw, str):
                try:
                    result["result_json"] = json.loads(raw)
                except json.JSONDecodeError:
                    result["result_json"] = None
        return result

    def delete_expired_upload_tasks(self) -> int:
        """Best-effort cleanup for old upload task rows."""
        with self.write_connection() as conn:
            deleted = conn.execute(
                "DELETE FROM upload_tasks WHERE expires_at < CURRENT_TIMESTAMP RETURNING task_id"
            ).fetchall()
            return len(deleted)

    # ===== CUSTOM FIELD OPERATIONS =====

    def upsert_custom_field_definition(
        self,
        field_key: str,
        display_name: str,
        data_type: str = "string",
        is_filterable: bool = True,
        created_by_user_id: str | None = None,
    ) -> dict[str, Any]:
        """Create or update a custom field definition."""
        with self.write_connection() as conn:
            conn.execute(
                """
                INSERT INTO custom_field_definitions
                    (field_key, display_name, data_type, is_filterable, created_by_user_id)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (field_key) DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    data_type = EXCLUDED.data_type,
                    is_filterable = EXCLUDED.is_filterable,
                    updated_at = CURRENT_TIMESTAMP
                """,
                [field_key, display_name, data_type, is_filterable, created_by_user_id],
            )

        definition = self.get_custom_field_definition(field_key)
        if definition is None:
            msg = f"Failed to upsert custom field definition: {field_key}"
            raise RuntimeError(msg)
        return definition

    def get_custom_field_definition(self, field_key: str) -> dict[str, Any] | None:
        """Get a custom field definition by key."""
        result = self.read_connection.execute(
            "SELECT * FROM custom_field_definitions WHERE field_key = ?",
            [field_key],
        ).fetchone()
        if result is None:
            return None
        columns = [desc[0] for desc in self.read_connection.description]
        return dict(zip(columns, result))

    def get_custom_field_definitions(self, filterable_only: bool = False) -> list[dict[str, Any]]:
        """Get custom field definitions."""
        query = "SELECT * FROM custom_field_definitions"
        params: list[Any] = []
        if filterable_only:
            query += " WHERE is_filterable = true"
        query += " ORDER BY display_name, field_key"

        result = self.read_connection.execute(query, params).fetchall()
        columns = [desc[0] for desc in self.read_connection.description]
        return [dict(zip(columns, row)) for row in result]

    def replace_custom_field_allowed_values(
        self,
        field_key: str,
        program_id: str,
        values: list[str],
    ) -> None:
        """Replace program-scoped allowed values for a custom field."""
        with self.write_connection() as conn:
            conn.execute(
                """
                DELETE FROM custom_field_allowed_values
                WHERE field_key = ? AND program_id = ?
                """,
                [field_key, program_id],
            )
            for idx, value in enumerate(values):
                conn.execute(
                    """
                    INSERT INTO custom_field_allowed_values
                        (field_key, program_id, value, sort_order)
                    VALUES (?, ?, ?, ?)
                    """,
                    [field_key, program_id, value, idx],
                )

    def get_custom_field_allowed_values(
        self,
        field_key: str | None = None,
        program_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """Get allowed values for custom fields with optional filters."""
        conditions: list[str] = []
        params: list[Any] = []

        if field_key:
            conditions.append("field_key = ?")
            params.append(field_key)
        if program_id:
            conditions.append("program_id = ?")
            params.append(program_id)

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        query = f"""
            SELECT field_key, program_id, value, sort_order
            FROM custom_field_allowed_values
            {where_clause}
            ORDER BY field_key, program_id, sort_order, value
        """
        result = self.read_connection.execute(query, params).fetchall()
        columns = [desc[0] for desc in self.read_connection.description]
        return [dict(zip(columns, row)) for row in result]

    def get_custom_filter_option_values(self, field_key: str, program_id: str | None = None) -> list[str]:
        """Get distinct allowed values for a custom field."""
        if program_id:
            result = self.read_connection.execute(
                """
                SELECT DISTINCT value
                FROM custom_field_allowed_values
                WHERE field_key = ? AND program_id = ?
                ORDER BY value
                """,
                [field_key, program_id],
            ).fetchall()
        else:
            result = self.read_connection.execute(
                """
                SELECT DISTINCT value
                FROM custom_field_allowed_values
                WHERE field_key = ?
                ORDER BY value
                """,
                [field_key],
            ).fetchall()
        return [row[0] for row in result]

    def upsert_event_custom_field_values(
        self,
        event_id: str,
        custom_values: dict[str, str],
        conn: duckdb.DuckDBPyConnection | None = None,
    ) -> None:
        """Upsert custom field values for an event."""
        if not custom_values:
            return

        def _execute(target_conn: duckdb.DuckDBPyConnection) -> None:
            for field_key, value in custom_values.items():
                target_conn.execute(
                    """
                    INSERT INTO event_custom_field_values (event_id, field_key, value)
                    VALUES (?, ?, ?)
                    ON CONFLICT (event_id, field_key) DO UPDATE SET
                        value = EXCLUDED.value
                    """,
                    [event_id, field_key, value],
                )

        if conn is not None:
            _execute(conn)
            return

        with self.write_connection() as write_conn:
            _execute(write_conn)

    def get_event_custom_field_values(self, event_ids: list[str]) -> dict[str, dict[str, str]]:
        """Get custom field values keyed by event_id then field_key."""
        if not event_ids:
            return {}
        placeholders = ", ".join(["?"] * len(event_ids))
        query = f"""
            SELECT event_id, field_key, value
            FROM event_custom_field_values
            WHERE event_id IN ({placeholders})
        """
        rows = self.read_connection.execute(query, event_ids).fetchall()
        result: dict[str, dict[str, str]] = {}
        for event_id, field_key, value in rows:
            if event_id not in result:
                result[event_id] = {}
            result[event_id][field_key] = value
        return result

    # ===== SCHEMA METADATA OPERATIONS =====

    def get_schema_metadata(self) -> dict[str, Any]:
        """
        Get schema metadata from database.
        
        Returns dict with schema_version, filter_options, filter_columns, etc.
        Returns empty dict if no metadata found (legacy database).
        """
        try:
            result = self.read_connection.execute(
                "SELECT key, value FROM _schema_metadata"
            ).fetchall()
            return {row[0]: json.loads(row[1]) if row[1] else None for row in result}
        except duckdb.Error:
            # Table doesn't exist - legacy database
            return {}

    def update_schema_metadata(self) -> None:
        """
        Update schema metadata from current schema.yaml configuration.
        
        This should be called:
        - After database initialization
        - Before exporting database
        - After importing database
        """
        filter_options = self._schema_loader.get_filter_options()
        filter_columns = self._schema_loader.get_filter_column_names()
        
        metadata = {
            "schema_version": self._schema_loader.version,
            "filter_options": filter_options,
            "filter_columns": filter_columns,
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        with self.write_connection() as conn:
            for key, value in metadata.items():
                conn.execute("""
                    INSERT INTO _schema_metadata (key, value, updated_at)
                    VALUES (?, ?, now())
                    ON CONFLICT (key) DO UPDATE SET
                        value = EXCLUDED.value,
                        updated_at = now()
                """, [key, json.dumps(value)])
        
        logger.info(f"Schema metadata updated: version={metadata['schema_version']}")

    def has_schema_metadata(self) -> bool:
        """Check if database has schema metadata table with data."""
        try:
            result = self.read_connection.execute(
                "SELECT COUNT(*) FROM _schema_metadata"
            ).fetchone()
            return result[0] > 0
        except duckdb.Error:
            return False

    # ===== LIFECYCLE =====

    def vacuum(self) -> None:
        """Reclaim disk space from deleted records."""
        with self.write_connection() as conn:
            conn.execute("VACUUM")
        logger.info("Database vacuumed")

    def close(self) -> None:
        """Checkpoint and close the shared connection (no dangling FD before file replace)."""
        with self._db_lock:
            if self._connection is not None:
                try:
                    self._connection.execute("CHECKPOINT")
                except duckdb.Error:
                    pass
                self._connection.close()
                self._connection = None
            else:
                conn = duckdb.connect(str(self.db_path))
                try:
                    conn.execute("CHECKPOINT")
                finally:
                    conn.close()
        logger.info("Unified database closed")

    # ===== PORTABILITY OPERATIONS =====

    def export_to_parquet(
        self,
        export_dir: Path,
        on_progress: ParquetProgressFn | None = None,
    ) -> None:
        """
        Export all user tables to Parquet (zstd) plus schema.sql and load.sql.

        The directory can be zipped for portable import. Paths in load.sql are
        relative to the export directory (import uses chdir to that folder).
        """
        export_dir.mkdir(parents=True, exist_ok=True)
        self.update_schema_metadata()

        with self.write_connection() as conn:
            conn.execute("CHECKPOINT")
            rows = conn.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'main' AND table_type = 'BASE TABLE'
                ORDER BY table_name
                """
            ).fetchall()
            user_tables = [r[0] for r in rows]
            total = len(user_tables)
            if on_progress:
                on_progress(None, 0, total)

            for i, table in enumerate(user_tables):
                out_p = export_dir / f"{table}.parquet"
                ident = _quote_duck_ident(table)
                conn.execute(
                    f"COPY (SELECT * FROM {ident}) TO ? (FORMAT PARQUET, COMPRESSION ZSTD)",
                    [str(out_p)],
                )
                if on_progress:
                    on_progress(table, i + 1, total)

            schema_parts: list[str] = []
            for (seq_sql,) in conn.execute("SELECT sql FROM duckdb_sequences()").fetchall():
                s = seq_sql.strip().rstrip(";")
                s = _normalize_create_sequence_sql(s)
                schema_parts.append(s + ";;\n")

            for table in user_tables:
                row = conn.execute(
                    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
                    [table],
                ).fetchone()
                if row and row[0]:
                    s = row[0].strip().rstrip(";")
                    schema_parts.append(s + ";;\n")

            for (idx_sql,) in conn.execute(
                """
                SELECT sql FROM sqlite_master
                WHERE type = 'index' AND sql IS NOT NULL
                ORDER BY name
                """
            ).fetchall():
                s = idx_sql.strip().rstrip(";")
                schema_parts.append(s + ";;\n")

            (export_dir / "schema.sql").write_text("".join(schema_parts), encoding="utf-8")

            load_lines: list[str] = []
            for table in user_tables:
                ident = _quote_duck_ident(table)
                load_lines.append(
                    f"COPY {ident} FROM '{table}.parquet' "
                    f"(FORMAT 'parquet', COMPRESSION 'ZSTD');\n"
                )
            (export_dir / "load.sql").write_text("".join(load_lines), encoding="utf-8")

        logger.info("Database exported to Parquet under %s", export_dir)

    def import_from_parquet(
        self,
        import_dir: Path,
        on_progress: ParquetProgressFn | None = None,
    ) -> dict[str, Any]:
        """
        Replace the current database from an EXPORT-compatible directory
        (schema.sql, load.sql, *.parquet).

        Creates a backup of the existing database first, then runs schema DDL
        and COPY statements with import_dir as the working directory so
        relative parquet paths resolve.
        """
        schema_path = import_dir / "schema.sql"
        load_path = import_dir / "load.sql"
        if not schema_path.is_file() or not load_path.is_file():
            raise ValueError("Import directory must contain schema.sql and load.sql")

        with self._db_lock:
            self.close()

            backup_path = self.db_path.with_suffix(".db.bak")
            if self.db_path.exists():
                shutil.copy2(self.db_path, backup_path)

            if self.db_path.exists():
                self.db_path.unlink()

            schema_text = _normalize_create_sequence_sql(schema_path.read_text(encoding="utf-8"))
            load_text = load_path.read_text(encoding="utf-8")
            copy_stmts = [
                ln.strip()
                for ln in load_text.splitlines()
                if ln.strip() and ln.strip().upper().startswith("COPY")
            ]
            total = len(copy_stmts)

            old_cwd = os.getcwd()
            conn = duckdb.connect(str(self.db_path))
            try:
                os.chdir(import_dir)
                conn.execute(schema_text)
                if on_progress:
                    on_progress(None, 0, total)
                for i, stmt in enumerate(copy_stmts):
                    conn.execute(stmt)
                    tbl = _parse_copy_table(stmt)
                    if on_progress:
                        on_progress(tbl, i + 1, total)
            finally:
                os.chdir(old_cwd)
                conn.close()

            self._connection = None
            self._init_schema()
            self.update_schema_metadata()

        event_count = self.read_connection.execute(
            "SELECT COUNT(*) FROM dim_event WHERE is_deleted = false"
        ).fetchone()[0]
        size_mb = self.db_path.stat().st_size / (1024 * 1024)

        return {
            "events": event_count,
            "size_mb": round(size_mb, 2),
            "backup_path": str(backup_path),
        }


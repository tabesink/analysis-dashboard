"""Database migration system for schema versioning.

Tracks schema versions and applies migrations to keep the database
in sync with schema.yaml definitions.
"""

import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Any

import duckdb

from .schema_applier import SchemaApplier
from .schema_loader import SchemaLoader, get_schema_loader

logger = logging.getLogger(__name__)


class MigrationRunner:
    """
    Handles database schema migrations.
    
    Tracks the current schema version in a `schema_version` table
    and applies migrations to bring the database up to date.
    """

    VERSION_TABLE = "schema_version"
    _STATUS_OK = "OK"
    _STATUS_MISSING = "MISSING"
    _STATUS_TYPE_MISMATCH = "TYPE_MISMATCH"
    _STATUS_DRIFT = "DRIFT"

    def __init__(self, db_path: Path, schema_loader: SchemaLoader | None = None):
        """
        Initialize migration runner.
        
        Args:
            db_path: Path to the DuckDB database file
            schema_loader: Optional schema loader instance
        """
        self.db_path = db_path
        self.schema_loader = schema_loader or get_schema_loader()

    def _get_connection(self) -> duckdb.DuckDBPyConnection:
        """Get a database connection."""
        return duckdb.connect(str(self.db_path))

    def _ensure_version_table(self, conn: duckdb.DuckDBPyConnection) -> None:
        """Create schema_version table if it doesn't exist."""
        conn.execute(f"""
            CREATE TABLE IF NOT EXISTS {self.VERSION_TABLE} (
                id INTEGER PRIMARY KEY DEFAULT 1,
                version INTEGER NOT NULL,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                description VARCHAR
            )
        """)

    def get_current_version(self) -> int:
        """Get the current schema version from the database."""
        conn = self._get_connection()
        try:
            self._ensure_version_table(conn)
            result = conn.execute(
                f"SELECT version FROM {self.VERSION_TABLE} WHERE id = 1"
            ).fetchone()
            return result[0] if result else 0
        finally:
            conn.close()

    def get_target_version(self) -> int:
        """Get the target schema version from schema.yaml."""
        return self.schema_loader.version

    def status(self) -> dict[str, Any]:
        """
        Get migration status.
        
        Returns:
            Dictionary with current_version, target_version, and needs_migration
        """
        current = self.get_current_version()
        target = self.get_target_version()
        
        return {
            "current_version": current,
            "target_version": target,
            "needs_migration": current != target,
            "schema_path": str(self.schema_loader.schema_path),
            "db_path": str(self.db_path),
        }

    def _set_version(self, conn: duckdb.DuckDBPyConnection, version: int, description: str = "") -> None:
        """Update the schema version in the database."""
        self._ensure_version_table(conn)
        
        # Upsert the version
        existing = conn.execute(
            f"SELECT 1 FROM {self.VERSION_TABLE} WHERE id = 1"
        ).fetchone()
        
        if existing:
            conn.execute(
                f"UPDATE {self.VERSION_TABLE} SET version = ?, applied_at = ?, description = ? WHERE id = 1",
                [version, datetime.now(), description]
            )
        else:
            conn.execute(
                f"INSERT INTO {self.VERSION_TABLE} (id, version, description) VALUES (1, ?, ?)",
                [version, description]
            )

    def apply_initial_schema(self) -> dict[str, Any]:
        """
        Apply the initial schema from schema.yaml.
        
        This creates all sequences and tables defined in the schema.
        Use for fresh databases or when migrating from version 0.
        
        Returns:
            Dictionary with migration results
        """
        conn = self._get_connection()
        try:
            conn.begin()
            
            statements = SchemaApplier(self.schema_loader).apply(conn)
            executed = [
                stmt[:50] + "..." if len(stmt) > 50 else stmt
                for stmt in statements
            ]
            
            # Update version
            target_version = self.get_target_version()
            self._set_version(conn, target_version, "Initial schema from schema.yaml")
            
            conn.commit()
            
            logger.info(f"Applied initial schema version {target_version}")
            
            return {
                "success": True,
                "version": target_version,
                "statements_executed": len(executed),
                "details": executed,
            }
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Migration failed: {e}")
            return {
                "success": False,
                "error": str(e),
            }
        finally:
            conn.close()

    def reconcile_declared_schema(self) -> dict[str, Any]:
        """
        Apply declared schema DDL without mutating schema_version metadata.

        This healing step is intended for legacy deployments where the stored
        version is already current but additive columns from schema.yaml are
        missing in the live database.
        """
        conn = self._get_connection()
        try:
            conn.begin()
            statements = SchemaApplier(self.schema_loader).apply(conn)
            conn.commit()
            return {
                "success": True,
                "statements_executed": len(statements),
            }
        except Exception as e:
            conn.rollback()
            logger.error(f"Schema reconciliation failed: {e}")
            return {
                "success": False,
                "error": str(e),
            }
        finally:
            conn.close()

    def migrate_up(self) -> dict[str, Any]:
        """
        Apply pending migrations to bring database to current schema version.
        
        Returns:
            Dictionary with migration results
        """
        current = self.get_current_version()
        target = self.get_target_version()
        
        if current >= target:
            return {
                "success": True,
                "message": f"Already at version {current}, no migration needed",
                "current_version": current,
                "target_version": target,
            }
        
        if current == 0:
            # Fresh database, apply initial schema
            return self.apply_initial_schema()
        
        # For incremental migrations, we would need migration files
        # For now, we just apply the full schema (safe with IF NOT EXISTS)
        return self.apply_initial_schema()

    def initialize_store_for_startup(self) -> tuple["UnifiedStore", dict[str, Any]]:
        """
        Initialize runtime storage through the canonical startup mutation path.

        Order is preserved intentionally:
        1) apply migration/schema mutations
        2) open UnifiedStore connection owner
        3) apply runtime startup backfills
        """
        migration_result = self.migrate_up()
        if not migration_result.get("success"):
            error_message = migration_result.get("error") or migration_result.get("message")
            raise RuntimeError(
                f"Database migrations failed: {error_message or 'unknown error'}"
            )
        reconcile_result = self.reconcile_declared_schema()
        if not reconcile_result.get("success"):
            error_message = reconcile_result.get("error") or "unknown error"
            raise RuntimeError(f"Database schema reconciliation failed: {error_message}")
        migration_result["schema_reconcile_statements"] = reconcile_result.get(
            "statements_executed", 0
        )
        from .database import UnifiedStore

        store = UnifiedStore(
            self.db_path,
            schema_loader=self.schema_loader,
            initialize_schema=False,
        )
        store.apply_startup_backfills()
        return store, migration_result

    def migrate_down(self) -> dict[str, Any]:
        """
        Rollback to previous version.
        
        Note: This is a placeholder. Full rollback support requires
        storing migration history and down scripts.
        
        Returns:
            Dictionary with rollback results
        """
        return {
            "success": False,
            "error": "Rollback not yet implemented. Manual intervention required.",
        }

    def generate_migration_diff(self) -> dict[str, Any]:
        """
        Compare current database schema with schema.yaml and show differences.
        
        Returns:
            Dictionary with schema differences
        """
        conn = self._get_connection()
        try:
            # Get existing tables
            existing_tables = conn.execute(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'"
            ).fetchall()
            existing_table_names = {row[0] for row in existing_tables}
            
            # Get tables from schema.yaml
            schema_table_names = set(self.schema_loader.tables.keys())

            table_rows = conn.execute(
                """
                SELECT table_name, column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = 'main'
                """
            ).fetchall()
            live_columns: dict[str, dict[str, str]] = {}
            for table_name, column_name, data_type in table_rows:
                live_columns.setdefault(table_name, {})[column_name] = data_type

            report_entries: list[dict[str, Any]] = []
            summary = {
                self._STATUS_OK: 0,
                self._STATUS_MISSING: 0,
                self._STATUS_TYPE_MISMATCH: 0,
                self._STATUS_DRIFT: 0,
            }

            for table_name in sorted(schema_table_names):
                if table_name not in existing_table_names:
                    status = self._STATUS_MISSING
                    report_entries.append(
                        {
                            "object_type": "table",
                            "table": table_name,
                            "status": status,
                            "details": {"reason": "Declared table missing from live database"},
                        }
                    )
                    summary[status] += 1
                    continue

                declared_columns = self.schema_loader.tables[table_name].get("columns", {})
                declared_column_names = set(declared_columns.keys())
                live_table_columns = live_columns.get(table_name, {})
                live_column_names = set(live_table_columns.keys())

                missing_columns = sorted(declared_column_names - live_column_names)
                extra_columns = sorted(live_column_names - declared_column_names)

                type_mismatches: list[dict[str, str]] = []
                for column_name in sorted(declared_column_names & live_column_names):
                    declared_type = declared_columns[column_name].get("type", "")
                    live_type = live_table_columns[column_name]
                    if self._normalize_type(declared_type) != self._normalize_type(live_type):
                        type_mismatches.append(
                            {
                                "column": column_name,
                                "declared_type": declared_type,
                                "live_type": live_type,
                            }
                        )

                if type_mismatches:
                    status = self._STATUS_TYPE_MISMATCH
                elif missing_columns:
                    status = self._STATUS_MISSING
                elif extra_columns:
                    status = self._STATUS_DRIFT
                else:
                    status = self._STATUS_OK

                report_entries.append(
                    {
                        "object_type": "table",
                        "table": table_name,
                        "status": status,
                        "details": {
                            "missing_columns": missing_columns,
                            "extra_columns": extra_columns,
                            "type_mismatches": type_mismatches,
                        },
                    }
                )
                summary[status] += 1

            for table_name in sorted(
                existing_table_names - schema_table_names - {self.VERSION_TABLE}
            ):
                status = self._STATUS_DRIFT
                report_entries.append(
                    {
                        "object_type": "table",
                        "table": table_name,
                        "status": status,
                        "details": {
                            "reason": "Live table not declared in schema registry"
                        },
                    }
                )
                summary[status] += 1

            missing_tables = [
                entry["table"]
                for entry in report_entries
                if entry["status"] == self._STATUS_MISSING
                and entry["table"] in schema_table_names
                and entry["details"].get("reason")
            ]
            extra_tables = [
                entry["table"]
                for entry in report_entries
                if entry["status"] == self._STATUS_DRIFT
                and entry["table"] not in schema_table_names
            ]

            return {
                "schema_version": self.get_target_version(),
                "db_version": self.get_current_version(),
                "tables_in_schema": list(schema_table_names),
                "tables_in_db": list(existing_table_names),
                "missing_tables": missing_tables,
                "extra_tables": extra_tables,
                "doctor_report": report_entries,
                "doctor_summary": summary,
            }
            
        finally:
            conn.close()

    @staticmethod
    def _normalize_type(type_name: str) -> str:
        """
        Normalize type names from declared schema and information_schema.

        DuckDB can surface aliases or strip width/precision when introspecting,
        so the schema doctor compares normalized base types.
        """
        normalized = re.sub(r"\(.*\)", "", type_name.strip().upper())
        aliases = {
            "INT": "INTEGER",
            "INT4": "INTEGER",
            "INT8": "BIGINT",
            "BOOL": "BOOLEAN",
            "DOUBLE PRECISION": "DOUBLE",
        }
        return aliases.get(normalized, normalized)

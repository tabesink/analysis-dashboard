"""Database migration system for schema versioning.

Tracks schema versions and applies migrations to keep the database
in sync with schema.yaml definitions.
"""

import logging
from datetime import datetime
from pathlib import Path
from typing import Any

import duckdb

from .schema_loader import SchemaLoader, get_schema_loader

logger = logging.getLogger(__name__)


class MigrationRunner:
    """
    Handles database schema migrations.
    
    Tracks the current schema version in a `schema_version` table
    and applies migrations to bring the database up to date.
    """

    VERSION_TABLE = "schema_version"

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
            
            # Generate and execute all SQL statements
            statements = self.schema_loader.generate_all_sql()
            executed = []
            
            for stmt in statements:
                try:
                    conn.execute(stmt)
                    executed.append(stmt[:50] + "..." if len(stmt) > 50 else stmt)
                except Exception as e:
                    logger.warning(f"Statement failed (may already exist): {e}")
                    executed.append(f"SKIPPED: {stmt[:30]}...")
            
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
            
            # Find differences
            missing_tables = schema_table_names - existing_table_names
            extra_tables = existing_table_names - schema_table_names - {self.VERSION_TABLE}
            
            return {
                "schema_version": self.get_target_version(),
                "db_version": self.get_current_version(),
                "tables_in_schema": list(schema_table_names),
                "tables_in_db": list(existing_table_names),
                "missing_tables": list(missing_tables),
                "extra_tables": list(extra_tables),
            }
            
        finally:
            conn.close()

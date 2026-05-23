"""DuckDB session tuning for staging load-data import."""

from __future__ import annotations

from pathlib import Path

from server.storage.database import UnifiedStore


def _duckdb_settings(conn) -> dict[str, str]:
    rows = conn.execute(
        """
        SELECT name, value
        FROM duckdb_settings()
        WHERE name IN (
            'memory_limit',
            'threads',
            'preserve_insertion_order',
            'temp_directory'
        )
        """
    ).fetchall()
    return {name: str(value) for name, value in rows}


def test_configure_bulk_import_session_applies_duckdb_tuning(tmp_path: Path) -> None:
    db_path = tmp_path / "staging.db"
    store = UnifiedStore(db_path)
    try:
        store.configure_bulk_import_session(memory_limit="7GB", threads=2)
        settings = _duckdb_settings(store._connection)
        assert settings["threads"] == "2"
        assert settings["preserve_insertion_order"] == "false"
        assert "GiB" in settings["memory_limit"]
        assert settings["temp_directory"].endswith("tmp/duckdb-import")
    finally:
        store.close()


def test_configure_live_session_for_background_import(tmp_path: Path) -> None:
    db_path = tmp_path / "live.db"
    store = UnifiedStore(db_path)
    try:
        store.configure_live_session_for_background_import(memory_limit="512MB", threads=1)
        settings = _duckdb_settings(store._connection)
        assert settings["threads"] == "1"
        assert settings["preserve_insertion_order"] == "false"
        assert "MiB" in settings["memory_limit"] or "MB" in settings["memory_limit"]
    finally:
        store.close()

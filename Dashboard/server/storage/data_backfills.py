"""Runtime data backfills applied after declared schema DDL."""

from __future__ import annotations

import csv
import json
from typing import Any


def _column_exists(conn: Any, table_name: str, column_name: str) -> bool:
    return (
        conn.execute(
            """
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_name = ? AND column_name = ?
            """,
            [table_name, column_name],
        ).fetchone()[0]
        > 0
    )


def _generic_col_index(value: Any) -> int | None:
    text = str(value or "").strip()
    if not text.startswith("col_") or not text[4:].isdigit():
        return None
    return int(text[4:])


def _preview_metadata_row(preview_json: Any, marker: str) -> list[str]:
    try:
        preview = json.loads(preview_json) if isinstance(preview_json, str) else preview_json
    except (TypeError, json.JSONDecodeError):
        return []
    if not isinstance(preview, dict):
        return []
    lines = preview.get("lines", [])
    if not isinstance(lines, list):
        return []
    for index, line in enumerate(lines[:-1]):
        if str(line).strip() == marker:
            return next(csv.reader([str(lines[index + 1])]))
    return []


def _backfill_channel_map_headers(conn: Any) -> None:
    required = (
        _column_exists(conn, "dim_channel_map", "x_channel")
        and _column_exists(conn, "dim_channel_map", "y_channel")
        and _column_exists(conn, "ingestion_artifacts", "preview_json")
    )
    if not required:
        return

    rows = conn.execute(
        """
        SELECT
            cm.id,
            cm.x_channel,
            cm.y_channel,
            ia.preview_json
        FROM dim_channel_map cm
        JOIN ingestion_artifacts ia
          ON ia.program_id = cm.program_id
         AND ia.version = cm.version
        WHERE cm.x_channel LIKE 'col_%'
           OR cm.y_channel LIKE 'col_%'
        ORDER BY cm.id, ia.status = 'processed' DESC, ia.created_at, ia.artifact_id
        """
    ).fetchall()

    repaired_ids: set[int] = set()
    for row_id, x_channel, y_channel, preview_json in rows:
        row_id = int(row_id)
        if row_id in repaired_ids:
            continue
        headers = _preview_metadata_row(preview_json, "#TITLES")
        units = _preview_metadata_row(preview_json, "#UNITS")
        if not headers:
            continue

        updates: list[str] = []
        params: list[Any] = []
        x_index = _generic_col_index(x_channel)
        y_index = _generic_col_index(y_channel)
        if x_index is not None and x_index < len(headers):
            updates.append("x_channel = ?")
            params.append(headers[x_index])
            if x_index < len(units):
                updates.append("x_unit = ?")
                params.append(units[x_index] or None)
        if y_index is not None and y_index < len(headers):
            updates.append("y_channel = ?")
            params.append(headers[y_index])
            if y_index < len(units):
                updates.append("y_unit = ?")
                params.append(units[y_index] or None)

        if not updates:
            continue
        params.append(row_id)
        conn.execute(
            f"UPDATE dim_channel_map SET {', '.join(updates)} WHERE id = ?",
            params,
        )
        repaired_ids.add(row_id)


def apply_startup_backfills(conn: Any) -> None:
    """Apply idempotent row backfills needed for legacy data compatibility."""
    users_can_write_exists = _column_exists(conn, "users", "can_write")
    if users_can_write_exists:
        conn.execute(
            "UPDATE users SET can_write = TRUE WHERE role = 'admin' AND can_write IS NOT TRUE"
        )

    users_token_version_exists = _column_exists(conn, "users", "token_version")
    if users_token_version_exists:
        conn.execute(
            "UPDATE users SET token_version = 0 WHERE token_version IS NULL"
        )

    maturity_column_exists = _column_exists(conn, "dim_event", "maturity")
    if maturity_column_exists:
        conn.execute(
            """
            UPDATE dim_event
            SET status = maturity
            WHERE status IS NULL AND maturity IS NOT NULL
            """
        )

    conn.execute(
        """
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
        """
    )

    _backfill_channel_map_headers(conn)

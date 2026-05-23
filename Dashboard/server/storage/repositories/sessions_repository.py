"""Sessions repository using UnifiedStore-owned DuckDB connections."""

from __future__ import annotations

import json
from typing import Any


class SessionsRepository:
    """Repository for sessions table operations."""

    def __init__(self, store: Any):
        self._store = store

    def get_session(
        self,
        session_id: str,
        user_id: str | None = None,
    ) -> dict[str, Any] | None:
        query = "SELECT * FROM sessions WHERE session_id = ?"
        params: list[Any] = [session_id]
        if user_id is not None:
            query += " AND user_id = ?"
            params.append(user_id)
        result = self._store.read_connection.execute(query, params).fetchone()
        if result is None:
            return None
        columns = [desc[0] for desc in self._store.read_connection.description]
        return dict(zip(columns, result))

    def upsert_session(self, session_id: str, data: dict[str, Any]) -> None:
        def to_json(value: Any) -> str | None:
            return json.dumps(value) if value is not None else None

        with self._store.write_connection(bump_data_version=False) as conn:
            conn.execute(
                """
                INSERT INTO sessions (session_id, user_id, data_state,
                                       global_filters, rendered_event_ids, ui_preferences,
                                       inspect_damage_state, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (session_id) DO UPDATE SET
                    user_id = COALESCE(EXCLUDED.user_id, sessions.user_id),
                    data_state = EXCLUDED.data_state,
                    global_filters = EXCLUDED.global_filters,
                    rendered_event_ids = EXCLUDED.rendered_event_ids,
                    ui_preferences = EXCLUDED.ui_preferences,
                    inspect_damage_state = EXCLUDED.inspect_damage_state,
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
                    to_json(data.get("inspect_damage_state")),
                    data.get("expires_at"),
                ],
            )

    def delete_session(self, session_id: str, user_id: str | None = None) -> bool:
        with self._store.write_connection(bump_data_version=False) as conn:
            query = "DELETE FROM sessions WHERE session_id = ?"
            params: list[Any] = [session_id]
            if user_id is not None:
                query += " AND user_id = ?"
                params.append(user_id)
            query += " RETURNING session_id"
            result = conn.execute(query, params).fetchone()
            return result is not None

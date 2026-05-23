"""Users repository using UnifiedStore-owned DuckDB connections."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any


class UsersRepository:
    """Repository for users table operations."""

    def __init__(self, store: Any):
        self._store = store

    def _row_to_dict(self, row: Any) -> dict[str, Any]:
        columns = [desc[0] for desc in self._store.read_connection.description]
        return dict(zip(columns, row))

    def get_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        result = self._store.read_connection.execute(
            "SELECT * FROM users WHERE id = ?",
            [user_id],
        ).fetchone()
        if result is None:
            return None
        return self._row_to_dict(result)

    def get_user_by_username(self, username: str) -> dict[str, Any] | None:
        result = self._store.read_connection.execute(
            "SELECT * FROM users WHERE username = ?",
            [username],
        ).fetchone()
        if result is None:
            return None
        return self._row_to_dict(result)

    def create_user(
        self,
        username: str,
        role: str = "user",
        password_hash: str | None = None,
        can_write: bool = False,
    ) -> dict[str, Any]:
        user_id = str(uuid.uuid4())
        effective_can_write = True if role == "admin" else can_write
        with self._store.write_connection() as conn:
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
        with self._store.write_connection() as conn:
            conn.execute(
                "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?",
                [user_id],
            )

    def list_users(self) -> list[dict[str, Any]]:
        rows = self._store.read_connection.execute(
            "SELECT * FROM users ORDER BY created_at ASC, username ASC"
        ).fetchall()
        columns = [desc[0] for desc in self._store.read_connection.description]
        return [dict(zip(columns, row)) for row in rows]

    def update_user_role_and_write(
        self,
        user_id: str,
        role: str | None = None,
        can_write: bool | None = None,
    ) -> dict[str, Any] | None:
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
        with self._store.write_connection() as conn:
            conn.execute(
                "UPDATE users SET role = ?, can_write = ? WHERE id = ?",
                [new_role, new_can_write, user_id],
            )
        return self.get_user_by_id(user_id)

    def set_user_password_hash(self, user_id: str, password_hash: str) -> bool:
        with self._store.write_connection() as conn:
            conn.execute(
                "UPDATE users SET password_hash = ? WHERE id = ?",
                [password_hash, user_id],
            )
        return self.get_user_by_id(user_id) is not None

    def delete_user(self, user_id: str) -> bool:
        existing = self.get_user_by_id(user_id)
        if existing is None:
            return False
        with self._store.write_connection() as conn:
            conn.execute("DELETE FROM users WHERE id = ?", [user_id])
        return True

    def count_users_created_after(
        self,
        after: datetime | None,
        exclude_user_id: str,
    ) -> int:
        if after is None:
            sql = "SELECT COUNT(*) FROM users WHERE id != ?"
            params: list[Any] = [exclude_user_id]
        else:
            sql = "SELECT COUNT(*) FROM users WHERE id != ? AND created_at > ?"
            params = [exclude_user_id, after]
        row = self._store.read_connection.execute(sql, params).fetchone()
        return int(row[0]) if row and row[0] is not None else 0

    def mark_user_settings_visited(self, user_id: str) -> None:
        with self._store.write_connection() as conn:
            conn.execute(
                "UPDATE users SET last_settings_visit_at = CURRENT_TIMESTAMP WHERE id = ?",
                [user_id],
            )

    def bump_token_version(self, user_id: str) -> int:
        with self._store.write_connection() as conn:
            row = conn.execute(
                """
                UPDATE users
                SET token_version = COALESCE(token_version, 0) + 1
                WHERE id = ?
                RETURNING token_version
                """,
                [user_id],
            ).fetchone()
        if row is None:
            msg = f"Failed to bump token version for user: {user_id}"
            raise RuntimeError(msg)
        return int(row[0])

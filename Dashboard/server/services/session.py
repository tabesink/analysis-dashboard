"""Session management service."""

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from server.storage.database import UnifiedStore

logger = logging.getLogger(__name__)


class SessionManager:
    """
    Manages user sessions stored in the database.

    Sessions store partition-aware filter state for the dashboard UI.
    """

    def __init__(
        self,
        db: UnifiedStore,
        session_ttl_hours: int = 48,
    ):
        self.db = db
        self.session_ttl = timedelta(hours=session_ttl_hours)

    def create(self, user_id: str, data: dict[str, Any] | None = None) -> str:
        """
        Create a new session.

        Returns the session ID.
        """
        session_id = self._generate_session_id()
        expires_at = datetime.now(timezone.utc) + self.session_ttl

        session_data = data or {}
        session_data["user_id"] = user_id
        session_data["expires_at"] = expires_at.isoformat()

        self.db.upsert_session(session_id, session_data)

        logger.debug(f"Created session: {session_id}")
        return session_id

    def get(self, session_id: str, user_id: str) -> dict[str, Any] | None:
        """
        Get session by ID.

        Returns None if session doesn't exist or is expired.
        """
        session = self.db.get_session(session_id, user_id=user_id)

        if session is None:
            return None

        # Check expiration
        expires_at = session.get("expires_at")
        if expires_at:
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            elif isinstance(expires_at, datetime) and expires_at.tzinfo is None:
                # DuckDB returns naive datetimes, assume UTC
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > expires_at:
                self.delete(session_id, user_id)
                return None

        # Parse JSON fields
        result = {
            "session_id": session_id,
            "created_at": session.get("created_at"),
            "updated_at": session.get("updated_at"),
            "expires_at": session.get("expires_at"),
        }

        for field in [
            "data_state",
            "baseline_state",
            "new_data_state",
            "global_filters",
            "rendered_event_ids",
            "ui_preferences",
            "inspect_damage_state",
        ]:
            value = session.get(field)
            if isinstance(value, str):
                try:
                    result[field] = json.loads(value)
                except json.JSONDecodeError:
                    result[field] = None
            else:
                result[field] = value

        # Migrate legacy sessions: merge baseline_state + new_data_state into data_state
        if result.get("data_state") is None:
            merged_ids: list[str] = []
            for legacy_key in ("baseline_state", "new_data_state"):
                legacy = result.get(legacy_key)
                if isinstance(legacy, dict):
                    merged_ids.extend(legacy.get("selected_event_ids", []))
            if merged_ids:
                result["data_state"] = {
                    "program_ids": [],
                    "versions": [],
                    "selected_event_ids": list(dict.fromkeys(merged_ids)),
                }
        result.pop("baseline_state", None)
        result.pop("new_data_state", None)

        return result

    def update(self, session_id: str, user_id: str, data: dict[str, Any]) -> bool:
        """
        Update session data.

        Returns True if session exists and was updated.
        """
        existing = self.get(session_id, user_id)
        if existing is None:
            return False

        merged: dict[str, Any] = {
            "data_state": existing.get("data_state"),
            "global_filters": existing.get("global_filters"),
            "rendered_event_ids": existing.get("rendered_event_ids"),
            "ui_preferences": existing.get("ui_preferences"),
            "inspect_damage_state": existing.get("inspect_damage_state"),
        }
        for key, value in data.items():
            if key in ("user_id", "expires_at"):
                continue
            if value is None:
                continue
            if key == "inspect_damage_state":
                existing_inspect = existing.get("inspect_damage_state") or {}
                incoming_inspect = value
                merged_inspect = {**existing_inspect, **incoming_inspect}
                if incoming_inspect.get("table_preferences") is not None:
                    existing_prefs = existing_inspect.get("table_preferences") or {}
                    merged_inspect["table_preferences"] = {
                        **existing_prefs,
                        **incoming_inspect["table_preferences"],
                    }
                merged["inspect_damage_state"] = merged_inspect
                continue
            merged[key] = value

        merged["user_id"] = user_id
        # Extend expiration on update
        merged["expires_at"] = (datetime.now(timezone.utc) + self.session_ttl).isoformat()

        self.db.upsert_session(session_id, merged)

        logger.debug(f"Updated session: {session_id}")
        return True

    def delete(self, session_id: str, user_id: str) -> bool:
        """
        Delete session.

        Returns True if session existed.
        """
        result = self.db.delete_session(session_id, user_id=user_id)
        if result:
            logger.debug(f"Deleted session: {session_id}")
        return result

    def cleanup_expired(self) -> int:
        """
        Remove all expired sessions.

        Returns count of sessions removed.
        """
        # This would be implemented with a DELETE query
        # For now, return 0 as cleanup happens on get()
        return 0

    def _generate_session_id(self) -> str:
        """Generate unique session ID."""
        return f"sess_{uuid.uuid4().hex[:16]}"


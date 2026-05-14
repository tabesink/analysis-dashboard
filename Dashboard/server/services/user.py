"""User lifecycle and management service.

Split out from AuthService so that authentication remains a thin verifier and
all user-creation / mutation logic lives behind a single, testable surface.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import bcrypt

from server.config import Settings
from server.exceptions import (
    AuthenticationError,
    ConflictError,
    NotFoundError,
    ValidationError,
)
from server.storage.database import UnifiedStore

logger = logging.getLogger(__name__)


def _hash_password(plain: str) -> str:
    """Hash a plaintext password with bcrypt (cost 12)."""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def _verify_password(plain: str, password_hash: str | None) -> bool:
    """Constant-time bcrypt verify; safe against missing hash."""
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


class UserService:
    """Owns user creation, mutation, password lifecycle, and admin bootstrap."""

    def __init__(self, db: UnifiedStore, settings: Settings):
        self.db = db
        self.settings = settings

    # ---- bootstrap -----------------------------------------------------

    def bootstrap_admin(self) -> dict[str, Any] | None:
        """Seed the initial admin row from settings.admin_secret if missing.

        After this runs the database is the only source of truth for the
        admin password. settings.admin_secret is never consulted again at
        login time.
        """
        secret = (self.settings.admin_secret or "").strip()
        if not secret:
            logger.warning(
                "admin bootstrap skipped: admin_secret not configured",
                extra={"event": "admin_bootstrap_skipped"},
            )
            return None

        existing = self.db.get_user_by_username("admin")
        if existing is not None:
            return existing

        password_hash = secret if secret.startswith("$2") else _hash_password(secret)
        user = self.db.create_user(
            username="admin",
            role="admin",
            password_hash=password_hash,
            can_write=True,
        )
        logger.info(
            "admin user bootstrapped from settings.admin_secret",
            extra={"event": "admin_bootstrap", "user_id": user["id"]},
        )
        return user

    # ---- read ----------------------------------------------------------

    def list_users(self) -> list[dict[str, Any]]:
        return self.db.list_users()

    def get_user(self, user_id: str) -> dict[str, Any] | None:
        return self.db.get_user_by_id(user_id)

    # ---- create --------------------------------------------------------

    def create_user(
        self,
        *,
        username: str,
        password: str,
        role: str = "user",
        can_write: bool = False,
    ) -> dict[str, Any]:
        """Create a new user with a bcrypt-hashed password."""
        if role not in {"user", "admin"}:
            raise ValidationError("role must be 'user' or 'admin'")
        normalized = username.strip()
        if self.db.get_user_by_username(normalized) is not None:
            raise ConflictError("Username already exists")
        password_hash = _hash_password(password)
        return self.db.create_user(
            username=normalized,
            role=role,
            password_hash=password_hash,
            can_write=can_write,
        )

    # ---- update --------------------------------------------------------

    def update_user(
        self,
        user_id: str,
        *,
        role: str | None = None,
        can_write: bool | None = None,
    ) -> dict[str, Any]:
        if role is not None and role not in {"user", "admin"}:
            raise ValidationError("role must be 'user' or 'admin'")
        updated = self.db.update_user_role_and_write(
            user_id, role=role, can_write=can_write
        )
        if updated is None:
            raise NotFoundError("User not found")
        return updated

    def delete_user(self, user_id: str) -> None:
        if not self.db.delete_user(user_id):
            raise NotFoundError("User not found")

    # ---- password ------------------------------------------------------

    def reset_password(self, user_id: str, new_password: str) -> None:
        """Admin-driven password reset (no current-password proof needed)."""
        existing = self.db.get_user_by_id(user_id)
        if existing is None:
            raise NotFoundError("User not found")
        self.db.set_user_password_hash(user_id, _hash_password(new_password))

    def change_own_password(
        self,
        user_id: str,
        current_password: str,
        new_password: str,
    ) -> None:
        """User-driven password change requiring proof of current password."""
        existing = self.db.get_user_by_id(user_id)
        if existing is None:
            raise NotFoundError("User not found")
        if not _verify_password(current_password, existing.get("password_hash")):
            raise AuthenticationError("Current password is incorrect")
        if current_password == new_password:
            raise ValidationError("New password must differ from current password")
        self.db.set_user_password_hash(user_id, _hash_password(new_password))

    # ---- admin notification dot ----------------------------------------

    def get_pending_count(self, admin_user_id: str) -> int:
        admin = self.db.get_user_by_id(admin_user_id)
        if admin is None:
            return 0
        last_visit = admin.get("last_settings_visit_at")
        if isinstance(last_visit, str):
            try:
                last_visit = datetime.fromisoformat(last_visit)
            except ValueError:
                last_visit = None
        return self.db.count_users_created_after(last_visit, admin_user_id)

    def mark_settings_visited(self, admin_user_id: str) -> None:
        self.db.mark_user_settings_visited(admin_user_id)

    # ---- credential verification (used by AuthService) -----------------

    def verify_credentials(self, username: str, password: str) -> dict[str, Any]:
        """Return the user record if username/password match; raise otherwise."""
        normalized = username.strip()
        user = self.db.get_user_by_username(normalized)
        if user is None or not _verify_password(password, user.get("password_hash")):
            raise AuthenticationError("Invalid username or password")
        return user

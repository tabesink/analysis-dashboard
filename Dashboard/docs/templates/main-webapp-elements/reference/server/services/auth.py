"""Authentication service for JWT cookie-based auth.

Closed-registration model: this service only verifies credentials and
manages JWT tokens. User creation, password mutation, and admin bootstrap
all live in `UserService` (SOLID single-responsibility split).
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt

from server.config import Settings
from server.exceptions import AuthenticationError
from server.services.user import UserService
from server.storage.database import UnifiedStore

logger = logging.getLogger(__name__)


class AuthService:
    """Encapsulates login and JWT operations."""

    def __init__(self, db: UnifiedStore, settings: Settings):
        self.db = db
        self.settings = settings
        self._users = UserService(db, settings)

    def authenticate(self, username: str, password: str) -> dict[str, Any]:
        """Verify username/password against stored bcrypt hash and stamp login."""
        if not password:
            raise AuthenticationError("Invalid username or password")
        user = self._users.verify_credentials(username, password)
        self.db.update_user_last_login(user["id"])
        user["last_login_at"] = datetime.now(UTC)
        return user

    def create_token(self, user: dict[str, Any]) -> str:
        """Create signed JWT token for a user."""
        if not self.settings.jwt_secret:
            raise AuthenticationError("JWT secret not configured")

        expires_at = datetime.now(UTC) + timedelta(hours=self.settings.jwt_expiry_hours)
        payload = {
            "sub": user["id"],
            "username": user["username"],
            "role": user["role"],
            "can_write": bool(user.get("can_write")),
            "exp": int(expires_at.timestamp()),
            "iat": int(datetime.now(UTC).timestamp()),
        }
        return jwt.encode(
            payload,
            self.settings.jwt_secret,
            algorithm=self.settings.jwt_algorithm,
        )

    def decode_token(self, token: str) -> dict[str, Any]:
        """Decode and validate JWT payload."""
        if not self.settings.jwt_secret:
            raise AuthenticationError("JWT secret not configured")
        try:
            payload = jwt.decode(
                token,
                self.settings.jwt_secret,
                algorithms=[self.settings.jwt_algorithm],
            )
        except jwt.ExpiredSignatureError as exc:
            raise AuthenticationError("Token expired") from exc
        except jwt.InvalidTokenError as exc:
            raise AuthenticationError("Invalid authentication token") from exc
        return payload

    def get_user_from_token(self, token: str) -> dict[str, Any] | None:
        """Decode a token and return the referenced user."""
        payload = self.decode_token(token)
        user_id = payload.get("sub", "")
        if not isinstance(user_id, str) or not user_id:
            return None
        return self.db.get_user_by_id(user_id)

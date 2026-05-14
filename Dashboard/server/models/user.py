"""User-management request/response models (admin surface)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from server.models.auth import _validate_username


class UserListItem(BaseModel):
    """Row shape returned by GET /admin/users."""

    id: str
    username: str
    role: Literal["user", "admin"]
    can_write: bool
    created_at: datetime | None = None
    last_login_at: datetime | None = None
    has_password: bool = True


class CreateUserRequest(BaseModel):
    """Admin creating a new user account."""

    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=256)
    role: Literal["user", "admin"] = "user"
    can_write: bool = False

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        return _validate_username(value)


class UpdateUserRequest(BaseModel):
    """Admin patching a user's role and/or write permission."""

    role: Literal["user", "admin"] | None = None
    can_write: bool | None = None


class ResetPasswordRequest(BaseModel):
    """Admin resetting another user's password (no current-password proof)."""

    new_password: str = Field(min_length=8, max_length=256)


class PendingCountResponse(BaseModel):
    """Notification-dot payload for admins."""

    count: int

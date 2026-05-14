"""Authentication request/response models."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


def _validate_username(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError("username is required")
    if not normalized.replace("_", "").replace("-", "").isalnum():
        raise ValueError(
            "username may contain only letters, numbers, underscores, and hyphens"
        )
    return normalized


class LoginRequest(BaseModel):
    """Login payload (closed model: password is always required)."""

    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=256)

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        return _validate_username(value)


class RegisterRequest(BaseModel):
    """Self-service registration payload. New users default to read-only."""

    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=256)

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        return _validate_username(value)


class ChangePasswordRequest(BaseModel):
    """Authenticated user changing their own password."""

    current_password: str = Field(min_length=8, max_length=256)
    new_password: str = Field(min_length=8, max_length=256)


class CurrentUserResponse(BaseModel):
    """Minimal authenticated user payload."""

    id: str
    username: str
    role: Literal["user", "admin"]
    can_write: bool = False
    created_at: datetime | None = None
    last_login_at: datetime | None = None

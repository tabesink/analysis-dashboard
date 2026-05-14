"""Dependency injection container for FastAPI."""

import logging
from typing import TYPE_CHECKING, Annotated, Literal, TypedDict

from fastapi import Depends, HTTPException, Request, status

from server.config import Settings, get_settings
from server.exceptions import AuthenticationError

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from server.services.auth import AuthService
    from server.services.custom_fields import CustomFieldService
    from server.services.export import ExportService
    from server.services.ingestion import IngestionService
    from server.services.query import QueryService
    from server.services.session import SessionManager
    from server.services.upload_query import UploadQueryService
    from server.services.user import UserService
    from server.storage.database import UnifiedStore
    from server.utils.cache import SimpleCache


# ============================================================================
# Storage Layer Dependencies (retrieved from app.state, initialized in lifespan)
# ============================================================================


def get_database(request: Request) -> "UnifiedStore":
    """Get the unified DuckDB store from app state."""
    return request.app.state.db


def get_cache(request: Request) -> "SimpleCache":
    """Get the cache instance from app state."""
    return request.app.state.cache


def get_session_manager(request: Request) -> "SessionManager":
    """Get session manager from app state."""
    return request.app.state.session_manager


# ============================================================================
# Service Layer Dependencies (created per request with injected dependencies)
# ============================================================================


def get_query_service(
    db: Annotated["UnifiedStore", Depends(get_database)],
    cache: Annotated["SimpleCache", Depends(get_cache)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> "QueryService":
    """Get query service for dashboard data operations."""
    from server.services.query import QueryService

    return QueryService(db, cache, settings)


def get_ingestion_service(
    db: Annotated["UnifiedStore", Depends(get_database)],
    cache: Annotated["SimpleCache", Depends(get_cache)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> "IngestionService":
    """Get ingestion service for file upload operations."""
    from server.services.ingestion import IngestionService

    return IngestionService(db, cache, settings)


def get_export_service(
    db: Annotated["UnifiedStore", Depends(get_database)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> "ExportService":
    """Service for database export/import (portability)."""
    from server.services.export import ExportService

    return ExportService(db, settings)


def get_auth_service(
    db: Annotated["UnifiedStore", Depends(get_database)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> "AuthService":
    """Auth service dependency."""
    from server.services.auth import AuthService

    return AuthService(db, settings)


def get_user_service(
    db: Annotated["UnifiedStore", Depends(get_database)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> "UserService":
    """User-management service dependency."""
    from server.services.user import UserService

    return UserService(db, settings)


def get_custom_field_service(
    db: Annotated["UnifiedStore", Depends(get_database)],
) -> "CustomFieldService":
    """Custom field service dependency."""
    from server.services.custom_fields import CustomFieldService

    return CustomFieldService(db)


def get_upload_query_service(
    db: Annotated["UnifiedStore", Depends(get_database)],
) -> "UploadQueryService":
    """Read-only dataset query service for upload routes."""
    from server.services.upload_query import UploadQueryService

    return UploadQueryService(db)


# ============================================================================
# Authentication and Authorization Dependencies
# ============================================================================


class AuthenticatedUser(TypedDict):
    """Current user contract for route dependencies."""

    id: str
    username: str
    role: Literal["user", "admin"]
    can_write: bool


async def get_optional_user(
    request: Request,
    auth_service: Annotated["AuthService", Depends(get_auth_service)],
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser | None:
    """Return authenticated user or None if no/invalid auth cookie."""
    token = request.cookies.get(settings.auth_cookie_name)
    if not token:
        return None

    try:
        user = auth_service.get_user_from_token(token)
    except AuthenticationError:
        return None

    if user is None:
        return None

    return {
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "can_write": bool(user.get("can_write")) or user["role"] == "admin",
    }


async def get_current_user(
    user: Annotated[AuthenticatedUser | None, Depends(get_optional_user)],
) -> AuthenticatedUser:
    """Require a valid authenticated user."""
    if user is None:
        logger.warning("auth required", extra={"event": "auth_required"})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return user


async def require_admin(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> AuthenticatedUser:
    """Require admin role."""
    if user["role"] != "admin":
        logger.warning(
            "admin authorization denied",
            extra={"event": "auth_forbidden", "user_id": user["id"], "role": user["role"]},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


async def require_write_or_admin(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> AuthenticatedUser:
    """Allow admin or any user with can_write granted."""
    if user["role"] == "admin" or user.get("can_write"):
        return user
    logger.warning(
        "write authorization denied",
        extra={"event": "auth_forbidden_write", "user_id": user["id"], "role": user["role"]},
    )
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Write access required",
    )


async def get_is_admin(
    user: Annotated[AuthenticatedUser | None, Depends(get_optional_user)],
) -> bool:
    """Boolean admin check for optional role-specific behavior."""
    return user is not None and user["role"] == "admin"


# ============================================================================
# Type Aliases for Cleaner Dependency Injection
# ============================================================================

SettingsDep = Annotated[Settings, Depends(get_settings)]
DatabaseDep = Annotated["UnifiedStore", Depends(get_database)]
CacheDep = Annotated["SimpleCache", Depends(get_cache)]
QueryServiceDep = Annotated["QueryService", Depends(get_query_service)]
IngestionServiceDep = Annotated["IngestionService", Depends(get_ingestion_service)]
SessionManagerDep = Annotated["SessionManager", Depends(get_session_manager)]
AuthServiceDep = Annotated["AuthService", Depends(get_auth_service)]
UserServiceDep = Annotated["UserService", Depends(get_user_service)]
CustomFieldServiceDep = Annotated["CustomFieldService", Depends(get_custom_field_service)]
UploadQueryServiceDep = Annotated["UploadQueryService", Depends(get_upload_query_service)]
CurrentUserDep = Annotated[AuthenticatedUser, Depends(get_current_user)]
OptionalUserDep = Annotated[AuthenticatedUser | None, Depends(get_optional_user)]
AdminUserDep = Annotated[AuthenticatedUser, Depends(require_admin)]
AdminRequiredDep = Annotated[AuthenticatedUser, Depends(require_admin)]
WriteUserDep = Annotated[AuthenticatedUser, Depends(require_write_or_admin)]
IsAdminDep = Annotated[bool, Depends(get_is_admin)]


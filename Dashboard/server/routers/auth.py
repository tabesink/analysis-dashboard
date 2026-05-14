"""Authentication endpoints."""

import logging

from fastapi import APIRouter, HTTPException, Response, status

from server.dependencies import (
    AuthServiceDep,
    CurrentUserDep,
    DatabaseDep,
    OptionalUserDep,
    SettingsDep,
    UserServiceDep,
)
from server.exceptions import (
    AuthenticationError,
    ConflictError,
    NotFoundError,
    ValidationError,
)
from server.models.auth import (
    ChangePasswordRequest,
    CurrentUserResponse,
    LoginRequest,
    RegisterRequest,
)
from server.utils.logging import get_audit_logger

logger = logging.getLogger(__name__)
audit_log = get_audit_logger()

router = APIRouter(prefix="/auth")


def _set_auth_cookie(
    response: Response,
    settings,
    auth_service,
    user: dict,
) -> None:
    token = auth_service.create_token(user)
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        max_age=settings.jwt_expiry_hours * 3600,
        domain=settings.auth_cookie_domain,
        path="/",
    )


def _to_response(user: dict) -> CurrentUserResponse:
    return CurrentUserResponse(
        id=user["id"],
        username=user["username"],
        role=user["role"],
        can_write=bool(user.get("can_write")) or user["role"] == "admin",
        created_at=user.get("created_at"),
        last_login_at=user.get("last_login_at"),
    )


@router.post("/login", response_model=CurrentUserResponse)
async def login(
    request: LoginRequest,
    response: Response,
    auth_service: AuthServiceDep,
    db: DatabaseDep,
    settings: SettingsDep,
) -> CurrentUserResponse:
    """Authenticate user and set secure HttpOnly JWT cookie."""
    try:
        user = auth_service.authenticate(request.username, request.password)
    except AuthenticationError as exc:
        audit_log.warning(
            "authentication failed",
            extra={
                "event": "login_failed",
                "username": request.username,
                "reason": str(exc),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        ) from exc

    _set_auth_cookie(response, settings, auth_service, user)
    db.log_audit(
        action="AUTH_LOGIN_SUCCESS",
        user_id=user["id"],
        details={"username": user["username"], "role": user["role"]},
    )
    audit_log.info(
        "login success",
        extra={
            "event": "login_success",
            "user_id": user["id"],
            "username": user["username"],
            "role": user["role"],
        },
    )
    return _to_response(user)


@router.post(
    "/register",
    response_model=CurrentUserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    request: RegisterRequest,
    response: Response,
    auth_service: AuthServiceDep,
    user_service: UserServiceDep,
    db: DatabaseDep,
    settings: SettingsDep,
) -> CurrentUserResponse:
    """Self-service registration. Creates a read-only user and signs them in."""
    try:
        user = user_service.create_user(
            username=request.username,
            password=request.password,
            role="user",
            can_write=False,
        )
    except ConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    db.update_user_last_login(user["id"])
    _set_auth_cookie(response, settings, auth_service, user)
    db.log_audit(
        action="AUTH_REGISTER",
        user_id=user["id"],
        details={"username": user["username"]},
    )
    audit_log.info(
        "self-registration",
        extra={
            "event": "register_success",
            "user_id": user["id"],
            "username": user["username"],
        },
    )
    return _to_response(user)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    request: ChangePasswordRequest,
    user: CurrentUserDep,
    user_service: UserServiceDep,
    db: DatabaseDep,
) -> None:
    """Authenticated user changes their own password."""
    try:
        user_service.change_own_password(
            user_id=user["id"],
            current_password=request.current_password,
            new_password=request.new_password,
        )
    except AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except NotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    db.log_audit(
        action="AUTH_PASSWORD_CHANGE",
        user_id=user["id"],
        details={"username": user["username"]},
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    settings: SettingsDep,
    user: OptionalUserDep,
    db: DatabaseDep,
) -> None:
    """Clear authentication cookie."""
    if user is not None:
        db.log_audit(
            action="AUTH_LOGOUT",
            user_id=user["id"],
            details={"username": user["username"]},
        )
        audit_log.info(
            "logout",
            extra={
                "event": "logout",
                "user_id": user["id"],
                "username": user["username"],
            },
        )
    response.delete_cookie(
        key=settings.auth_cookie_name,
        domain=settings.auth_cookie_domain,
        path="/",
    )


@router.get("/me", response_model=CurrentUserResponse)
async def me(user: CurrentUserDep, db: DatabaseDep) -> CurrentUserResponse:
    """Return current authenticated user (fresh from DB to reflect role/perm changes)."""
    fresh = db.get_user_by_id(user["id"])
    if fresh is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return _to_response(fresh)

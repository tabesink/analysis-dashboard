"""Admin user-management endpoints (admin role required)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status

from server.dependencies import (
    AdminRequiredDep,
    DatabaseDep,
    UserServiceDep,
)
from server.exceptions import ConflictError, NotFoundError, ValidationError
from server.models.user import (
    CreateUserRequest,
    PendingCountResponse,
    ResetPasswordRequest,
    UpdateUserRequest,
    UserListItem,
)
from server.utils.logging import get_audit_logger

logger = logging.getLogger(__name__)
audit_log = get_audit_logger()

router = APIRouter(prefix="/admin/users")


def _to_item(user: dict) -> UserListItem:
    return UserListItem(
        id=user["id"],
        username=user["username"],
        role=user["role"],
        can_write=bool(user.get("can_write")) or user["role"] == "admin",
        created_at=user.get("created_at"),
        last_login_at=user.get("last_login_at"),
        has_password=bool(user.get("password_hash")),
    )


@router.get("", response_model=list[UserListItem])
async def list_users(
    user_service: UserServiceDep,
    _: AdminRequiredDep,
) -> list[UserListItem]:
    return [_to_item(row) for row in user_service.list_users()]


@router.post("", response_model=UserListItem, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: CreateUserRequest,
    user_service: UserServiceDep,
    admin: AdminRequiredDep,
    db: DatabaseDep,
) -> UserListItem:
    try:
        user = user_service.create_user(
            username=request.username,
            password=request.password,
            role=request.role,
            can_write=request.can_write,
        )
    except ConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    db.log_audit(
        action="ADMIN_USER_CREATE",
        user_id=admin["id"],
        details={
            "target_user_id": user["id"],
            "target_username": user["username"],
            "role": user["role"],
            "can_write": bool(user.get("can_write")),
        },
    )
    return _to_item(user)


@router.patch("/{user_id}", response_model=UserListItem)
async def update_user(
    user_id: str,
    request: UpdateUserRequest,
    user_service: UserServiceDep,
    admin: AdminRequiredDep,
    db: DatabaseDep,
) -> UserListItem:
    target = user_service.get_user(user_id)
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    if target["id"] == admin["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admins cannot change their own role or write access",
        )
    try:
        user = user_service.update_user(
            user_id, role=request.role, can_write=request.can_write
        )
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    except NotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    db.log_audit(
        action="ADMIN_USER_UPDATE",
        user_id=admin["id"],
        details={
            "target_user_id": user_id,
            "role": request.role,
            "can_write": request.can_write,
        },
    )
    return _to_item(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    user_service: UserServiceDep,
    admin: AdminRequiredDep,
    db: DatabaseDep,
) -> None:
    if user_id == admin["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admins cannot delete themselves",
        )
    try:
        user_service.delete_user(user_id)
    except NotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    db.log_audit(
        action="ADMIN_USER_DELETE",
        user_id=admin["id"],
        details={"target_user_id": user_id},
    )


@router.post("/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(
    user_id: str,
    request: ResetPasswordRequest,
    user_service: UserServiceDep,
    admin: AdminRequiredDep,
    db: DatabaseDep,
) -> None:
    try:
        user_service.reset_password(user_id, request.new_password)
    except NotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    db.log_audit(
        action="ADMIN_USER_RESET_PASSWORD",
        user_id=admin["id"],
        details={"target_user_id": user_id},
    )


@router.get("/pending-count", response_model=PendingCountResponse)
async def pending_count(
    user_service: UserServiceDep,
    admin: AdminRequiredDep,
) -> PendingCountResponse:
    return PendingCountResponse(count=user_service.get_pending_count(admin["id"]))


@router.post("/mark-visited", status_code=status.HTTP_204_NO_CONTENT)
async def mark_visited(
    user_service: UserServiceDep,
    admin: AdminRequiredDep,
) -> None:
    user_service.mark_settings_visited(admin["id"])

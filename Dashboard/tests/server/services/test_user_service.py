"""Tests for UserService bootstrap, lifecycle, and password flows."""

from __future__ import annotations

import pytest

from server.exceptions import (
    AuthenticationError,
    ConflictError,
    NotFoundError,
    ValidationError,
)
from server.services.user import UserService


def _make(test_database, test_settings) -> UserService:
    return UserService(test_database, test_settings)


def test_bootstrap_admin_creates_admin_with_can_write(test_database, test_settings):
    service = _make(test_database, test_settings)
    assert test_database.get_user_by_username("admin") is None

    user = service.bootstrap_admin()

    assert user is not None
    assert user["username"] == "admin"
    assert user["role"] == "admin"
    assert bool(user.get("can_write")) is True
    assert user.get("password_hash"), "admin row must have a hashed password"
    assert not user["password_hash"].startswith("test-admin-secret"), (
        "plaintext secret must be hashed before storage"
    )


def test_bootstrap_admin_is_idempotent(test_database, test_settings):
    service = _make(test_database, test_settings)
    first = service.bootstrap_admin()
    assert first is not None
    original_hash = first["password_hash"]

    second = service.bootstrap_admin()
    assert second is not None
    assert second["id"] == first["id"]
    assert second["password_hash"] == original_hash


def test_verify_credentials_rejects_unknown_user(test_database, test_settings):
    service = _make(test_database, test_settings)
    with pytest.raises(AuthenticationError):
        service.verify_credentials("does-not-exist", "any-password-1234")


def test_verify_credentials_rejects_wrong_password(test_database, test_settings):
    service = _make(test_database, test_settings)
    service.create_user(username="alice", password="correct-horse-battery", role="user")
    with pytest.raises(AuthenticationError):
        service.verify_credentials("alice", "wrong-password")


def test_create_user_hashes_password_and_blocks_duplicates(
    test_database, test_settings
):
    service = _make(test_database, test_settings)
    user = service.create_user(username="bob", password="password1234")
    assert user["password_hash"] != "password1234"
    assert bool(user.get("can_write")) is False
    assert user["role"] == "user"

    with pytest.raises(ConflictError):
        service.create_user(username="bob", password="otherpassword1")


def test_create_user_admin_role_forces_can_write(test_database, test_settings):
    service = _make(test_database, test_settings)
    user = service.create_user(
        username="carol", password="password1234", role="admin", can_write=False
    )
    assert user["role"] == "admin"
    assert bool(user.get("can_write")) is True


def test_create_user_rejects_invalid_role(test_database, test_settings):
    service = _make(test_database, test_settings)
    with pytest.raises(ValidationError):
        service.create_user(
            username="dave", password="password1234", role="superuser"
        )


def test_update_user_promote_to_admin_forces_can_write(test_database, test_settings):
    service = _make(test_database, test_settings)
    user = service.create_user(username="eve", password="password1234")
    assert bool(user.get("can_write")) is False

    promoted = service.update_user(user["id"], role="admin")
    assert promoted["role"] == "admin"
    assert bool(promoted.get("can_write")) is True


def test_update_user_grant_write_without_role_change(test_database, test_settings):
    service = _make(test_database, test_settings)
    user = service.create_user(username="frank", password="password1234")
    granted = service.update_user(user["id"], can_write=True)
    assert granted["role"] == "user"
    assert bool(granted.get("can_write")) is True


def test_reset_password_without_current_proof(test_database, test_settings):
    service = _make(test_database, test_settings)
    user = service.create_user(username="grace", password="oldpassword12")

    service.reset_password(user["id"], "brand-new-password-123")

    service.verify_credentials("grace", "brand-new-password-123")
    with pytest.raises(AuthenticationError):
        service.verify_credentials("grace", "oldpassword12")


def test_reset_password_unknown_user_raises(test_database, test_settings):
    service = _make(test_database, test_settings)
    with pytest.raises(NotFoundError):
        service.reset_password("missing-id", "irrelevant1234")


def test_change_own_password_requires_correct_current(test_database, test_settings):
    service = _make(test_database, test_settings)
    user = service.create_user(username="heidi", password="oldpassword12")

    with pytest.raises(AuthenticationError):
        service.change_own_password(user["id"], "wrong-current", "newpassword12")

    service.change_own_password(user["id"], "oldpassword12", "newpassword12")
    service.verify_credentials("heidi", "newpassword12")


def test_change_own_password_rejects_unchanged_password(test_database, test_settings):
    service = _make(test_database, test_settings)
    user = service.create_user(username="ivan", password="samepassword12")
    with pytest.raises(ValidationError):
        service.change_own_password(user["id"], "samepassword12", "samepassword12")


def test_pending_count_excludes_admin_and_pre_visit_rows(
    test_database, test_settings
):
    service = _make(test_database, test_settings)
    admin = service.bootstrap_admin()
    assert admin is not None
    service.create_user(username="judy", password="password1234")
    service.create_user(username="kate", password="password1234")

    assert service.get_pending_count(admin["id"]) == 2

    service.mark_settings_visited(admin["id"])
    assert service.get_pending_count(admin["id"]) == 0

    service.create_user(username="leo", password="password1234")
    assert service.get_pending_count(admin["id"]) == 1

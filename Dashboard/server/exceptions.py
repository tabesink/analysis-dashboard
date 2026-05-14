"""Custom exception types for the RSP Data Analytics Dashboard API."""

from typing import Any


class ServerException(Exception):
    """Base exception for server errors."""

    def __init__(self, message: str, details: dict[str, Any] | None = None):
        self.message = message
        self.details = details or {}
        super().__init__(message)


class ValidationError(ServerException):
    """Invalid input data (400)."""

    pass


class NotFoundError(ServerException):
    """Resource not found (404)."""

    pass


class ConflictError(ServerException):
    """Resource conflict (409)."""

    pass


class StorageError(ServerException):
    """Storage operation failed (500)."""

    pass


class IngestionError(ServerException):
    """Data ingestion failed (500)."""

    pass


class AuthenticationError(ServerException):
    """Authentication failed (401)."""

    pass


class AuthorizationError(ServerException):
    """Authorization failed (403)."""

    pass


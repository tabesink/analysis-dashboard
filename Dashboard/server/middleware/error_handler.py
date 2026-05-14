"""Central API error-to-response mapping.

`register_error_handlers()` is wired during app startup so domain exceptions
from routers/services are converted into consistent JSON payloads and HTTP
status codes. Debug mode controls detail exposure, preventing sensitive internals
from leaking in production responses while keeping logs actionable.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from server.config import get_settings
from server.exceptions import (
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    IngestionError,
    NotFoundError,
    ServerException,
    StorageError,
    ValidationError,
)

logger = logging.getLogger(__name__)


def register_error_handlers(app: FastAPI) -> None:
    """Register global exception handlers."""

    @app.exception_handler(RequestValidationError)
    async def request_validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """Handle FastAPI request validation errors (422)."""
        logger.warning(
            "request validation failed",
            extra={
                "event": "request_validation_error",
                "request_id": getattr(request.state, "request_id", None),
                "method": request.method,
                "path": request.url.path,
            },
        )
        return JSONResponse(
            status_code=422,
            content={
                "error": "request_validation_error",
                "message": "Request validation failed",
                "details": exc.errors(),
            },
        )

    @app.exception_handler(ValidationError)
    async def validation_error_handler(
        request: Request, exc: ValidationError
    ) -> JSONResponse:
        """Handle validation errors (400)."""
        logger.warning(
            "validation error",
            extra={
                "event": "validation_error",
                "request_id": getattr(request.state, "request_id", None),
                "method": request.method,
                "path": request.url.path,
            },
        )
        return JSONResponse(
            status_code=400,
            content={
                "error": "validation_error",
                "message": exc.message,
                "details": exc.details,
            },
        )

    @app.exception_handler(AuthenticationError)
    async def authentication_error_handler(
        request: Request, exc: AuthenticationError
    ) -> JSONResponse:
        """Handle authentication errors (401)."""
        return JSONResponse(
            status_code=401,
            content={
                "error": "authentication_error",
                "message": exc.message,
            },
        )

    @app.exception_handler(AuthorizationError)
    async def authorization_error_handler(
        request: Request, exc: AuthorizationError
    ) -> JSONResponse:
        """Handle authorization errors (403)."""
        return JSONResponse(
            status_code=403,
            content={
                "error": "authorization_error",
                "message": exc.message,
            },
        )

    @app.exception_handler(NotFoundError)
    async def not_found_error_handler(
        request: Request, exc: NotFoundError
    ) -> JSONResponse:
        """Handle not found errors (404)."""
        return JSONResponse(
            status_code=404,
            content={
                "error": "not_found",
                "message": exc.message,
                "details": exc.details,
            },
        )

    @app.exception_handler(ConflictError)
    async def conflict_error_handler(
        request: Request, exc: ConflictError
    ) -> JSONResponse:
        """Handle conflict errors (409)."""
        return JSONResponse(
            status_code=409,
            content={
                "error": "conflict",
                "message": exc.message,
                "details": exc.details,
            },
        )

    @app.exception_handler(IngestionError)
    async def ingestion_error_handler(
        request: Request, exc: IngestionError
    ) -> JSONResponse:
        """Handle ingestion errors (500)."""
        logger.error(
            "ingestion error",
            exc_info=True,
            extra={
                "event": "ingestion_error",
                "request_id": getattr(request.state, "request_id", None),
                "method": request.method,
                "path": request.url.path,
            },
        )
        settings = get_settings()
        return JSONResponse(
            status_code=500,
            content={
                "error": "ingestion_error",
                "message": exc.message if settings.debug else "Data ingestion failed",
                "details": exc.details if settings.debug else None,
            },
        )

    @app.exception_handler(StorageError)
    async def storage_error_handler(
        request: Request, exc: StorageError
    ) -> JSONResponse:
        """Handle storage errors (500)."""
        logger.error(
            "storage error",
            exc_info=True,
            extra={
                "event": "storage_error",
                "request_id": getattr(request.state, "request_id", None),
                "method": request.method,
                "path": request.url.path,
            },
        )
        settings = get_settings()
        return JSONResponse(
            status_code=500,
            content={
                "error": "storage_error",
                "message": exc.message if settings.debug else "Storage operation failed",
                "details": exc.details if settings.debug else None,
            },
        )

    @app.exception_handler(ServerException)
    async def server_exception_handler(
        request: Request, exc: ServerException
    ) -> JSONResponse:
        """Handle generic server exceptions (500)."""
        logger.error(
            "server exception",
            exc_info=True,
            extra={
                "event": "server_exception",
                "request_id": getattr(request.state, "request_id", None),
                "method": request.method,
                "path": request.url.path,
            },
        )
        settings = get_settings()
        return JSONResponse(
            status_code=500,
            content={
                "error": "server_error",
                "message": exc.message if settings.debug else "Internal server error",
                "details": exc.details if settings.debug else None,
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        """Handle unhandled exceptions (500)."""
        logger.error(
            "unhandled exception",
            exc_info=True,
            extra={
                "event": "unhandled_exception",
                "request_id": getattr(request.state, "request_id", None),
                "method": request.method,
                "path": request.url.path,
            },
        )
        settings = get_settings()
        return JSONResponse(
            status_code=500,
            content={
                "error": "internal_error",
                "message": str(exc) if settings.debug else "Internal server error",
            },
        )


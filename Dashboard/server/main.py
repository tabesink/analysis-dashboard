"""FastAPI application factory and lifespan management."""

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

from server import __version__
from server.config import get_settings
from server.middleware.rate_limiter import RateLimiter, RateLimitMiddleware
from server.utils.logging import setup_logging

logger = logging.getLogger(__name__)
app_logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """
    Application lifespan: initialize and cleanup resources.

    The unified DuckDB store is created here and stored in app.state
    for access via dependency injection.
    """
    settings = get_settings()

    # Configure logging
    setup_logging(
        level=settings.log_level,
        log_dir=settings.log_dir,
        log_to_file=settings.log_to_file,
    )
    app_logger.info(
        "server starting",
        extra={"event": "startup", "reason": f"version={__version__}"},
    )

    # Ensure directories exist
    settings.data_root.mkdir(parents=True, exist_ok=True)
    settings.scratch_dir.mkdir(parents=True, exist_ok=True)
    settings.log_dir.mkdir(parents=True, exist_ok=True)

    # Initialize storage through one explicit startup mutation path.
    from server.storage.migrations import MigrationRunner

    migration_runner = MigrationRunner(settings.database_path)
    app.state.db, migration_result = migration_runner.initialize_store_for_startup()
    app_logger.info(
        "migrations applied",
        extra={
            "event": "migrations_applied",
            "reason": migration_result.get("message"),
        },
    )
    logger.info(f"Unified database initialized: {settings.database_path}")

    # Initialize cache
    from server.utils.cache import SimpleCache

    app.state.cache = SimpleCache(default_ttl_seconds=60)

    # Initialize session manager
    from server.services.session import SessionManager

    app.state.session_manager = SessionManager(app.state.db)

    # Bootstrap default admin from settings.admin_secret if no admin row exists.
    # After this runs the DB is the source of truth for the admin password.
    from server.services.user import UserService

    try:
        UserService(app.state.db, settings).bootstrap_admin()
    except Exception:
        logger.exception("admin bootstrap failed")

    from server.services.export import (
        cleanup_stale_import_staging_file,
        reconcile_persisted_parquet_tasks,
    )

    cleanup_stale_import_staging_file(settings.database_path)
    reconcile_persisted_parquet_tasks()

    logger.info("Server ready to accept requests")

    yield  # Application runs here

    # Cleanup: checkpoint and close
    logger.info("Shutting down...")
    app_logger.info("server shutting down", extra={"event": "shutdown"})
    app.state.db.vacuum()  # Reclaim space from soft-deleted records
    app.state.db.close()
    logger.info("Shutdown complete")


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="RSP Data Analytics Dashboard API",
        description="API for CSV data ingestion and dashboard queries",
        version=__version__,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS - explicit methods and headers
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-Session-Id"],
        expose_headers=["X-Process-Time-Ms", "X-Request-Id"],
    )

    # GZip compression for responses > 1KB
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # Basic rate limiting (enabled by settings)
    app.add_middleware(
        RateLimitMiddleware,
        rate_limiter=RateLimiter(settings),
    )

    # Access logging + slow-query detection (replaces the older
    # PerformanceMiddleware; routes per-request emits to the dedicated
    # access logger so they land in server/access.log).
    if settings.enable_performance_metrics:
        from server.middleware.access_log import AccessLogMiddleware

        app.add_middleware(
            AccessLogMiddleware,
            slow_query_ms=settings.slow_query_ms,
        )

    # Register routers
    from server.routers import (
        admin_users,
        auth,
        dashboard,
        damage,
        export,
        health,
        info,
        session,
        sync,
        upload,
    )

    app.include_router(health.router, tags=["health"])
    app.include_router(info.router, prefix="/api/v1", tags=["info"])
    app.include_router(auth.router, prefix="/api/v1", tags=["auth"])
    app.include_router(admin_users.router, prefix="/api/v1", tags=["admin"])
    app.include_router(upload.router, prefix="/api/v1", tags=["upload"])
    app.include_router(dashboard.router, prefix="/api/v1", tags=["dashboard"])
    app.include_router(damage.router, prefix="/api/v1", tags=["damage"])
    app.include_router(session.router, prefix="/api/v1", tags=["session"])
    app.include_router(sync.router, prefix="/api/v1", tags=["sync"])
    app.include_router(export.router, prefix="/api/v1", tags=["export"])

    # Register error handlers
    from server.middleware.error_handler import register_error_handlers

    register_error_handlers(app)

    return app


# Application instance for uvicorn
app = create_app()

# Run with: uv run server
# Or with reload: uv run uvicorn server.main:app --host 0.0.0.0 --port 8000 --reload
# (must run from project root, not server/ directory)
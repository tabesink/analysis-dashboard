"""Health check endpoints.

SOLID Principles:
- Single Responsibility: Health monitoring only
- Dependency Inversion: Uses __version__ from package, not hardcoded
"""

from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from server import __version__
from server.services.export import is_database_import_in_progress

router = APIRouter()


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = Field(description="Health status")
    database: str | None = Field(default=None, description="Database status")
    version: str = Field(description="Server version")


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Basic liveness check."""
    return HealthResponse(status="healthy", version=__version__)


@router.get("/health/live", response_model=HealthResponse)
async def liveness_check() -> HealthResponse:
    """Container liveness probe."""
    return HealthResponse(status="alive", version=__version__)


@router.get("/health/ready", response_model=HealthResponse)
async def readiness_check(request: Request) -> HealthResponse | JSONResponse:
    """
    Readiness check - verifies storage is connected.

    Returns 503 if database is not accessible.

    During a background database import, skip the DuckDB probe so Docker
    healthchecks do not block on the live file while a staging copy is loaded.
    """
    if is_database_import_in_progress():
        return HealthResponse(
            status="ready",
            database="import_in_progress",
            version=__version__,
        )

    try:
        # Check database connectivity
        db = request.app.state.db
        db.read_connection.execute("SELECT 1").fetchone()
        return HealthResponse(status="ready", database="connected", version=__version__)
    except Exception as e:
        body = HealthResponse(
            status="not_ready", database=f"error: {str(e)}", version=__version__
        )
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=body.model_dump(),
        )


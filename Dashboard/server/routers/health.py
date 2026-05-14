"""Health check endpoints.

SOLID Principles:
- Single Responsibility: Health monitoring only
- Dependency Inversion: Uses __version__ from package, not hardcoded
"""

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from server import __version__

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
async def readiness_check(request: Request) -> HealthResponse:
    """
    Readiness check - verifies storage is connected.

    Returns 503 if database is not accessible.
    """
    try:
        # Check database connectivity
        db = request.app.state.db
        db.read_connection.execute("SELECT 1").fetchone()
        return HealthResponse(status="ready", database="connected", version=__version__)
    except Exception as e:
        return HealthResponse(
            status="not_ready", database=f"error: {str(e)}", version=__version__
        )


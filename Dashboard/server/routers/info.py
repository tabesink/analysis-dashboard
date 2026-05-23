"""Application info endpoints.

Provides version and compatibility information for clients.

SOLID Principles:
- Single Responsibility: Version/info management only
- Open/Closed: Extensible via InfoResponse model
- Dependency Inversion: Uses __version__ from package root
"""

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from server import __version__
from server.config import get_settings
from server.storage.schema_loader import get_schema_loader

router = APIRouter()

# Minimum client version required for compatibility
# Update this when making breaking API changes
CLIENT_MIN_VERSION = "0.1.0"

# Current API version
API_VERSION = "v1"


class InfoResponse(BaseModel):
    """Application info response.
    
    Provides version information for compatibility checking.
    """

    server_version: str = Field(description="Server version (SemVer)")
    api_version: str = Field(description="API version prefix")
    client_min_version: str = Field(
        description="Minimum supported client version"
    )
    app_env: str = Field(description="Runtime mode")
    database_status: str = Field(description="Database connectivity status")
    database_schema_version: int | None = Field(
        default=None,
        description="Schema version currently recorded in the database",
    )
    database_schema_target_version: int = Field(
        description="Schema version expected by this application build",
    )
    database_schema_needs_migration: bool = Field(
        description="Whether the database schema differs from the application target",
    )


@router.get("/info", response_model=InfoResponse)
async def get_info(request: Request) -> InfoResponse:
    """
    Get application version information.
    
    Returns server version, API version, and minimum supported client version.
    Clients should use this endpoint on startup to verify compatibility.
    
    Returns:
        InfoResponse with version details
    """
    target_schema_version = get_schema_loader().version
    database_status = "connected"
    database_schema_version: int | None = None
    try:
        db = request.app.state.db
        result = db.read_connection.execute(
            "SELECT version FROM schema_version WHERE id = 1"
        ).fetchone()
        if result:
            database_schema_version = int(result[0])
    except Exception:
        database_status = "unavailable"

    return InfoResponse(
        server_version=__version__,
        api_version=API_VERSION,
        client_min_version=CLIENT_MIN_VERSION,
        app_env=get_settings().app_env,
        database_status=database_status,
        database_schema_version=database_schema_version,
        database_schema_target_version=target_schema_version,
        database_schema_needs_migration=database_schema_version != target_schema_version,
    )


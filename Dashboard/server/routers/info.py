"""Application info endpoints.

Provides version and compatibility information for clients.

SOLID Principles:
- Single Responsibility: Version/info management only
- Open/Closed: Extensible via InfoResponse model
- Dependency Inversion: Uses __version__ from package root
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from server import __version__

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


@router.get("/info", response_model=InfoResponse)
async def get_info() -> InfoResponse:
    """
    Get application version information.
    
    Returns server version, API version, and minimum supported client version.
    Clients should use this endpoint on startup to verify compatibility.
    
    Returns:
        InfoResponse with version details
    """
    return InfoResponse(
        server_version=__version__,
        api_version=API_VERSION,
        client_min_version=CLIENT_MIN_VERSION,
    )


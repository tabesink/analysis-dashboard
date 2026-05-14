"""Pydantic models for request/response validation."""

from server.models.common import (
    ErrorResponse,
    PaginatedResponse,
    PaginationParams,
    SuccessResponse,
)
from server.models.dashboard import (
    EventsRequest,
    EventsResponse,
    PlotDataRequest,
    PlotDataResponse,
    ProgramIdsResponse,
    VersionsResponse,
)
from server.models.session import (
    SessionCreate,
    SessionResponse,
    SessionUpdate,
)
from server.models.upload import (
    FileResult,
    UploadResponse,
)

__all__ = [
    # Common
    "ErrorResponse",
    "SuccessResponse",
    "PaginationParams",
    "PaginatedResponse",
    # Dashboard
    "ProgramIdsResponse",
    "VersionsResponse",
    "EventsRequest",
    "EventsResponse",
    "PlotDataRequest",
    "PlotDataResponse",
    # Session
    "SessionCreate",
    "SessionUpdate",
    "SessionResponse",
    # Upload
    "FileResult",
    "UploadResponse",
]

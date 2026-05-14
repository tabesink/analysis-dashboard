"""Common Pydantic models shared across the API."""

from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorResponse(BaseModel):
    """Standard error response structure."""

    error: str = Field(description="Error type")
    message: str = Field(description="Human-readable error message")
    details: dict[str, Any] | None = Field(default=None, description="Additional error details")


class SuccessResponse(BaseModel):
    """Standard success response structure."""

    status: str = Field(default="success")
    message: str | None = Field(default=None)


class PaginationParams(BaseModel):
    """Pagination parameters for list endpoints."""

    limit: int = Field(default=50, ge=1, le=200, description="Items per page")
    offset: int = Field(default=0, ge=0, description="Items to skip")


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated response wrapper."""

    items: list[T]
    total: int = Field(description="Total items matching query")
    limit: int
    offset: int
    has_more: bool = Field(description="More items exist beyond this page")

    @classmethod
    def create(
        cls, items: list[T], total: int, limit: int, offset: int
    ) -> "PaginatedResponse[T]":
        """Factory method to create paginated response."""
        return cls(
            items=items,
            total=total,
            limit=limit,
            offset=offset,
            has_more=(offset + len(items)) < total,
        )


"""Protocol interfaces used by shared backend dependencies."""

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class SessionStorage(Protocol):
    """Protocol for session storage operations."""

    def get(self, session_id: str) -> dict[str, Any] | None:
        """Get session by ID."""
        ...

    def create(self, session_id: str, data: dict[str, Any]) -> None:
        """Create new session."""
        ...

    def update(self, session_id: str, data: dict[str, Any]) -> None:
        """Update existing session."""
        ...

    def delete(self, session_id: str) -> bool:
        """Delete session. Returns True if existed."""
        ...

    def cleanup_expired(self) -> int:
        """Remove expired sessions. Returns count removed."""
        ...


@runtime_checkable
class CacheProtocol(Protocol):
    """Protocol for caching operations."""

    def get(self, key: str) -> Any | None:
        """Get cached value."""
        ...

    def set(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        """Set cached value with optional TTL."""
        ...

    def invalidate(self, key: str) -> bool:
        """Invalidate specific key. Returns True if existed."""
        ...

    def invalidate_prefix(self, prefix: str) -> int:
        """Invalidate all keys with prefix. Returns count."""
        ...

    def clear(self) -> int:
        """Clear all cache. Returns count."""
        ...


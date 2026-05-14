"""Simple in-memory TTL cache for single-user deployment."""

import threading
import time
from dataclasses import dataclass
from typing import Any, Callable, TypeVar

T = TypeVar("T")


@dataclass
class CacheEntry:
    """Cache entry with expiration timestamp."""

    value: Any
    expires_at: float


class SimpleCache:
    """Thread-safe in-memory TTL cache."""

    def __init__(self, default_ttl_seconds: int = 60):
        self._cache: dict[str, CacheEntry] = {}
        self._lock = threading.Lock()
        self._default_ttl = default_ttl_seconds

    def get(self, key: str) -> Any | None:
        """Get cached value if not expired."""
        with self._lock:
            entry = self._cache.get(key)
            if entry is None:
                return None
            if time.time() > entry.expires_at:
                del self._cache[key]
                return None
            return entry.value

    def set(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        """Set cache entry with TTL."""
        ttl = ttl_seconds or self._default_ttl
        with self._lock:
            self._cache[key] = CacheEntry(
                value=value,
                expires_at=time.time() + ttl,
            )

    def get_or_set(
        self,
        key: str,
        factory: Callable[[], T],
        ttl_seconds: int | None = None,
    ) -> T:
        """Get cached value or compute and cache if missing/expired."""
        cached = self.get(key)
        if cached is not None:
            return cached

        value = factory()
        self.set(key, value, ttl_seconds)
        return value

    def invalidate(self, key: str) -> bool:
        """Remove a specific cache entry. Returns True if key existed."""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False

    def invalidate_prefix(self, prefix: str) -> int:
        """Remove all cache entries with matching prefix."""
        with self._lock:
            keys = [k for k in self._cache if k.startswith(prefix)]
            for key in keys:
                del self._cache[key]
            return len(keys)

    def clear(self) -> int:
        """Clear all cache entries. Returns count of cleared entries."""
        with self._lock:
            count = len(self._cache)
            self._cache.clear()
            return count

    def cleanup_expired(self) -> int:
        """Remove all expired entries. Returns count of removed entries."""
        now = time.time()
        with self._lock:
            expired = [k for k, v in self._cache.items() if now > v.expires_at]
            for key in expired:
                del self._cache[key]
            return len(expired)


class CacheKeys:
    """Cache key prefixes for organization."""

    PROGRAM_IDS = "program_ids"
    VERSIONS = "versions"
    FILTER_OPTIONS = "filter_options"
    EVENTS = "events"
    EVENT_COUNT = "event_count"
    PLOT_DATA = "plot_data"


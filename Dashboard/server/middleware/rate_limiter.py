"""Request-throttling layer for FastAPI.

This middleware runs early in the HTTP pipeline to protect expensive routes
(upload, render, admin/export) before service and database logic executes.
Limits come from `server.config.Settings.rate_limiting`; exceeding a limit
returns HTTP 429 with `Retry-After` so clients can back off.
"""

import time
from dataclasses import dataclass, field
from threading import Lock

import jwt
from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from server.config import Settings
from server.utils.logging import get_audit_logger


@dataclass
class TokenBucket:
    """Token bucket for rate limiting with burst allowance."""

    capacity: int
    tokens: float = field(default=0.0)
    last_update: float = field(default_factory=time.time)
    refill_rate: float = 1.0  # tokens per second

    def __post_init__(self) -> None:
        if self.tokens == 0.0:
            self.tokens = float(self.capacity)

    def consume(self, tokens: int = 1) -> bool:
        """Attempt to consume tokens. Returns True if successful."""
        now = time.time()
        elapsed = now - self.last_update
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_update = now

        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False

    @property
    def wait_time(self) -> float:
        """Seconds until a token becomes available."""
        if self.tokens >= 1:
            return 0.0
        return (1 - self.tokens) / self.refill_rate


class RateLimiter:
    """In-memory rate limiter using token bucket algorithm."""

    # Endpoint category to rate limit mapping. Order matters: more specific
    # auth-sensitive paths must be checked before broader admin/upload prefixes.
    CATEGORY_PREFIXES = {
        "register": ["/api/v1/auth/register"],
        "auth": ["/api/v1/auth/login", "/api/v1/auth/change-password"],
        "upload": ["/api/v1/upload"],
        "render": ["/api/v1/dashboard/render"],
        "admin": ["/api/v1/admin", "/api/v1/export"],
    }

    def __init__(self, settings: Settings):
        self.settings = settings
        self.enabled = settings.rate_limiting.enabled
        self._buckets: dict[str, TokenBucket] = {}
        self._lock = Lock()

    def _categorize_endpoint(self, path: str) -> tuple[str, int]:
        """Map endpoint path to category and RPM limit."""
        for category, prefixes in self.CATEGORY_PREFIXES.items():
            if any(path.startswith(prefix) for prefix in prefixes):
                rpm = getattr(
                    self.settings.rate_limiting, f"{category}_requests_per_minute"
                )
                return category, rpm
        return "default", self.settings.rate_limiting.default_requests_per_minute

    def _extract_actor_key(self, request: Request) -> str:
        """Prefer user identity from auth cookie, fallback to IP."""
        token = request.cookies.get(self.settings.auth_cookie_name)
        if token and self.settings.jwt_secret:
            try:
                payload = jwt.decode(
                    token,
                    self.settings.jwt_secret,
                    algorithms=[self.settings.jwt_algorithm],
                )
                user_id = payload.get("sub")
                if isinstance(user_id, str) and user_id:
                    return f"user:{user_id}"
            except jwt.InvalidTokenError:
                pass
        if request.client and request.client.host:
            return f"ip:{request.client.host}"
        return "ip:unknown"

    def _get_bucket(self, key: str, rpm: int) -> TokenBucket:
        """Get or create bucket for a key."""
        with self._lock:
            if key not in self._buckets:
                refill_rate = rpm / 60.0  # tokens per second
                capacity = rpm + self.settings.rate_limiting.burst_allowance
                self._buckets[key] = TokenBucket(
                    capacity=capacity,
                    refill_rate=refill_rate,
                )
            return self._buckets[key]

    def check_rate_limit(self, request: Request) -> None:
        """Check rate limit. Raises HTTPException(429) if exceeded."""
        if not self.enabled:
            return

        category, rpm = self._categorize_endpoint(request.url.path)
        actor_key = self._extract_actor_key(request)
        bucket_key = f"{category}:{actor_key}"
        bucket = self._get_bucket(bucket_key, rpm)

        if not bucket.consume():
            get_audit_logger().warning(
                "rate limit blocked",
                extra={
                    "event": "rate_limit_blocked",
                    "path": request.url.path,
                    "method": request.method,
                    "ip": request.client.host if request.client else None,
                    "limit": rpm,
                    "reason": category,
                },
            )
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded for {category} endpoints",
                headers={"Retry-After": str(int(bucket.wait_time) + 1)},
            )


class RateLimitMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware for rate limiting."""

    def __init__(self, app, rate_limiter: RateLimiter):
        super().__init__(app)
        self.rate_limiter = rate_limiter

    async def dispatch(self, request: Request, call_next) -> Response:
        self.rate_limiter.check_rate_limit(request)
        return await call_next(request)


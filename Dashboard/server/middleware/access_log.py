"""HTTP access-log middleware.

Replaces the older PerformanceMiddleware "request completed" emit. This
middleware is the single source of truth for:

* generating the per-request UUID (``request.state.request_id``)
* setting the ``X-Request-Id`` and ``X-Process-Time-Ms`` response headers
* emitting one structured line on the dedicated ``access`` logger per request
* emitting a ``slow_request`` line on the ``app`` logger when the request
  exceeds ``settings.slow_query_ms``

Health probes are intentionally skipped to keep the access log signal-rich.
"""

import logging
import time
import uuid
from typing import Callable, Iterable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from server.utils.logging import get_access_logger

_HEALTH_PATHS = ("/health", "/health/live", "/health/ready")

_app_logger = logging.getLogger("app")


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def _user_id_from_request(request: Request) -> str | None:
    user = getattr(request.state, "user", None)
    if isinstance(user, dict):
        return user.get("user_id") or user.get("username")
    return getattr(user, "user_id", None)


class AccessLogMiddleware(BaseHTTPMiddleware):
    """Per-request structured access log + slow-query detector."""

    def __init__(
        self,
        app,
        slow_query_ms: int = 1000,
        skip_paths: Iterable[str] = _HEALTH_PATHS,
    ) -> None:
        super().__init__(app)
        self._slow_query_ms = slow_query_ms
        self._skip_paths = tuple(skip_paths)
        self._access_logger = get_access_logger()

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
        request.state.request_id = request_id
        start = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            _app_logger.exception(
                "request failed",
                extra={
                    "event": "request_error",
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": duration_ms,
                    "ip": _client_ip(request),
                },
            )
            raise

        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        response.headers["X-Process-Time-Ms"] = f"{duration_ms:.2f}"
        response.headers["X-Request-Id"] = request_id

        path = request.url.path
        if path in self._skip_paths:
            return response

        extras = {
            "event": "http_access",
            "request_id": request_id,
            "method": request.method,
            "path": path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
            "ip": _client_ip(request),
            "user_id": _user_id_from_request(request),
        }
        self._access_logger.info("http access", extra=extras)

        if duration_ms > self._slow_query_ms:
            _app_logger.warning(
                "slow request",
                extra={
                    **extras,
                    "event": "slow_request",
                    "limit": self._slow_query_ms,
                },
            )

        return response

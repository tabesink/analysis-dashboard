"""Per-request timing and observability middleware.

It wraps each request/response cycle and appends `X-Process-Time-Ms` so API
consumers and UI tooling can inspect latency. Slow-request warnings here help
connect endpoint behavior to downstream service/query bottlenecks.
"""

import logging
import time
import uuid
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)


class PerformanceMiddleware(BaseHTTPMiddleware):
    """Middleware to measure and log request performance."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and measure timing."""
        request_id = uuid.uuid4().hex
        request.state.request_id = request_id
        start_time = time.perf_counter()
        response: Response
        try:
            response = await call_next(request)
        except Exception:
            process_time_ms = (time.perf_counter() - start_time) * 1000
            logger.exception(
                "request failed",
                extra={
                    "event": "request_error",
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": round(process_time_ms, 2),
                    "ip": request.client.host if request.client else None,
                },
            )
            raise

        # Calculate processing time
        process_time_ms = (time.perf_counter() - start_time) * 1000

        # Add header to response
        response.headers["X-Process-Time-Ms"] = f"{process_time_ms:.2f}"
        response.headers["X-Request-Id"] = request_id

        logger.info(
            "request completed",
            extra={
                "event": "request_completed",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round(process_time_ms, 2),
                "ip": request.client.host if request.client else None,
            },
        )

        return response


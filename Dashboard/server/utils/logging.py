"""Logging configuration utilities.

Production logging layout (when ``log_to_file`` is True):

    <log_dir>/
        server/
            access.log    daily-rotated, kept 90 days  (logger="access")
            audit.log     daily-rotated, kept 365 days (logger="audit")
            error.log     daily-rotated, kept 90 days  (root, level=ERROR)
            app.log       daily-rotated, kept 90 days  (root, level=INFO,
                          excludes access/audit to avoid double-writing)

Stdout always receives the full JSON stream so ``docker logs`` keeps working.
"""

import json
import logging
from datetime import UTC, datetime
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path

ACCESS_LOGGER = "access"
AUDIT_LOGGER = "audit"

_AUDIT_BACKUP_DAYS = 365
_OPERATIONAL_BACKUP_DAYS = 90


class JsonFormatter(logging.Formatter):
    """Structured JSON formatter for application logs."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key in (
            "event",
            "request_id",
            "method",
            "path",
            "status_code",
            "duration_ms",
            "user_id",
            "ip",
            "username",
            "role",
            "rows",
            "bytes",
            "filename",
            "reason",
            "limit",
        ):
            if hasattr(record, key):
                payload[key] = getattr(record, key)
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


class _ExcludeNamesFilter(logging.Filter):
    """Drop records emitted by the listed logger names (or their children)."""

    def __init__(self, names: tuple[str, ...]) -> None:
        super().__init__()
        self._names = names

    def filter(self, record: logging.LogRecord) -> bool:
        for name in self._names:
            if record.name == name or record.name.startswith(name + "."):
                return False
        return True


def _make_file_handler(
    path: Path,
    level: int,
    backup_days: int,
    formatter: logging.Formatter,
) -> TimedRotatingFileHandler:
    handler = TimedRotatingFileHandler(
        filename=str(path),
        when="midnight",
        interval=1,
        backupCount=backup_days,
        encoding="utf-8",
        utc=True,
    )
    handler.setLevel(level)
    handler.setFormatter(formatter)
    return handler


def get_access_logger() -> logging.Logger:
    """Return the dedicated access logger (writes to access.log when enabled)."""
    return logging.getLogger(ACCESS_LOGGER)


def get_audit_logger() -> logging.Logger:
    """Return the dedicated audit logger (writes to audit.log when enabled)."""
    return logging.getLogger(AUDIT_LOGGER)


def setup_logging(
    level: str = "INFO",
    log_dir: Path | None = None,
    log_to_file: bool = False,
) -> None:
    """Configure logging for the application.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL).
        log_dir: Directory for log files (used when ``log_to_file`` is True).
        log_to_file: When True, attach the routed file handlers documented at
            the top of this module in addition to stdout.
    """
    log_level = getattr(logging, level.upper(), logging.INFO)
    formatter = JsonFormatter()

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.handlers.clear()

    import sys

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    access_logger = logging.getLogger(ACCESS_LOGGER)
    access_logger.setLevel(log_level)
    access_logger.handlers.clear()
    access_logger.propagate = True  # bubble to root stdout handler

    audit_logger = logging.getLogger(AUDIT_LOGGER)
    audit_logger.setLevel(logging.INFO)
    audit_logger.handlers.clear()
    audit_logger.propagate = True

    if log_to_file and log_dir is not None:
        server_dir = Path(log_dir) / "server"
        server_dir.mkdir(parents=True, exist_ok=True)

        access_handler = _make_file_handler(
            server_dir / "access.log",
            log_level,
            _OPERATIONAL_BACKUP_DAYS,
            formatter,
        )
        access_logger.addHandler(access_handler)

        audit_handler = _make_file_handler(
            server_dir / "audit.log",
            logging.INFO,
            _AUDIT_BACKUP_DAYS,
            formatter,
        )
        audit_logger.addHandler(audit_handler)

        error_handler = _make_file_handler(
            server_dir / "error.log",
            logging.ERROR,
            _OPERATIONAL_BACKUP_DAYS,
            formatter,
        )
        root_logger.addHandler(error_handler)

        app_handler = _make_file_handler(
            server_dir / "app.log",
            log_level,
            _OPERATIONAL_BACKUP_DAYS,
            formatter,
        )
        app_handler.addFilter(_ExcludeNamesFilter((ACCESS_LOGGER, AUDIT_LOGGER)))
        root_logger.addHandler(app_handler)

    # Quiet noisy third-party loggers (uvicorn access is replaced by our own
    # access middleware; httpx is generally chatty during health checks).
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)

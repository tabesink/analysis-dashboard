"""Apply declared DuckDB schema DDL to an open connection."""

from __future__ import annotations

import logging
from typing import Any

from .schema_loader import SchemaLoader, get_schema_loader

logger = logging.getLogger(__name__)


class SchemaApplier:
    """Executes idempotent schema DDL generated from ``server/schema.yaml``."""

    def __init__(self, schema_loader: SchemaLoader | None = None):
        self.schema_loader = schema_loader or get_schema_loader()

    def apply(self, conn: Any) -> list[str]:
        """Apply all declared DDL statements on the provided DuckDB connection."""
        executed: list[str] = []
        for statement in self.schema_loader.generate_all_sql():
            conn.execute(statement)
            executed.append(statement)

        logger.info("Applied %s declared schema statements", len(executed))
        return executed

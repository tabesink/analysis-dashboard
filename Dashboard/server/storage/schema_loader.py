"""Schema loader for the YAML-based DuckDB schema registry."""

import logging
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)


class SchemaLoader:
    """
    Loads the declared database schema from ``server/schema.yaml``.

    The registry owns DDL facts only: sequences, tables, additive columns,
    constraints, indexes, and filter metadata. Runtime data behavior stays in
    Python services/storage code.
    """

    def __init__(self, schema_path: Path | None = None):
        """
        Initialize schema loader.

        Args:
            schema_path: Path to schema.yaml. Defaults to server/schema.yaml.
        """
        if schema_path is None:
            schema_path = Path(__file__).parent.parent / "schema.yaml"

        self.schema_path = schema_path
        self._schema: dict[str, Any] | None = None

    @property
    def schema(self) -> dict[str, Any]:
        """Load and cache schema from YAML file."""
        if self._schema is None:
            self._schema = self._load_schema()
        return self._schema

    def _load_schema(self) -> dict[str, Any]:
        """Load schema from disk."""
        if not self.schema_path.exists():
            raise FileNotFoundError(f"Schema file not found: {self.schema_path}")

        with open(self.schema_path) as f:
            schema = yaml.safe_load(f)

        logger.info(
            "Loaded schema version %s from %s",
            schema.get("version", "unknown"),
            self.schema_path,
        )
        return schema

    def reload(self) -> None:
        """Force reload of schema from disk."""
        self._schema = None
        _ = self.schema

    @property
    def version(self) -> int:
        """Get schema version number."""
        return self.schema.get("version", 1)

    @property
    def sequences(self) -> dict[str, dict[str, Any]]:
        """Get sequence definitions keyed by sequence name."""
        return self.schema.get("sequences", {})

    @property
    def tables(self) -> dict[str, dict[str, Any]]:
        """Get table definitions keyed by table name."""
        return self.schema.get("tables", {})

    @property
    def indexes(self) -> dict[str, dict[str, Any]]:
        """Get index definitions keyed by index name."""
        return self.schema.get("indexes", {})

    def _iter_columns(self, table_def: dict[str, Any]) -> list[dict[str, Any]]:
        columns = table_def.get("columns", {})
        return [
            {"name": name, **definition}
            for name, definition in columns.items()
        ]

    def get_filter_columns_from_schema(self) -> list[dict[str, Any]]:
        """
        Get columns that have filter config defined.

        These are columns in dim_event with filter metadata.
        """
        dim_event = self.tables.get("dim_event", {})
        return [col for col in self._iter_columns(dim_event) if col.get("filter")]

    def get_filter_options(self) -> dict[str, dict[str, Any]]:
        """
        Build filter options dict from schema column definitions.

        Returns dict in format expected by API:
            {
                "Display Name": {
                    "column": "column_name",
                    "order": 1,
                    "values": ["value1", "value2"]
                },
                ...
            }
        """
        filter_options: dict[str, dict[str, Any]] = {}

        for col in self.get_filter_columns_from_schema():
            filter_config = col.get("filter", {})
            display_name = filter_config.get("display_name")

            if display_name:
                filter_options[display_name] = {
                    "column": col["name"],
                    "order": filter_config.get("order", 999),
                    "values": filter_config.get("values", []),
                }

        return filter_options

    def get_filter_column_map(self) -> dict[str, str]:
        """
        Get mapping of display names and column names to column names.

        Used for resolving filter keys in queries.
        """
        column_map: dict[str, str] = {}

        for col in self.get_filter_columns_from_schema():
            column_name = col["name"]
            filter_config = col.get("filter", {})
            display_name = filter_config.get("display_name")

            column_map[column_name] = column_name
            if display_name:
                column_map[display_name] = column_name

        return column_map

    def generate_sequence_sql(self, name: str, sequence: dict[str, Any]) -> str:
        """Generate CREATE SEQUENCE statement."""
        start = sequence.get("start", 1)
        return f"CREATE SEQUENCE IF NOT EXISTS {name} START {start}"

    def generate_all_sequence_sql(self) -> list[str]:
        """Generate all CREATE SEQUENCE statements."""
        return [
            self.generate_sequence_sql(name, sequence)
            for name, sequence in self.sequences.items()
        ]

    def _format_default(self, default: Any) -> str:
        if isinstance(default, bool):
            return "TRUE" if default else "FALSE"
        if isinstance(default, int | float):
            return str(default)
        if default in ("CURRENT_TIMESTAMP", "TRUE", "FALSE"):
            return str(default)
        if isinstance(default, str) and default.startswith("nextval("):
            return default
        return f"'{default}'"

    def _column_to_sql(
        self,
        name: str,
        column: dict[str, Any],
        *,
        include_constraints: bool = True,
    ) -> str:
        """Convert a column definition to a SQL column clause."""
        parts = [name, column["type"]]

        if include_constraints:
            if column.get("primary_key"):
                parts.append("PRIMARY KEY")
            elif column.get("nullable") is False:
                parts.append("NOT NULL")

            if column.get("unique"):
                parts.append("UNIQUE")

        if "default" in column:
            parts.append(f"DEFAULT {self._format_default(column['default'])}")

        return " ".join(parts)

    def _table_constraints_to_sql(self, table_def: dict[str, Any]) -> list[str]:
        constraints = table_def.get("constraints", {})
        clauses: list[str] = []
        for constraint in constraints.values():
            constraint_type = constraint.get("type")
            columns = ", ".join(constraint.get("columns", []))
            if constraint_type == "unique":
                clauses.append(f"UNIQUE ({columns})")
        return clauses

    def generate_table_sql(self, table_name: str, table_def: dict[str, Any]) -> str:
        """Generate CREATE TABLE statement for a table."""
        column_clauses = [
            self._column_to_sql(name, column)
            for name, column in table_def.get("columns", {}).items()
        ]
        column_clauses.extend(self._table_constraints_to_sql(table_def))
        columns_sql = ",\n                    ".join(column_clauses)

        return f"""CREATE TABLE IF NOT EXISTS {table_name} (
                    {columns_sql}
                )"""

    def generate_all_table_sql(self) -> list[str]:
        """Generate all CREATE TABLE statements."""
        return [
            self.generate_table_sql(name, table_def)
            for name, table_def in self.tables.items()
        ]

    def generate_add_column_sql(
        self,
        table_name: str,
        column_name: str,
        column: dict[str, Any],
    ) -> str:
        """Generate idempotent ADD COLUMN SQL for an additive column."""
        column_sql = self._column_to_sql(
            column_name,
            column,
            include_constraints=False,
        )
        return f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {column_sql}"

    def generate_all_add_column_sql(self) -> list[str]:
        """Generate all declared additive column statements."""
        statements: list[str] = []
        for table_name, table_def in self.tables.items():
            for column_name, column in table_def.get("columns", {}).items():
                if column.get("additive"):
                    statements.append(
                        self.generate_add_column_sql(table_name, column_name, column)
                    )
        return statements

    def generate_index_sql(self, name: str, index: dict[str, Any]) -> str:
        """Generate CREATE INDEX statement."""
        table = index["table"]
        columns = ", ".join(index["columns"])
        return f"CREATE INDEX IF NOT EXISTS {name} ON {table}({columns})"

    def generate_all_index_sql(self) -> list[str]:
        """Generate all CREATE INDEX statements."""
        return [
            self.generate_index_sql(name, index)
            for name, index in self.indexes.items()
        ]

    def generate_all_sql(self) -> list[str]:
        """Generate all idempotent DDL statements."""
        statements = []
        statements.extend(self.generate_all_sequence_sql())
        statements.extend(self.generate_all_table_sql())
        statements.extend(self.generate_all_add_column_sql())
        statements.extend(self.generate_all_index_sql())
        return statements

    def get_table_columns(self, table_name: str) -> list[dict[str, Any]]:
        """Get column definitions for a specific table."""
        table = self.tables.get(table_name)
        if table is None:
            return []
        return self._iter_columns(table)

    def get_filter_column_names(self) -> list[str]:
        """Get list of column names that are used as filters."""
        return [col["name"] for col in self.get_filter_columns_from_schema()]

    def validate_schema(self) -> list[str]:
        """
        Validate the schema configuration.

        Returns:
            List of validation error messages (empty if valid)
        """
        errors = []

        for col in self.get_filter_columns_from_schema():
            column_name = col["name"]
            filter_config = col.get("filter", {})

            if not filter_config.get("display_name"):
                errors.append(
                    f"Column '{column_name}' has filter config but missing 'display_name'"
                )

            if not filter_config.get("values"):
                errors.append(
                    f"Column '{column_name}' has filter config but missing 'values' list"
                )

        return errors


_default_loader: SchemaLoader | None = None


def get_schema_loader() -> SchemaLoader:
    """Get the default schema loader instance."""
    global _default_loader
    if _default_loader is None:
        _default_loader = SchemaLoader()
    return _default_loader

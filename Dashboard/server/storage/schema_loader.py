"""Schema loader for YAML-based database schema configuration.

Parses schema.yaml and generates SQL statements for DuckDB.
This provides a single source of truth for table definitions.
"""

import logging
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)


class SchemaLoader:
    """
    Loads database schema from YAML configuration.
    
    Generates SQL statements for:
    - CREATE SEQUENCE
    - CREATE TABLE

    Note: This loader only emits SQL for objects defined in schema.yaml
    (currently dim tables and filter metadata). Runtime index creation and
    non-schema.yaml tables are managed by UnifiedStore.
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
        """Load schema from YAML file."""
        if not self.schema_path.exists():
            raise FileNotFoundError(f"Schema file not found: {self.schema_path}")
        
        with open(self.schema_path, "r") as f:
            schema = yaml.safe_load(f)
        
        logger.info(f"Loaded schema version {schema.get('version', 'unknown')} from {self.schema_path}")
        return schema

    def reload(self) -> None:
        """Force reload of schema from disk."""
        self._schema = None
        _ = self.schema  # Trigger reload

    @property
    def version(self) -> int:
        """Get schema version number."""
        return self.schema.get("version", 1)

    @property
    def sequences(self) -> list[dict[str, Any]]:
        """Get sequence definitions."""
        return self.schema.get("sequences", [])

    @property
    def tables(self) -> dict[str, dict[str, Any]]:
        """Get table definitions."""
        return self.schema.get("tables", {})

    def get_filter_columns_from_schema(self) -> list[dict[str, Any]]:
        """
        Get columns that have filter config defined.
        
        These are columns in dim_event with filter metadata.
        Returns list of column defs with filter field.
        """
        dim_event = self.tables.get("dim_event", {})
        columns = dim_event.get("columns", [])
        return [col for col in columns if col.get("filter")]

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
        
        This is the single source of truth for filter configuration,
        replacing the old settings.yaml filter_options.
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
        
        Used for resolving filter keys in queries. Returns a dict that
        maps both "Display Name" and "column_name" to the actual column.
        """
        column_map: dict[str, str] = {}
        
        for col in self.get_filter_columns_from_schema():
            column_name = col["name"]
            filter_config = col.get("filter", {})
            display_name = filter_config.get("display_name")
            
            # Map column name to itself
            column_map[column_name] = column_name
            
            # Map display name to column name
            if display_name:
                column_map[display_name] = column_name
        
        return column_map

    def generate_sequence_sql(self, sequence: dict[str, Any]) -> str:
        """Generate CREATE SEQUENCE statement."""
        name = sequence["name"]
        start = sequence.get("start", 1)
        return f"CREATE SEQUENCE IF NOT EXISTS {name} START {start}"

    def generate_all_sequence_sql(self) -> list[str]:
        """Generate all CREATE SEQUENCE statements."""
        return [self.generate_sequence_sql(seq) for seq in self.sequences]

    def _column_to_sql(self, column: dict[str, Any]) -> str:
        """Convert column definition to SQL column clause."""
        name = column["name"]
        col_type = column["type"]
        
        parts = [name, col_type]
        
        if column.get("primary_key"):
            parts.append("PRIMARY KEY")
        elif column.get("nullable") is False:
            parts.append("NOT NULL")
        
        if "default" in column:
            default = column["default"]
            # Handle special defaults that shouldn't be quoted
            if default in ("CURRENT_TIMESTAMP", "TRUE", "FALSE"):
                parts.append(f"DEFAULT {default}")
            elif default.startswith("nextval("):
                parts.append(f"DEFAULT {default}")
            else:
                parts.append(f"DEFAULT '{default}'")
        
        return " ".join(parts)

    def generate_table_sql(self, table_name: str, table_def: dict[str, Any]) -> str:
        """Generate CREATE TABLE statement for a table."""
        columns = table_def.get("columns", [])
        
        column_clauses = [self._column_to_sql(col) for col in columns]
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

    def generate_all_sql(self) -> list[str]:
        """Generate all SQL statements (sequences + tables)."""
        statements = []
        statements.extend(self.generate_all_sequence_sql())
        statements.extend(self.generate_all_table_sql())
        return statements

    def get_table_columns(self, table_name: str) -> list[dict[str, Any]]:
        """Get column definitions for a specific table."""
        table = self.tables.get(table_name)
        if table is None:
            return []
        return table.get("columns", [])

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
        
        # Check each filter column has required fields
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


# Module-level instance for convenience
_default_loader: SchemaLoader | None = None


def get_schema_loader() -> SchemaLoader:
    """Get the default schema loader instance."""
    global _default_loader
    if _default_loader is None:
        _default_loader = SchemaLoader()
    return _default_loader

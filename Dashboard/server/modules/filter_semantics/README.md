# Filter Semantics Module

This module owns the meaning of Dashboard filters.

It converts user filter input into a validated `FilterPlan`. Callers should not manually interpret boolean filters, weight filters, custom fields, event ID search, or schema metadata.

The module decides what each filter means. Query and storage code still decide how to execute the resulting SQL against DuckDB.

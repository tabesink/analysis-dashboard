# RSP Data Analytics Dashboard Context

This file is the shared domain glossary for agents working on the RSP Data Analytics Dashboard. Keep terms concise, domain-level, and stable. Do not turn this into an implementation inventory.

## Domain Terms

- **Dashboard**: The user-facing analysis workspace for filtering, plotting, and comparing uploaded RSP event data.
- **Dataset**: An uploaded CSV-derived data package stored in DuckDB with event metadata and measurement rows.
- **Event**: The primary analysis unit within a program/version. Events carry metadata, status, and associated channel measurements.
- **Program**: The top-level grouping for related vehicle or test data.
- **Version**: A subdivision of a program used to compare iterations of related event data.
- **Channel**: A named measurement signal from uploaded RSP data, normalized through the channel map when applicable.
- **Measurement**: Time-series channel data associated with an event and used for plotting or downsampling.
- **Fatigue Damage**: A per-event, per-channel scalar calculated from a full-resolution channel series using the notebook-defined rainflow cycle counting and SN-curve method.
- **Global Filters**: Dashboard-wide filter selections that constrain available programs, versions, events, and plot data.
- **Edit Metadata**: The Database/Edit workflow for updating event or program-version metadata while preserving authorization and cache invalidation rules.
- **Database Export/Import**: Admin-only portable database transfer using the documented Parquet ZIP format, not raw database downloads.
- **Admin User**: A user with administrative privileges for user management, privileged metadata/status updates, and database export/import.
- **Write User**: A non-admin user with `can_write` permission for allowed upload and metadata mutation flows.
- **Read-Only User**: A user without write permission; they can view allowed data but cannot use write routes.

## Documentation Map

- `AGENTS.md`: mandatory project rules for agents.
- `docs/agents/`: issue-tracker, triage-label, and domain-doc setup consumed by skills.
- `docs/master-build-plan.md`: task tracker and implementation phase map.
- `docs/decisions/log.md`: durable decisions.
- `docs/database-schema.txt`: database schema source of truth.
- `docs/test-strategy.md`: test strategy and gaps.

## Maintenance Rules

- Add a term when repeated conversation or implementation work depends on a stable name.
- Prefer domain language over file, function, or component names.
- Update this file during `grill-with-docs` when a term is resolved.
- Record durable technical decisions in `docs/decisions/log.md`, not here.

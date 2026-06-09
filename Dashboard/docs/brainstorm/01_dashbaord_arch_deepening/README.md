# Dashboard Architecture Documentation Index

Use these files in order.

## 1. `dashboard_deepening_elaborated.md`

Senior-level explanation of the full review. Read this first to understand all candidates and the recommended order.

## 2. `candidate_1_dashboard_workspace_module.md`

Detailed implementation guide for the client-side dashboard workspace module.

Use this when working on:

```text
client/src/hooks/use-session.ts
client/src/lib/session/session-sync.ts
client/src/hooks/use-filter-state.ts
client/src/hooks/use-event-catalog.ts
client/src/hooks/use-filter-selection-sync.ts
client/src/components/dashboard/DashboardContent.tsx
```

## 3. `candidate_2_filter_semantics_module.md`

Detailed implementation guide for the server-side filter semantics module.

Use this when working on:

```text
server/services/query.py
server/storage/database.py
server/storage/schema_loader.py
server/utils/boolean_filters.py
server/utils/weight_filters.py
```

## 4. `coding_agent_work_order.md`

A direct prompt/work order you can give to a coding agent.

It includes:

- Role
- Scope
- Architecture rules
- Candidate tasks
- Acceptance criteria
- Pull request sequence
- Non-goals

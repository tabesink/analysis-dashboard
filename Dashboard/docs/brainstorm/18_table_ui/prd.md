# PRD — Table UI Port Package

## Problem

Agents and junior developers need a self-contained reference to reproduce the canartdb-ui table experience — both the **navigation/summary tables** and the **Excel-like CRUD editors** — in other apps without re-discovering implementation details from scratch.

## Goals

1. **Visual parity** — flex tables match the Workbench database-table card; Handsontable editors feel native inside the same Card chrome.
2. **Portable documentation** — an agent can implement from `docs/brainstorm/18_table_ui/` alone (offline copies under `reference/`).
3. **Clear separation** — presentation (this package) vs. domain API (each app's backend).

## Two table paradigms (locked)

| Paradigm | When to use | Primary files |
|----------|-------------|---------------|
| **Flex hierarchy / flat** | Browsing grouped data, sort, pagination, batch delete, drill-down links | `CertificateFlatTable`, `CertificatePagesTable`, `ColumnResizeHandle` |
| **Handsontable spreadsheet** | Dense tabular data with in-cell edit, add/remove rows, copy/paste | `TableResultsEditor`, `FailedPageEditor` |

Do **not** merge these into one component. The reference keeps navigation tables (flex) separate from edit surfaces (Handsontable).

## In scope

- All React components, hooks, types, and page wiring for table UI in canartdb-ui
- Visual spec tokens from `database-table` skill
- CRUD patterns: local edit buffer → diff → batch save; context-menu row ops; batch certificate delete
- Fix-mode CSV editor with validation and `__extra_*` column handling

## Out of scope

- PDF upload side panel (`DatabaseSidePanel`) — mentioned only as layout context
- Backend API implementation — document contract shapes in types, not server code
- Virtualized scrolling — explicitly deferred in database-table skill
- Replacing Handsontable with AG Grid, TanStack Table, or native `<table>` for the edit surface

## Stack assumptions

Target app must provide:

- Next.js App Router, React 19+
- Tailwind CSS v4 (`@import "tailwindcss"` in globals, no `tailwind.config.js`)
- shadcn/ui primitives on Radix (`Button`, `Card`, `Checkbox`, `Collapsible`, `Popover`, `AlertDialog`, `Select`)
- `@tanstack/react-query` for data fetching
- `lucide-react` icons
- For spreadsheet editors: `handsontable` + `@handsontable/react-wrapper` (^17.x)

## Success criteria

An implementer can:

1. Render a flat sortable table with column resize and batch select matching `CertificateFlatTable`.
2. Render a 2-level Page→Table tree matching `CertificatePagesTable`.
3. Render an editable spreadsheet with save/reset/diff matching `TableResultsEditor`.
4. Wire CRUD to their own API using the hook/page patterns without modifying presentation components.

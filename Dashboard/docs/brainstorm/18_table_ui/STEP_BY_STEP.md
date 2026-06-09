# Step-by-Step — Port Table UI to Another App

## Phase 0 — Prerequisites

```
[ ] Tailwind v4 + shadcn (Button, Card, Checkbox, Collapsible, Select, AlertDialog)
[ ] @tanstack/react-query
[ ] (Spreadsheet) handsontable + @handsontable/react-wrapper
```

## Phase 1 — Shared primitives

Copy `ColumnResizeHandle.tsx`, optionally `IndeterminateCheckbox.tsx`, `SaveConfirmDialog.tsx`.

## Phase 2 — Types and API

Copy `types/database.ts`, `lib/api/database.ts`, wire to target fetch helper.

## Phase 3A — Flex flat table

1. Copy `CertificateFlatTable.tsx`
2. Replace `DATA_COLUMNS` and row accessors
3. Copy `useCertificateHierarchy` + list `page.tsx`

## Phase 3B — Flex hierarchy

1. Copy `CertificatePagesTable.tsx`
2. Copy `usePageTables` lazy hook
3. Create certificate detail page with `expandedPageIds` URL state

For 3-level trees use `reference/database-table-skill/templates/HierarchicalTable.three-level.tsx`.

## Phase 4 — Handsontable editor

1. Copy `TableResultsEditor.tsx`
2. Import CSS in table page
3. Copy hooks + page with `diffRows`, save, reset

## Phase 5 — Fix mode (optional)

Copy `FailedPageEditor.tsx` + `?mode=fix` branch in table page.

## Phase 6 — Polish

- Preserve query string across drill-down navigation
- Invalidate `['database']` after mutations
- Match loading/empty states from VISUAL_SPEC.md

## Refresh references

```bash
bash docs/brainstorm/18_table_ui/scripts/refresh-references.sh
```

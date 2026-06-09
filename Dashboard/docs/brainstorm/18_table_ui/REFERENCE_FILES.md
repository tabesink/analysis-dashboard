# Reference Files Index

Refresh: `bash docs/brainstorm/18_table_ui/scripts/refresh-references.sh`

---

## `reference/canartdb-ui/`

Copied from [`.references/canartdb-ui`](../../../.references/canartdb-ui).

### Spreadsheet CRUD

| File | Purpose |
|------|---------|
| `src/components/upload/TableResultsEditor.tsx` | Excel-like edit grid |
| `src/components/upload/FailedPageEditor.tsx` | CSV fix-mode editor |
| `src/components/upload/SaveConfirmDialog.tsx` | Save confirmation |
| `src/app/database/table/[tableId]/page.tsx` | Edit page: diff, save, reset, fix mode |

### Flex navigation tables

| File | Purpose |
|------|---------|
| `src/components/upload/CertificateFlatTable.tsx` | Sort, pagination, batch delete |
| `src/components/upload/CertificatePagesTable.tsx` | 2-level Page→Table tree |
| `src/components/upload/ColumnResizeHandle.tsx` | Column drag resize |
| `src/components/upload/IndeterminateCheckbox.tsx` | Tree batch select |
| `src/app/database/page.tsx` | List route |
| `src/app/database/certificate/[certificateId]/page.tsx` | Detail route |

### Data layer

| File | Purpose |
|------|---------|
| `src/types/database.ts` | Type contracts |
| `src/lib/api/database.ts` | REST client |
| `src/hooks/use-table-results.ts` | Spreadsheet query |
| `src/hooks/use-certificate-hierarchy.ts` | List/pages/tables queries |
| `src/hooks/use-certificate-batch-save.ts` | Save mutation |
| `src/lib/review-status.ts` | Status icon helper |
| `package.json` | Dependency versions |

---

## `reference/database-table-skill/`

Copied from [`.cursor/skills/database-table`](../../../.cursor/skills/database-table).

| File | Purpose |
|------|---------|
| `DESIGN.md` | Full visual + behavior spec |
| `tokens.md` | Indent/width constants |
| `AUDIT.md` | Drift detection checklist |
| `templates/HierarchicalTable.two-level.tsx` | Generic 2-level template |
| `templates/HierarchicalTable.three-level.tsx` | Generic 3-level template |
| `templates/types.ts` | Template data contract |

---

## Excluded (not table UI)

- `DatabaseSidePanel.tsx`, upload components
- `lib/api/client.ts`, `components/ui/*`

---

## Doc map

| Copying... | Read |
|------------|------|
| Flex tables | VISUAL_SPEC.md |
| Handsontable | HANDSONTABLE_GUIDE.md |
| Routes / data flow | ARCHITECTURE.md |
| Full port | STEP_BY_STEP.md |

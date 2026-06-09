# Handsontable Guide — Excel-like CRUD Editors

Canonical sources:

- `reference/canartdb-ui/src/components/upload/TableResultsEditor.tsx`
- `reference/canartdb-ui/src/components/upload/FailedPageEditor.tsx`
- `reference/canartdb-ui/src/app/database/table/[tableId]/page.tsx`

---

## Dependencies

```json
{
  "dependencies": {
    "handsontable": "^17.0.1",
    "@handsontable/react-wrapper": "^17.0.1"
  }
}
```

License: reference uses `licenseKey="non-commercial-and-evaluation"`. Production needs a commercial license.

---

## One-time setup

```tsx
import 'handsontable/styles/handsontable.min.css';

import Handsontable from 'handsontable/base';
import { HotTable } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';

registerAllModules();
```

---

## Minimal editable grid

```tsx
<HotTable
  data={data}
  colHeaders={columns}
  rowHeaders={true}
  stretchH="all"
  height="70vh"
  licenseKey="non-commercial-and-evaluation"
  contextMenu={['row_above', 'row_below', 'remove_row']}
  afterChange={(changes, source) => {
    if (!changes || source === 'loadData') return;
    // sync to row model
  }}
  afterRemoveRow={(index, amount) => { /* splice state */ }}
/>
```

---

## Save / reset pattern (page level)

1. Keep `hasUserEditedRows` flag + `editorRows` buffer
2. `activeRows = hasUserEditedRows ? editorRows : serverRows`
3. `diffRows(original, active)` → `BatchChange[]` with per-field patches
4. PUT batch save; invalidate `['database']` queries
5. Reset: clear buffer + refetch

Copy `diffRows()` from `reference/canartdb-ui/src/app/database/table/[tableId]/page.tsx`.

---

## TableResultsEditor highlights

- `READ_ONLY_FIELDS` → column `readOnly: true`
- `NUMERIC_FIELDS` → normalize empty to `null`
- Context menu row CRUD
- Parent receives `onRowsChange(rows)`

---

## FailedPageEditor highlights

- Canonical columns + `__extra_*` OCR drift columns
- `cells` callback → `htInvalid` / `htDimmed` classes
- `beforeRemoveCol` blocks non-extra column deletion
- Commit blocked while extras remain

Use stable refs (`rowsRef`, `validationsRef`) so the grid does not remount on each render.

---

## API endpoints (contract)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/database/tables/:tableId/results` | Load spreadsheet |
| PUT | `/api/v1/database/certificates/:id/results-batch` | Patch save |
| GET | `/api/v1/database/pages/:pageId/csv-content` | Fix mode CSV |
| POST | `.../commit-from-failure` | Fix mode commit |

Types: `reference/canartdb-ui/src/types/database.ts`

---

## Checklist

```
[ ] handsontable.min.css imported
[ ] registerAllModules() called
[ ] afterChange ignores source === 'loadData'
[ ] Save sends patch diff, not full dataset
[ ] Reset clears buffer and refetches
[ ] Fix mode blocks commit with __extra_* columns
```

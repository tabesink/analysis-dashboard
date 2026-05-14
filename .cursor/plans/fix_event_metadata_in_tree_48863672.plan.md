---
name: Fix Event Metadata In Tree
overview: "Eliminate the display*/meta: indirection layer that is masking metadata values in the nested tree. Column keys become raw DatasetInfo column names, and getColumnValue becomes a direct lookup."
todos:
  - id: tree-component
    content: "Update DatabaseEventTree.tsx: DatasetRow = DatasetInfo alias, rollUpStatus reads e.status, grouping uses ds.program_id / ds.version, isStatus check uses 'status'"
    status: completed
  - id: page-column-keys
    content: "Rename staticColumnDefinitions keys, columnDefinitions status entry, dynamicMetadataColumns (drop meta: prefix), visibleColumns + columnFilters initial state, toggleableColumnDefinitions filter, handleColumnVisibilityToggle guard"
    status: completed
  - id: page-getcolvalue
    content: Simplify getColumnValue to direct dataset[columnKey] lookup, drop displayKeyToServerColumn, update getUniqueValues facets lookup
    status: completed
  - id: page-datasetrow-removal
    content: Remove toDatasetRow; use rawDatasets directly; update defaultHiddenMetadataColumns useEffect to check column.key; adjust types on <DatabaseEventTree> call site
    status: completed
isProject: false
---

# Fix Event Metadata In Database Tree

## Root cause

Event rows all show `-` because `getColumnValue(dataset, 'displaySuspension')` resolves to `dataset['displaySuspension']`, which relies on a separate spread in `toDatasetRow`. That indirection is fragile and redundant: the raw `DatasetInfo` object already has `suspension_component`, `axle_location`, etc. directly on it (confirmed by the fact the Version-level `rollUpStatus` pill renders correctly, and by the server's `list_datasets` SELECT returning all those columns).

Fix: remove the `display*` and `meta:` key indirection. Use raw DB column names as the single source of truth. `getColumnValue` becomes a three-line direct lookup on the raw `DatasetInfo`.

## Changes

### 1. `[Dashboard/client/src/components/upload/DatabaseEventTree.tsx](Dashboard/client/src/components/upload/DatabaseEventTree.tsx)`

- Replace the `DatasetRow` extended type with a simple alias:
  ```ts
  export type DatasetRow = DatasetInfo;
  ```
  (kept as an alias so external imports from `@/components/upload` keep working.)
- `rollUpStatus`: change `events.map((e) => e.displayStatus)` -> `events.map((e) => e.status ?? '')` and the same for the fallback `events[0].displayStatus`.
- `tree` `useMemo` grouping: swap `ds.displayProgramId` -> `ds.program_id` and `ds.displayVersion` -> `ds.version`.
- Event row `isStatus` check: `col.key === 'displayStatus' || col.key === 'meta:status'` -> `col.key === 'status'`.

### 2. `[Dashboard/client/src/app/database/page.tsx](Dashboard/client/src/app/database/page.tsx)`

- Delete `toDatasetRow`. Replace the `datasets` memo with a pass-through:
  ```ts
  const datasets = rawDatasets;
  ```
  (Or keep the memo form for identity stability but drop the mapping.)
- `staticColumnDefinitions`: rename keys to raw DB columns:
  - `displaySuspension` -> `suspension_component`
  - `displayAxle` -> `axle_location`
  - `displayGrossVehicleWeight` -> `gross_vehicle_weight_range_lbs`
  - `displayDriveType` -> `drive_type`
  - `displayMaterial` -> `material_construction`
  - `displaySteeringPosition` -> `steering_position`
  - `displayVehicleType` -> `vehicle_type`
- `columnDefinitions`: trailing Status entry becomes `{ key: 'status', label: 'Status' }`.
- `dynamicMetadataColumns`: drop the `meta:` prefix — `key: config.column` directly.
- `visibleColumns` initial state: rename keys to the raw column names (and `status` instead of `displayStatus`).
- `columnFilters` initial state: same rename.
- Delete `displayKeyToServerColumn` (identity map now).
- `getUniqueValues`: replace `displayKeyToServerColumn[column.key]` lookup with `column.key` directly when consulting `facets`.
- `getColumnValue`: collapse to:
  ```ts
  const getColumnValue = useCallback((dataset: DatasetInfo, columnKey: string): string => {
    const value = (dataset as Record<string, unknown>)[columnKey];
    if (typeof value === 'boolean') return value ? 'Applicable' : 'Not Applicable';
    return typeof value === 'string' ? value : '';
  }, []);
  ```
- `toggleableColumnDefinitions`: filter on `col.key !== 'status'`.
- `handleColumnVisibilityToggle`: guard on `columnKey === 'status'`.
- `defaultHiddenMetadataColumns` + the `useEffect` that seeds new dynamic columns: change `next[column.key] = !defaultHiddenMetadataColumns.has(column.column)` to `...has(column.key)` (since `column.key` is now the raw name); drop the unused `column` field from the dynamic column shape.
- Update `<DatabaseEventTree>` prop type: it now takes `DatasetInfo[]` (typing flows through via the `DatasetRow = DatasetInfo` alias).

### 3. `[Dashboard/client/src/components/upload/index.ts](Dashboard/client/src/components/upload/index.ts)`

No source change; the `DatasetRow` export continues to work because it's now an alias of `DatasetInfo`.

## Why this is surgical & bloat-free

- Net code removed: `toDatasetRow` (15 lines), `displayKeyToServerColumn` map (10 lines), 9 `display*` field definitions on `DatasetRow`, the `meta:` prefix parsing branch in `getColumnValue`.
- Net code added: ~0 (renames only).
- No new data fetches, no behavior changes to sort/filter/delete/selection. Tree structure, shading, status pill placement, and column visibility behavior are preserved.

## Files Changed

- `[Dashboard/client/src/components/upload/DatabaseEventTree.tsx](Dashboard/client/src/components/upload/DatabaseEventTree.tsx)`: collapse `DatasetRow` to `DatasetInfo` alias, switch grouping and `rollUpStatus` to raw column names, simplify status-cell check.
- `[Dashboard/client/src/app/database/page.tsx](Dashboard/client/src/app/database/page.tsx)`: drop `toDatasetRow` and `displayKeyToServerColumn`, rename all column keys to raw DB names, simplify `getColumnValue`, update dependent state / callbacks.


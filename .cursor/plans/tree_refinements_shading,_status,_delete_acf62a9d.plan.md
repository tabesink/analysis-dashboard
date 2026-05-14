---
name: "Tree Refinements: Shading, Status, Delete"
overview: "Polish the database nested tree: add progressive gray shading per level (Program darkest to Event lightest), restrict status display to Version level only, and remove event-level selection so users can only delete whole Programs or whole Versions."
todos:
  - id: shading
    content: "Apply progressive gray shading: Program bg-muted/60, Version bg-muted/30, Event transparent"
    status: completed
  - id: status-changes
    content: Remove Program status pill; keep Version status pill; render empty Status cell at Event level
    status: completed
  - id: remove-event-checkboxes
    content: Remove Event-level checkboxes and onSelectDataset prop from DatabaseEventTree
    status: completed
  - id: remove-master-select-all
    content: Remove master 'Select All' checkbox from column header row in page.tsx
    status: completed
  - id: cleanup-orphans
    content: "Remove now-orphaned code: handleSelectDataset, handleSelectAll, visibleDatasetIds, allSelected"
    status: completed
isProject: false
---

# Database Tree Refinements

## Design Decisions (Resolved)

- **Shading:** Darkest at Program -> Medium at Version -> Lightest/transparent at Event leaves
- **Status:** Keep "Status" column header (for sort/filter), but leave Event cells empty in that column. Keep Version status pill. Remove Program status pill.
- **Delete:** Remove Event checkboxes entirely. Remove master "Select All" in column header. Users can only select whole Programs or whole Versions for deletion.

## Changes

### 1. `[DatabaseEventTree.tsx](Dashboard/client/src/components/upload/DatabaseEventTree.tsx)`

**Shading (progressive darkest -> lightest):**

- Program row: change `bg-muted/30` -> `bg-muted/60`
- Version row: add `bg-muted/30`
- Event row: no background (keep transparent / white inheritance from `Card`)
- Hover states remain `bg-muted/50` at all levels for consistent interaction feedback

**Status pill changes:**

- Remove the Program-level status pill rendering (the entire `<span>` that uses `programStatus.className`) plus the `rollUpStatus` call at the Program level. Also remove the unused `allProgramEvents` computation.
- Keep the Version-level status pill unchanged.
- In the Event row rendering, detect the Status column (`col.key === 'displayStatus' || col.key === 'meta:status'`) and render an empty cell placeholder (preserves column alignment) instead of the status badge:

```tsx
if (isStatus) {
  return <span key={col.key} className="flex-1 min-w-0 px-2" />;
}
```

**Remove event-level checkboxes:**

- Delete the `<IndeterminateCheckbox>` from inside the event row's `w-48` block
- Remove the `onSelectDataset` prop from the component's interface (no longer called from anywhere internally)
- Event row's left block becomes just the event-id label, aligned to the tree indent depth

**Simplify props:**

- `DatabaseEventTreeProps` loses `onSelectDataset`
- Internal `selectedSet` is still needed to compute Program/Version `getGroupState`

### 2. `[client/src/app/database/page.tsx](Dashboard/client/src/app/database/page.tsx)`

**Remove master "Select All" in column header:**

- In the column header row (around the "Program ID" label), remove the `<Checkbox>` for `allSelected` / `handleSelectAll`
- Keep the "Program ID" label text as-is

**Remove now-orphaned code:**

- `handleSelectDataset` function (no callers)
- `handleSelectAll` function (no callers)
- `visibleDatasetIds` memo (only used by `handleSelectAll` and `allSelected`)
- `allSelected` derived value (only used in removed Checkbox)
- Remove `onSelectDataset={handleSelectDataset}` from the `<DatabaseEventTree>` call site

**Keep:**

- `handleBatchSelect` (used for Program/Version checkboxes)
- `selectedDatasets` state and `handleDeleteSelected` (delete workflow unchanged -- it still operates on event IDs; users just can't populate it with single events anymore)
- "Status" column header with filter/sort (column header loop is unchanged; only the Event cell rendering for that column becomes empty inside the tree component)

## Files Changed

- `[Dashboard/client/src/components/upload/DatabaseEventTree.tsx](Dashboard/client/src/components/upload/DatabaseEventTree.tsx)`: shading, drop Program status pill, drop Event checkbox, empty Status cell for events, prune `onSelectDataset` prop
- `[Dashboard/client/src/app/database/page.tsx](Dashboard/client/src/app/database/page.tsx)`: remove header "Select All" checkbox, remove orphaned handlers (`handleSelectDataset`, `handleSelectAll`, `visibleDatasetIds`, `allSelected`)


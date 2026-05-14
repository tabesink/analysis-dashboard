---
name: center-db-table-values
overview: Center-align database table data column headers and leaf row values while keeping the Job ID tree column, program rows, and version rows left-aligned.
todos:
  - id: center-headers
    content: Center data column headers in the database page table header without changing the Job ID tree header.
    status: completed
  - id: center-values
    content: Center leaf row data values in DatabaseEventTree while preserving truncation/tooltips.
    status: completed
  - id: verify-centering
    content: Run targeted validation and summarize any unrelated existing lint issues.
    status: completed
isProject: false
---

# Center Database Table Columns

## Scope

- Center data column headers rendered in [client/src/app/database/page.tsx](client/src/app/database/page.tsx).
- Center leaf row values rendered in [client/src/components/upload/DatabaseEventTree.tsx](client/src/components/upload/DatabaseEventTree.tsx).
- Keep the left tree column unchanged: Job ID group labels, version labels, and event IDs remain left-aligned.

## Implementation

1. Update the data column header wrapper in `renderFilterableColumnHeader`.
  - Change the header row content from left-packed flex to centered flex.
  - Keep the sort arrow and filter icon usable and visually grouped with the label.
  - The current target is:

```593:608:client/src/app/database/page.tsx
  const renderFilterableColumnHeader = (
    label: string,
    field: SortField,
    width: number,
  ) => (
    <div
      key={field}
      className="relative shrink-0 px-2"
      style={{ width }}
    >
      <div className="flex items-center gap-1">
        <button
          onClick={() => handleSort(field)}
          className="flex items-center gap-1 hover:text-foreground transition-colors text-left min-w-0"
```

1. Update leaf row value cells in `DatabaseEventTree`.
  - Add centered layout/text alignment to data cells only.
  - Preserve truncation and `title={value}` tooltip behavior.
  - The current target is:

```450:459:client/src/components/upload/DatabaseEventTree.tsx
                                        const value = getColumnValue(dataset, col.key);
                                        return (
                                          <span
                                            key={col.key}
                                            className="shrink-0 text-xs text-foreground/80 truncate px-2"
                                            style={{ width: widthOf(col.key) }}
                                            title={value}
                                          >
                                            {value || '-'}
                                          </span>
```

1. Verify visually and technically.
  - Run TypeScript check for the client.
  - Use lints for the touched files where useful, noting existing repo lint failures if they remain unrelated.

## Expected Result

The database table will read as: left-aligned tree hierarchy in the Job ID column, then centered labels and centered values for columns like Work Order, Program ID, Component, GVW, and Status headers.
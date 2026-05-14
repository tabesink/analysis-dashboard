# Refactor Playbook

Ordered playbook for converting an existing table view into the canonical hierarchical-table card. Apply categories in this order — foundation classes first, behavior on top. Each category lists the audit findings it resolves and shows a before / after recipe.

For the **scaffold** branch (target has no comparable view), skip the "before" snippets and copy the templates directly.

## Order

1. Card chrome + scroll wrapper
2. Sticky header
3. Group / Subgroup / Leaf row scaffolding (pick variant)
4. Indent math constants + first-cell width
5. Single-boundary rule
6. Indeterminate checkbox
7. Column resize
8. Column visibility / filter / sort
9. Rollup badge
10. Empty + loading + refreshing

## 1. Card chrome + scroll wrapper

Resolves audit category 2.

**Before** (typical drift — bare `<div>` table or shadcn Card with default padding):

```tsx
<Card>
  <CardHeader>...</CardHeader>
  <CardContent>
    <table>...</table>
  </CardContent>
</Card>
```

**After**:

```tsx
<Card className="h-full rounded-r-lg rounded-l-none flex flex-col gap-0 overflow-hidden shadow-subtle border py-0">
  <div className="shrink-0 flex items-center justify-end gap-2 px-4 py-3 border-b">
    {/* header bar — column visibility button, batch action button(s), inline refreshing indicator */}
  </div>
  <CardContent className="flex-1 min-h-0 overflow-auto p-0">
    <div style={{ minWidth: totalRowWidth }}>
      {/* sticky header + tree go here */}
    </div>
  </CardContent>
</Card>
```

Verify: scroll the body horizontally — the header must scroll with the rows, not stay pinned to the viewport edge.

## 2. Sticky header

Resolves audit category 3.

**Before**:

```tsx
<thead>
  <tr><th>Name</th><th>Status</th></tr>
</thead>
```

**After**:

```tsx
<div className="sticky top-0 z-10 flex items-center py-2 px-3 border-b bg-card text-xs font-semibold text-foreground/70">
  <div className="relative flex items-center gap-2 shrink-0 pl-1" style={{ width: level1Width }}>
    <span>{LEVEL_1_LABEL}</span>
    <ColumnResizeHandle width={level1Width} onResize={(n) => setColumnWidth(LEVEL_1_KEY, n)} />
  </div>
  <div className="flex items-center">
    {visibleColumnDefs.map((col) => renderFilterableColumnHeader(col.label, col.key, columnWidths[col.key] ?? MIN_COLUMN_PX))}
  </div>
</div>
```

Verify: scroll the body vertically — the header stays visible at the top of the scroll area.

## 3. Group / Subgroup / Leaf row scaffolding

Resolves audit category 4. Pick the variant in Phase 3:

- 2-level: copy [templates/HierarchicalTable.two-level.tsx](templates/HierarchicalTable.two-level.tsx)
- 3-level: copy [templates/HierarchicalTable.three-level.tsx](templates/HierarchicalTable.three-level.tsx)

Rename per the parameter table:

- `Group` → target's level-1 noun (e.g. `Project`)
- `Subgroup` → target's level-2 noun (3-level only, e.g. `Sprint`)
- `Leaf` → target's level-3 noun (e.g. `Task`)

Do **not** rename the underlying class strings — those are the design system contract. Only rename identifiers.

Verify: groups expand/collapse with the chevron. The right-arrow rotates to a down-arrow on open.

## 4. Indent math constants + first-cell width

Resolves audit category 5. **This is the step most often skipped — do not skip it.**

Copy [tokens.md](tokens.md)'s constants verbatim into the table component:

```ts
const ROW_PADDING_X_PX = 12;
const SUBGROUP_INDENT_PX = 24 + 1;   // 3-level only
const LEAF_INDENT_PX = 20 + 1;
const FALLBACK_COLUMN_PX = 80;
```

Compute the per-level first-cell widths:

```ts
const groupRowFirstCellWidth = Math.max(0, level1Width - ROW_PADDING_X_PX);
const subgroupRowFirstCellWidth = Math.max(0, level1Width - ROW_PADDING_X_PX - SUBGROUP_INDENT_PX); // 3-level only
const leafRowFirstCellWidth = Math.max(0, level1Width - ROW_PADDING_X_PX
  - (THREE_LEVEL ? SUBGROUP_INDENT_PX : 0)
  - LEAF_INDENT_PX);
```

Apply each width via `style={{ width: <levelWidth> }}` on the row's first cell. Wrap subgroup lists in `ml-6 border-l border-border` and leaf lists in `ml-5 border-l border-border`.

Verify: at any column width, the first leaf-row data cell starts at the same x-coordinate as the second column header. Resize the level-1 column — leaf rows must follow.

## 5. Single-boundary rule

Resolves audit category 6.

**Before**: every row has `border-b`, producing visible double lines between back-to-back groups.

**After**: detect the tail row of each group and conditionally drop its `border-b`:

```ts
const suppressLastRowBorder = !isLastGroup;

// On the subgroup row (3-level), when the subgroup is collapsed it is the visible tail:
const subgroupRowIsGroupTail = isLastSubgroupInGroup && !isSubgroupOpen;

// On the leaf row, when its subgroup is the last AND the leaf is the last in that subgroup:
const isGroupTailLeaf = isLastSubgroupInGroup && isLastLeafInSubgroup;
```

Then in the row JSX:

```tsx
className={cn(
  'flex items-center py-1.5 px-3 border-b hover:bg-muted/30 transition-colors',
  isGroupTailLeaf && suppressLastRowBorder && 'border-b-0',
)}
```

Verify: collapse all groups, expand none — exactly one horizontal line sits between each pair of group rows. Expand a group — still exactly one line.

## 6. Indeterminate checkbox

Resolves audit category 7.

**Before** (typical drift — using shadcn `Checkbox`):

```tsx
import { Checkbox } from '@/components/ui/checkbox';
<Checkbox checked={pState.allChecked} onCheckedChange={...} />
```

This loses the indeterminate visual.

**After**: copy [templates/IndeterminateCheckbox.tsx](templates/IndeterminateCheckbox.tsx) into the project and import it:

```tsx
import { IndeterminateCheckbox } from '@/components/<feature>/IndeterminateCheckbox';

<IndeterminateCheckbox
  checked={state.allChecked}
  indeterminate={state.indeterminate}
  onCheckedChange={(checked) => onBatchSelect(allLeafIds, checked)}
/>
```

Verify: select some-but-not-all leaves of a group — the group's checkbox shows a `Minus` icon, not a `Check`. Click the `Minus` checkbox — all leaves get selected (and the row's `Collapsible` does **not** toggle).

## 7. Column resize

Resolves audit category 8a.

Copy [templates/ColumnResizeHandle.tsx](templates/ColumnResizeHandle.tsx) verbatim. Place one inside each header cell (level-1 and each visible data column):

```tsx
<div className="relative shrink-0 px-2" style={{ width }}>
  <div className="flex items-center gap-1">{/* label + sort + filter */}</div>
  <ColumnResizeHandle width={width} onResize={(n) => setColumnWidth(field, n)} />
</div>
```

Wire `columnWidths` state at the page level (a `Record<string, number>`), seeded by per-column character-count heuristics (see `widthForValues` in `client/src/app/database/page.tsx` lines 64–73). Persist user resizes for the session only — no backend write.

Verify: drag the handle — the cursor stays `col-resize` across the whole drag, the inner stripe darkens to `bg-primary`, and the column resizes live.

## 8. Column visibility / filter / sort

Resolves audit category 8b/8c/8d.

Add the three controls to the page-level header bar + per-column header. Distill from [templates/TablePage.example.tsx](templates/TablePage.example.tsx).

Wire state:

```ts
const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({...});
const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({...});
const [sortField, setSortField] = useState<string>('<default>');
const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
```

Filter + sort the rows in `useMemo` (see `filteredDatasets` and `sortedDatasets` in `client/src/app/database/page.tsx` lines 462–492).

Verify:

- Visibility popover toggles columns. Last column cannot be unchecked (toast error).
- Per-column filter shows unique values. Selected values filter rows. Filter icon turns `text-primary`.
- Per-column sort: clicking active field flips direction; clicking new field defaults to `desc`. Arrow shows only on active field.

## 9. Rollup badge

Resolves audit category 9.

Copy [templates/rollup.ts](templates/rollup.ts) and import `rollupByPriority` into the table component. Configure with the parameter table's `ROLLUP_PRIORITY` and `ROLLUP_CLASS_MAP`.

In the rollup-level row (subgroup row in 3-level, group row in 2-level), render the badge inside the rollup column's cell:

```tsx
{columnDefinitions.map((col) => {
  if (col.key === ROLLUP_FIELD) {
    const rollup = rollupByPriority(rollupValues, ROLLUP_PRIORITY, classNameForRollup);
    return (
      <span key={col.key} className="shrink-0 px-2 flex items-center" style={{ width: widthOf(col.key) }}>
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium truncate', rollup.className)}>
          {rollup.label}
        </span>
      </span>
    );
  }
  return <span key={col.key} className="shrink-0 px-2" style={{ width: widthOf(col.key) }} />;
})}
```

In the **leaf** row, the rollup column renders an empty placeholder of the right width (the badge belongs only at the rollup level):

```tsx
if (col.key === ROLLUP_FIELD) {
  return <span key={col.key} className="shrink-0 px-2" style={{ width: widthOf(col.key) }} />;
}
```

If the target has no rollup field, omit this category entirely — every column renders a plain value at every level.

Verify: a group with mixed rollup values shows the highest-priority value as a badge. A group with one value shows that value. A group with no values shows `-`. Leaf rows show no badge.

## 10. Empty / loading / refreshing

Resolves audit category 10.

Three states, all distilled in [templates/TablePage.example.tsx](templates/TablePage.example.tsx):

- **Empty**: no data ever loaded — centered icon + title + helper. `h-[400px]` container.
- **Initial loading**: no data yet, fetch in flight — centered `Loader2 h-8 w-8`.
- **Refreshing**: have data, re-fetch in flight — inline `Loader2 h-3.5 w-3.5` in the header bar (use `mr-auto` to push left when other actions are right-aligned).

Render order in the body slot:

```tsx
{summaryRows.length > 0 ? (
  <div style={{ minWidth: totalRowWidth }}>
    {/* sticky header + tree */}
  </div>
) : isLoading || isRefreshing ? (
  <CenteredLoading />
) : (
  <EmptyState />
)}
```

Verify all three states render correctly by toggling the data hook's `isLoading` and `isRefreshing` flags.

## After all categories

Run a final sweep against [AUDIT.md](AUDIT.md) and confirm every Critical finding is resolved. Re-run the ripgrep recipes — they should now find the expected patterns in the target.

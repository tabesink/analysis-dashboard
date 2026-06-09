---
name: Database Table (Hierarchical Tree Card)
description: Canonical visual + behavioral spec for the hierarchical database-table card. Derived from client/src/components/upload/DatabaseEventTree.tsx and client/src/app/database/page.tsx. Pairs with the design-guidelines skill for color/typography tokens.
canonical_implementation:
  tree: client/src/components/upload/DatabaseEventTree.tsx
  page: client/src/app/database/page.tsx
  resize_handle: client/src/components/upload/ColumnResizeHandle.tsx
  rollup: client/src/lib/status-badge.ts
---

# Design Specification

This document captures the exact classes, structure, and behavioral contracts of the canonical hierarchical-table surface. Use it during Phase 2 (Audit) to know expected values, and during Phase 3 (Plan) to cite roles.

All class strings below are Tailwind v4 utility classes that resolve against the Workbench design tokens (see `.cursor/skills/design-guidelines/theme.css`). Do not hand-roll equivalents — always use the named utility.

## 1. Card chrome

The table lives inside a single `Card`:

```tsx
<Card className="h-full rounded-r-lg rounded-l-none flex flex-col gap-0 overflow-hidden shadow-subtle border py-0">
  {/* header bar */}
  <div className="shrink-0 flex items-center justify-end gap-2 px-4 py-3 border-b">...</div>

  {/* scroll body — header + rows share one horizontal scroll */}
  <CardContent className="flex-1 min-h-0 overflow-auto p-0">
    <div style={{ minWidth: totalRowWidth }}>
      {/* sticky header */}
      <div className="sticky top-0 z-10 flex items-center py-2 px-3 border-b bg-card text-xs font-semibold text-foreground/70">...</div>
      {/* tree */}
      <HierarchicalTable ... />
    </div>
  </CardContent>
</Card>
```

Why these choices:

- `rounded-l-none` because the table is the right pane of a side-panel + table layout. The left edge butts against the panel.
- `gap-0` + `py-0` to defeat shadcn `Card` defaults and make `CardContent` flush against the header bar.
- `overflow-hidden` on the card so the inner scroll area's `border-b` lines stay clipped at the rounded right corner.
- `min-h-0` on `CardContent` so the flex parent allows the scroll area to shrink — without it the card grows past its container and the sticky header detaches.
- `minWidth: totalRowWidth` on the inner div so when columns are resized wider than the viewport, header + rows scroll together.

Source: `client/src/app/database/page.tsx` lines 747–887.

## 2. Sticky header

```tsx
<div className="sticky top-0 z-10 flex items-center py-2 px-3 border-b bg-card text-xs font-semibold text-foreground/70">
  <div className="relative flex items-center gap-2 shrink-0 pl-1" style={{ width: programIdWidth }}>
    <span>{LEVEL_1_LABEL}</span>
    <ColumnResizeHandle width={programIdWidth} onResize={(n) => setColumnWidth(LEVEL_1_KEY, n)} />
  </div>
  <div className="flex items-center">
    {visibleColumnDefs.map((col) => renderFilterableColumnHeader(col.label, col.key, columnWidths[col.key] ?? MIN_COLUMN_PX))}
  </div>
</div>
```

The first cell holds the level-1 label and is the only header cell that gets a resize handle on its own (the rest are rendered through `renderFilterableColumnHeader`). The sticky behavior depends on `bg-card` so rows scrolling under it don't bleed through.

Source: `client/src/app/database/page.tsx` lines 833–853.

## 3. Group / Subgroup / Leaf rows

### Level-1 (Group) row

```tsx
<div className={cn(
  'flex items-center gap-2 py-2 px-3 border-t border-b bg-muted/60 hover:bg-muted/70 transition-colors',
  isFirstProgram && '-mt-px',
)}>
  <IndeterminateCheckbox ... />
  <CollapsibleTrigger className="p-0.5 hover:bg-muted rounded-sm transition-colors">
    <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform duration-200', !isOpen && '-rotate-90')} />
  </CollapsibleTrigger>
  <span className="text-xs font-semibold text-foreground select-none cursor-pointer" onClick={toggle}>
    {GROUP_LABEL}
  </span>
  <span className="text-xs text-muted-foreground">({totalLeafCount})</span>
</div>
```

- `bg-muted/60` is the visual signature of the group row — brighter than the leaf hover, dimmer than the page background.
- `border-t border-b` delimits the group block; the `-mt-px` on the first group cancels the doubled top edge against the sticky header.
- `size-3.5` chevron, `text-xs font-semibold` label, parenthesized total count.

### Level-2 (Subgroup) row — 3-level variant only

```tsx
<div className={cn('flex items-center py-1.5 px-3 border-b hover:bg-muted/30 transition-colors', versionRowIsProgramTail && suppressLastRowBorder && 'border-b-0')}>
  <div className="flex items-center gap-2 shrink-0 pl-1" style={{ width: subgroupRowFirstCellWidth }}>
    <IndeterminateCheckbox ... />
    <CollapsibleTrigger className="p-0.5 hover:bg-muted rounded-sm transition-colors">
      <ChevronDown className={cn('size-3 text-muted-foreground transition-transform duration-200', !isOpen && '-rotate-90')} />
    </CollapsibleTrigger>
    <span className="text-xs font-medium text-foreground select-none cursor-pointer">{SUBGROUP_LABEL}</span>
    <span className="text-xs text-muted-foreground">({totalLeafCount})</span>
  </div>
  <div className="flex items-center">
    {/* rollup cell + spacer cells per column */}
  </div>
</div>
```

- Lighter typography (`font-medium` not `semibold`), smaller chevron (`size-3` not `size-3.5`).
- Wrapped in `ml-6 border-l border-border` from the parent. The `pl-1` on the first cell is what visually separates the indent border from the checkbox.
- The rollup column at this level **renders a value** (the rolled-up badge); other column cells render an empty placeholder of the right width so the next subgroup/leaf row's columns still align.

### Leaf row

```tsx
<div className={cn(
  'flex items-center py-1.5 px-3 border-b hover:bg-muted/30 transition-colors group',
  isDeleting && 'opacity-50',
  isProgramTailEvent && suppressLastRowBorder && 'border-b-0',
)}>
  <div className="flex items-center gap-2 shrink-0 pl-1" style={{ width: leafRowFirstCellWidth }}>
    <span className="text-xs text-muted-foreground truncate" title={leafLabel}>{leafLabel}</span>
  </div>
  <div className="flex items-center">
    {visibleColumnDefs.map((col) => (
      <span className="shrink-0 text-xs text-foreground/80 truncate px-2" style={{ width: widthOf(col.key) }} title={value}>
        {value || '-'}
      </span>
    ))}
  </div>
</div>
```

- Wrapped in `ml-5 border-l border-border` (slightly less indent than subgroups, so the leaf's vertical line doesn't visually overlap the subgroup line above it).
- The leaf has no checkbox of its own — selection is batched at the subgroup/group level. Per-leaf selection is intentionally absent; if added, it goes in the same `flex items-center gap-2` slot as the group/subgroup checkbox.
- `group` class on the row enables the `opacity-0 group-hover:opacity-100` pattern for any per-row action button (delete, edit, etc.) the target may add.

Source: `client/src/components/upload/DatabaseEventTree.tsx` lines 277–478.

## 4. Indent math (the critical alignment trick)

Without this, leaf rows misalign with their column headers — the most common bug when porting this view.

```ts
const ROW_PADDING_X_PX = 12;        // matches `px-3`
const SUBGROUP_INDENT_PX = 24 + 1;  // ml-6 + 1px border-l
const LEAF_INDENT_PX = 20 + 1;      // ml-5 + 1px border-l

const groupRowFirstCellWidth = Math.max(0, level1Width - ROW_PADDING_X_PX);
const subgroupRowFirstCellWidth = Math.max(0, level1Width - ROW_PADDING_X_PX - SUBGROUP_INDENT_PX);
const leafRowFirstCellWidth = Math.max(0, level1Width - ROW_PADDING_X_PX - SUBGROUP_INDENT_PX - LEAF_INDENT_PX);
```

The first cell at each level is sized so its right edge lands at the same x-coordinate from the row's outer-left, regardless of how much indent has been consumed by `ml-6` / `ml-5` wrappers above. This is what keeps the data columns aligned with the column headers.

For the **2-level variant** drop `SUBGROUP_INDENT_PX` from the leaf calculation:

```ts
const leafRowFirstCellWidth = Math.max(0, level1Width - ROW_PADDING_X_PX - LEAF_INDENT_PX);
```

Source: `client/src/components/upload/DatabaseEventTree.tsx` lines 53–164.

## 5. Single-boundary rule

When two groups sit back-to-back, only **one** horizontal line should paint between them — not the previous group's `border-b` plus the next group's `border-t`.

The implementation:

1. Each group's last visible row computes `versionRowIsProgramTail` (subgroup row, when it's the last one and collapsed) or `isProgramTailEvent` (leaf row, when it's the very last leaf in the program).
2. The outer loop sets `suppressLastRowBorder = !isLastProgram`.
3. The tail row drops its `border-b` only when `suppressLastRowBorder` is true.

This keeps the visual rule "groups are separated by exactly one line" stable regardless of whether the user has expanded or collapsed the inner subgroups.

Source: `client/src/components/upload/DatabaseEventTree.tsx` lines 261–268, 317–326, 410–423.

## 6. Indeterminate checkbox

Must use Radix `CheckboxPrimitive` directly — not the shadcn `Checkbox` wrapper — because the indeterminate state requires writing `data-state="indeterminate"` and supplying the `indeterminate` value to `checked` literally:

```tsx
<CheckboxPrimitive.Root
  data-state={indeterminate ? 'indeterminate' : checked ? 'checked' : 'unchecked'}
  checked={indeterminate ? 'indeterminate' : checked}
  onCheckedChange={(val) => onCheckedChange(val === true)}
  className="peer border-border/70 bg-background dark:bg-input/20 data-[state=checked]:bg-primary/90 data-[state=indeterminate]:bg-primary/90 data-[state=checked]:text-primary-foreground data-[state=indeterminate]:text-primary-foreground data-[state=checked]:border-primary/90 data-[state=indeterminate]:border-primary/90 focus-visible:border-ring focus-visible:ring-ring/50 size-3.5 shrink-0 rounded-[3px] border shadow-none transition-shadow outline-none focus-visible:ring-[2px] disabled:cursor-not-allowed disabled:opacity-50"
  onClick={(e) => e.stopPropagation()}
>
  <CheckboxPrimitive.Indicator className="grid place-content-center text-current transition-none">
    {indeterminate ? <Minus className="size-3" /> : <Check className="size-3" />}
  </CheckboxPrimitive.Indicator>
</CheckboxPrimitive.Root>
```

The `e.stopPropagation()` on the `onClick` is mandatory — without it, clicking the checkbox also toggles the surrounding `Collapsible`, which is never what the user wants.

Source: `client/src/components/upload/DatabaseEventTree.tsx` lines 108–136.

## 7. Column resize handle

A 1.5px-wide vertical strip pinned to the right edge of every header cell. Drag-to-resize updates clamped to `[60, 600]` px by default.

```tsx
<div role="separator" aria-orientation="vertical" onMouseDown={handleMouseDown}
  className="group absolute top-0 right-0 h-full w-1.5 cursor-col-resize select-none flex justify-center">
  <div className={cn('h-full w-px transition-colors bg-border/70 group-hover:bg-primary/70', dragging && 'bg-primary w-0.5')} />
</div>
```

While dragging, the body cursor and `user-select` are locked through a global event listener (effect cleanup restores them). Without this lock, the cursor flickers between `col-resize` and `text` as the pointer crosses text nodes.

Source: `client/src/components/upload/ColumnResizeHandle.tsx` lines 1–74.

## 8. Column visibility popover

shadcn `Popover` wrapping a vertical list of `Checkbox` + `<label>` pairs, one per toggleable column. The rollup column (e.g. Status) is **not** toggleable — exclude it from the list.

```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" size="sm" className="h-8 rounded-lg px-3 gap-2">
      <Columns className="h-4 w-4" />
      <span className="text-xs">Columns</span>
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-56 p-3" align="end">
    <div className="space-y-3">
      <div className="text-xs font-semibold">Column Visibility</div>
      <div className="space-y-2 bg-muted/70 rounded-md p-2">
        {toggleableColumnDefinitions.map((col) => (
          <div className="flex items-center space-x-2">
            <Checkbox className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
            <label className="text-xs cursor-pointer flex-1">{col.label}</label>
          </div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground pt-2 border-t">
        {visibleCount} columns visible
      </div>
    </div>
  </PopoverContent>
</Popover>
```

Guard: at least one column must remain visible. Toast an error and refuse to uncheck the last visible column.

Source: `client/src/app/database/page.tsx` lines 756–806.

## 9. Per-column filter dropdown

shadcn `DropdownMenu` per column with `DropdownMenuCheckboxItem` per unique value. The filter icon tints `text-primary` when at least one value is checked:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <button className={`shrink-0 p-1 rounded hover:bg-accent transition-colors ${
      activeFilterCount > 0 ? 'text-primary' : 'text-muted-foreground/50 hover:text-muted-foreground'
    }`} onClick={(e) => e.stopPropagation()}>
      <FilterIcon size={10} />
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-48 max-h-[280px] overflow-y-auto rounded-lg shadow-lg">
    {uniqueValues.map((value) => (
      <DropdownMenuCheckboxItem checked={...} onCheckedChange={...} className="text-xs">
        {value}
      </DropdownMenuCheckboxItem>
    ))}
  </DropdownMenuContent>
</DropdownMenu>
```

`stopPropagation` is required so opening the filter menu doesn't also toggle the sort.

Source: `client/src/app/database/page.tsx` lines 613–649.

## 10. Per-column sort

A button with the column label + a directional arrow shown only on the active sort field:

```tsx
<button onClick={() => handleSort(field)} className="flex items-center gap-1 hover:text-foreground transition-colors text-left min-w-0">
  <span className="truncate">{label}</span>
  {sortField === field && (
    <span className="text-primary shrink-0">
      {sortDirection === 'asc' ? <ArrowUpIcon size={10} /> : <ArrowDownIcon size={10} />}
    </span>
  )}
</button>
```

Click semantics: clicking the active field toggles direction; clicking a different field switches to it with `desc` as the default.

Source: `client/src/app/database/page.tsx` lines 436–443, 597–612.

## 11. Rollup badge

A pill rendered at the **subgroup** row (3-level variant) or the **group** row (2-level variant) that summarizes a chosen field across all the leaves in that group. The rollup logic is priority-based:

1. If all leaves share one value, show that value.
2. Else, walk the priority list in order — the first value that appears in any leaf wins.
3. Else (no values at all), show `-`.

Pill styling:

```tsx
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium truncate <classNameForValue>">
  {label}
</span>
```

The `<classNameForValue>` slot is filled from the target's `ROLLUP_CLASS_MAP`. The Workbench example maps `Approved → bg-green-100 text-green-700`, `Obsolete → bg-red-100 text-red-700`, all others → `bg-amber-100 text-amber-700`.

The leaf row leaves the rollup column **empty** — the badge only paints at the rollup level. This is intentional: it tells the user "this is a rolled-up summary" rather than "every row has a status".

Source: `client/src/components/upload/DatabaseEventTree.tsx` lines 76–95, 372–397, 437–448; `client/src/lib/status-badge.ts`.

## 12. Empty / loading / refreshing states

### Empty (no data ever loaded)

```tsx
<div className="flex flex-col items-center justify-center h-[400px] text-center">
  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
    <Icon className="h-8 w-8 text-muted-foreground" />
  </div>
  <h3 className="text-sm font-medium text-foreground mb-1">{emptyTitle}</h3>
  <p className="text-xs text-muted-foreground max-w-[280px]">{emptyHelp}</p>
</div>
```

### Initial loading (no data yet)

```tsx
<div className="flex flex-col items-center justify-center h-[400px] text-center">
  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
  <p className="text-xs text-muted-foreground">Refreshing datasets...</p>
</div>
```

### Refreshing (have data, fetching new)

Inline indicator in the header bar's left side (uses `mr-auto` to push to the left when other actions are right-aligned):

```tsx
{isRefreshing && (
  <div className="mr-auto flex items-center gap-2 text-xs text-muted-foreground">
    <Loader2 className="h-3.5 w-3.5 animate-spin" />
    Refreshing datasets...
  </div>
)}
```

Source: `client/src/app/database/page.tsx` lines 749–755, 866–886.

## Tokens dependency

This skill assumes the design-guidelines skill has already been applied to the target — the classes used here (`bg-card`, `bg-muted/60`, `text-foreground/70`, `border-border`, `text-primary`, `shadow-subtle`) only resolve correctly when the Workbench palette is wired into the target's `globals.css`. If the target's tokens differ, run the design-guidelines skill first.

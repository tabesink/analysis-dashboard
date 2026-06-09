# Audit Checklist

Walk these 10 categories top to bottom against the target's existing table view. For each finding capture: file path, line range, category, severity, current value, expected value (cite [DESIGN.md](DESIGN.md)).

## Severity rubric

- **Critical** — breaks a must-have behavior. Sticky header detaches, indeterminate state lost, leaf rows misaligned with headers, double borders between groups, virtualized list. Must be fixed before the target ships.
- **Warning** — visible drift from the canonical look. Wrong padding, wrong typography weight, wrong rounding, wrong hover color. Should be fixed.
- **Suggestion** — defensible variation. Different empty-state copy, different icon choice, different default sort field. Optional.

## 1. Stack conformance

The target must use Next.js App Router + Tailwind v4 + shadcn + Radix + lucide. Halt if any check fails.

```bash
rg -l "@import \"tailwindcss\"" --type css
rg -l "from \"@radix-ui/react-checkbox\"" --type tsx
rg -l "from \"@radix-ui/react-collapsible\"" --type tsx
rg -l "from \"lucide-react\"" --type tsx
rg --files -g "tailwind.config.*"   # should be empty
rg --files -g "app/layout.tsx" -g "src/app/layout.tsx"   # should find one
```

| Severity | Check | Failure |
|----------|-------|---------|
| Critical | Tailwind v4 import present | `@import "tailwindcss"` missing |
| Critical | No `tailwind.config.*` | v3 config file exists |
| Critical | Radix Checkbox available | not installed |
| Critical | Radix Collapsible available | not installed |
| Critical | shadcn `Card`, `Button`, `Checkbox`, `DropdownMenu`, `Popover` exist in `components/ui/` | any missing |

## 2. Card chrome + scroll container

```bash
rg "rounded-r-lg rounded-l-none" --type tsx
rg "overflow-hidden shadow-subtle border py-0" --type tsx
rg "minWidth.*totalRowWidth|minWidth.*total.*Width" --type tsx
```

| Severity | Check | Expected (per DESIGN.md §1) |
|----------|-------|------------------------------|
| Critical | Card uses `flex flex-col gap-0 overflow-hidden ... py-0` | as specified |
| Critical | `CardContent` uses `flex-1 min-h-0 overflow-auto p-0` | as specified |
| Critical | Inner div sets `minWidth: totalRowWidth` so header + rows scroll together | present |
| Warning  | Card `rounded-r-lg rounded-l-none` (when adjacent to side panel) | both classes present |
| Warning  | Card `shadow-subtle border` | not `shadow-md`, not borderless |

## 3. Sticky header + horizontal-scroll wrapping

```bash
rg "sticky top-0 z-10" --type tsx
rg "bg-card text-xs font-semibold text-foreground/70" --type tsx
```

| Severity | Check | Expected (per DESIGN.md §2) |
|----------|-------|------------------------------|
| Critical | Header has `sticky top-0 z-10 ... bg-card` | as specified |
| Critical | Header sits **inside** the inner `minWidth` div, not above it | placed correctly |
| Warning  | Header text uses `text-xs font-semibold text-foreground/70` | not `font-bold`, not `text-sm` |
| Warning  | First header cell wraps in `relative flex items-center gap-2 shrink-0 pl-1` | as specified |

## 4. Group / subgroup / leaf row classes

```bash
rg "py-2 px-3 border-t border-b bg-muted/60" --type tsx     # group
rg "py-1.5 px-3 border-b hover:bg-muted/30" --type tsx      # subgroup + leaf
rg "size-3.5.*ChevronDown|ChevronDown.*size-3.5" --type tsx # group chevron
rg "size-3 .*ChevronDown|ChevronDown.*size-3 " --type tsx   # subgroup chevron
```

| Severity | Check | Expected (per DESIGN.md §3) |
|----------|-------|------------------------------|
| Critical | Group row class string matches verbatim | as specified |
| Critical | Subgroup + leaf row classes match verbatim | as specified |
| Critical | First-group `-mt-px` cancels doubled top border under header | present |
| Warning  | Group label is `text-xs font-semibold text-foreground` | not `font-bold` |
| Warning  | Subgroup label is `text-xs font-medium text-foreground` | not `font-semibold` |
| Warning  | Leaf label is `text-xs text-muted-foreground truncate` with `title=` for tooltip | as specified |
| Warning  | Group chevron `size-3.5`, subgroup chevron `size-3` | not the same size |
| Warning  | Total counts shown as `({n})` next to label | present |

## 5. Indent math + indent-aware first-cell width

This is the **most commonly missed** detail when porting. Without it, leaf rows misalign with the header columns.

```bash
rg "ROW_PADDING_X_PX|ml-6 border-l|ml-5 border-l" --type tsx
rg "subgroupRowFirstCellWidth|leafRowFirstCellWidth" --type tsx
```

| Severity | Check | Expected (per DESIGN.md §4) |
|----------|-------|------------------------------|
| Critical | `ROW_PADDING_X_PX = 12` constant present and matches `px-3` rows | as specified |
| Critical | `SUBGROUP_INDENT_PX = 24 + 1` (3-level only) | as specified |
| Critical | `LEAF_INDENT_PX = 20 + 1` | as specified |
| Critical | First cell at each level uses `style={{ width: <levelWidth> }}` derived from constants | computed correctly |
| Critical | `ml-6 border-l border-border` wraps subgroup list (3-level) | present |
| Critical | `ml-5 border-l border-border` wraps leaf list | present |

## 6. Single-boundary rule (no double borders between groups)

```bash
rg "suppressLastRowBorder|isProgramTailEvent|versionRowIsProgramTail|isLastGroup|isGroupTail" --type tsx
```

| Severity | Check | Expected (per DESIGN.md §5) |
|----------|-------|------------------------------|
| Critical | Tail-row detection logic exists for both subgroup-collapsed and leaf-expanded cases | both branches handled |
| Critical | `border-b-0` applied to tail row when `!isLastGroup` | present |
| Warning  | Last group keeps its `border-b` (it IS the bottom of the table) | not suppressed |

## 7. Indeterminate checkbox primitive

```bash
rg "CheckboxPrimitive.Root" --type tsx
rg "data-state=\"indeterminate\"|data-\\[state=indeterminate\\]" --type tsx
rg "Minus.*size-3|size-3.*Minus" --type tsx
```

| Severity | Check | Expected (per DESIGN.md §6) |
|----------|-------|------------------------------|
| Critical | Uses Radix `CheckboxPrimitive.Root` directly, not the shadcn `Checkbox` wrapper | direct primitive |
| Critical | `data-state` switched between `indeterminate | checked | unchecked` | present |
| Critical | `checked` prop literally `'indeterminate'` (string) when indeterminate | as specified |
| Critical | `Minus` icon for indeterminate, `Check` icon for checked | both present |
| Critical | `onClick={(e) => e.stopPropagation()}` to prevent collapsible toggle | present |
| Warning  | Class string includes `data-[state=checked]:bg-primary/90 data-[state=indeterminate]:bg-primary/90` | both states styled |
| Warning  | Checkbox is `size-3.5 rounded-[3px]` | not `size-4`, not `rounded-md` |

## 8. Column controls

### 8a. Resize handle

```bash
rg "cursor-col-resize" --type tsx
rg "ColumnResizeHandle" --type tsx
```

| Severity | Check | Expected (per DESIGN.md §7) |
|----------|-------|------------------------------|
| Critical | Handle is `absolute top-0 right-0 h-full w-1.5 cursor-col-resize` | as specified |
| Critical | Drag locks `document.body.style.cursor` and `userSelect`, restores on cleanup | both restored |
| Warning  | Inner stripe is `w-px bg-border/70 group-hover:bg-primary/70`, swaps to `w-0.5 bg-primary` while dragging | as specified |
| Warning  | Min/max clamp `[60, 600]` (or similar configurable bounds) | clamped |

### 8b. Visibility popover

```bash
rg "Column Visibility" --type tsx
rg "columns visible" --type tsx
```

| Severity | Check | Expected (per DESIGN.md §8) |
|----------|-------|------------------------------|
| Critical | Rollup column is excluded from the toggle list | excluded |
| Critical | "At least one column must be visible" guard present | enforced |
| Warning  | Trigger is `Button variant="outline" size="sm" h-8 rounded-lg px-3 gap-2` with `Columns` icon | as specified |
| Warning  | Popover content `w-56 p-3 align="end"`, list wrapped in `bg-muted/70 rounded-md p-2` | as specified |

### 8c. Filter dropdown

```bash
rg "DropdownMenuCheckboxItem" --type tsx
rg "FilterIcon" --type tsx
```

| Severity | Check | Expected (per DESIGN.md §9) |
|----------|-------|------------------------------|
| Critical | Filter icon tints `text-primary` when at least one value is checked | conditional class |
| Critical | Trigger has `onClick={(e) => e.stopPropagation()}` to not fire sort | present |
| Warning  | DropdownMenuContent `w-48 max-h-[280px] overflow-y-auto rounded-lg shadow-lg` | as specified |
| Warning  | Items use `text-xs` | as specified |

### 8d. Sort

```bash
rg "ArrowUpIcon|ArrowDownIcon" --type tsx
```

| Severity | Check | Expected (per DESIGN.md §10) |
|----------|-------|-------------------------------|
| Critical | Arrow shown only on active sort field | conditional render |
| Warning  | Arrow uses `size={10}` and `text-primary shrink-0` wrapper | as specified |
| Warning  | Click on already-active field toggles direction; click on new field defaults to `desc` | both behaviors present |

## 9. Rollup badge (presence + priority + class mapping)

```bash
rg "rollupByPriority|rollUpStatus|STATUS_PRIORITY" --type tsx --type ts
rg "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" --type tsx
```

| Severity | Check | Expected (per DESIGN.md §11) |
|----------|-------|-------------------------------|
| Critical | Rollup logic walks priority list, falls back to single-value or first-value | as specified |
| Critical | Rollup renders at the rollup level (subgroup in 3-level, group in 2-level), **not** at leaf rows | leaf row leaves cell empty |
| Warning  | Pill class string matches verbatim | as specified |
| Warning  | Class map exists for each priority value (`Approved → green`, `Obsolete → red`, default → amber, etc.) | mapped |

## 10. Empty / loading / refreshing states

```bash
rg "h-16 w-16 rounded-full bg-muted" --type tsx
rg "Loader2.*animate-spin" --type tsx
rg "Refreshing" --type tsx
```

| Severity | Check | Expected (per DESIGN.md §12) |
|----------|-------|-------------------------------|
| Critical | Empty state has icon container `h-16 w-16 rounded-full bg-muted`, title `text-sm font-medium`, helper `text-xs text-muted-foreground max-w-[280px]` | as specified |
| Critical | Initial loading uses `Loader2 h-8 w-8 animate-spin text-muted-foreground` centered in `h-[400px]` | as specified |
| Critical | Refreshing-with-data is an inline indicator inside the header bar (`Loader2 h-3.5 w-3.5`) | inline, not blocking |
| Warning  | Empty / loading / refreshing copy is concise (≤1 short sentence each) | concise |

## Reporting template

Use this exact format for the audit report you produce in Phase 2A:

```markdown
## Audit Report: <project name>

### Summary
- Critical: N findings
- Warning: N findings
- Suggestion: N findings

### Findings by Category

#### 1. Stack conformance
| #    | Severity | File         | Line | Current        | Expected        |
|------|----------|--------------|------|----------------|-----------------|
| 1.1  | Critical | tailwind.config.ts | 1 | v3 config | Tailwind v4 `@theme inline` |

#### 2. Card chrome + scroll container
| ... |

#### 3. Sticky header
...
```

Number findings `<category>.<n>` so the Phase 3 plan can cite them by ID.

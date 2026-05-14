---
name: database-table skill
overview: Create a Cursor skill at `docs/templates/database-table/` that lets a coding agent reproduce this app's hierarchical database-table card in another Next.js + Tailwind v4 + shadcn target, supporting both scaffold and audit-and-align workflows, with neutral-named template files for 2-level and 3-level hierarchies and all 12 canonical behaviors as must-have.
todos:
  - id: scaffold_dirs
    content: Create docs/templates/database-table/ and docs/templates/database-table/templates/ directories
    status: completed
  - id: skill_md
    content: Write SKILL.md with frontmatter, 5-phase workflow (scaffold + audit branches), variant picker, and parameter table
    status: completed
  - id: design_md
    content: Write DESIGN.md capturing layout classes, indent math, single-boundary rule, all 12 canonical behaviors with citations to client/src files
    status: completed
  - id: audit_md
    content: Write AUDIT.md with 10 categories, ripgrep recipes, and severity rubric
    status: completed
  - id: refactor_md
    content: Write REFACTOR.md with ordered playbook (foundation first) and before/after recipes per category
    status: completed
  - id: tokens_md
    content: Write tokens.md naming the spacing constants (ROW_PADDING_X_PX, VERSION_INDENT_PX, LEAF_INDENT_PX, MIN/MAX_COLUMN_PX, PROGRAM_ID_DEFAULT_PX)
    status: completed
  - id: tpl_types
    content: Create templates/types.ts with neutral Group/Subgroup/Leaf/ColumnDef/RollupConfig types
    status: completed
  - id: tpl_three_level
    content: Create templates/HierarchicalTable.three-level.tsx ported from DatabaseEventTree.tsx with neutral names + generalized rollup column
    status: completed
  - id: tpl_two_level
    content: Create templates/HierarchicalTable.two-level.tsx by collapsing the 3-level template (drop inner Collapsible)
    status: completed
  - id: tpl_resize
    content: Create templates/ColumnResizeHandle.tsx as a verbatim port
    status: completed
  - id: tpl_indet
    content: Create templates/IndeterminateCheckbox.tsx extracted from DatabaseEventTree lines 108-136
    status: completed
  - id: tpl_rollup
    content: Create templates/rollup.ts with rollupByPriority<T> generalized from rollUpStatusFromValues + getStatusBadgeClassName
    status: completed
  - id: tpl_page
    content: Create templates/TablePage.example.tsx distilled from app/database/page.tsx (sticky header, sort/filter/visibility wiring, batch delete bar, empty/loading/refreshing states, indent math constants)
    status: completed
  - id: tpl_columns
    content: Create templates/columns.example.ts showing the ColumnDef[] parameterization shape with two example columns
    status: completed
isProject: false
---

# Database-Table Skill Plan

## Decisions captured

- **Workflow**: both scaffold AND audit-and-align (5-phase, decided in Phase 1 discovery)
- **Scope**: just the hierarchical data-table card (sticky header, tree, column controls, batch select bar, empty/loading states). Headers/columns are parameterized per target.
- **Hierarchy depth**: ship two ready-made variants — 2-level and 3-level
- **Target stack**: must be Next.js App Router + Tailwind v4 (`@theme inline`) + shadcn + Radix + lucide-react. If not, halt with a blocker report (mirrors the design-guidelines skill).
- **Template style**: neutral names — `HierarchicalTable`, `Group`/`Subgroup`/`Leaf` terminology
- **Must-have behaviors** (all 12): indeterminate batch checkboxes, collapsible groups, indent-aware first-cell width math, sticky header, column resize, column visibility popover, per-column filter dropdown, per-column sort, rollup column (priority-list-driven, generalized from status), single-line group boundaries, centered empty state, inline + centered loading states

## Where the skill lives

Primary location: `docs/templates/database-table/` (matches user request).

Note: Cursor's auto-discovery scans `.cursor/skills/`. If the user later wants auto-activation by description match, we can add a thin `.cursor/skills/database-table/SKILL.md` that re-exports the docs path. For now, the user will activate by path reference.

## File tree to create

```
docs/templates/database-table/
  SKILL.md                       # frontmatter + 5-phase workflow + variant picker
  DESIGN.md                      # canonical visual + behavior spec, with annotated tokens
  AUDIT.md                       # 9-category checklist + ripgrep recipes
  REFACTOR.md                    # ordered playbook (scaffold path AND audit path)
  tokens.md                      # spacing constants (indent math, padding, widths)
  templates/
    types.ts                       # Row/Group/ColumnDef/RollupConfig types
    HierarchicalTable.three-level.tsx
    HierarchicalTable.two-level.tsx
    ColumnResizeHandle.tsx         # verbatim port (no domain)
    IndeterminateCheckbox.tsx      # extracted from DatabaseEventTree
    rollup.ts                      # generalized priority-rollup utility
    TablePage.example.tsx          # full page wiring (header bar, sort, filter, batch delete)
    columns.example.ts             # example ColumnDef[] showing parameterization shape
```

## SKILL.md shape

Frontmatter (so Cursor can match by description):

```markdown
---
name: database-table
description: Reproduce the Multimatic Workbench hierarchical database-table card (2 or 3 level Group>Subgroup>Leaf tree, sticky header, column resize/sort/filter/visibility, indeterminate batch select, rollup badge, single-line group boundaries) in another Next.js + Tailwind v4 + shadcn app. Use when the user wants to add a hierarchical data table, port the database table look, audit an existing table for drift, or mentions "database table", "hierarchical tree table", or "group expand table".
---
```

Then five phases (mirrors the design-guidelines skill so the two skills compose):

1. **Discovery** — confirm stack (rg `@import "tailwindcss"` + Radix + lucide), confirm 2 vs 3 level hierarchy in target data, decide scaffold vs audit-and-align
2. **Audit** (audit-only path) — walk `AUDIT.md` categories, produce findings table
3. **Plan** — pick variant, fill the parameter table, list before/after edits
4. **Approval** — present plan, wait for explicit go-ahead
5. **Execute** — copy templates, rename neutral identifiers per parameter table, wire to target's data hook

Includes a **parameter table** the agent fills before Execute:

```
| Param                   | This repo example                  | Target value      |
|-------------------------|------------------------------------|-------------------|
| LEVEL_1_LABEL           | Program ID                         | ?                 |
| LEVEL_2_LABEL (3-level) | Version                            | ?                 |
| LEAF_LABEL              | Event                              | ?                 |
| ROW_TYPE                | DatasetInfo                        | ?                 |
| GROUP_KEY               | program_id                         | ?                 |
| SUBGROUP_KEY (3-level)  | version                            | ?                 |
| LEAF_ID_KEY             | event_id                           | ?                 |
| ROLLUP_FIELD            | status                             | ? (or none)       |
| ROLLUP_PRIORITY         | [Obsolete, Pending, Approved]      | ?                 |
| COLUMN_DEFS             | suspension_component, axle...      | ?                 |
| DATA_HOOK               | useUploadedDatasets                | ?                 |
| SUMMARY_HOOK            | programVersions from same hook     | ?                 |
```

## Source-to-template mapping

Each template file is derived from a real file in this repo. The skill cites the source for traceability:

- `templates/HierarchicalTable.three-level.tsx` ← [client/src/components/upload/DatabaseEventTree.tsx](client/src/components/upload/DatabaseEventTree.tsx) (rename Program/Version/Event → Group/Subgroup/Leaf, drop status-specific naming, keep priority rollup as `rollupValue`)
- `templates/HierarchicalTable.two-level.tsx` ← same source, collapsed by removing the inner Collapsible loop and merging Subgroup → Group
- `templates/ColumnResizeHandle.tsx` ← [client/src/components/upload/ColumnResizeHandle.tsx](client/src/components/upload/ColumnResizeHandle.tsx) verbatim
- `templates/IndeterminateCheckbox.tsx` ← extracted from `DatabaseEventTree.tsx` lines 108–136
- `templates/rollup.ts` ← generalized from [client/src/lib/status-badge.ts](client/src/lib/status-badge.ts) + the `rollUpStatusFromValues` helper. Signature: `rollupByPriority<T extends string>(values: T[], priority: T[], classNameFor: (v: T) => string)`
- `templates/TablePage.example.tsx` ← distilled from [client/src/app/database/page.tsx](client/src/app/database/page.tsx) lines 587–893 (sticky header, sort/filter/visibility wiring, batch delete bar, empty + loading + refreshing states, indent math constants)
- `templates/columns.example.ts` ← distilled from `staticColumnDefinitions` + `dynamicMetadataColumns` patterns
- `templates/types.ts` ← distilled from the `DatasetInfo`, `ProgramVersionSummary`, `ColumnDef` types

## DESIGN.md content

Annotated specification (no narration, just facts the agent can verify):

- **Layout**: card with `rounded-r-lg rounded-l-none flex flex-col gap-0 overflow-hidden shadow-subtle border py-0`, header bar `shrink-0 flex items-center justify-end gap-2 px-4 py-3 border-b`, scroll body `flex-1 min-h-0 overflow-auto p-0`, inner `<div style={{ minWidth: totalRowWidth }}>` so header + rows share one horizontal scroll
- **Sticky header**: `sticky top-0 z-10 ... bg-card text-xs font-semibold text-foreground/70`
- **Group row** (level 1): `py-2 px-3 border-t border-b bg-muted/60 hover:bg-muted/70`, chevron `size-3.5`, label `text-xs font-semibold`
- **Subgroup row** (level 2, 3-level only): `py-1.5 px-3 border-b hover:bg-muted/30`, indent `ml-6 border-l border-border`, chevron `size-3`, label `text-xs font-medium`
- **Leaf row**: `py-1.5 px-3 border-b hover:bg-muted/30 group`, indent `ml-5 border-l border-border`, value cells `text-xs text-foreground/80 truncate`
- **Indent math** (the alignment trick that survives porting):
  - `ROW_PADDING_X_PX = 12` (matches `px-3`)
  - `VERSION_INDENT_PX = 24 + 1` (ml-6 + 1px border-l)
  - `LEAF_INDENT_PX = 20 + 1` (ml-5 + 1px border-l)
  - First-cell width per level = `firstColumnWidth - paddingX - sum(indents above)`
- **Single boundary rule**: when a group is followed by another group, the previous group's last visible row drops `border-b` so only the next group's `border-t` paints the boundary. See `suppressLastRowBorder` + `versionRowIsProgramTail` + `isProgramTailEvent` in source
- **Indeterminate checkbox**: Radix `CheckboxPrimitive.Root` with `data-state` switched between `checked | indeterminate | unchecked`, `Minus` icon for indeterminate, `Check` for checked, click event stopped to prevent collapsible toggle
- **Column resize**: 1.5px wide handle pinned `absolute top-0 right-0`, `cursor-col-resize`, drag updates clamped to `[60, 600]`
- **Column visibility**: shadcn Popover + Checkbox list, "at least one column must be visible" guard
- **Per-column filter**: shadcn DropdownMenu with `DropdownMenuCheckboxItem` per unique value, filter icon tinted `text-primary` when active
- **Per-column sort**: button with `ArrowUp`/`ArrowDown` (size 10) shown only on active sort field
- **Rollup badge**: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium`, className from priority lookup (priority list `Obsolete > Pending > Approved` is replaced by target's list)
- **Empty state**: `h-16 w-16 rounded-full bg-muted` icon container, `text-sm font-medium` heading, `text-xs text-muted-foreground max-w-[280px]` helper
- **Loading**: inline `Loader2 h-3.5 w-3.5 animate-spin` in header bar; centered `Loader2 h-8 w-8` over the empty body when no data yet
- **Tokens**: cites design-guidelines `theme.css` for color/typography. Skill assumes the design-guidelines skill has already been applied (or runs alongside it).

## AUDIT.md categories

1. Stack conformance (Next.js App Router, Tailwind v4 `@theme inline`, shadcn `components/ui/`, lucide)
2. Card chrome + scroll container
3. Sticky header + horizontal-scroll wrapping
4. Group / subgroup / leaf row classes
5. Indent math + indent-aware first-cell width
6. Single-boundary rule (no double borders between groups)
7. Indeterminate checkbox primitive (must use Radix `CheckboxPrimitive`, not a hand-rolled checkbox)
8. Column controls (resize handle, visibility popover, filter dropdown, sort indicator)
9. Rollup badge (presence + priority list + class mapping)
10. Empty + loading + refreshing states

Each category gets ripgrep recipes and a severity rubric (Critical / Warning / Suggestion).

## REFACTOR.md ordering

Foundation first, behavior second:

1. Card chrome + scroll wrapper
2. Sticky header
3. Group/Subgroup/Leaf row scaffolding (pick 2 vs 3 level variant)
4. Indent math constants + first-cell width
5. Single-boundary rule
6. Indeterminate checkbox
7. Column resize
8. Column visibility / filter / sort
9. Rollup badge
10. Empty + loading + refreshing

## Anti-patterns (in SKILL.md)

- Don't introduce a real `<table>` element — the canonical implementation uses flex rows so column resize math stays simple. Don't change that.
- Don't replace Radix `CheckboxPrimitive` with shadcn's wrapped Checkbox; the indeterminate state needs raw `data-state="indeterminate"`.
- Don't switch to virtualized lists (react-window etc.) without an explicit user request — the canonical impl is non-virtualized, and virtualization breaks the sticky-header + indent-align contract.
- Don't auto-port domain-specific status priority. Always confirm `ROLLUP_PRIORITY` with the user during Phase 3.
- Don't refactor the target's data layer. The skill only owns presentation; data fetching is left as an integration point with two interfaces (`rows: Row[]` and `summary: GroupSummary[]`).
---
name: database-table
description: Reproduce the Multimatic Workbench hierarchical database-table card (2 or 3 level Group>Subgroup>Leaf tree, sticky header, column resize/sort/filter/visibility, indeterminate batch select, rollup badge, single-line group boundaries) in another Next.js + Tailwind v4 + shadcn app. Use when the user wants to add a hierarchical data table, port the database table look, audit an existing table for drift, or mentions "database table", "hierarchical tree table", or "group expand table".
---

# Database Table (Hierarchical Tree Card)

This skill ports the canonical database-table surface from this repo into another Next.js + Tailwind v4 + shadcn target. The canonical implementation lives in `client/src/components/upload/DatabaseEventTree.tsx` and `client/src/app/database/page.tsx`. The portable artifacts in this folder (`DESIGN.md`, `AUDIT.md`, `REFACTOR.md`, `tokens.md`, `templates/`) are derived from those files and are the source of truth for the port.

The skill owns presentation only. The target app's data-fetching, mutations, and routing are integration points — not refactor targets.

## Stack assumptions

The target app must use:

- Next.js (App Router preferred)
- Tailwind CSS v4 with `@theme inline` in a global stylesheet (not a `tailwind.config.js`)
- shadcn primitives in `components/ui/` built on Radix
- lucide-react for icons

If any of these fails in Phase 1, write a short blocker report and stop. Do **not** continue to Phase 2.

This skill composes with the `design-guidelines` skill — run that first (or alongside) so the target's color/typography tokens are already aligned. The table card relies on `bg-card`, `bg-muted/60`, `text-foreground/70`, etc. resolving to the Workbench palette.

## Workflow

Track progress with this checklist. The branch picked in Phase 1 (Scaffold or Audit) determines what Phases 2–5 do.

```
- [ ] Phase 1: Discovery (stack + data shape + branch)
- [ ] Phase 2: Audit (audit branch only) OR Inventory (scaffold branch)
- [ ] Phase 3: Plan (variant pick + parameter table + edit list)
- [ ] Phase 4: Approval
- [ ] Phase 5: Execute
```

### Phase 1: Discovery

1. Confirm stack with ripgrep:

   ```bash
   rg -l "@import \"tailwindcss\"" --type css
   rg -l "from \"@radix-ui" --type tsx
   rg -l "from \"lucide-react\"" --type tsx
   ```

   If `tailwind.config.*` exists, flag as a stack mismatch and halt.

2. Confirm hierarchy depth in the target's data:
   - **2 levels** = Group > Leaf (e.g. Customer > Order, Project > Task)
   - **3 levels** = Group > Subgroup > Leaf (e.g. Program > Version > Event)

   If the target doesn't have natural grouping, ask the user whether to introduce one or use a flat-table skill instead. Halt if neither path is acceptable.

3. Pick the branch:
   - **Scaffold** — target has no comparable table view. Skill creates new files only.
   - **Audit-and-align** — target has an existing table view with drift. Skill produces an audit report + refactor plan that touches existing files.

   If unclear, ask the user.

### Phase 2A: Audit (audit branch)

Read [AUDIT.md](AUDIT.md) and walk every category top to bottom. For each finding capture:

- File path and line range
- Category (one of the 10 in AUDIT.md)
- Severity: **Critical** / **Warning** / **Suggestion**
- Current value (the offending snippet)
- Expected value (cite the relevant token or pattern from [DESIGN.md](DESIGN.md))

Produce the audit report using this template:

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
| 1.1  | Critical | tailwind.config.ts | 1    | v3 config | Tailwind v4 `@theme inline` |
```

Do not propose fixes yet. Hand the report to Phase 3.

### Phase 2B: Inventory (scaffold branch)

Locate the target file paths the new table will live at:

- Page route (e.g. `app/<route>/page.tsx`)
- Component directory (e.g. `components/<feature>/`)
- The data hook(s) the page will use (existing or to-be-created)

Confirm the target already has the shadcn primitives the templates import: `Button`, `Card`, `Checkbox`, `DropdownMenu`, `Popover`. If any are missing, list them as setup prerequisites for the user.

### Phase 3: Plan

Pick the variant:

- **Two-level**: `templates/HierarchicalTable.two-level.tsx`
- **Three-level**: `templates/HierarchicalTable.three-level.tsx`

Fill the parameter table — the agent commits to these values before any file is written:

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
| ROLLUP_CLASS_MAP        | Approved=green, Obsolete=red, *=amber | ?              |
| COLUMN_DEFS             | suspension_component, axle_location, ... | ?           |
| DATA_HOOK               | useUploadedDatasets                | ?                 |
| SUMMARY_HOOK            | programVersions field on hook      | ?                 |
```

Then produce the plan as either:

- **Scaffold plan**: ordered list of new files to create, each citing which template it derives from
- **Refactor plan**: ordered list of files to edit, grouped by [REFACTOR.md](REFACTOR.md)'s 10-category sequence (foundation first), each citing which audit finding it resolves

For each plan item include:

- File path
- Before / after snippet (small diff sketch)
- Verify check (e.g. "no visual regression in `/route`", "all 12 must-have behaviors present per AUDIT.md", "axe reports no new violations")

### Phase 4: Approval

Present the audit report (if applicable) **and** the plan to the user. Ask which findings/files to apply:

- All
- By category (e.g. "all of category 1, 2, 3")
- By severity (e.g. "all Critical, none of Warning/Suggestion")
- By individual finding number

Wait for explicit approval. Do not begin Phase 5 without it.

### Phase 5: Execute

Apply the approved changes file-by-file in the working tree. After each file:

- Show the diff
- Note which audit findings or plan items are now resolved

Do **not** auto-commit. Do **not** open a PR. Leave the working tree dirty for the user to review and commit themselves.

When done, print the final summary:

```
Refactor complete.
- Plan items applied: N
- Items deferred (need user input): N
- Files changed: N
```

## Variant picker

| If the target has...                                    | Use                                  |
|---------------------------------------------------------|--------------------------------------|
| One natural grouping key (Customer, Project, ...)       | `HierarchicalTable.two-level.tsx`    |
| Two nested grouping keys (Program > Version, ...)       | `HierarchicalTable.three-level.tsx`  |
| No grouping (flat list)                                 | Don't use this skill                 |
| 4+ nested groupings                                     | Don't use this skill (out of scope)  |

## Reference files

Read these when their phase calls for them. Keep references one level deep:

- [DESIGN.md](DESIGN.md) — canonical layout, classes, and behavior spec. Read in Phase 2 (to know expected values) and Phase 3 (to cite roles in plan items).
- [AUDIT.md](AUDIT.md) — 10-category audit checklist with severity criteria and ripgrep recipes. Read in Phase 2A.
- [REFACTOR.md](REFACTOR.md) — ordered refactor playbook with before/after recipes per category. Read in Phase 3.
- [tokens.md](tokens.md) — named spacing constants the indent math depends on. Copy verbatim during Phase 5.
- [templates/](templates/) — the actual code to copy. See [templates/types.ts](templates/types.ts) for the data-shape contract the page must satisfy.

## Anti-patterns

Do not:

- Introduce a real `<table>` element. The canonical implementation uses flex rows so column-resize math stays simple. Don't change that.
- Replace Radix `CheckboxPrimitive` with shadcn's wrapped `Checkbox` for the tree's batch-select checkboxes. The indeterminate state needs raw `data-state="indeterminate"` and a stopped click event to avoid toggling the surrounding `Collapsible`.
- Switch to virtualized lists (`react-window`, `react-virtual`, etc.) without an explicit user request. Virtualization breaks the sticky-header + indent-align contract. If the user asks for it, surface as a deferred item and stop.
- Auto-port domain-specific status priority. Always confirm `ROLLUP_PRIORITY` and `ROLLUP_CLASS_MAP` with the user during Phase 3.
- Refactor the target's data layer. The skill only owns presentation. Data fetching is integrated through two interfaces: `rows: Row[]` (current page) and `summary: GroupSummary[]` (full-database aggregate that drives the tree skeleton).
- Skip Phase 4. The user must approve before any file is edited.
- Drop the indent-math constants in favor of "looks close enough" indentation. The first-cell width subtract trick is what keeps data columns aligned across levels — without it the table looks broken on the leaf rows.

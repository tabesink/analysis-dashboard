# Agent Handoff — Table UI Port

**Read this first.** Scope: [prd.md](./prd.md)

---

## Your mission

Document and optionally port the **canartdb-ui table UI** into another app. Preserve visual parity with the reference. Do not refactor the reference's domain model unless the target app requires different field names.

---

## Quick start checklist

```
[ ] 1. Read prd.md, ARCHITECTURE.md, and pick variant (flex vs Handsontable vs both)
[ ] 2. Confirm target stack (Next.js, Tailwind v4, shadcn, React Query)
[ ] 3. Run refresh-references.sh if local copies may be stale
[ ] 4. Copy components from reference/canartdb-ui/ (adjust import paths)
[ ] 5. Install deps (see HANDSONTABLE_GUIDE.md if using spreadsheet)
[ ] 6. Implement API adapter matching types in reference/canartdb-ui/src/types/database.ts
[ ] 7. Wire a page using reference page.tsx patterns
[ ] 8. Verify against VISUAL_SPEC.md and HANDSONTABLE_GUIDE.md checklists
```

---

## Pick your variant first

| Need | Read | Copy from |
|------|------|-----------|
| Flat list + sort + pagination + batch delete | VISUAL_SPEC.md § Flat | `CertificateFlatTable.tsx` |
| 2-level tree (Group → Leaf) + lazy children | VISUAL_SPEC.md § Hierarchy | `CertificatePagesTable.tsx` |
| In-cell edit spreadsheet + save diff | HANDSONTABLE_GUIDE.md | `TableResultsEditor.tsx` |
| CSV repair with validation | HANDSONTABLE_GUIDE.md § Fix mode | `FailedPageEditor.tsx` |
| All of the above (full canartdb flow) | ARCHITECTURE.md | All three page routes under `app/database/` |

---

## File creation order (recommended)

| Step | Action | Source |
|------|--------|--------|
| 1 | Copy shared primitives | `ColumnResizeHandle.tsx`, optionally `IndeterminateCheckbox.tsx` |
| 2 | Copy table shell | `CertificateFlatTable.tsx` or `CertificatePagesTable.tsx` |
| 3 | Parameterize column defs | Replace `DATA_COLUMNS` / `CANONICAL_COLUMNS` with target domain |
| 4 | Copy data hooks | `use-certificate-hierarchy.ts`, `use-table-results.ts`, `use-certificate-batch-save.ts` |
| 5 | Copy API client | `lib/api/database.ts` — adapt base URL / auth |
| 6 | Copy spreadsheet editor | `TableResultsEditor.tsx` + import Handsontable CSS once per app |
| 7 | Wire page | `app/database/page.tsx` pattern — URL params for sort/page state |
| 8 | Wire detail + edit routes | certificate + table pages |

---

## Non-negotiables — flex tables

From `reference/database-table-skill/DESIGN.md`:

- **No `<table>` element** — flex rows only, so column-resize math stays simple.
- **Sticky header** uses `sticky top-0 z-10 bg-card` inside a `min-h-0 overflow-auto` scroll container.
- **Column width** via `flex: ${basis} 0 ${basis}px` — copy `flexFor()` verbatim.
- **Indent math** — leaf rows use `pl-[20px] border-l border-border`; do not round indent constants (see `tokens.md`).
- **Group row** background: `bg-muted/60 hover:bg-muted/70`.
- **Leaf row** hover: `hover:bg-muted/30`.

---

## Non-negotiables — Handsontable editors

- Import CSS once: `import 'handsontable/styles/handsontable.min.css'`
- Call `registerAllModules()` once per editor module (or extract to shared init).
- Use `afterChange` with `source === 'loadData'` guard — prevents feedback loops.
- Keep stable refs (`rowsRef`) in complex editors to avoid remounting the grid.
- Local edit buffer pattern: server rows → user edits → `diffRows()` → batch PUT.

---

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Sticky header scrolls away | Parent missing `min-h-0`; CardContent needs `flex-1 min-h-0 overflow-auto` |
| Columns misaligned at leaf level | First-cell width must subtract indent px from level-1 width |
| Handsontable resets on every keystroke | Don't pass inline `afterChange`; use refs or `useCallback` with stable deps |
| Save sends full row set | Use patch diff (`BatchChange[]`) like `diffRows()` in table page |
| shadcn Checkbox in Collapsible tree | Use `IndeterminateCheckbox` with `stopPropagation` on click |

---

## Refresh references

```bash
bash docs/brainstorm/18_table_ui/scripts/refresh-references.sh
```

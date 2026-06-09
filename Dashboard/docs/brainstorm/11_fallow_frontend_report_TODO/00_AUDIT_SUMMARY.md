# Fallow Frontend Audit — Raw Summary

**Tool:** Fallow v2.89.0  
**Command:** `npx fallow --format markdown` (full codebase, not changed-since)  
**Root:** `Dashboard/client/`  
**Date:** 2026-06-08

## Verdict

```
Failed: dead-code (193 issues), dupes (31 clone groups), health (137 above threshold)
Start with: src/components/ui/button-group.tsx
```

## Vital signs

| Metric | Value |
|--------|------:|
| Total LOC | 24,623 |
| Avg Cyclomatic | 2.2 |
| P90 Cyclomatic | 4 |
| Dead Files | 5.7% |
| Dead Exports | 25.5% |
| Maintainability (avg) | 90.4 |
| Hotspots (6 months) | 0 |
| Circular Deps | 0 |
| Unused Deps | 3 |
| Duplication | 7.5% (1,779 lines across 27 files) |

## Dead code (193 issues)

### Unused files (12)

- `src/components/dashboard/index.ts`
- `src/components/layout/NavDocuments.tsx`
- `src/components/layout/index.ts`
- `src/components/ui/avatar.tsx`
- `src/components/ui/button-group.tsx`
- `src/components/ui/pagination.tsx`
- `src/components/ui/sheet.tsx`
- `src/lib/chart-utils/index.ts`
- `src/lib/utils/index.ts`
- `src/lib/utils/partition-sync.ts`
- `src/stores/index.ts`
- `src/types/index.ts`

### Unused dependencies (3)

- `@hookform/resolvers`
- `react-hook-form`
- `zod`

### Unused exports (126) and unused type exports (52)

See per-issue files for scoped cleanup. Highest dead-code % files:

| File | Dead code % |
|------|------------:|
| `src/hooks/use-filter-selection-sync.ts` | 100% |
| `src/components/ui/sheet.tsx` | 100% |
| `src/components/ui/pagination.tsx` | 100% |
| `src/components/ui/button-group.tsx` | 100% |
| `src/components/ui/avatar.tsx` | 100% |
| `src/components/shared/EmptyState.tsx` | 100% |
| `src/components/shared/ErrorBoundary.tsx` | 100% |
| `src/config/filters.ts` | 86% |
| `src/components/ui/shadcn-io/color-picker.tsx` | 75% |
| `src/config/version.ts` | 67% |
| `src/lib/chart-utils/canvas-renderer.ts` | 71% |

## Duplication (31 clone groups)

### Highest-impact families

| Family | Lines | Files | Recommendation |
|--------|------:|-------|----------------|
| 10 | 494 | `HierarchicalEventTree.tsx`, `DatabaseEventTree.tsx` | Extract shared event-tree module |
| 3 | 164 | `database/page.tsx`, `inspect-damage/page.tsx` | Extract shared table page utilities |
| 5 | 42 | `InteractiveCanvasPlot.tsx`, `SVGPlot.tsx` | Extract shared plot setup |
| 17 | 51 | `binary-decoder.ts`, `binary-decode.worker.ts` | Share decode logic |
| 18 | 41 | `api.ts`, `upload.ts` | Consolidate type shapes |
| 1 | 18 | 3× `error.tsx` route files | Shared error boundary component |

Full clone group listing (31 groups) is in the Fallow markdown output captured during this audit.

## Complexity hotspots (top 10 by CRAP)

| File | Function | Cyclomatic | Cognitive | CRAP | Lines |
|------|----------|----------:|----------:|-----:|------:|
| `DatabaseOperationModal.tsx:477` | `renderImportProgress` | 72 | 73 | 5256 | 191 |
| `database/edit/page.tsx:181` | `FilterValuesPage` | 68 | 44 | 4692 | 1147 |
| `DatabaseOperationModal.tsx:151` | `DatabaseOperationModal` | 61 | 60 | 3782 | 841 |
| `DatabaseOperationModal.tsx:339` | `renderExportProgress` | 56 | 53 | 3192 | 137 |
| `database/edit/page.tsx:373` | `<arrow>` | 24 | 11 | 600 | 91 |
| `UploadDataSection.tsx:45` | `UploadDataSection` | 23 | 20 | 552 | 349 |
| `DatabaseOperationModal.tsx:743` | `renderImportConfirm` | 19 | 21 | 380 | 122 |
| `use-database-operation.ts:380` | `confirmImport` | 18 | 19 | 342 | 135 |
| `database/page.tsx:699` | `handleDeleteSelected` | 17 | 22 | 306 | 77 |
| `settings/users/page.tsx:119` | `SettingsUsersPage` | 17 | 16 | 306 | 499 |

## Refactoring targets (Fallow-ranked)

| Efficiency | Category | File | Recommendation |
|-----------:|----------|------|----------------|
| 23.7 | dead code | `button-group.tsx` | Remove 4 unused exports (100% dead file) |
| 22.6 | dead code | `avatar.tsx` | Remove 3 unused exports (100% dead file) |
| 13.1 | dead code | `color-picker.tsx` | Remove 9 unused exports (75% dead) |
| 9.1 | complexity | `PlotGrid.tsx` | Extract `calculateRawAxisLimits` (cognitive 38) |
| 7.7 | complexity | `scales.ts` | Extract `calculateAxisLimits` (cognitive 38) |
| 7.2 | untested risk | `global-filters/utils.ts` | Add tests before modifying |
| 6.5 | complexity | `DatabaseOperationModal.tsx` | Extract render functions (cognitive 73/60) |
| 5.8 | complexity | `database/edit/page.tsx` | Extract `FilterValuesPage` (cognitive 44) |

## Notes for agents

- Fallow uses **syntactic** analysis (no type-checker). False positives are possible for dynamic imports, framework conventions, and barrel re-exports. Verify with grep and tests before deleting.
- Shadcn UI components often ship many sub-exports; only delete **entire files** when Fallow reports 100% dead file + zero imports.
- `use-filter-selection-sync.ts` is 100% dead export but the hook file itself may still be imported — verify before deletion.
- Re-run `npx fallow --format markdown` after each issue to confirm the finding count drops.

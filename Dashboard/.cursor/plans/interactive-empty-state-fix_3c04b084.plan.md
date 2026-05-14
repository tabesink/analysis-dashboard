---
name: interactive-empty-state-fix
overview: Align Interactive viewer behavior with Grid by using rendered/cached data fallback when returning to dashboard, while preserving tab state. This removes false empty states after navigation from Edit.
todos:
  - id: derive-effective-ids
    content: Add effective event-ID source in InteractiveViewer (selected first, rendered fallback).
    status: completed
  - id: fix-empty-gate
    content: Switch NoCurves gate to effective visible IDs and keep load/error precedence unchanged.
    status: completed
  - id: verify-nav-flow
    content: Test edit->dashboard return path with preserved interactive tab and side-panel visibility toggles.
    status: completed
  - id: docs-required-updates
    content: After implementation, update docs/master-build-plan.md, docs/decisions/log.md, and add docs/tasks note per AGENTS.md.
    status: completed
isProject: false
---

# Interactive Empty-State Alignment Plan

## What I verified

- The message is currently shown when `visibleEventIds.length === 0` in [InteractiveViewer](client/src/components/dashboard/interactive-viewer/InteractiveViewer.tsx), where `visibleEventIds` is derived from `allSelectedEventIds` and `curveVisibility`.
- Grid can still show plots from prior render/cached data driven by `rendered_event_ids` and render-store caches in [PlotGrid](client/src/components/dashboard/plot-grid/PlotGrid.tsx) and [useFilterState](client/src/hooks/use-filter-state.ts).
- Result: Interactive can show `No curves visible` even while Grid still displays curves.

## Implementation approach

1. In [InteractiveViewer](client/src/components/dashboard/interactive-viewer/InteractiveViewer.tsx), compute effective visibility from a fallback source:
  - Primary: `allSelectedEventIds` (current behavior).
  - Fallback when primary is empty: `renderedEventIds` (your selected behavior).
2. Update empty-state gating in Interactive:
  - Show `No curves visible` only when the **effective** visible IDs are empty.
  - Keep loading/error states unchanged.
3. Keep tab behavior unchanged (`preserve_tab`) in [dashboard page](client/src/app/dashboard/page.tsx).
4. Validate flow manually:
  - Render in Grid -> open Interactive -> go to Edit -> return to Dashboard while preserving Interactive tab -> confirm curves still display.
  - Confirm side-panel toggles still hide/show curves correctly.

## Key files

- [Interactive viewer logic](client/src/components/dashboard/interactive-viewer/InteractiveViewer.tsx)
- [Filter/session event sources](client/src/hooks/use-filter-state.ts)
- [Grid rendering source behavior](client/src/components/dashboard/plot-grid/PlotGrid.tsx)

## Expected result

- Interactive no longer appears empty in cases where Grid already has rendered/cached curves.
- `No curves visible` appears only when curves are truly filtered out/hidden, not due to selection-vs-rendered mismatch.

## Notes

- Your chosen UX is now explicit in code: Interactive falls back to rendered data continuity when current selection is empty.


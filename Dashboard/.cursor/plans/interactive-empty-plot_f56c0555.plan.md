---
name: interactive-empty-plot
overview: Replace the "No curves visible / Enable curves from the side panel" message in the interactive viewer with an empty plot rendered by InteractiveCanvasPlot using curves=[], matching the empty-state look used by the grid card while staying consistent with the populated interactive view.
todos:
  - id: edit-viewer
    content: "Edit InteractiveViewer.tsx: remove NoCurvesState branch and component, render InteractiveCanvasPlot with current curves (which collapses to [] when none visible), keep PlotLabel always, gate PinnedEventsOverlay on curves.length > 0, also collapse the redundant fallback LoadingState branch."
    status: completed
  - id: cleanup-imports
    content: Remove the LineChart import if it becomes unused after deleting NoCurvesState (it is still used by the no-plot-selected branch, so likely keep).
    status: completed
  - id: manual-verify
    content: "Manually verify: toggle all curves off in interactive view -> empty plot with axes + bottom title, no text message; toggle a curve back on -> normal render returns with PinnedEventsOverlay."
    status: completed
  - id: docs
    content: Add docs/tasks note and append to docs/decisions/log.md per AGENTS.md.
    status: completed
isProject: false
---

## Context

In [client/src/components/dashboard/interactive-viewer/InteractiveViewer.tsx](client/src/components/dashboard/interactive-viewer/InteractiveViewer.tsx), the branch at lines 155–156 renders `NoCurvesState` (defined at lines 204–219) whenever a plot is selected but `visibleEventIds.length === 0` (i.e. the user has toggled off every curve from the side panel).

The grid does it differently — in [client/src/components/charts/SVGPlotCard.tsx](client/src/components/charts/SVGPlotCard.tsx) lines 96–114 it renders `<SVGPlot curves={[]} ... renderMode="grid" />`, which produces an empty plot with axes only (the `calculateAxisLimits` helper at [client/src/lib/chart-utils/scales.ts](client/src/lib/chart-utils/scales.ts) line 80 returns a sensible default range when given no data).

`InteractiveCanvasPlot` already handles `curves=[]` safely:

- `calculateAxisLimits` returns the default empty range.
- `scaledCurves` becomes `[]`, the offscreen canvas is built empty, the spatial grid has no entries, hover lookups return nothing.
- The `SVGAxes` layer still renders with the empty-range limits — exactly what we want.

## Change

In [client/src/components/dashboard/interactive-viewer/InteractiveViewer.tsx](client/src/components/dashboard/interactive-viewer/InteractiveViewer.tsx):

1. Drop the `NoCurvesState` branch from the render-state ladder (lines 155–156) and remove the now-unused `NoCurvesState` component (lines 204–219).
2. Treat "no visible curves" the same as the populated branch: render `InteractiveCanvasPlot` with `curves={[]}` (it will draw axes only, with no lines), keep the bottom `PlotLabel`, and skip `PinnedEventsOverlay` when there are no visible curves.
3. Drop the `LineChart` import from `lucide-react` if it is no longer used elsewhere in the file (it is currently only referenced from the no-plot-selected empty state at line 126 — keep the import if that branch still uses it; remove only if unused).

Concretely the inner Card content becomes (sketch):

```tsx
{isLoading ? (
  <LoadingState displayName={displayName} />
) : error ? (
  <ErrorState displayName={displayName} error={error} />
) : (
  <>
    <div className="absolute inset-0 pb-8">
      <InteractiveCanvasPlot
        curves={curves}
        config={config}
        colorConfig={colorConfig}
      />
    </div>
    {curves.length > 0 && <PinnedEventsOverlay />}
    <PlotLabel displayName={displayName} />
  </>
)}
```

Notes:

- `curves` already collapses to `[]` whenever `cachedPlotData` is missing or all curves are filtered by `curveVisibility` (lines 76–103), so a single branch correctly covers both "no visible curves" and the prior fallback `LoadingState` at line 170.
- The fallback `LoadingState` at line 170 (shown when the data is technically present but `curves` array maps to empty due to filtering) becomes redundant and is removed by this change — the empty plot renders instead, which is the intended behavior.
- The `!selectedPlotKey` branch (lines 121–145) is unchanged.

## Verification

Manual smoke test in the dashboard:

1. Render some events in the grid.
2. Open the interactive viewer for one plot.
3. In the side panel, toggle off all curves -> confirm the interactive card now shows an empty plot with axes (matching the grid empty card visually) and the plot title label at the bottom, with no "No curves visible" text.
4. Toggle a curve back on -> confirm curves render normally and `PinnedEventsOverlay` reappears.
5. Confirm the "no plot selected" empty state still shows when navigating to interactive without a `selectedPlotKey`.

## Mandatory follow-ups (per AGENTS.md)

- Add a brief implementation note under `docs/tasks/` (e.g. `docs/tasks/interactive-empty-plot.md`) describing the change.
- Append an entry to `docs/decisions/log.md` noting the empty-state alignment between interactive and grid views.
- No `docs/master-build-plan.md` task ID was specified for this — confirm with the user whether to attach it to an existing task or skip the build-plan update.
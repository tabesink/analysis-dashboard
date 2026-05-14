---
name: React Render Performance Fixes
overview: "Implement 7 targeted performance improvements across the grid layout, interactive layout, and dashboard orchestration: React.memo on chart components, stable callbacks, structuralSharing on interactive query, removal of inline style allocations, memoized visibleCount, and useCallback for dashboard handlers."
todos:
  - id: memo-svgpath
    content: Wrap SVGPath in React.memo, remove inline style object creating per-render allocations
    status: pending
  - id: memo-svgplot
    content: Wrap SVGPlot in React.memo
    status: pending
  - id: memo-svgplotcard
    content: Wrap SVGPlotCard in React.memo
    status: pending
  - id: stable-plotgrid-callbacks
    content: Extract PlotGridItem memoized component in PlotGrid to stabilize onClick and actionButtons props
    status: pending
  - id: usecallback-dashboard
    content: Wrap handleRender and handleClear in useCallback in DashboardContent
    status: pending
  - id: structural-sharing-interactive
    content: "Add structuralSharing: false to interactive binary query in InteractiveViewer"
    status: pending
  - id: memoize-visiblecount
    content: Wrap visibleCount in useMemo in CurveSelector
    status: pending
isProject: false
---

# React Render Performance Improvements

## Changes

### 1. `React.memo` on SVGPath (highest impact)

In [client/src/components/charts/SVGPath.tsx](client/src/components/charts/SVGPath.tsx):

- Wrap the component export in `React.memo`
- Remove the inline `style={{ transition: ... }}` object (creates a new reference every render, defeating memo, and CSS transitions on hundreds of SVG paths add compositor overhead). Move the opacity transition to a static CSS class or remove it entirely.

### 2. `React.memo` on SVGPlot

In [client/src/components/charts/SVGPlot.tsx](client/src/components/charts/SVGPlot.tsx):

- Wrap the component export in `React.memo`
- This prevents re-rendering all 8 plots when only the parent `PlotGrid` re-renders (e.g., from a store change that doesn't affect plot data).

### 3. `React.memo` on SVGPlotCard

In [client/src/components/charts/SVGPlotCard.tsx](client/src/components/charts/SVGPlotCard.tsx):

- Wrap the component export in `React.memo`
- Move the `pinnedEventIds` / `isPinnedModeActive` / `togglePinnedMode` / `isSynced` / `toggleSync` store selectors inside the component (they already are -- no change needed here)
- The card will skip re-renders when its props (`curves`, `config`, `colorConfig`, `axisLimits`, etc.) are referentially stable, which they are when coming from the memoized `plotsData` in PlotGrid.

### 4. Stable callbacks in PlotGrid `.map()`

In [client/src/components/dashboard/plot-grid/PlotGrid.tsx](client/src/components/dashboard/plot-grid/PlotGrid.tsx), the inline `onClick={() => handleExpand(plotKey)}` and the inline `actionButtons` JSX create new references every render, defeating `React.memo` on `SVGPlotCard`.

Fix: Move `SVGPlotCard` rendering into a dedicated memoized child component (`PlotGridItem`) that receives `plotKey` and `handleExpand` as stable props, and builds its own `onClick` and `actionButtons` internally.

### 5. `useCallback` for `handleRender` and `handleClear` in DashboardContent

In [client/src/components/dashboard/DashboardContent.tsx](client/src/components/dashboard/DashboardContent.tsx):

- Wrap `handleRender` and `handleClear` in `useCallback` with their respective dependencies
- This prevents new function references on every render, reducing child re-renders.

### 6. `structuralSharing: false` on interactive query

In [client/src/components/dashboard/interactive-viewer/InteractiveViewer.tsx](client/src/components/dashboard/interactive-viewer/InteractiveViewer.tsx):

- Add `structuralSharing: false` to the `useQuery` call for `interactivePlotBinary`
- This query returns decoded `BinaryCurveData` with `Float32Array` fields; structural sharing performs wasteful deep comparison on typed arrays.

### 7. Memoize `visibleCount` in CurveSelector

In [client/src/components/dashboard/interactive-viewer/CurveSelector.tsx](client/src/components/dashboard/interactive-viewer/CurveSelector.tsx):

- Wrap `visibleCount` computation in `useMemo` with `[allEvents, isVisible]` dependencies
- Currently `allEvents.filter(...).length` runs on every render unconditionally.

---

## Files Changed


| File                    | Change                                                           |
| ----------------------- | ---------------------------------------------------------------- |
| `SVGPath.tsx`           | `React.memo` wrapper, remove inline `style` object               |
| `SVGPlot.tsx`           | `React.memo` wrapper                                             |
| `SVGPlotCard.tsx`       | `React.memo` wrapper                                             |
| `PlotGrid.tsx`          | Extract `PlotGridItem` memoized component to stabilize callbacks |
| `DashboardContent.tsx`  | `useCallback` on `handleRender` / `handleClear`                  |
| `InteractiveViewer.tsx` | Add `structuralSharing: false`                                   |
| `CurveSelector.tsx`     | `useMemo` on `visibleCount`                                      |



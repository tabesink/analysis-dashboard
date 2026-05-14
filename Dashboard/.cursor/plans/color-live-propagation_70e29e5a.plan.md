---
name: color-live-propagation
overview: Make program/version color edits propagate live to both the interactive viewer and grid (single shared store, no new wiring), and remove the obsolete "click Render" gate for color changes since colors are pure client-side cosmetics.
todos:
  - id: reactive-coloring
    content: Subscribe useCurveColoring to programColors and programVersionColors data; add to getCurveColor deps
    status: completed
  - id: drop-color-gate
    content: Remove color half of the click-Render gate from PlotGrid (colorRevision sub, lastRenderedColorRevision usage, hasUnrenderedColorChanges)
    status: completed
  - id: active-tab-gate
    content: Gate PlotGrid.plotsData recompute on activeTab === 'grid' via plotsDataRef fallback
    status: completed
  - id: trim-render-store
    content: Delete lastRenderedColorRevision and setLastRenderedColorRevision from render-store
    status: completed
  - id: verify
    content: Lint, TypeScript check, npm run build; append decision-log entry
    status: completed
isProject: false
---

## Goal

A swatch change in either side panel updates both viewers immediately, with bounded per-frame work (only the active tab recomputes). No new abstractions; net code shrinks.

## Root cause recap

`[useCurveColoring](client/src/hooks/use-curve-coloring.ts)` selects the *function reference* `getProgramVersionColor` (which Zustand never recreates) but does NOT subscribe to `programColors` / `programVersionColors`. So `getCurveColor`'s deps never invalidate after a swatch change. Today's compensation — the grid's amber "click Render" banner triggering a full server refetch — is unnecessary because colors are applied client-side in `[SVGPlot.tsx:76](client/src/components/charts/SVGPlot.tsx)` and `[InteractiveViewer.tsx:67-94](client/src/components/dashboard/interactive-viewer/InteractiveViewer.tsx)`.

## Edits

### 1. Make `useCurveColoring` reactive — `[client/src/hooks/use-curve-coloring.ts](client/src/hooks/use-curve-coloring.ts)`

Subscribe to the color *data* and add it to `getCurveColor`'s deps:

```ts
const eventOverrideColors = useColorSelectionStore((s) => s.eventOverrideColors);
const programColors = useColorSelectionStore((s) => s.programColors);
const programVersionColors = useColorSelectionStore((s) => s.programVersionColors);
const getProgramVersionColor = useColorSelectionStore((s) => s.getProgramVersionColor);
// ...
const getCurveColor = useCallback(
  (eventId) => { /* unchanged body */ },
  [
    eventOverrideColors,
    programColors,            // NEW
    programVersionColors,     // NEW
    eventMetaMap,
    getProgramVersionColor,
    globalSortedProgramIds,
    versionsByProgramId,
  ],
);
```

The body stays identical — `getProgramVersionColor` reads fresh state via `get()`. We just need React to know when to re-derive.

### 2. Drop the color half of the "click Render" gate — `[client/src/components/dashboard/plot-grid/PlotGrid.tsx](client/src/components/dashboard/plot-grid/PlotGrid.tsx)`

Remove:

- `colorRevision` subscription (line 122) and the `useColorSelectionStore` import if it becomes unused.
- `lastRenderedColorRevision` / `setLastRenderedColorRevision` reads (lines 114-115).
- The `setLastRenderedColorRevision(colorRevision)` call inside the Render-trigger effect (line 157).
- `hasUnrenderedColorChanges` (lines 166-169) and the `hasPendingRerenderChanges` derivation collapses back to just `hasUnrenderedChanges`.

The amber banner stays — but now it only flashes for selection changes (legitimate refetch territory).

### 3. Gate `plotsData` recompute on the active tab — `[client/src/components/dashboard/plot-grid/PlotGrid.tsx](client/src/components/dashboard/plot-grid/PlotGrid.tsx)`

```tsx
const activeTab = useUIStore((s) => s.activeTab);
const plotsDataRef = useRef<Record<string, PlotInfo>>({});

const plotsData = useMemo(() => {
  if (activeTab !== 'grid') {
    return plotsDataRef.current;   // hidden; reuse last-good
  }
  // ...existing recompute body...
  plotsDataRef.current = result;
  return result;
}, [activeTab, streamedPlots, getCurveColor, eventVersionMap, pinnedModeEnabled, pinnedSet]);
```

When the user tabs back to grid, `activeTab` flips, the memo recomputes once, and the latest colors land in a single frame.

### 4. Delete the dead field from render-store — `[client/src/stores/render-store.ts](client/src/stores/render-store.ts)`

Remove `lastRenderedColorRevision` and `setLastRenderedColorRevision` (no remaining consumers after edit 2).

## Out of scope (intentional)

- Per-view color scopes — kept shared. One swatch identity per program/version.
- Debounce / commit-on-release for the color picker — rejected; kills live preview.
- Per-event override behavior — already correct (pinned-only lifecycle, untouched).

## Verification

1. Lint + TypeScript check on the four touched files.
2. `npm run build`.
3. Manual smoke test:
  - Interactive tab open → drag a version swatch → curves recolor live in the same frame.
  - Switch to Grid tab → all 11 plots reflect the new color (single recompute on switch, no banner, no Render click).
  - Reverse: edit on Grid tab → curves update live → switch to Interactive → matches.
  - Selection change still flashes the amber banner and still requires Render click (refetch path unchanged).
  - Pin → set per-event override → unpin → override clears (existing behavior intact).
4. Append a brief entry to `[docs/decisions/log.md](docs/decisions/log.md)` recording: "color edits are client-side cosmetics, no refetch gate" and the active-tab recompute optimization.


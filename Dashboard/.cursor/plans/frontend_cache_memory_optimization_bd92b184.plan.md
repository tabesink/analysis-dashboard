---
name: Frontend Cache Memory Optimization
overview: Implement the cache and memory performance optimizations from the audit document, targeting the critical and high-priority items across all 5 caching layers (React Query, Zustand, WeakMap, Offscreen Canvas, Spatial Grid).
todos:
  - id: fix-canvas-leak
    content: "Phase 1A: Fix offscreen canvas leak in InteractiveCanvasPlot.tsx - add cleanup and disposal"
    status: completed
  - id: structural-sharing
    content: "Phase 1B: Add structuralSharing: false to use-all-events.ts query"
    status: completed
  - id: cachedplots-lru
    content: "Phase 1C: Add LRU eviction (max 50 entries) to cachedPlots in render-store.ts"
    status: completed
  - id: float32-canvas
    content: "Phase 2A: Add drawCurveFromArrays to canvas-renderer.ts and refactor InteractiveCanvasPlot to use Float32Array-based scaled curves"
    status: completed
  - id: tab-visibility
    content: "Phase 2B: Create useTabVisibility hook, release offscreen canvas and pause fetching when tab hidden"
    status: completed
  - id: query-cache-cap
    content: "Phase 2C: Add React Query cache size cap (max 100 queries) with periodic cleanup"
    status: completed
  - id: derive-render-state
    content: "Phase 2D: Derive isRendering/renderProgress from loadingPlots instead of storing separately"
    status: completed
  - id: textdecoder-singleton
    content: "Phase 3A: Move TextDecoder to module scope in binary-decoder.ts"
    status: completed
  - id: scratch-set
    content: "Phase 3B: Add reusable scratch Set to findCandidates in spatial-grid.ts"
    status: completed
  - id: debounce-persist
    content: "Phase 3C: Debounce localStorage persist writes in color-selection-store"
    status: completed
  - id: map-cachedplots
    content: "Phase 3D: Convert cachedPlots from Record to Map to eliminate spread overhead"
    status: completed
isProject: false
---

# Frontend Cache & Memory Performance Optimization

## Issues Found (by severity)

### Critical

1. **Offscreen canvas memory leak** -- [InteractiveCanvasPlot.tsx](client/src/components/charts/InteractiveCanvasPlot.tsx) line 137: the `useEffect` that creates offscreen canvases overwrites `offscreenRef.current` without disposing the previous canvas (`canvas.width = 0; canvas.height = 0`). Each data/config change leaks ~30 MB of canvas memory.
2. **No `structuralSharing: false` on any query** -- React Query v5 performs deep structural sharing by default. For binary-decoded data (typed arrays, large Point[] arrays), this comparison is wasteful and can cause subtle bugs. Affects [providers.tsx](client/src/app/providers.tsx) and [use-all-events.ts](client/src/hooks/use-all-events.ts).
3. `**cachedPlots` unbounded growth** -- [render-store.ts](client/src/stores/render-store.ts) `updateCachedPlot` appends entries with no size limit or LRU eviction. Each entry can be 2-5 MB. 50 plots = 100-250 MB heap.

### High

1. **Point[] materialization doubles memory** -- [binary-decoder.ts](client/src/lib/utils/binary-decoder.ts) `getCurvePoints()` converts `Float32Array` pairs to `{x, y}[]`, doubling per-curve memory. 500 curves x 5000 points = ~100 MB extra. Canvas renderer should index Float32Arrays directly.
2. `**scaledCurves` re-creates full path arrays** -- [InteractiveCanvasPlot.tsx](client/src/components/charts/InteractiveCanvasPlot.tsx) line 115: `curve.points.map(p => ({x: scaleX(p.x), y: scaleY(p.y)}))` allocates a new array of objects per curve on every scale/data change. Should use pre-allocated typed arrays.
3. **No tab-hidden optimization** -- No `visibilitychange` listener anywhere. When tab is hidden, offscreen canvases (~~60 MB), spatial grids (~~8 MB), and React Query refetches continue consuming resources.
4. **No React Query cache size cap** -- [providers.tsx](client/src/app/providers.tsx) has no max cache entries. The query cache grows unbounded across sessions.
5. **Derived state stored in render-store** -- `isRendering` and `renderProgress` are stored directly but are derivable from `loadingPlots.size`.

### Medium

1. **TextDecoder created per decode call** -- [binary-decoder.ts](client/src/lib/utils/binary-decoder.ts) line 64: `new TextDecoder()` inside `decodeBinaryPlotData()`. Should be module-level singleton.
2. `**findCandidates` allocates new Set per call** -- [spatial-grid.ts](client/src/lib/chart-utils/spatial-grid.ts) line 66: `new Set<T>()` inside RAF callback on every mousemove. Should reuse a scratch set.
3. **Color selection store serializes on every mutation** -- Zustand persist middleware writes to localStorage on every color change. Should debounce (500 ms).
4. **Spread-based `updateCachedPlot` creates GC pressure** -- `{ ...state.cachedPlots, [plotKey]: data }` on progressive loading creates many short-lived objects.

---

## Implementation Plan

### Phase 1: Critical Fixes (immediate, safe, no architecture change)

#### 1A. Fix offscreen canvas leak

In [InteractiveCanvasPlot.tsx](client/src/components/charts/InteractiveCanvasPlot.tsx), add cleanup to the offscreen canvas `useEffect`:

```tsx
useEffect(() => {
  const prevCanvas = offscreenRef.current;
  offscreenRef.current = createOffscreenCanvas(
    scaledCurves, DIMENSIONS, axisLimits,
    { xLabel: config.xLabel, yLabel: config.yLabel, gridCount: GRID_COUNT }
  );
  // Release previous canvas backing store
  if (prevCanvas) {
    prevCanvas.width = 0;
    prevCanvas.height = 0;
  }
  return () => {
    if (offscreenRef.current) {
      offscreenRef.current.width = 0;
      offscreenRef.current.height = 0;
      offscreenRef.current = null;
    }
  };
}, [scaledCurves, axisLimits, config.xLabel, config.yLabel]);
```

#### 1B. Add `structuralSharing: false` to binary/large data queries

- In [providers.tsx](client/src/app/providers.tsx), keep default `structuralSharing` true (it's fine for small metadata queries).
- In [use-all-events.ts](client/src/hooks/use-all-events.ts), add `structuralSharing: false` -- this query returns hundreds of events with deep objects.
- For any future React Query usage for binary plot data, always set `structuralSharing: false`.

#### 1C. Add LRU eviction to `cachedPlots`

In [render-store.ts](client/src/stores/render-store.ts), add a max-entry cap with FIFO eviction:

```ts
const MAX_CACHED_PLOTS = 50;

updateCachedPlot: (plotKey, data) =>
  set((state) => {
    const next = { ...state.cachedPlots, [plotKey]: data };
    const keys = Object.keys(next);
    if (keys.length > MAX_CACHED_PLOTS) {
      const oldest = keys.slice(0, keys.length - MAX_CACHED_PLOTS);
      for (const k of oldest) delete next[k];
    }
    return { cachedPlots: next };
  }),
```

### Phase 2: High-Priority Optimizations

#### 2A. Direct Float32Array rendering in canvas path

Modify [canvas-renderer.ts](client/src/lib/chart-utils/canvas-renderer.ts) to accept `Float32Array` pairs directly (in addition to `{x,y}[]`), skipping Point[] materialization for the canvas path. Add a `drawCurveFromArrays(ctx, xArray, yArray, color, opacity)` function.

Modify [InteractiveCanvasPlot.tsx](client/src/components/charts/InteractiveCanvasPlot.tsx) `scaledCurves` to hold `Float32Array` for scaled coordinates instead of `{x,y}[]` objects.

#### 2B. Tab-hidden optimization

Create a `useTabVisibility` hook that:

- Listens to `document.visibilitychange`
- When hidden: releases offscreen canvases (set width/height to 0), pauses sequential fetching
- When visible: lazily rebuilds offscreen canvas and spatial grid on next render/interaction

Wire it into [InteractiveCanvasPlot.tsx](client/src/components/charts/InteractiveCanvasPlot.tsx) and [use-sequential-plot-data.ts](client/src/hooks/use-sequential-plot-data.ts).

#### 2C. React Query cache size cap

Add a cache cleanup utility in [providers.tsx](client/src/app/providers.tsx) or a dedicated hook that periodically trims the React Query cache when it exceeds 100 entries:

```ts
const MAX_CACHED_QUERIES = 100;
const EVICT_COUNT = 20;
// Remove oldest 20 entries when cache exceeds 100
```

#### 2D. Derive `isRendering` / `renderProgress` from `loadingPlots`

Remove stored `isRendering` and `renderProgress` from [render-store.ts](client/src/stores/render-store.ts). Replace with selectors that compute from `loadingPlots.size`.

### Phase 3: Medium-Priority Refinements

#### 3A. Module-level TextDecoder singleton

Move `new TextDecoder()` to module scope in [binary-decoder.ts](client/src/lib/utils/binary-decoder.ts).

#### 3B. Reusable scratch Set in spatial-grid

Modify [spatial-grid.ts](client/src/lib/chart-utils/spatial-grid.ts) `findCandidates` to accept an optional pre-allocated `Set` to avoid per-call allocation in RAF handlers.

#### 3C. Debounce persist middleware writes

In the color-selection-store, wrap the persist middleware with a custom storage adapter that debounces `setItem` calls by 500 ms.

#### 3D. Use Map for `cachedPlots` to reduce spread overhead

Replace `Record<string, ...>` with `Map<string, ...>` in [render-store.ts](client/src/stores/render-store.ts) to avoid spread-based cloning on every progressive update.

---

## Estimated Impact

- **Offscreen canvas fix**: Prevents 30+ MB leak per plot switch
- `**structuralSharing: false**`: Eliminates wasted deep comparison on large datasets
- `**cachedPlots` LRU**: Caps heap at ~100 MB max for plot cache (down from unbounded)
- **Float32Array rendering**: ~50-100 MB heap reduction by eliminating Point[] duplication
- **Tab-hidden**: 60-80% memory recovery when tab is backgrounded (~150-200 MB freed)
- **React Query cap**: Prevents unbounded query cache growth
- **Spatial grid scratch Set**: Eliminates ~1 allocation per mousemove frame
- **TextDecoder singleton**: Trivial but removes per-decode allocation


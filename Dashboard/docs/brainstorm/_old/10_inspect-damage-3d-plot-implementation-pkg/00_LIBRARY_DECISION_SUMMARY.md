# Library Decision Summary: React Three Fiber vs JsPlot3D

## Recommendation

Use **React Three Fiber + Drei + Three.js**.

Do **not** use JsPlot3D.

## Decision matrix

| Criterion | React Three Fiber + Drei | JsPlot3D |
|---|---|---|
| Fit with Next.js / React 19 | Strong | Weak |
| TypeScript friendliness | Strong | Weak |
| Maintained modern ecosystem | Strong | Weak |
| Works with React state/components | Strong | Weak |
| Low-entropy Inspect Damage integration | Strong | Weak |
| White canvas tiled 3D matrix | Strong | Possible, but awkward |
| Global script risk | Low | High |
| Old dependency risk | Low if latest stable used | High |
| Junior-dev maintainability | Strong | Weak |
| Recommendation | Use | Do not use |

## Why R3F is better here

The required feature is not generic plotting. It is a page-local inspection visualization tied to Inspect Damage table state. React Three Fiber lets us express the plot as regular React components:

```text
DamagePlotSidePanel
  -> DamagePlotControls
  -> pure layout utilities
  -> DamagePlotCanvas.client
       -> DamagePlotBars
       -> DamagePlotAxes
```

This keeps the app architecture clean and makes the 3D plot an extension of the existing page rather than an embedded external plotting application.

## Why JsPlot3D loses

JsPlot3D was useful to inspect as a historical/reference library, but it should not be used:

- Its own README warns not to use it.
- It was built for learning/practice.
- It depends on old packages like `three@^0.87.1`, `three-orbit-controls`, Webpack 3, and Babel 6.
- It is not designed for React 19 / Next.js 16.
- It would increase integration complexity and technical debt.
- The dashboard only needs one tiled matrix plot, not a CSV/formula plotting library.

## Final call

Use JsPlot3D for **zero runtime code**. At most, mention it in the decision log as a rejected option.

Use React Three Fiber + Drei for implementation.

# ADR: Inspect Damage 3D Plot Library Choice

Status: Proposed
Date: 2026-05-23
Task: PX-inspect-damage-3d-plot

## Context

The Inspect Damage page needs a collapsible right-side 3D plot panel that visualizes table-aligned damage values. The plot is a tiled 3D matrix:

- X axis: fixed channel/load columns
- event/depth axis: events under selected version
- vertical axis: damage value

Candidate approaches:

1. React Three Fiber + Drei + Three.js
2. Plain Three.js embedded manually in React
3. JsPlot3D

## Decision

Use **React Three Fiber + Drei + Three.js**.

Do **not** use JsPlot3D.

## Why React Three Fiber

React Three Fiber is a React renderer for Three.js. It allows the scene to be expressed as reusable React components and participate naturally in React state, props, and component boundaries.

This matches the dashboard architecture:

- Next.js / React / TypeScript frontend
- local page state and existing UI controls
- table data passed into a side-panel visualization
- need for dynamic updates when user selects a version
- need for a client-only canvas boundary

The dashboard currently uses React 19. Therefore, use React Three Fiber v9.

## Why Drei

Drei provides proven helpers such as:

- `OrbitControls`
- `Text`
- camera helpers
- lightweight scene utilities

The MVP only needs a small subset of Drei. Do not use Drei as an excuse to add unrelated 3D abstractions.

## Why not JsPlot3D

JsPlot3D is not suitable for this codebase:

- It is an old Webpack/global-script-era project.
- It depends on very old Three.js-era packages.
- Its package manifest references `three@^0.87.1`, `three-orbit-controls`, Webpack 3, Babel 6, and Jasmine 2.
- Its own README says it was built for learning/practice and says not to use it.
- It would fight the current React/Next.js architecture.
- It is generic CSV/formula plotting, while this feature is a narrow Inspect Damage matrix view.

JsPlot3D may be looked at only as historical inspiration for feature vocabulary: scatter plots, barcharts, legends, and heatmap coloring. It must not be imported, wrapped, vendored, or used as a runtime dependency.

## Why not plain Three.js first

Plain Three.js can work, but it increases lifecycle code:

- manual renderer setup
- manual resize handling
- manual scene cleanup
- imperative diffing when version changes
- custom controls setup

React Three Fiber keeps this simpler for a React/Next.js dashboard while still allowing escape hatches for low-level Three.js optimization such as `InstancedMesh`.

## Consequences

Positive:

- Fits React 19 / Next.js.
- Cleaner component boundaries.
- Easy to keep table data as source of truth.
- Easier junior-dev mental model: panel -> controls -> pure layout -> canvas.
- Supports later optimization using `InstancedMesh`.

Negative:

- Adds three new runtime dependencies.
- Canvas tests need mocking or utility-level tests.
- Developers need basic Three.js coordinate awareness.

## Guardrails

- Do not add Leva to production UI.
- Do not create a generic plotting framework.
- Do not create `/plots/3d` for this MVP.
- Do not add a backend plot API unless Inspect Damage table data is incomplete.
- Do not duplicate damage calculation logic.
- Keep all data normalization and layout math in pure utilities.

# Inspect Damage 3D Plot Panel — Implementation Package

Target repo: `https://github.com/tabesink/analysis-dashboard.git`

## Purpose

Add a lean, maintainable React Three Fiber 3D tiled damage plot inside the existing **Inspect Damage** page. The table remains the primary workflow. The 3D plot lives in a collapsible right-side panel and visualizes the same damage values displayed in the Inspect Damage table.

## Core decision

Use **React Three Fiber + Drei + Three.js**. Do **not** use JsPlot3D.

Rationale:

- The dashboard is a modern Next.js / React / TypeScript app.
- React Three Fiber integrates with React state, component boundaries, and the existing UI architecture.
- JsPlot3D is old, global-script/Webpack-era code. Its own README says not to use it.
- The 3D visualization needed here is narrow and table-aligned, not a generic plotting framework.

## Latest stable dependency target as of 2026-05-23

The current dashboard client already uses:

- `next`: `^16.1.6`
- `react`: `19.2.3`
- `react-dom`: `19.2.3`
- `@tanstack/react-query`: `^5.90.12`
- `zustand`: `^5.0.9`
- `tailwindcss`: `^4`
- `typescript`: `^5`

Add only the 3D dependencies:

```json
{
  "dependencies": {
    "three": "^0.184.0",
    "@react-three/fiber": "^9.6.1",
    "@react-three/drei": "^10.7.7"
  },
  "devDependencies": {
    "@types/three": "^0.184.1"
  }
}
```

Why R3F v9: R3F documentation says `@react-three/fiber@8` pairs with React 18 and `@react-three/fiber@9` pairs with React 19.

## Package contents

```text
repo-docs/
  docs/architecture/inspect-damage-3d-plot.md
  docs/tasks/PX-inspect-damage-3d-plot.md
  docs/decisions/ADR-inspect-damage-3d-plot-library-choice.md

code-scaffold/
  client/src/features/inspect-damage-3d/
    components/
      DamagePlotSidePanel.tsx
      DamagePlotCanvas.client.tsx
      DamagePlotBars.tsx
      DamagePlotAxes.tsx
    lib/
      build-inspect-damage-plot-rows.ts
      damage-channel-axis.ts
      damage-plot-types.ts
      build-damage-plot-matrix.ts
      damage-plot-layout.ts
      damage-color-scale.ts
    __tests__/
      damage-plot-utils.test.ts

agent-prompts/
  coding-agent-implementation-prompt.md
  code-review-prompt.md
```

## Implementation posture

- Surgical vertical slice.
- No standalone `/plots/3d` route.
- No generic plot framework.
- No backend route unless table data is insufficient.
- Reuse the calculated Inspect Damage response as the source of truth.
- Use a client-only WebGL boundary.
- Keep heavy data semantics out of the 3D renderer.
- Use pure utilities for version filtering, matrix building, layout, and color scale.
- Drive the work with vertical TDD: one behavior test, one minimal implementation, then the next behavior.

## Agreed MVP decisions

- **Row scope**: plot selected events that have calculated Inspect Damage results. Do not mirror table filters, sort order, or visible columns in the MVP.
- **Version source**: join `EventMetadata.version` from selected events with matching `DamageInspectRow` entries from the latest cached calculation.
- **Channel axis**: always reserve the fixed 12 Inspect Damage channel positions from DEC-066. API-returned channels tell us availability; they do not redefine the X axis.
- **Cell policy**: render only `DamageCell` values where `status === 'ok'`, `damage` is finite, and `damage >= 0`. Preserve true zero. Skip missing, errored, null, NaN, infinite, and negative values.
- **Panel behavior**: keep the viewer page-local in a right-side collapsible panel. It should stay unobtrusive until calculated damage exists and the user opens it.
- **Performance policy**: use simple per-bar meshes first with a visible cap/warning for large cell counts. Keep `DamagePlotBars` props stable so internals can move to `InstancedMesh` later.
- **Test posture**: protect pure adapter/util behavior first. Avoid WebGL-heavy component tests in the MVP.

## Live Inspect Damage data flow

The existing page does not have a flat table row shaped like the scaffold. The plot adapter must bridge the current API shapes:

```text
selectedEvents: EventMetadata[]
  + damageRowsByEventId: Map<string, DamageInspectRow>
  -> buildInspectDamagePlotRows(...)
  -> InspectDamagePlotRow[]
  -> version options
  -> fixed 12-channel cells
  -> deterministic layout/color data
  -> client-only R3F canvas
```

Key source fields:

- `EventMetadata.event_id` joins to `DamageInspectRow.event_id`.
- `EventMetadata.version` is the plot version grouping.
- `EventMetadata.job_number` and `EventMetadata.work_order` are labels/metadata.
- `DamageInspectRow.damages[channelKey]` contains `{ damage, status, error }`.
- `damageResponse.channels` lists available calculated channels but must not replace the fixed 12-channel axis.

## MVP success criteria

- Inspect Damage page still renders its existing table.
- A right-side panel can collapse/expand.
- Expanded panel shows a white 3D canvas.
- Dropdown lists only versions represented by selected events with calculated damage rows.
- Selecting a version renders all events under that version.
- X axis shows the fixed 12 load/channel labels, even when some channels have no available cells.
- Event axis shows events under the selected version.
- Damage axis height comes from calculated `status: ok` damage values.
- User can orbit, pan, and zoom.
- Code is typed, testable, and low entropy.

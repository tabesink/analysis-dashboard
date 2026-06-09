# Frontend Implementation Checklist

Use this as a vertical TDD checklist. Do not write all tests first and do not copy the scaffold wholesale. Each slice should be: write one behavior test, make it pass with the smallest useful implementation, then continue.

## Slice 1: Inspect Damage plot-row adapter

- [ ] Locate `client/src/app/inspect-damage/page.tsx`, `DamageInspectResponse`, `DamageInspectRow`, `DamageCell`, and `EventMetadata`.
- [ ] Add one failing test for a pure adapter such as `buildInspectDamagePlotRows({ selectedEvents, damageRowsByEventId })`.
- [ ] Join `EventMetadata.event_id` to `DamageInspectRow.event_id`.
- [ ] Put `EventMetadata.version` on the plot row.
- [ ] Use `job_number`, `work_order`, and `program_id` as optional row metadata.
- [ ] Include only selected events that have a calculated damage row.
- [ ] Keep table filters, table sort, and visible table columns out of this MVP adapter.

## Slice 2: Damage cell semantics

- [ ] Add one failing test that proves only `status === 'ok'` cells with finite non-negative numeric damage become plot cells.
- [ ] Preserve real zero damage as a valid value.
- [ ] Skip missing cells, `status !== 'ok'`, null damage, NaN, infinite values, and negative values.
- [ ] Do not clamp negative damage to zero.
- [ ] Keep error text out of the renderer; errors remain Inspect Damage table/API concerns for this MVP.

## Slice 3: Fixed channel axis and versions

- [ ] Add one failing test for sorted version options derived from adapted rows.
- [ ] Add one failing test for the fixed 12-channel axis order from DEC-066.
- [ ] Always reserve all 12 channel positions on the X axis.
- [ ] Use `damageResponse.channels` only to understand availability/labels if needed; do not let it redefine the axis.
- [ ] Report availability separately, for example `8/12 channels available`, instead of shrinking the axis.

## Slice 4: Layout and color utilities

- [ ] Add one failing test for deterministic bar position/scale from cells.
- [ ] Keep the coordinate mapping isolated in a pure layout utility: user-facing X = channels, Y = events, Z = damage; Three.js X = channels, Z = events/depth, Y = damage height.
- [ ] Compute bounds and camera center from fixed channels plus selected-version event count.
- [ ] Keep color scaling dependency-free and deterministic.
- [ ] Keep layout constants in one place so axes and bars cannot drift.

## Slice 5: Side panel shell

- [ ] Add `DamagePlotSidePanel` only after adapter and utility tests pass.
- [ ] Keep it as a collapsible right-side panel inside Inspect Damage; no standalone route.
- [ ] Keep it unobtrusive until calculated damage exists and the user opens it.
- [ ] Show a version dropdown derived from adapted rows.
- [ ] Show summary text: selected-version event count, fixed channel count, rendered cell count, and channel availability.
- [ ] Show empty state for no calculated damage rows.
- [ ] Show empty state for no renderable cells under the selected version.

## Slice 6: Client-only R3F canvas

- [ ] Add dependencies only here: `three`, `@react-three/fiber`, `@react-three/drei`, and `@types/three`.
- [ ] Add a client-only `DamagePlotCanvas.client` boundary and dynamic import if needed.
- [ ] Use only the minimal R3F/Drei surface: `Canvas`, camera, and `OrbitControls`.
- [ ] Use a white background, basic lighting, bars, and axes.
- [ ] Keep all data fetching and damage semantics out of mesh components.
- [ ] Use simple per-bar meshes first.
- [ ] Add a visible cap/warning for large cell counts; keep `DamagePlotBars` props stable for later `InstancedMesh`.

## Review checks

- [ ] No JsPlot3D dependency, import, vendored code, or runtime reference.
- [ ] No Leva production dependency.
- [ ] No Plotly/deck.gl/react-force-graph/generic plotting framework.
- [ ] No standalone 3D route.
- [ ] No backend route unless the table/calculation response is proven insufficient.
- [ ] No duplicate backend damage calculation.
- [ ] No WebGL-heavy component tests required for MVP.
- [ ] No unrelated refactors.

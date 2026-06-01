# Coding Agent Prompt — Inspect Damage 3D Plot Side Panel

You are a senior Next.js / React / React Three Fiber / Three.js engineer working in `https://github.com/tabesink/analysis-dashboard.git`.

## Task

Implement a collapsible right-side 3D damage plot panel inside the existing Inspect Damage page.

## Hard constraints

- Do not create a standalone `/plots/3d` route.
- Do not use JsPlot3D.
- Do not add Leva to production UI.
- Do not create a generic plotting framework.
- Do not duplicate damage calculation logic.
- Use the calculated Inspect Damage response already held by the page as the plot source of truth.
- Add a narrow Inspect Damage API only if the table data does not contain the needed values.
- Keep changes surgical.
- Use vertical TDD: one behavior test, one minimal implementation, then repeat.
- Do not copy the scaffold wholesale.
- Update docs and tests only where needed for the implemented slice.

## Library decision

Use:

```bash
cd Dashboard/client
npm install three@^0.184.0 @react-three/fiber@^9.6.1 @react-three/drei@^10.7.7
npm install -D @types/three@^0.184.1
```

The repo uses React 19, so React Three Fiber v9 is required.

## Visual requirement

Render a tiled 3D bar/grid plot:

- X axis: fixed 12 Inspect Damage channels from DEC-066
- event/depth axis: calculated selected events under selected version
- vertical axis: damage value
- white canvas
- orbit/pan/zoom controls
- version dropdown in panel

Fixed X axis channels:

1. BJ X Force
2. BJ Y Force
3. BJ Z Force
4. Shock X Force
5. Shock Y Force
6. Shock Z Force
7. Bushing F X Momt
8. Bushing F Y Momt
9. Bushing F Z Momt
10. Bushing R X Momt
11. Bushing R Y Momt
12. Bushing R Z Momt

## Implementation plan

1. Read `Dashboard/AGENTS.md`.
2. Locate Inspect Damage page and confirm the live shapes:
   - `EventMetadata.version`
   - `EventMetadata.job_number`
   - `DamageInspectRow.damages[channelKey]`
   - `DamageCell.status`
   - `damageResponse.channels`
3. Write one failing adapter test for `buildInspectDamagePlotRows({ selectedEvents, damageRowsByEventId })`.
4. Implement the adapter:
   - join `EventMetadata.event_id` to `DamageInspectRow.event_id`
   - include only selected events with calculated rows
   - use `EventMetadata.version` as the version source
   - use `job_number`, not `job_id`
5. Add fixed channel definitions.
6. Add typed plot row/cell/layout shapes.
7. Add pure utilities one test at a time:
   - `getDamageVersionOptions`
   - `filterDamageRowsByVersion`
   - `buildDamagePlotCells`
   - `computeDamagePlotLayout`
   - `getDamageColor`
8. In `buildDamagePlotCells`, render only `status === 'ok'`, finite, non-negative damage. Preserve zero. Skip missing, errored, null, NaN, infinite, and negative values. Do not clamp negative values.
9. Add `DamagePlotSidePanel` after pure tests pass.
10. Add client-only `DamagePlotCanvas.client` using minimal R3F/Drei.
11. Add simple mesh bars and axes.
12. Add a visible cap/warning for large cell counts; keep `DamagePlotBars` props stable for later `InstancedMesh`.
13. Integrate side panel into Inspect Damage layout.
14. Run targeted tests, lint, and build as appropriate.
15. Update docs/changelog only if the implementation changes user-facing behavior in the target branch.

## Coordinate convention

User-facing labels:

- X = channels
- Y = events
- Z = damage

Three.js internal mapping:

- `threeX` = channel index
- `threeZ` = event index/depth
- `threeY` = damage height

Keep this mapping isolated in a pure layout utility.

## Acceptance criteria

- Inspect Damage table still works.
- Right-side 3D plot panel opens/collapses.
- Version dropdown is derived from calculated selected events.
- Selecting a version updates the plot.
- X axis keeps all 12 fixed channel positions even when some channels have no bars.
- Plot displays a white canvas.
- Plot bars use only `status: ok`, finite, non-negative damage values.
- Missing/error/invalid cells do not render as zero-height bars.
- Orbit/pan/zoom works.
- Tests pass.
- No JsPlot3D dependency or import exists.

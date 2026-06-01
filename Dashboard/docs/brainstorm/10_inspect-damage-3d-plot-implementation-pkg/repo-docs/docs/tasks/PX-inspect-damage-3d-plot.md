# Task PX: Inspect Damage 3D Plot Side Panel

Status: Proposed
Date: 2026-05-23
Owner: Frontend / Dashboard

## Goal

Add a collapsible right-side 3D plot panel to the Inspect Damage page. The panel visualizes calculated Inspect Damage values for selected events.

## Non-goals

- No standalone `/plots/3d` page.
- No generic plotting framework.
- No JsPlot3D dependency.
- No Leva production controls.
- No duplicate damage calculation logic.
- No unrelated layout refactor.

## Dependencies

Add latest stable compatible 3D packages:

```bash
cd Dashboard/client
npm install three@^0.184.0 @react-three/fiber@^9.6.1 @react-three/drei@^10.7.7
npm install -D @types/three@^0.184.1
```

Run:

```bash
npm install
npm run lint
npm run test
npm run build
```

## Implementation steps

### Step 1 — Locate Inspect Damage source of truth

Find the existing Inspect Damage page and identify:

- `selectedEvents: EventMetadata[]`
- `damageRowsByEventId: Map<string, DamageInspectRow>`
- `EventMetadata.version`
- `EventMetadata.job_number`
- `DamageInspectRow.damages[channelKey]`
- `DamageCell.status`
- `damageResponse.channels`

The MVP plots selected events with calculated damage rows. It does not mirror table sort, table filters, or visible columns.

Write the first failing test for a pure adapter such as `buildInspectDamagePlotRows({ selectedEvents, damageRowsByEventId })`.

### Step 2 — Add fixed channel definitions

Create:

```text
client/src/features/inspect-damage-3d/lib/damage-channel-axis.ts
```

Define the 12 fixed channels, order, labels, and short labels.

Always reserve all 12 channel positions. Do not let `damageResponse.channels` shrink or reorder the axis.

### Step 3 — Add shared types

Create:

```text
client/src/features/inspect-damage-3d/lib/damage-plot-types.ts
```

Define:

- `DamageChannelKey`
- `DamageChannelDefinition`
- `InspectDamagePlotRow`
- `DamagePlotCell`
- `DamagePlotLayout`

Map from selected events plus calculated damage rows in a pure adapter, not inside the renderer.

### Step 4 — Add pure utilities

Create:

```text
build-damage-plot-matrix.ts
damage-plot-layout.ts
damage-color-scale.ts
```

Required functions:

- `buildInspectDamagePlotRows(input)`
- `getDamageVersionOptions(rows)`
- `filterDamageRowsByVersion(rows, version)`
- `buildDamagePlotCells(rows, channels)`
- `computeDamagePlotLayout(cells, channels, options)`
- `getDamageColor(value, min, max)`

Write one behavior test, make it pass, then add the next behavior. Do not write all tests first.

### Step 5 — Add side panel component

Create:

```text
components/DamagePlotSidePanel.tsx
```

Responsibilities:

- collapsed/expanded state
- version dropdown
- summary text
- empty/error states
- calls pure utilities
- passes computed layout to canvas
- visible cap/warning for large cell counts

### Step 6 — Add client-only R3F canvas

Create:

```text
components/DamagePlotCanvas.client.tsx
components/DamagePlotBars.tsx
components/DamagePlotAxes.tsx
```

Use:

- `Canvas` from `@react-three/fiber`
- `PerspectiveCamera`, `OrbitControls`, `Text` from `@react-three/drei`
- white background
- basic lights
- grid floor
- camera centered to layout bounds

### Step 7 — Integrate into Inspect Damage page

Modify only the Inspect Damage page/layout area:

```tsx
<div className="flex min-h-0 flex-1 overflow-hidden">
  <div className="min-w-0 flex-1 overflow-auto">
    <InspectDamageTable ... />
  </div>
  <DamagePlotSidePanel rows={plotRowsFromCalculatedDamage} />
</div>
```

Do not disturb existing table logic.

### Step 8 — Add tests

Add utility tests first:

```text
client/src/features/inspect-damage-3d/__tests__/damage-plot-utils.test.ts
```

Test:

- selected events join to calculated damage rows
- versions are extracted and sorted
- selected version filters rows
- cells are built in channel order
- only `status: ok`, finite, non-negative values become cells
- zero damage is preserved
- missing/error/null/NaN/infinite/negative values are skipped
- height scaling works
- bounds are computed
- color scale clamps values

### Step 9 — Documentation and changelog

Update only what is relevant for the implemented branch:

- `docs/master-build-plan.md`
- `docs/tasks/PX-inspect-damage-3d-plot.md`
- `docs/architecture/inspect-damage-3d-plot.md`
- `CHANGELOG.md`

Add a decision-log entry only if the implementation makes a durable architectural decision that is not already captured elsewhere.

## Acceptance criteria

- Inspect Damage table remains usable.
- Right-side panel expands/collapses.
- Dropdown lists versions from selected events with calculated damage rows.
- Selecting a version updates the plot.
- X axis uses the fixed 12 channels.
- Event/depth axis uses calculated selected events under selected version.
- Vertical axis uses only `status: ok`, finite, non-negative damage values.
- Missing/error/invalid values are skipped, not rendered as zero.
- Canvas is white.
- Orbit/pan/zoom works.
- No JsPlot3D references exist in code or package files.
- Tests pass.

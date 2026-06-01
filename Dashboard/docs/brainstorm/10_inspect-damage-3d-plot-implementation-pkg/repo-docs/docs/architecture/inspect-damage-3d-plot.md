# Architecture: Inspect Damage 3D Plot Side Panel

Status: Proposed
Date: 2026-05-23
Task: PX-inspect-damage-3d-plot

## Summary

Add a collapsible right-side 3D plot panel to the existing Inspect Damage page. The panel renders a tiled 3D bar/grid chart using React Three Fiber. It visualizes the same event/channel damage matrix already displayed in the table.

This is not a standalone plotting page and not a generic plotting framework.

## User experience

Main page layout:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Inspect Damage                                                              │
├───────────────────────────────────────────────────────────────┬─────────────┤
│                                                               │ 3D Plot     │
│ Damage table                                                   │ side panel  │
│                                                               │             │
│ - Program ID                                                   │ Version ▾   │
│ - Work Order                                                   │ Summary     │
│ - Program ID                                                   │             │
│ - 12 damage channel columns                                    │ White R3F   │
│                                                               │ canvas      │
└───────────────────────────────────────────────────────────────┴─────────────┘
```

Collapsed state:

```text
┌───────────────────────────────────────────────────────────────┬──┐
│ Inspect Damage table                                           │▶ │
└───────────────────────────────────────────────────────────────┴──┘
```

Expanded panel contents:

1. Header: `3D Damage Plot`
2. Collapse button
3. Version dropdown
4. Summary: selected version, event count, channel count, cell count
5. White canvas
6. Optional damage min/max legend
7. Empty/loading/error states

## Data ownership

The calculated Inspect Damage response held by the page should remain the source of truth.

Preferred path:

```text
selectedEvents + calculated damage response
        ↓
buildInspectDamagePlotRows()
        ↓
DamagePlotSidePanel receives adapted rows as props
        ↓
version dropdown options derived from rows
        ↓
selected version filters rows
        ↓
buildDamagePlotCells()
        ↓
computeDamagePlotLayout()
        ↓
DamagePlotCanvas.client renders bars/axes
```

Only add a server endpoint if the current `POST /api/v1/damage/inspect` response cannot provide the selected events, versions, and calculated damage cells needed by the adapter.

## Fixed channel axis

X axis channel order is fixed:

| Order | Key | Label |
|---:|---|---|
| 1 | `bj_x_force` | BJ X Force |
| 2 | `bj_y_force` | BJ Y Force |
| 3 | `bj_z_force` | BJ Z Force |
| 4 | `shock_x_force` | Shock X Force |
| 5 | `shock_y_force` | Shock Y Force |
| 6 | `shock_z_force` | Shock Z Force |
| 7 | `bushing_f_x_momt` | Bushing F X Momt |
| 8 | `bushing_f_y_momt` | Bushing F Y Momt |
| 9 | `bushing_f_z_momt` | Bushing F Z Momt |
| 10 | `bushing_r_x_momt` | Bushing R X Momt |
| 11 | `bushing_r_y_momt` | Bushing R Y Momt |
| 12 | `bushing_r_z_momt` | Bushing R Z Momt |

## Coordinate convention

User-facing axis labels:

- X = channels
- Y = events
- Z = damage

Three.js internal convention:

- `threeX` = channel position
- `threeZ` = event/depth position
- `threeY` = vertical damage bar height

This mismatch must stay isolated inside `damage-plot-layout.ts` and documented in code comments.

## Module shape

Preferred if no Inspect Damage feature folder exists yet:

```text
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
```

If the current codebase already has an Inspect Damage module, place these files inside that module instead. Do not create duplicate feature roots.

## Component responsibilities

### `DamagePlotSidePanel`

Owns UI state:

- collapsed / expanded panel state
- selected version
- derived version options
- calls pure utilities
- renders controls, summary, legend, canvas wrapper

Does not perform 3D geometry calculations directly.

### `DamagePlotCanvas.client`

Owns R3F scene:

- white background
- camera
- lights
- orbit controls
- bars
- axes

Does not fetch data.

### `DamagePlotBars`

Renders bars. Start simple, but keep a clean path to instancing.

MVP guidance:

- `<mesh>` bars are acceptable for small data sets.
- `InstancedMesh` should be used when cells exceed roughly 300.

### `DamagePlotAxes`

Renders axis lines and labels.

Rules:

- show all 12 channel labels if space allows
- cap/sparsify event labels if many events exist
- keep vertical damage label simple

## Dependency target

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

Do not add:

- JsPlot3D
- Leva
- Plotly
- deck.gl
- react-force-graph
- custom WebGL framework

## API fallback only if needed

If the existing Inspect Damage calculation response is insufficient, add a narrow endpoint:

```http
POST /api/v1/damage/plot-matrix
```

Request should reuse the current Inspect Damage filter/selection payload.

Response:

```json
{
  "versions": ["V1", "V2"],
  "channels": [
    { "key": "bj_x_force", "label": "BJ X Force", "order": 1 }
  ],
  "rows": [
    {
      "event_id": "EVT-001",
      "job_number": "J001",
      "work_order": "WO-001",
      "program_id": "P001",
      "version": "V1",
      "damages": {
        "bj_x_force": { "status": "ok", "damage": 0.012 },
        "bj_y_force": { "status": "ok", "damage": 0.009 }
      }
    }
  ],
  "warnings": []
}
```

Do not add a generic `/plot3d` API for this MVP.

## Rendering requirements

- White canvas background.
- Camera frames the full grid.
- Orbit, pan, and zoom enabled.
- Reset view control if easy.
- Render only `status: ok`, finite, non-negative damage values.
- Preserve real zero damage.
- Skip missing, errored, null, NaN, infinite, and negative values.
- Color maps to damage magnitude using a small deterministic utility.

## Performance guidance

Cell count = `12 × eventCountForSelectedVersion`.

MVP policy:

- Start with normal mesh rendering for readability.
- Add a visible cap/warning for large cell counts.
- Keep `DamagePlotBars` props stable so internals can move to `InstancedMesh` later.

## Testing strategy

Prioritize pure utility tests because they catch most bugs without WebGL:

- version extraction
- version filtering
- cell building
- `status: ok` and finite-value filtering
- layout bounds
- height scaling
- color scaling

Do not add WebGL-heavy component tests for the MVP. Add only a light panel empty-state/dropdown test if it catches behavior that pure tests cannot.

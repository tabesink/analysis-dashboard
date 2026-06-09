# Implementation Notes for Junior Developers

## Where to start

Start with the existing Inspect Damage page and identify the calculated data already available there:

- `selectedEvents: EventMetadata[]`
- `damageRowsByEventId: Map<string, DamageInspectRow>`
- `damageResponse.channels: DamageChannelMetadata[]`

The 3D plot should consume a small adapted row shape built from those values. Do not start from table DOM, visible columns, table sort, or table filters for the MVP.

## Important: do not start in Three.js

Most bugs will come from data mapping, not WebGL. Implement and test these first:

1. `EventMetadata` + `DamageInspectRow` join
2. version extraction from adapted rows
3. fixed 12-channel ordering
4. `DamageCell.status` and finite-value filtering
5. height scaling
6. layout bounds

Only then wire the canvas.

Use vertical TDD. Write one behavior test, implement only enough code to pass it, then move to the next behavior.

## Expected parent integration shape

```tsx
import { DamagePlotSidePanel } from '@/features/inspect-damage-3d/components/DamagePlotSidePanel';
import { buildInspectDamagePlotRows } from '@/features/inspect-damage-3d/lib/build-inspect-damage-plot-rows';

export function InspectDamagePage() {
  const selectedEvents = ...;
  const damageRowsByEventId = ...;
  const plotRows = buildInspectDamagePlotRows({
    selectedEvents,
    damageRowsByEventId,
  });

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="min-w-0 flex-1 overflow-auto">
        <InspectDamageTable />
      </div>
      <DamagePlotSidePanel rows={plotRows} />
    </div>
  );
}
```

## Building plot rows

The actual source is not a flat table row. Keep the adapter pure and test it through its public function.

```ts
type BuildInspectDamagePlotRowsInput = {
  selectedEvents: readonly EventMetadata[];
  damageRowsByEventId: ReadonlyMap<string, DamageInspectRow>;
};

function buildInspectDamagePlotRows({
  selectedEvents,
  damageRowsByEventId,
}: BuildInspectDamagePlotRowsInput): InspectDamagePlotRow[] {
  return selectedEvents.flatMap((event) => {
    const row = damageRowsByEventId.get(event.event_id);
    if (!row) return [];

    return [{
      event_id: event.event_id,
      job_number: event.job_number,
      work_order: event.work_order,
      program_id: event.program_id,
      version: event.version,
      damages: row.damages,
    }];
  });
}
```

Use `job_number`, not `job_id`. `EventMetadata.version` is the version source; `DamageInspectRow` does not carry version.

## Null handling policy

Recommended MVP policy: render a cell only when:

- `cell.status === 'ok'`
- `typeof cell.damage === 'number'`
- `Number.isFinite(cell.damage)`
- `cell.damage >= 0`

Preserve real zero damage. Skip null, undefined, NaN, infinite, errored, missing, and negative values.

Reason: rendering a zero-height bar for missing data can make missing values look like real zero damage. Silently clamping negative damage hides invalid upstream data.

## Fixed channel axis

The plot axis is the DEC-066 channel set:

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

Always reserve these positions. `damageResponse.channels` may be a subset for the selected calculation; use that for availability summaries, not for changing the axis.

## Performance policy

The MVP should use normal mesh bars for readability and include an explicit cap/warning for large cell counts. After the feature works and real usage proves the need, switch `DamagePlotBars` internals to `InstancedMesh`.

Do not change the `DamagePlotBars` public props when doing that optimization.

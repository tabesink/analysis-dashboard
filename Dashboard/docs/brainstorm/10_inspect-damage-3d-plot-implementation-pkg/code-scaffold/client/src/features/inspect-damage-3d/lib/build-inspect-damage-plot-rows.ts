import type { DamageInspectRow, EventMetadata } from '@/types/api';
import type { InspectDamagePlotRow } from './damage-plot-types';

type BuildInspectDamagePlotRowsInput = {
  selectedEvents: readonly EventMetadata[];
  damageRowsByEventId: ReadonlyMap<string, DamageInspectRow>;
};

export function buildInspectDamagePlotRows({
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

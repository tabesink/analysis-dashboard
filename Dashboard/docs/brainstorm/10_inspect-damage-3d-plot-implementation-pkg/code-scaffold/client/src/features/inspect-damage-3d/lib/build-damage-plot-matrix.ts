import type {
  DamageChannelDefinition,
  DamagePlotCell,
  InspectDamagePlotRow,
} from './damage-plot-types';

export function getDamageVersionOptions(rows: readonly InspectDamagePlotRow[]): string[] {
  return Array.from(
    new Set(
      rows
        .map((row) => row.version?.trim())
        .filter((version): version is string => Boolean(version)),
    ),
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function filterDamageRowsByVersion(
  rows: readonly InspectDamagePlotRow[],
  version: string | null | undefined,
): InspectDamagePlotRow[] {
  if (!version) return [];
  return rows.filter((row) => row.version === version);
}

export function buildDamagePlotCells(
  rows: readonly InspectDamagePlotRow[],
  channels: readonly DamageChannelDefinition[],
): DamagePlotCell[] {
  const cells: DamagePlotCell[] = [];

  rows.forEach((row, eventIndex) => {
    const eventLabel = row.work_order || row.event_id;

    channels.forEach((channel, channelIndex) => {
      const cell = row.damages[channel.key];
      const rawDamage = cell?.damage;
      if (
        cell?.status !== 'ok' ||
        typeof rawDamage !== 'number' ||
        !Number.isFinite(rawDamage) ||
        rawDamage < 0
      ) {
        return;
      }

      cells.push({
        eventId: row.event_id,
        eventLabel,
        eventIndex,
        version: row.version,
        channelKey: channel.key,
        channelLabel: channel.label,
        channelIndex,
        damage: rawDamage,
        metadata: {
          job_number: row.job_number,
          work_order: row.work_order,
          program_id: row.program_id,
        },
      });
    });
  });

  return cells;
}

import { describe, expect, it } from 'vitest';
import { DAMAGE_CHANNELS } from '../lib/damage-channel-axis';
import { buildInspectDamagePlotRows } from '../lib/build-inspect-damage-plot-rows';
import {
  buildDamagePlotCells,
  filterDamageRowsByVersion,
  getDamageVersionOptions,
} from '../lib/build-damage-plot-matrix';
import { getDamageColor, normalizeValue } from '../lib/damage-color-scale';
import { computeDamagePlotLayout } from '../lib/damage-plot-layout';
import type { DamageInspectRow, EventMetadata } from '@/types/api';
import type { InspectDamagePlotRow } from '../lib/damage-plot-types';

const rows: InspectDamagePlotRow[] = [
  {
    event_id: 'E2',
    work_order: 'WO-2',
    program_id: 'P1',
    version: 'V2',
    damages: {
      bj_x_force: { status: 'ok', damage: 0.2 },
      bj_y_force: { status: 'error', damage: null, error: 'missing channel' },
    },
  },
  {
    event_id: 'E1',
    work_order: 'WO-1',
    program_id: 'P1',
    version: 'V1',
    damages: {
      bj_x_force: { status: 'ok', damage: 0.1 },
      bj_y_force: { status: 'ok', damage: 0 },
      bj_z_force: { status: 'ok', damage: -1 },
      shock_x_force: { status: 'ok', damage: Number.NaN },
      shock_y_force: { status: 'error', damage: 0.3, error: 'calc failed' },
    },
  },
];

describe('damage plot utils', () => {
  it('adapts selected events with calculated damage rows into plot rows', () => {
    const selectedEvents: EventMetadata[] = [
      {
        event_id: 'E1',
        program_id: 'P1',
        version: 'V1',
        status: 'Approved',
        job_number: 'JOB-1',
        work_order: 'WO-1',
      },
      {
        event_id: 'E3',
        program_id: 'P1',
        version: 'V1',
        status: 'Approved',
      },
    ];
    const damageRowsByEventId = new Map<string, DamageInspectRow>([
      [
        'E1',
        {
          event_id: 'E1',
          program_id: 'P1',
          damages: {
            bj_x_force: { status: 'ok', damage: 0.1 },
          },
        },
      ],
    ]);

    expect(buildInspectDamagePlotRows({ selectedEvents, damageRowsByEventId })).toEqual([
      {
        event_id: 'E1',
        job_number: 'JOB-1',
        work_order: 'WO-1',
        program_id: 'P1',
        version: 'V1',
        damages: {
          bj_x_force: { status: 'ok', damage: 0.1 },
        },
      },
    ]);
  });

  it('extracts sorted version options', () => {
    expect(getDamageVersionOptions(rows)).toEqual(['V1', 'V2']);
  });

  it('filters rows by version', () => {
    expect(filterDamageRowsByVersion(rows, 'V1')).toHaveLength(1);
    expect(filterDamageRowsByVersion(rows, 'missing')).toHaveLength(0);
  });

  it('builds cells and skips missing, errored, non-finite, and negative damage values', () => {
    const cells = buildDamagePlotCells(filterDamageRowsByVersion(rows, 'V1'), DAMAGE_CHANNELS);
    expect(cells.map((cell) => cell.channelKey)).toEqual(['bj_x_force', 'bj_y_force']);
    expect(cells.map((cell) => cell.damage)).toEqual([0.1, 0]);
  });

  it('computes plot layout bounds and bars', () => {
    const cells = buildDamagePlotCells(filterDamageRowsByVersion(rows, 'V1'), DAMAGE_CHANNELS);
    const layout = computeDamagePlotLayout(cells, DAMAGE_CHANNELS);

    expect(layout.bars).toHaveLength(2);
    expect(layout.bounds.width).toBeGreaterThan(0);
    expect(layout.bounds.depth).toBeGreaterThan(0);
    expect(layout.maxDamage).toBe(0.1);
  });

  it('normalizes and clamps color values', () => {
    expect(normalizeValue(5, 0, 10)).toBe(0.5);
    expect(normalizeValue(-1, 0, 10)).toBe(0);
    expect(normalizeValue(11, 0, 10)).toBe(1);
    expect(getDamageColor(5, 0, 10)).toMatch(/^rgb\(/);
  });
});

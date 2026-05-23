import { describe, expect, it } from 'vitest';

import {
  getDefaultColumnFilters,
  getDefaultInspectDamageTablePreferences,
  mergeTreeExpansionWithTreeKeys,
  parseInspectDamageTablePreferences,
  resolvePersistedExpansion,
  serializeInspectDamageTablePreferences,
} from './inspect-damage-table-preferences';

describe('inspect damage table preferences', () => {
  it('parses legacy v1 payload with only visibleColumns and columnWidths', () => {
    const legacy = JSON.stringify({
      visibleColumns: { work_order: true, job_number: false },
      columnWidths: { programId: 250, work_order: 120 },
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const parsed = parseInspectDamageTablePreferences(legacy);

    expect(parsed).not.toBeNull();
    expect(parsed?.visibleColumns).toEqual({ work_order: true, job_number: false });
    expect(parsed?.columnWidths).toEqual({ programId: 250, work_order: 120 });
    expect(parsed?.expandedPrograms).toEqual([]);
    expect(parsed?.expandedVersions).toEqual([]);
    expect(parsed?.sortField).toBe('job_number');
    expect(parsed?.sortDirection).toBe('asc');
    expect(parsed?.columnFilters).toEqual(getDefaultColumnFilters());
  });

  it('round-trips full payload including expansion, sort, and filters', () => {
    const prefs = {
      ...getDefaultInspectDamageTablePreferences(),
      visibleColumns: { work_order: true, job_number: true },
      columnWidths: { programId: 300 },
      expandedPrograms: ['P1', 'P2'],
      expandedVersions: ['P1::V1'],
      sortField: 'work_order',
      sortDirection: 'desc' as const,
      columnFilters: { work_order: ['WO-1'], job_number: [] },
      updatedAt: '2026-05-22T12:00:00.000Z',
    };

    const serialized = serializeInspectDamageTablePreferences(prefs);
    const parsed = parseInspectDamageTablePreferences(serialized);

    expect(parsed).toEqual(prefs);
  });

  it('mergeTreeExpansionWithTreeKeys keeps expanded version when tree keys are unchanged', () => {
    const stored = {
      expandedPrograms: ['P1'],
      expandedVersions: ['P1::V1'],
    };
    const programIds = ['P1'];
    const versionKeys = ['P1::V1'];

    const merged = mergeTreeExpansionWithTreeKeys(stored, programIds, versionKeys);

    expect(merged.expandedPrograms).toEqual(['P1']);
    expect(merged.expandedVersions).toEqual(['P1::V1']);
  });

  it('mergeTreeExpansionWithTreeKeys adds new program expanded and new version collapsed', () => {
    const stored = {
      expandedPrograms: ['P1'],
      expandedVersions: ['P1::V1'],
    };
    const programIds = ['P1', 'P2'];
    const versionKeys = ['P1::V1', 'P1::V2', 'P2::V1'];

    const merged = mergeTreeExpansionWithTreeKeys(stored, programIds, versionKeys);

    expect(merged.expandedPrograms).toEqual(['P1', 'P2']);
    expect(merged.expandedVersions).toEqual(['P1::V1']);
  });

  it('mergeTreeExpansionWithTreeKeys drops stale keys no longer in tree', () => {
    const stored = {
      expandedPrograms: ['P1', 'P-removed'],
      expandedVersions: ['P1::V1', 'P-removed::V1'],
    };
    const programIds = ['P1'];
    const versionKeys = ['P1::V1'];

    const merged = mergeTreeExpansionWithTreeKeys(stored, programIds, versionKeys);

    expect(merged.expandedPrograms).toEqual(['P1']);
    expect(merged.expandedVersions).toEqual(['P1::V1']);
  });

  it('mergeTreeExpansionWithTreeKeys defaults all programs expanded when stored is empty', () => {
    const programIds = ['P1', 'P2'];
    const versionKeys = ['P1::V1', 'P2::V1'];

    const merged = mergeTreeExpansionWithTreeKeys(
      { expandedPrograms: [], expandedVersions: [] },
      programIds,
      versionKeys,
    );

    expect(merged.expandedPrograms).toEqual(['P1', 'P2']);
    expect(merged.expandedVersions).toEqual([]);
  });

  it('resolvePersistedExpansion keeps stored expansion before tree hydration', () => {
    const resolved = resolvePersistedExpansion(
      false,
      { expandedPrograms: [], expandedVersions: [] },
      { expandedPrograms: ['P1'], expandedVersions: ['P1::V1'] },
    );

    expect(resolved).toEqual({
      expandedPrograms: ['P1'],
      expandedVersions: ['P1::V1'],
    });
  });

  it('resolvePersistedExpansion uses live expansion after tree hydration', () => {
    const resolved = resolvePersistedExpansion(
      true,
      { expandedPrograms: ['P1'], expandedVersions: ['P1::V1', 'P1::V2'] },
      { expandedPrograms: ['P1'], expandedVersions: ['P1::V1'] },
    );

    expect(resolved).toEqual({
      expandedPrograms: ['P1'],
      expandedVersions: ['P1::V1', 'P1::V2'],
    });
  });
});

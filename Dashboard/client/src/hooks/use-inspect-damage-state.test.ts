import { describe, expect, it } from 'vitest';

import {
  getDefaultTablePreferencesState,
  mergeInspectDamageState,
  tablePreferencesUiEqual,
  uiTablePrefsFromSession,
  uiTablePrefsToSession,
} from '@/lib/inspect-damage-table-preferences';
import { getDefaultSessionState, mergeSessionUpdates } from '@/lib/session/session-sync';
import type { SessionState } from '@/types/session';

describe('inspect damage session defaults', () => {
  it('includes empty inspect_damage_state in default session state', () => {
    const defaults = getDefaultSessionState();

    expect(defaults.inspect_damage_state).toEqual({
      table_preferences: undefined,
    });
  });

  it('restores table preferences from session backup', () => {
    const tablePreferences = {
      ...getDefaultTablePreferencesState(),
      expanded_versions: ['P1::V1'],
    };
    const defaults = getDefaultSessionState({
      inspect_damage_state: { table_preferences: tablePreferences },
    });

    expect(defaults.inspect_damage_state).toEqual({
      table_preferences: tablePreferences,
    });
  });

  it('uses data_state as the only restored event selection source', () => {
    const defaults = getDefaultSessionState({
      data_state: {
        program_ids: [],
        versions: [],
        selected_event_ids: ['event-a', 'event-b'],
      },
      inspect_damage_state: {
        selected_event_ids: ['legacy-event'],
        table_preferences: undefined,
      },
    } as Partial<SessionState> & {
      inspect_damage_state: { selected_event_ids: string[]; table_preferences: undefined };
    });

    expect(defaults.data_state.selected_event_ids).toEqual(['event-a', 'event-b']);
    expect(defaults.inspect_damage_state).toEqual({
      table_preferences: undefined,
    });
  });
});

describe('inspect damage state merge', () => {
  it('mergeInspectDamageState updates table_preferences', () => {
    const current = {
      table_preferences: {
        ...getDefaultTablePreferencesState(),
        expanded_versions: ['P1::V1'],
      },
    };

    const merged = mergeInspectDamageState(current, {
      table_preferences: {
        ...getDefaultTablePreferencesState(),
        sort_field: 'work_order',
      },
    });

    expect(merged.table_preferences?.sort_field).toBe('work_order');
  });

  it('mergeInspectDamageState preserves table_preferences when patch omits them', () => {
    const current = {
      table_preferences: getDefaultTablePreferencesState(),
    };

    const merged = mergeInspectDamageState(current, {});

    expect(merged.table_preferences).toEqual(getDefaultTablePreferencesState());
  });

  it('round-trips table preferences between session and UI formats', () => {
    const sessionPrefs = {
      ...getDefaultTablePreferencesState(),
      visible_columns: { work_order: true },
      expanded_versions: ['P1::V1'],
      sort_field: 'work_order',
      sort_direction: 'desc' as const,
    };

    const uiPrefs = uiTablePrefsFromSession(sessionPrefs);
    expect(uiPrefs).not.toBeNull();
    expect(uiTablePrefsToSession(uiPrefs!)).toEqual(sessionPrefs);
  });

  it('tablePreferencesUiEqual detects unchanged payloads', () => {
    const prefs = {
      visibleColumns: { work_order: true },
      columnWidths: { programId: 250 },
      expandedPrograms: ['P1'],
      expandedVersions: ['P1::V1'],
      sortField: 'job_number',
      sortDirection: 'asc' as const,
      columnFilters: { work_order: [], job_number: [] },
    };

    expect(tablePreferencesUiEqual(prefs, prefs)).toBe(true);
    expect(
      tablePreferencesUiEqual(prefs, {
        ...prefs,
        expandedVersions: [],
      }),
    ).toBe(false);
  });
});

describe('session update merge', () => {
  it('deep-merges data_state with inspect damage table preferences', () => {
    const tablePreferences = getDefaultTablePreferencesState();
    const merged = mergeSessionUpdates(
      {
        data_state: {
          program_ids: ['P1'],
          versions: ['V1'],
          selected_event_ids: ['event-a'],
        },
        inspect_damage_state: {
          table_preferences: tablePreferences,
        },
      },
      {
        data_state: {
          selected_event_ids: ['event-b'],
        },
        inspect_damage_state: {
          table_preferences: {
            sort_field: 'work_order',
          },
        },
      } as Partial<SessionState>,
    );

    expect(merged.data_state).toEqual({
      program_ids: ['P1'],
      versions: ['V1'],
      selected_event_ids: ['event-b'],
    });
    expect(merged.inspect_damage_state?.table_preferences).toEqual({
      ...tablePreferences,
      sort_field: 'work_order',
    });
  });
});

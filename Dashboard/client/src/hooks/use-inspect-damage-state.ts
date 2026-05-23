'use client';

import { useCallback, useMemo } from 'react';
import {
  getDefaultTablePreferencesState,
  mergeInspectDamageState,
  uiTablePrefsFromSession,
  uiTablePrefsToSession,
  type InspectDamageTablePreferences,
} from '@/lib/inspect-damage-table-preferences';
import { useSession } from './use-session';
import type {
  InspectDamageState,
  InspectDamageTablePreferencesState,
} from '@/types/session';

const DEFAULT_INSPECT_DAMAGE_STATE: InspectDamageState = {
  table_preferences: undefined,
};

export function useInspectDamageState() {
  const { session, updateSession, isLoading } = useSession();

  const inspectDamageState = useMemo<InspectDamageState>(
    () => session?.inspect_damage_state ?? DEFAULT_INSPECT_DAMAGE_STATE,
    [session?.inspect_damage_state],
  );

  const tablePreferences = inspectDamageState.table_preferences;
  const tablePreferencesUi = useMemo(
    () => uiTablePrefsFromSession(tablePreferences),
    [tablePreferences],
  );
  const isSessionReady = Boolean(session) && !isLoading;

  const updateInspectDamageState = useCallback(
    (patch: Partial<InspectDamageState>) => {
      updateSession({
        inspect_damage_state: mergeInspectDamageState(
          session?.inspect_damage_state,
          patch,
        ),
      });
    },
    [session?.inspect_damage_state, updateSession],
  );

  const setTablePreferences = useCallback(
    (prefs: Omit<InspectDamageTablePreferences, 'updatedAt'>) => {
      updateInspectDamageState({
        table_preferences: uiTablePrefsToSession(prefs),
      });
    },
    [updateInspectDamageState],
  );

  const updateTablePreferences = useCallback(
    (patch: Partial<InspectDamageTablePreferencesState>) => {
      const current = session?.inspect_damage_state?.table_preferences
        ?? getDefaultTablePreferencesState();
      updateInspectDamageState({
        table_preferences: {
          ...current,
          ...patch,
        },
      });
    },
    [session?.inspect_damage_state?.table_preferences, updateInspectDamageState],
  );

  const resetTablePreferences = useCallback(() => {
    updateInspectDamageState({
      table_preferences: getDefaultTablePreferencesState(),
    });
  }, [updateInspectDamageState]);

  return {
    tablePreferences,
    tablePreferencesUi,
    setTablePreferences,
    updateTablePreferences,
    resetTablePreferences,
    isSessionReady,
    isSessionLoading: isLoading,
  };
}

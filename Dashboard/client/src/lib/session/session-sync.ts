/**
 * Session synchronization utilities for persistent user state.
 * 
 * Manages two-tier session persistence:
 * 1. Session ID in localStorage - survives browser restarts, identifies user across sessions
 * 2. Session backup in sessionStorage - survives page refreshes, provides instant restore
 * 
 * The session ID is the primary key for server-side session state (data selections,
 * filters, rendered events). The backup is a client-side cache that prevents flicker
 * on page reload by providing immediate state while the server fetch completes.
 * 
 * Used by session-store to:
 * - Initialize session on app load (restore ID + backup)
 * - Debounce sync to server (SYNC_DEBOUNCE_MS)
 * - Periodically backup state to sessionStorage (BACKUP_INTERVAL_MS)
 * 
 * Session state includes:
 * - data_state: selected programs, versions, events
 * - global_filters: user-applied dimension filters
 * - rendered_event_ids: events currently rendered in plots
 * - ui_preferences: tab selection, view modes, etc.
 */

import type { SessionResponse, SessionState } from '@/types/session';

export const SESSION_ID_KEY = 'rsp_session_id';
export const SESSION_BACKUP_KEY = 'rsp_session_backup';
export const SYNC_DEBOUNCE_MS = 300;
export const BACKUP_INTERVAL_MS = 60_000;

const DEFAULT_SESSION_STATE: Omit<SessionState, 'session_id'> = {
  data_state: { program_ids: [], versions: [], selected_event_ids: [] },
  global_filters: {},
  rendered_event_ids: [],
  inspect_damage_state: { table_preferences: undefined },
};

export function getDefaultSessionState(
  backup?: Partial<SessionState> | null,
): Omit<SessionState, 'session_id'> {
  if (!backup) return DEFAULT_SESSION_STATE;
  return {
    ...DEFAULT_SESSION_STATE,
    ...backup,
    inspect_damage_state: {
      table_preferences: backup.inspect_damage_state?.table_preferences,
    },
  };
}

export function getInitialSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SESSION_ID_KEY);
}

export function getSessionBackup(): Partial<SessionState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const backup = sessionStorage.getItem(SESSION_BACKUP_KEY);
    return backup ? (JSON.parse(backup) as Partial<SessionState>) : null;
  } catch {
    return null;
  }
}

export function saveSessionBackup(session: SessionResponse): void {
  if (typeof window === 'undefined') return;
  try {
    const backup: Partial<SessionState> = {
      data_state: session.data_state,
      global_filters: session.global_filters,
      rendered_event_ids: session.rendered_event_ids,
      ui_preferences: session.ui_preferences,
      inspect_damage_state: {
        table_preferences: session.inspect_damage_state?.table_preferences,
      },
    };
    sessionStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify(backup));
  } catch {
    // Ignore storage errors; backup is best-effort.
  }
}

export function clearSessionBackup(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_BACKUP_KEY);
}

export function mergeSessionUpdates(
  current: Partial<SessionState>,
  updates: Partial<SessionState>,
): Partial<SessionState> {
  const merged: Partial<SessionState> = {
    ...current,
    ...updates,
  };

  if (current.data_state && updates.data_state) {
    merged.data_state = {
      ...current.data_state,
      ...updates.data_state,
    };
  }

  if (current.ui_preferences && updates.ui_preferences) {
    merged.ui_preferences = {
      ...current.ui_preferences,
      ...updates.ui_preferences,
    };
  }

  if (current.inspect_damage_state && updates.inspect_damage_state) {
    const updateHasTablePreferences = Object.prototype.hasOwnProperty.call(
      updates.inspect_damage_state,
      'table_preferences',
    );
    const tablePreferences =
      updateHasTablePreferences &&
      current.inspect_damage_state.table_preferences &&
      updates.inspect_damage_state.table_preferences
        ? {
            ...current.inspect_damage_state.table_preferences,
            ...updates.inspect_damage_state.table_preferences,
          }
        : updateHasTablePreferences
          ? updates.inspect_damage_state.table_preferences
          : current.inspect_damage_state.table_preferences;

    merged.inspect_damage_state = {
      ...current.inspect_damage_state,
      ...updates.inspect_damage_state,
      table_preferences: tablePreferences,
    };
  }

  return merged;
}

export function hasSessionUpdates(state: Partial<SessionState>): boolean {
  return Object.keys(state).length > 0;
}

export function hasUnrenderedSelection(
  selectedEventIds: string[],
  renderedEventIds: string[],
): boolean {
  if (selectedEventIds.length === 0 && renderedEventIds.length === 0) {
    return false;
  }
  const selectedSet = new Set(selectedEventIds);
  const renderedSet = new Set(renderedEventIds);
  if (selectedSet.size !== renderedSet.size) {
    return true;
  }
  for (const id of selectedSet) {
    if (!renderedSet.has(id)) {
      return true;
    }
  }
  return false;
}

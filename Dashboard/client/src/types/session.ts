/**
 * Session state type definitions
 */

import type { DataState, GlobalFilters } from './api';

/**
 * UI preferences stored in session
 */
export interface UIPreferences {
  grid_columns?: number;
  active_tab?: string;
  baseline_opacity?: number;
}

/**
 * Inspect Damage table UI preferences persisted in session
 */
export interface InspectDamageTablePreferencesState {
  visible_columns: Record<string, boolean>;
  column_widths: Record<string, number>;
  expanded_programs: string[];
  expanded_versions: string[];
  sort_field: string;
  sort_direction: 'asc' | 'desc';
  column_filters: Record<string, string[]>;
}

/**
 * Inspect Damage route UI state. Event selection is stored in data_state.
 */
export interface InspectDamageState {
  table_preferences?: InspectDamageTablePreferencesState;
}

/**
 * Full session state persisted on server
 */
export interface SessionState {
  data_state: DataState;
  global_filters: GlobalFilters;
  rendered_event_ids: string[];
  ui_preferences?: UIPreferences;
  inspect_damage_state?: InspectDamageState;
}

/**
 * Request payload for creating a session.
 */
export interface SessionCreatePayload {
  data_state?: DataState;
  global_filters?: GlobalFilters;
  rendered_event_ids?: string[];
  ui_preferences?: UIPreferences;
  inspect_damage_state?: InspectDamageState;
}

/**
 * Request payload for updating a session.
 */
export interface SessionUpdatePayload {
  data_state?: DataState;
  global_filters?: GlobalFilters;
  rendered_event_ids?: string[];
  ui_preferences?: UIPreferences;
  inspect_damage_state?: InspectDamageState;
}

/**
 * Session response from server
 */
export interface SessionResponse extends SessionState {
  session_id: string;
  created_at: string;
  updated_at: string;
}


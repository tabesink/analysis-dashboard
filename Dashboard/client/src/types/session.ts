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
 * Full session state persisted on server
 */
export interface SessionState {
  data_state: DataState;
  global_filters: GlobalFilters;
  rendered_event_ids: string[];
  ui_preferences?: UIPreferences;
}

/**
 * Request payload for creating a session.
 */
export interface SessionCreatePayload {
  data_state?: DataState;
  global_filters?: GlobalFilters;
  rendered_event_ids?: string[];
  ui_preferences?: UIPreferences;
}

/**
 * Request payload for updating a session.
 */
export interface SessionUpdatePayload {
  data_state?: DataState;
  global_filters?: GlobalFilters;
  rendered_event_ids?: string[];
  ui_preferences?: UIPreferences;
}

/**
 * Session response from server
 */
export interface SessionResponse extends SessionState {
  session_id: string;
  created_at: string;
  updated_at: string;
}


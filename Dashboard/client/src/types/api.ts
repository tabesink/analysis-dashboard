/**
 * API request/response type definitions
 */

// Event metadata from server
export interface EventMetadata {
  event_id: string;
  program_id: string;
  version: string;
  uploaded_by_user_id?: string;
  uploaded_by_username?: string;
  last_updated_by_user_id?: string;
  last_updated_by_username?: string;
  status: 'Approved' | 'Obsolete' | 'Pending';
  job_number?: string;
  work_order?: string;
  rfq?: boolean;
  dv?: boolean;
  pv?: boolean;
  post_prod?: boolean;
  suspension_component?: string;
  axle_location?: string;
  gvw?: string;
  gross_vehicle_weight_range_lbs?: string;
  fgawr?: string;
  fgawr_range_lbs?: string;
  rgawr?: string;
  rgawr_range_lbs?: string;
  drive_type?: string;
  material_construction?: string;
  steering_position?: string;
  damper_type?: string;
  vehicle_type?: string;
  custom_fields?: Record<string, string>;
  source_file?: string;
  row_count?: number;
  has_channel_map?: boolean;
  missing_channel_map?: boolean;
  selectable_for_plotting?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Data selection state
export interface DataState {
  program_ids: string[];
  versions: string[];
  selected_event_ids: string[];
}

// Global filters applied to all events
export type GlobalFilters = Record<string, string[] | string | undefined> & {
  event_id_query?: string;
};

// Events request/response
export interface EventsRequest {
  program_ids?: string[];
  versions?: string[];
  global_filters: GlobalFilters;
}

export interface EventsResponse {
  events: EventMetadata[];
  total_count: number;
  has_more: boolean;
}

export interface EventMetadataUpdateFields {
  job_number?: string | null;
  work_order?: string | null;
  rfq?: boolean | null;
  dv?: boolean | null;
  pv?: boolean | null;
  post_prod?: boolean | null;
  suspension_component?: string | null;
  axle_location?: string | null;
  gvw?: string | null;
  fgawr?: string | null;
  rgawr?: string | null;
  drive_type?: string | null;
  material_construction?: string | null;
  steering_position?: string | null;
  damper_type?: string | null;
  vehicle_type?: string | null;
  status?: string | null;
}

export interface EventMetadataUpdateRequest extends EventMetadataUpdateFields {
  if_unmodified_since: string | null;
}

export interface ProgramVersionMetadataUpdateRequest {
  program_id: string;
  version: string;
  updates: EventMetadataUpdateFields;
}

export interface ProgramVersionMetadataUpdateResponse {
  program_id: string;
  version: string;
  updated_event_count: number;
  status?: string | null;
  uploaded_by_user_id?: string | null;
  uploaded_by_username?: string | null;
  last_updated_by_user_id?: string | null;
  last_updated_by_username?: string | null;
  uploaded_at?: string | null;
  last_updated_at?: string | null;
}

// Filter option entry from server (includes column mapping and order)
export interface FilterOptionEntry {
  column: string;
  order: number;
  values: string[];
  source?: 'core' | 'custom';
  data_type?: string;
}

// Filter options (dynamic from server) - keyed by display name
export type FilterOptions = Record<string, FilterOptionEntry>;

export interface CustomFieldDefinitionRequest {
  field_key: string;
  display_name: string;
  data_type?: string;
  is_filterable?: boolean;
}

export interface CustomFieldDefinitionResponse {
  field_key: string;
  display_name: string;
  data_type: string;
  is_filterable: boolean;
  created_by_user_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProgramCustomFieldValuesResponse {
  program_id: string;
  values_by_field: Record<string, string[]>;
}

export interface ChannelMapEditorEntry {
  plot_key: string;
  x_col: number;
  y_col: number;
}

export interface ChannelMapEditorResponse {
  program_id: string;
  version: string;
  has_channel_map: boolean;
  missing_channel_map: boolean;
  entries: ChannelMapEditorEntry[];
  preview_lines: string[];
  column_count: number;
  pending_artifact_count: number;
  failed_artifact_count: number;
}

export interface ChannelMapProcessResult {
  program_id: string;
  version: string;
  processed_count: number;
  failed_count: number;
  total_rows: number;
  processed: Array<Record<string, unknown>>;
  failed: Array<Record<string, unknown>>;
}

export interface DamageChannelMetadata {
  channel_key: string;
  channel_name: string;
  unit?: string | null;
}

export interface DamageCell {
  damage: number | null;
  status: string;
  error?: string | null;
}

export interface DamageInspectRow {
  event_id: string;
  job_number?: string | null;
  work_order?: string | null;
  program_id: string;
  damages: Record<string, DamageCell>;
}

export interface DamageInspectResponse {
  channels: DamageChannelMetadata[];
  rows: DamageInspectRow[];
}

// ============================================================================
// Standard API Error Response
// ============================================================================

/**
 * Standard error response structure from the API
 */
export interface APIErrorResponse {
  error: string;
  message: string;
  details?: Record<string, string[]>;
}


// ============================================================================
// SVG Plot Data Types (Client-Side Rendering)
// ============================================================================

/**
 * Single data point for SVG rendering
 */
export interface SVGPoint {
  x: number;
  y: number;
}

/**
 * Curve data for a single event on a plot
 */
export interface SVGCurveData {
  event_id: string;
  points: SVGPoint[];
  x_array?: Float32Array;
  y_array?: Float32Array;
  color?: string;
}

/**
 * All curves for a single plot
 */
export interface SVGPlotCurvesData {
  curves: SVGCurveData[];
  x_label: string;
  y_label: string;
  x_unit: string;
  y_unit: string;
}

/**
 * Metadata about the SVG plot data response
 */
export interface SVGPlotMetadata {
  total_events: number;
  total_points: number;
  scale_factor: number;
}

/**
 * Response from GET /api/v1/dashboard/plots/data
 */
export interface SVGPlotDataResponse {
  plots: Record<string, SVGPlotCurvesData>;
  metadata: SVGPlotMetadata;
}


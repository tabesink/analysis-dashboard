/**
 * Upload-related type definitions
 * Aligned with server Pydantic models (server/models/upload.py)
 */

// ============================================================================
// Server Response Types (match Pydantic models exactly)
// ============================================================================

/**
 * Validation issue from server
 * Matches: server.models.upload.ValidationIssue
 */
export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Result for a single file in an upload
 * Matches: server.models.upload.FileResult
 */
export interface FileResult {
  filename: string;
  success: boolean;
  event_id?: string;
  error?: string;
  row_count: number;
  validation_issues: ValidationIssue[];
}

/**
 * Response from upload endpoint
 * Matches: server.models.upload.UploadResponse
 */
export interface UploadResponse {
  success: boolean;
  files: FileResult[];
  event_ids: string[];
  error?: string;
  total_rows: number;
  pending_channel_map: boolean;
}

export interface UploadTaskStartResponse {
  task_id: string;
}

export interface UploadTaskEvent {
  task_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  phase: string;
  completed_events: number;
  total_events: number;
  current_event?: string;
  error?: string;
  result?: UploadResponse;
}

/**
 * Dataset information for upload management table
 * Matches: server.models.upload.DatasetInfo
 */
export interface DatasetInfo {
  event_id: string;
  program_id: string;
  version: string;
  source_file?: string;
  status?: 'Approved' | 'Obsolete' | 'Pending';
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
  row_count: number;
  created_at?: string;
}

/**
 * Response for single event deletion
 * Matches: server.models.upload.DeleteEventResponse
 */
export interface DeleteEventResponse {
  deleted: boolean;
  event_id: string;
}

/**
 * Response for bulk event deletion
 * Matches: server.models.upload.DeleteEventsResponse
 */
export interface DeleteEventsResponse {
  deleted_count: number;
  event_ids: string[];
}

export interface DeleteProgramVersionScopeRequest {
  program_id: string;
  version?: string | null;
}

export interface DeleteProgramVersionScopeResponse {
  deleted: boolean;
  program_id: string;
  version?: string | null;
  event_count: number;
  raw_rows: number;
  lttb_rows: number;
  event_custom_field_rows: number;
  artifact_count: number;
  channel_map_rows: number;
  deleted_files: number;
  skipped_files: string[];
  owner_user_ids: string[];
}

// ============================================================================
// Paginated Response (matches server.models.common.PaginatedResponse)
// ============================================================================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

/**
 * Aggregate counts and statuses for a (program_id, version) pair across
 * every non-deleted event (not just the current page).
 * Matches: server.models.upload.ProgramVersionSummary
 */
export interface ProgramVersionSummary {
  program_id: string;
  version: string;
  event_count: number;
  statuses: string[];
  has_channel_map: boolean;
  missing_channel_map: boolean;
  pending_artifact_count: number;
  failed_artifact_count: number;
}

/**
 * Response from GET /api/v1/upload/datasets
 * Matches: server.models.upload.DatasetListResponse
 */
export interface DatasetListResponse {
  items: DatasetInfo[];
  total: number;
  facets: Record<string, string[]>;
  program_versions: ProgramVersionSummary[];
}

// ============================================================================
// Client-side Form Types
// ============================================================================

/**
 * Upload metadata form state (client-side)
 */
export interface UploadMetadata {
  program_id: string;
  version: string;
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
  status?: string;
}

/**
 * File info for upload display
 */
export interface UploadedFile {
  name: string;
  size: number;
  type: string;
}

/**
 * Upload API functions
 * Single responsibility: HTTP calls only
 */

import { get, del, post, postFormDataWithProgress, getApiBaseUrl } from './client';
import type {
  UploadResponse,
  UploadTaskStartResponse,
  UploadTaskEvent,
  DatasetInfo,
  DatasetListResponse,
  UploadMetadata,
  DeleteEventResponse,
  DeleteEventsResponse,
  DeleteProgramVersionScopeRequest,
  DeleteProgramVersionScopeResponse,
} from '@/types/upload';

// Re-export types for convenience
export type { UploadResponse, UploadTaskStartResponse, UploadTaskEvent, DatasetInfo, UploadMetadata };

/**
 * Optional metadata fields for upload
 */
const OPTIONAL_METADATA_FIELDS = [
  'job_number',
  'work_order',
  'rfq',
  'dv',
  'pv',
  'post_prod',
  'suspension_component',
  'axle_location',
  'gvw',
  'gross_vehicle_weight_range_lbs',
  'fgawr',
  'fgawr_range_lbs',
  'rgawr',
  'rgawr_range_lbs',
  'drive_type',
  'material_construction',
  'steering_position',
  'damper_type',
  'vehicle_type',
  'status',
] as const;

const DATA_UPLOAD_TIMEOUT_MS = 3_600_000; // 60 minutes for large local-network uploads

export const uploadApi = {
  buildFolderUploadFormData: (
    dataFiles: File[],
    channelMapFile: File | undefined,
    metadata: UploadMetadata,
  ): FormData => {
    const formData = new FormData();

    dataFiles.forEach((file) => {
      formData.append('files', file);
    });
    if (channelMapFile) {
      formData.append('channel_map', channelMapFile);
    }
    formData.append('program_id', metadata.program_id);
    formData.append('version', metadata.version);

    OPTIONAL_METADATA_FIELDS.forEach((field) => {
      const value = metadata[field];
      if (typeof value === 'boolean') {
        formData.append(field, String(value));
        return;
      }
      if (value) formData.append(field, value);
    });
    return formData;
  },

  /**
   * Start async data upload task
   * Matches: POST /api/v1/upload/folder/start
   */
  startFolderUpload: (
    dataFiles: File[],
    channelMapFile: File | undefined,
    metadata: UploadMetadata,
    onProgress?: (percent: number, isProcessing: boolean) => void,
    signal?: AbortSignal,
  ): Promise<UploadTaskStartResponse> => {
    const formData = uploadApi.buildFolderUploadFormData(dataFiles, channelMapFile, metadata);
    return postFormDataWithProgress<UploadTaskStartResponse>(
      '/api/v1/upload/folder/start',
      formData,
      onProgress,
      DATA_UPLOAD_TIMEOUT_MS,
      signal,
    );
  },

  /**
   * Build EventSource URL for upload progress stream.
   */
  getFolderUploadEventsUrl: (taskId: string): string => {
    return `${getApiBaseUrl()}/api/v1/upload/folder/events/${taskId}`;
  },

  /**
   * List every non-deleted uploaded dataset plus global facets.
   * Matches: GET /api/v1/upload/datasets
   */
  listDatasets: (timeoutMs?: number): Promise<DatasetListResponse> =>
    get<DatasetListResponse>(`/api/v1/upload/datasets`, timeoutMs),

  /**
   * Delete a single dataset
   * Matches: DELETE /api/v1/upload/events/{event_id}
   */
  deleteDataset: (eventId: string): Promise<DeleteEventResponse> =>
    del<DeleteEventResponse>(`/api/v1/upload/events/${eventId}`),

  /**
   * Bulk delete datasets
   * Matches: POST /api/v1/upload/events/delete (using POST for body support)
   */
  deleteDatasets: (eventIds: string[]): Promise<DeleteEventsResponse> =>
    post<DeleteEventsResponse>('/api/v1/upload/events/delete', {
      event_ids: eventIds,
    }),

  /**
   * Hard-delete a full program or program/version scope.
   */
  deleteProgramVersionScope: (
    payload: DeleteProgramVersionScopeRequest,
  ): Promise<DeleteProgramVersionScopeResponse> =>
    post<DeleteProgramVersionScopeResponse>(
      '/api/v1/upload/program-version/delete',
      payload,
    ),
};

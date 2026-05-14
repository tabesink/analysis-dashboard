/**
 * Export/Import API — Parquet + ZIP portability (admin-only on server).
 */

import { APIError, getApiBaseUrl, postFormDataWithProgress } from './client';

export interface SchemaCompatibility {
  is_compatible: boolean;
  is_legacy: boolean;
  imported_schema_version: number | null;
  current_schema_version: number;
  schema_version_match: boolean;
  missing_columns: string[];
  extra_columns: string[];
}

export interface DatabaseValidationResponse {
  valid: boolean;
  event_count: number;
  size_mb: number;
  tables: string[];
  schema_compatibility: SchemaCompatibility;
  warnings: string[];
}

export interface UploadAndValidateResponse {
  upload_id: string;
  validation: DatabaseValidationResponse;
}

export interface StartTaskResponse {
  task_id: string;
}

export interface TaskStatusResponse {
  task_id: string;
  kind: string;
  status: string;
  progress: string;
  /** Server-reported phase: exporting, compressing, pending_download, downloading, extracting, importing, completed, failed, cancelled */
  phase: string;
  current: number;
  total: number;
  current_table: string | null;
  events_loaded: number | null;
  error: string | null;
  result: Record<string, unknown> | null;
}

export interface DatabaseInfoResponse {
  path: string;
  size_mb: number;
  event_count: number;
  program_count: number;
  /** Server max size for database import ZIP (MB) */
  max_upload_size_mb: number;
}

async function fetchWithCredentials(
  path: string,
  options: RequestInit,
): Promise<Response> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    credentials: 'include',
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body && typeof body === 'object' && 'detail' in body ? (body as { detail?: unknown }).detail : undefined;
    if (typeof detail === 'string') {
      throw new Error(detail);
    }
    throw new APIError(response.status, response.statusText, body);
  }

  return response;
}

const POLL_MS = 2000;
/** Large DB ZIP imports (multi-GB) */
const PARQUET_ZIP_UPLOAD_TIMEOUT_MS = 30 * 60 * 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export const exportApi = {
  getDatabaseInfo: async (): Promise<DatabaseInfoResponse> => {
    const response = await fetchWithCredentials('/api/v1/export/database/info', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
  },

  /** Start background Parquet export; poll task then download. */
  startParquetExport: async (): Promise<StartTaskResponse> => {
    const response = await fetchWithCredentials(
      '/api/v1/export/database/parquet/export/start',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
    );
    return response.json();
  },

  getParquetTaskStatus: async (taskId: string): Promise<TaskStatusResponse> => {
    const response = await fetchWithCredentials(
      `/api/v1/export/database/parquet/task/${taskId}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    );
    return response.json();
  },

  downloadParquetExport: async (taskId: string): Promise<Blob> => {
    const response = await fetchWithCredentials(
      `/api/v1/export/database/parquet/download/${taskId}`,
      { method: 'GET' },
    );
    return response.blob();
  },

  /**
   * Stream ZIP to server once; returns upload_id + validation for the modal.
   * Uses XHR for upload progress events and a long timeout for multi-GB files.
   */
  uploadParquetZip: async (
    file: File,
    options?: {
      onProgress?: (percent: number, isProcessing: boolean) => void;
      signal?: AbortSignal;
    },
  ): Promise<UploadAndValidateResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return postFormDataWithProgress<UploadAndValidateResponse>(
      '/api/v1/export/database/parquet/upload',
      formData,
      options?.onProgress,
      PARQUET_ZIP_UPLOAD_TIMEOUT_MS,
      options?.signal,
    );
  },

  startParquetImport: async (uploadId: string): Promise<StartTaskResponse> => {
    const response = await fetchWithCredentials(
      `/api/v1/export/database/parquet/import/${uploadId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
    );
    return response.json();
  },

  cancelParquetUpload: async (uploadId: string): Promise<void> => {
    await fetchWithCredentials(`/api/v1/export/database/parquet/upload/${uploadId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
  },

  /** Cancel a running export/import background task (best-effort). */
  cancelParquetTask: async (taskId: string): Promise<void> => {
    await fetchWithCredentials(`/api/v1/export/database/parquet/task/${taskId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
  },

  /**
   * Poll until task completes, fails, or is cancelled. Invokes onUpdate between polls.
   */
  waitForParquetTask: async (
    taskId: string,
    onUpdate?: (s: TaskStatusResponse) => void,
  ): Promise<TaskStatusResponse> => {
    for (;;) {
      const s = await exportApi.getParquetTaskStatus(taskId);
      onUpdate?.(s);
      if (
        s.status === 'completed' ||
        s.status === 'failed' ||
        s.status === 'cancelled'
      ) {
        return s;
      }
      await sleep(POLL_MS);
    }
  },
};

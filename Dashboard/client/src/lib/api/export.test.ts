import { afterEach, describe, expect, it, vi } from 'vitest';

import { exportApi } from './export';
import { postFormDataWithProgress } from './client';

vi.mock('./client', () => {
  class APIError extends Error {
    constructor(
      public status: number,
      public statusText: string,
      public body: unknown,
    ) {
      super(statusText);
    }
  }

  return {
    APIError,
    getApiBaseUrl: () => 'http://localhost:8000',
    postFormDataWithProgress: vi.fn(),
  };
});

describe('export api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('requests database info with credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          path: '/tmp/dashboard.db',
          size_mb: 1,
          event_count: 2,
          program_count: 1,
          max_upload_size_mb: 100,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(exportApi.getDatabaseInfo()).resolves.toMatchObject({
      event_count: 2,
      max_upload_size_mb: 100,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/export/database/info',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('uses current task route contracts for export and import actions', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => (
      new Response(JSON.stringify({ task_id: 'task-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    ));
    vi.stubGlobal('fetch', fetchMock);

    await exportApi.startParquetExport();
    await exportApi.startParquetImport('upload-1');
    await exportApi.cancelParquetUpload('upload-1');
    await exportApi.cancelParquetTask('task-1');

    expect(fetchMock.mock.calls.map(([url, init]) => [url, (init as RequestInit).method])).toEqual([
      ['http://localhost:8000/api/v1/export/database/parquet/export/start', 'POST'],
      ['http://localhost:8000/api/v1/export/database/parquet/import/upload-1', 'POST'],
      ['http://localhost:8000/api/v1/export/database/parquet/upload/upload-1', 'DELETE'],
      ['http://localhost:8000/api/v1/export/database/parquet/task/task-1', 'DELETE'],
    ]);
  });

  it('uses current task status and download route contracts', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ task_id: 'task-1', status: 'running' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response('zip bytes', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await exportApi.getParquetTaskStatus('task-1');
    await exportApi.downloadParquetExport('task-1');

    expect(fetchMock.mock.calls.map(([url, init]) => [url, (init as RequestInit).method])).toEqual([
      ['http://localhost:8000/api/v1/export/database/parquet/task/task-1', 'GET'],
      ['http://localhost:8000/api/v1/export/database/parquet/download/task-1', 'GET'],
    ]);
  });

  it('uploads parquet zip through the progress form helper', async () => {
    vi.mocked(postFormDataWithProgress).mockResolvedValue({
      upload_id: 'upload-1',
      validation: {
        valid: true,
        event_count: 1,
        size_mb: 0.1,
        tables: ['dim_event'],
        schema_compatibility: {
          is_compatible: true,
          is_legacy: false,
          imported_schema_version: 1,
          current_schema_version: 1,
          schema_version_match: true,
          missing_columns: [],
          extra_columns: [],
        },
        warnings: [],
      },
    });
    const onProgress = vi.fn();
    const signal = new AbortController().signal;

    await exportApi.uploadParquetZip(new File(['zip'], 'dashboard_export.zip'), {
      onProgress,
      signal,
    });

    expect(postFormDataWithProgress).toHaveBeenCalledTimes(1);
    const [path, formData, progress, timeout, passedSignal] = vi.mocked(
      postFormDataWithProgress,
    ).mock.calls[0];
    expect(path).toBe('/api/v1/export/database/parquet/upload');
    expect(formData).toBeInstanceOf(FormData);
    expect(progress).toBe(onProgress);
    expect(timeout).toBe(30 * 60 * 1000);
    expect(passedSignal).toBe(signal);
  });

  it('retries transient task poll gateway failures', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 502, statusText: 'Bad Gateway' }))
      .mockResolvedValueOnce(new Response('', { status: 503, statusText: 'Unavailable' }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            task_id: 'task-1',
            kind: 'import',
            status: 'completed',
            progress: 'Import complete',
            phase: 'completed',
            sub_phase: '',
            current: 16,
            total: 16,
            current_table: null,
            events_loaded: 1,
            error: null,
            result: { events: 1 },
            updated_at: 1,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const states: Array<{ connectionLost: boolean; message?: string }> = [];

    const task = exportApi.waitForParquetTask(
      'task-1',
      undefined,
      (state) => states.push(state),
    );

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(2000);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await vi.advanceTimersByTimeAsync(4000);

    await expect(task).resolves.toMatchObject({ status: 'completed' });
    expect(states).toContainEqual({
      connectionLost: true,
      message: 'Waiting for server… import may still be running.',
    });
    expect(states.at(-1)).toEqual({ connectionLost: false });
  });
});

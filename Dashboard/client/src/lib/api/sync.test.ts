import { afterEach, describe, expect, it, vi } from 'vitest';

import { syncApi } from './sync';

describe('sync api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('requests sync version endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data_version: 42 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const response = await syncApi.getVersion();
    expect(response).toEqual({ data_version: 42 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8000/api/v1/sync/version');
    expect(init.method).toBe('GET');
  });
});

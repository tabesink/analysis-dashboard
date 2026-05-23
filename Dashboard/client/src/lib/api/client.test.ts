import { afterEach, describe, expect, it, vi } from 'vitest';

import { get } from './client';

describe('api client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('includes credentials on requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    const result = await get<{ ok: boolean }>('/health');

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8000/health');
    expect(init.credentials).toBe('include');
    expect(init.method).toBe('GET');
  });

  it('uses relative URLs in same-origin proxy mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_MODE', 'same-origin');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    await get<{ ok: boolean }>('/api/v1/info');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/info');
  });

  it('normalizes error responses into APIError with sanitized message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: 'raw backend detail' }), {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'content-type': 'application/json' },
        })
      )
    );

    await expect(get('/secure')).rejects.toMatchObject({
      name: 'APIError',
      status: 401,
      statusText: 'Unauthorized',
      message: 'Authentication required.',
      body: { detail: 'raw backend detail' },
    });
  });

  it('returns APIError timeout when request aborts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        throw new DOMException('Aborted', 'AbortError');
      })
    );

    await expect(get('/slow', 1)).rejects.toMatchObject({
      name: 'APIError',
      status: 504,
      statusText: 'Gateway Timeout',
      message: 'Request timed out. Please try again.',
    });
  });
});

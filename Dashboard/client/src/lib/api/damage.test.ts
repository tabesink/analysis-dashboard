import { afterEach, describe, expect, it, vi } from 'vitest';

import { damageApi } from './damage';

describe('damage api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('posts selected event ids to the damage inspect endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ channels: [], rows: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(damageApi.inspect(['event-1', 'event-2'])).resolves.toEqual({
      channels: [],
      rows: [],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/damage/inspect',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ event_ids: ['event-1', 'event-2'] }),
      }),
    );
  });
});

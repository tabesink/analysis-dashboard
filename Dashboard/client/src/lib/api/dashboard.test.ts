import { afterEach, describe, expect, it, vi } from 'vitest';

import { dashboardApi } from './dashboard';

describe('dashboard api events by ids', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('requests events by ids endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          events: [{ event_id: 'event-1', program_id: 'P1', version: 'V1' }],
          total_count: 1,
          has_more: false,
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    vi.stubGlobal('fetch', fetchMock);

    const response = await dashboardApi.getEventsByIds(['event-1']);

    expect(response.events).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8000/api/v1/dashboard/events/by-ids');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ event_ids: ['event-1'] }));
  });
});

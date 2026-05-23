import { beforeEach, describe, expect, it } from 'vitest';
import type { DamageInspectResponse } from '@/types/api';
import {
  buildDamageResultCacheKey,
  MAX_CACHED_DAMAGE_RESULTS,
  useInspectDamageResultsStore,
} from './inspect-damage-results-store';

function responseFor(
  eventId: string,
  channelKey: string = 'bj_x_force',
): DamageInspectResponse {
  return {
    channels: [
      {
        channel_key: channelKey,
        channel_name: channelKey,
        unit: 'N',
      },
    ],
    rows: [
      {
        event_id: eventId,
        program_id: 'P1',
        damages: {
          [channelKey]: {
            damage: 1,
            status: 'ok',
          },
        },
      },
    ],
  };
}

describe('inspect damage result cache', () => {
  beforeEach(() => {
    useInspectDamageResultsStore.getState().clearCachedResults();
  });

  it('builds the same key for the same selected event set', () => {
    expect(buildDamageResultCacheKey(['event-c', 'event-a', 'event-b'])).toBe(
      buildDamageResultCacheKey(['event-b', 'event-c', 'event-a']),
    );
  });

  it('stores cached damage responses by normalized selection key', () => {
    const key = buildDamageResultCacheKey(['event-b', 'event-a']);
    const response = responseFor('event-a');

    useInspectDamageResultsStore.getState().setCachedResult(key, response);

    expect(useInspectDamageResultsStore.getState().cachedResults.get(key)).toBe(response);
  });

  it('evicts the oldest entries when the cache exceeds its maximum size', () => {
    for (let index = 0; index < MAX_CACHED_DAMAGE_RESULTS + 2; index += 1) {
      useInspectDamageResultsStore
        .getState()
        .setCachedResult(`key-${index}`, responseFor(`event-${index}`));
    }

    const cachedResults = useInspectDamageResultsStore.getState().cachedResults;
    expect(cachedResults.size).toBe(MAX_CACHED_DAMAGE_RESULTS);
    expect(cachedResults.has('key-0')).toBe(false);
    expect(cachedResults.has('key-1')).toBe(false);
    expect(cachedResults.has('key-2')).toBe(true);
    expect(cachedResults.has(`key-${MAX_CACHED_DAMAGE_RESULTS + 1}`)).toBe(true);
  });

  it('clears cached damage responses', () => {
    useInspectDamageResultsStore
      .getState()
      .setCachedResult('key-1', responseFor('event-1'));

    useInspectDamageResultsStore.getState().clearCachedResults();

    expect(useInspectDamageResultsStore.getState().cachedResults.size).toBe(0);
  });

});

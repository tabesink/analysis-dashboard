import { create } from 'zustand';
import type { DamageInspectResponse } from '@/types/api';

export const MAX_CACHED_DAMAGE_RESULTS = 10;

const DAMAGE_RESULT_KEY_DELIMITER = '\u0000';

interface InspectDamageResultsState {
  cachedResults: Map<string, DamageInspectResponse>;
  setCachedResult: (cacheKey: string, response: DamageInspectResponse) => void;
  clearCachedResults: () => void;
}

export function buildDamageResultCacheKey(eventIds: string[]): string {
  return [...eventIds].sort().join(DAMAGE_RESULT_KEY_DELIMITER);
}

export const useInspectDamageResultsStore = create<InspectDamageResultsState>((set) => ({
  cachedResults: new Map(),
  setCachedResult: (cacheKey, response) =>
    set((state) => {
      const next = new Map(state.cachedResults);
      next.delete(cacheKey);
      next.set(cacheKey, response);
      if (next.size > MAX_CACHED_DAMAGE_RESULTS) {
        const iter = next.keys();
        let evictCount = next.size - MAX_CACHED_DAMAGE_RESULTS;
        while (evictCount-- > 0) {
          next.delete(iter.next().value!);
        }
      }
      return { cachedResults: next };
    }),
  clearCachedResults: () => set({ cachedResults: new Map() }),
}));

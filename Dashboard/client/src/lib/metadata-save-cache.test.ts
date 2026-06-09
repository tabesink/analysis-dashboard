import { describe, expect, it, vi } from 'vitest';

import {
  invalidateQueriesAfterMetadataSave,
  METADATA_SAVE_INVALIDATION_KEYS,
} from '@/lib/metadata-save-cache';

describe('invalidateQueriesAfterMetadataSave', () => {
  it('invalidates filter-options along with other metadata-dependent queries', async () => {
    const invalidated: string[] = [];
    const queryClient = {
      invalidateQueries: vi.fn(async ({ queryKey }: { queryKey: string[] }) => {
        invalidated.push(queryKey[0]);
      }),
    };

    await invalidateQueriesAfterMetadataSave(queryClient as never);

    expect(invalidated).toEqual([...METADATA_SAVE_INVALIDATION_KEYS]);
    expect(invalidated).toContain('filter-options');
  });
});

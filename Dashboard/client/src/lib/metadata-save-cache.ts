import type { QueryClient } from '@tanstack/react-query';

export const METADATA_SAVE_INVALIDATION_KEYS = [
  'program-version-events',
  'datasets',
  'event-catalog',
  'all-events',
  'versions',
  'program-ids',
  'filter-options',
] as const;

export async function invalidateQueriesAfterMetadataSave(
  queryClient: QueryClient
): Promise<void> {
  for (const queryKey of METADATA_SAVE_INVALIDATION_KEYS) {
    await queryClient.invalidateQueries({ queryKey: [queryKey] });
  }
}

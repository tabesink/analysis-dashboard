/**
 * Hook for fetching filter options from the server
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api/dashboard';
import type { FilterOptions } from '@/types/api';

export function useFilterOptions(programId?: string) {
  return useQuery<FilterOptions>({
    queryKey: ['filter-options', programId ?? 'all'],
    queryFn: () => dashboardApi.getFilterOptions(programId),
    staleTime: 60 * 60 * 1000, // 1 hour - filter options rarely change
  });
}

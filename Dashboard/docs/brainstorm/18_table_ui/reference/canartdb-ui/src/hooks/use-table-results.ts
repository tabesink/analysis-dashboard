'use client';

import { useQuery } from '@tanstack/react-query';
import { databaseApi } from '@/lib/api/database';

export function useTableResults(tableId: string | null) {
  return useQuery({
    queryKey: ['database', 'tables', tableId, 'results'],
    queryFn: ({ signal }) => {
      if (!tableId) {
        throw new Error('tableId is required');
      }
      return databaseApi.getTableResults(tableId, signal);
    },
    enabled: Boolean(tableId),
  });
}


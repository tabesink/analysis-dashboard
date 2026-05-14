/**
 * Hook for managing uploaded datasets.
 * Single responsibility: dataset list state management.
 * Fetches every non-deleted event in one request; filtering and sorting
 * happen in the consumer.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { uploadApi } from '@/lib/api/upload';
import type { DatasetInfo, ProgramVersionSummary } from '@/types/upload';

interface UseUploadedDatasetsOptions {
  /** Callback for error handling */
  onError?: (error: string) => void;
  /** Whether to fetch on mount (default: true) */
  fetchOnMount?: boolean;
}

interface UseUploadedDatasetsReturn {
  /** Every non-deleted dataset */
  datasets: DatasetInfo[];
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Loading state for background refetch */
  isRefreshing: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Refetch from server */
  refetch: () => Promise<void>;
  /** Delete multiple datasets by event IDs */
  deleteDatasets: (eventIds: string[]) => Promise<boolean>;
  /** IDs currently being deleted (for UI feedback) */
  isDeletingIds: string[];
  /** Total events across all non-deleted rows */
  total: number;
  /** Distinct values per filterable column (global) */
  facets: Record<string, string[]>;
  /** Program/version summaries across every non-deleted row */
  programVersions: ProgramVersionSummary[];
}

export function useUploadedDatasets(
  options: UseUploadedDatasetsOptions = {}
): UseUploadedDatasetsReturn {
  const { onError, fetchOnMount = true } = options;
  const queryClient = useQueryClient();

  const datasetsQuery = useQuery({
    queryKey: ['datasets'],
    queryFn: () => uploadApi.listDatasets(90_000),
    enabled: fetchOnMount,
    refetchOnWindowFocus: false,
  });

  const [isDeletingIds, setIsDeletingIds] = useState<string[]>([]);

  const queryError = datasetsQuery.error;
  const errorMessage = queryError
    ? queryError instanceof Error
      ? queryError.message
      : 'Failed to fetch datasets'
    : null;

  useEffect(() => {
    if (errorMessage) {
      onError?.(errorMessage);
    }
  }, [errorMessage, onError]);

  const datasets: DatasetInfo[] = datasetsQuery.data?.items ?? [];
  const total: number = datasetsQuery.data?.total ?? 0;
  const facets: Record<string, string[]> = datasetsQuery.data?.facets ?? {};
  const programVersions: ProgramVersionSummary[] =
    datasetsQuery.data?.program_versions ?? [];

  const refetch = useCallback(async () => {
    await datasetsQuery.refetch();
  }, [datasetsQuery]);

  const deleteDatasets = useCallback(
    async (eventIds: string[]): Promise<boolean> => {
      if (eventIds.length === 0) return false;

      setIsDeletingIds(eventIds);

      try {
        await uploadApi.deleteDatasets(eventIds);
        await queryClient.invalidateQueries({ queryKey: ['datasets'] });
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to delete datasets';
        onError?.(message);
        return false;
      } finally {
        setIsDeletingIds([]);
      }
    },
    [onError, queryClient]
  );

  return {
    datasets,
    isLoading: datasetsQuery.isLoading,
    isRefreshing: datasetsQuery.isFetching && !datasetsQuery.isLoading,
    error: errorMessage,
    refetch,
    deleteDatasets,
    isDeletingIds,
    total,
    facets,
    programVersions,
  };
}

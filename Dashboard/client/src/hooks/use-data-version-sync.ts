'use client';

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { syncApi } from '@/lib/api/sync';
import { useInspectDamageResultsStore } from '@/stores/inspect-damage-results-store';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';

const SYNC_POLL_INTERVAL_MS = 10_000;

function invalidateSyncSensitiveQueries(queryClient: ReturnType<typeof useQueryClient>) {
  const keysToInvalidate = [
    ['all-events'],
    ['program-ids'],
    ['versions'],
    ['filter-options'],
    ['event-catalog'],
  ] as const;

  keysToInvalidate.forEach((queryKey) => {
    void queryClient.invalidateQueries({ queryKey: [...queryKey] });
  });
}

export function useDataVersionSync() {
  const queryClient = useQueryClient();
  const authStatus = useAuthStore((s) => s.status);
  const databaseImportInProgress = useUIStore((s) => s.databaseImportInProgress);
  const lastSeenVersionRef = useRef<number | null>(null);

  const { data } = useQuery({
    queryKey: ['sync-version'],
    queryFn: syncApi.getVersion,
    enabled: authStatus === 'authenticated' && !databaseImportInProgress,
    staleTime: 0,
    refetchInterval: databaseImportInProgress ? false : SYNC_POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
    retry: false,
  });

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      lastSeenVersionRef.current = null;
    }
  }, [authStatus]);

  useEffect(() => {
    const currentVersion = data?.data_version;
    if (typeof currentVersion !== 'number') return;

    const previousVersion = lastSeenVersionRef.current;
    if (previousVersion === null) {
      lastSeenVersionRef.current = currentVersion;
      return;
    }

    if (currentVersion > previousVersion) {
      invalidateSyncSensitiveQueries(queryClient);
      useInspectDamageResultsStore.getState().clearCachedResults();
    }
    lastSeenVersionRef.current = currentVersion;
  }, [data?.data_version, queryClient]);
}

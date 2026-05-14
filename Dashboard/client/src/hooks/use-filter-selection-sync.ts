/**
 * Reactive sync that prunes session.selected_event_ids whenever a global
 * dimension filter change shrinks the catalog of visible events.
 *
 * Contract (see DEC-037):
 * - selected_event_ids always equals "currently visible after dimension filters
 *   AND checked".
 * - Pruning happens immediately on dimension-filter change. The grid and
 *   rendered_event_ids are intentionally left alone -- the existing
 *   "Selection changed -- click Render" banner already signals the dirty state,
 *   and the next Render click cleanly refetches with the pruned selection.
 * - The Event-ID search box (event_id_query) is a find tool and never causes
 *   pruning. useEventCatalog excludes it from dimensionFilteredEventIds.
 *
 * Mount once at the dashboard level (DashboardContent.tsx).
 */

'use client';

import { useEffect, useRef } from 'react';
import { useFilterState } from './use-filter-state';
import { useEventCatalog } from './use-event-catalog';

export function useFilterSelectionSync(): void {
  const { isSessionReady, dataState, updateDataState } = useFilterState();
  const { dimensionFilteredEventIds, isLoading } = useEventCatalog();
  const lastWhitelistRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    // Wait for session hydration AND the catalog fetch to settle. Without this
    // guard the very first run (catalog still loading -> empty set) would wipe
    // any persisted selection on page reload.
    if (!isSessionReady || isLoading) return;

    // useEventCatalog rebuilds dimensionFilteredEventIds (a new Set) whenever
    // allEvents changes. Identity comparison cheaply detects "fresh catalog".
    if (lastWhitelistRef.current === dimensionFilteredEventIds) return;
    lastWhitelistRef.current = dimensionFilteredEventIds;

    const sel = dataState.selected_event_ids;
    if (sel.length === 0) return;

    const pruned = sel.filter((id) => dimensionFilteredEventIds.has(id));
    if (pruned.length !== sel.length) {
      updateDataState({ selected_event_ids: pruned });
    }
  }, [
    isSessionReady,
    isLoading,
    dimensionFilteredEventIds,
    dataState.selected_event_ids,
    updateDataState,
  ]);
}

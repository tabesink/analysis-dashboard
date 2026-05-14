'use client';

import { useCallback, useMemo } from 'react';
import { SidePanelSection } from '@/components/shared';
import { HierarchicalEventTree } from '@/components/dashboard/shared/HierarchicalEventTree';
import { usePinnedEventsStore } from '@/stores/pinned-events-store';
import { useEventTreeColorProps } from '@/hooks/use-event-tree-color-props';
import type { CurveSelectorProps } from './types';
import type { HierarchicalEventTreeProps } from '@/components/dashboard/shared/HierarchicalEventTree';

/**
 * CurveSelector - Main orchestrator for interactive plot sidebar.
 *
 * Single Responsibility: Manages visibility state and composes child components.
 * Open/Closed: Extensible through composition, not modification.
 * Dependency Inversion: Child components receive callbacks, not store access.
 */
export function CurveSelector({
  events,
  curveVisibility,
  onToggleVisibility,
}: CurveSelectorProps) {
  const isPinned = usePinnedEventsStore((state) => state.isPinned);
  const unpinEvent = usePinnedEventsStore((state) => state.unpinEvent);
  const colorProps = useEventTreeColorProps();
  const allEvents = events;
  // Visibility check helper
  const isVisible = useCallback(
    (id: string) => curveVisibility[id] !== false,
    [curveVisibility],
  );

  // Batch toggle: set visibility for a group of events
  const handleBatchSetChecked = useCallback(
    (eventIds: string[], checked: boolean) => {
      for (const id of eventIds) {
        if (isVisible(id) !== checked) {
          onToggleVisibility(id);
        }
      }
    },
    [isVisible, onToggleVisibility],
  );

  const handleSelectAll = useCallback(() => {
    allEvents.forEach((event) => {
      if (!isVisible(event.event_id)) onToggleVisibility(event.event_id);
    });
  }, [allEvents, isVisible, onToggleVisibility]);

  const handleSelectNone = useCallback(() => {
    allEvents.forEach((event) => {
      if (isVisible(event.event_id)) onToggleVisibility(event.event_id);
    });
  }, [allEvents, isVisible, onToggleVisibility]);

  const visibleCount = useMemo(
    () => allEvents.filter((e) => isVisible(e.event_id)).length,
    [allEvents, isVisible],
  );
  const interactiveTreeProps: HierarchicalEventTreeProps = {
    events: allEvents,
    isChecked: isVisible,
    onToggleEvent: onToggleVisibility,
    isPinned,
    onUnpinEvent: unpinEvent,
    onBatchSetChecked: handleBatchSetChecked,
    onSelectAll: handleSelectAll,
    onSelectNone: handleSelectNone,
    emptyMessage: 'No data available',
    defaultExpandPrograms: true,
    ...colorProps,
  };

  return (
    <SidePanelSection
      title="Load Data"
      subtitle={`${visibleCount} visible / ${allEvents.length} total`}
      defaultExpanded={true}
      className="flex-1 min-h-0"
      contentClassName="min-h-0"
    >
      <HierarchicalEventTree {...interactiveTreeProps} />
    </SidePanelSection>
  );
}

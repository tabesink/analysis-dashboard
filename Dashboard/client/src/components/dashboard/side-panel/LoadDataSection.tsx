'use client';

import { useCallback, useMemo } from 'react';
import { Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HierarchicalEventTree } from '@/components/dashboard/shared/HierarchicalEventTree';
import { useFilterState } from '@/hooks/use-filter-state';
import { useEventCatalog } from '@/hooks/use-event-catalog';
import { useEventTreeColorProps } from '@/hooks/use-event-tree-color-props';
import { SidePanelSection } from '@/components/shared';

export function LoadDataSection({
  isCollapsed = false,
  onExpand,
}: {
  isCollapsed?: boolean;
  onExpand?: () => void;
}) {
  const { dataState, updateDataState } = useFilterState();
  const { events, isLoading } = useEventCatalog();
  const colorProps = useEventTreeColorProps();

  const selectedSet = useMemo(
    () => new Set(dataState.selected_event_ids),
    [dataState.selected_event_ids],
  );

  const isEventChecked = useCallback(
    (eventId: string) => selectedSet.has(eventId),
    [selectedSet],
  );

  const handleToggleEvent = useCallback(
    (eventId: string) => {
      const event = events.find((item) => item.event_id === eventId);
      if (event?.selectable_for_plotting === false) return;
      const newIds = selectedSet.has(eventId)
        ? dataState.selected_event_ids.filter((id) => id !== eventId)
        : [...dataState.selected_event_ids, eventId];
      updateDataState({ selected_event_ids: newIds });
    },
    [events, selectedSet, dataState.selected_event_ids, updateDataState],
  );

  const handleBatchToggle = useCallback(
    (eventIds: string[], checked: boolean) => {
      const selectableIds = eventIds.filter((id) => {
        const event = events.find((item) => item.event_id === id);
        return event?.selectable_for_plotting !== false;
      });
      const idSet = new Set(selectableIds);
      const newIds = checked
        ? [...new Set([...dataState.selected_event_ids, ...selectableIds])]
        : dataState.selected_event_ids.filter((id) => !idSet.has(id));
      updateDataState({ selected_event_ids: newIds });
    },
    [events, dataState.selected_event_ids, updateDataState],
  );

  const handleSelectAll = useCallback(() => {
    const allIds = events
      .filter((event) => event.selectable_for_plotting !== false)
      .map((e) => e.event_id);
    updateDataState({ selected_event_ids: allIds });
  }, [events, updateDataState]);

  const handleDeselectAll = useCallback(() => {
    updateDataState({ selected_event_ids: [], program_ids: [], versions: [] });
  }, [updateDataState]);

  const hasSelections = dataState.selected_event_ids.length > 0;
  const sectionSubtitle = hasSelections
    ? `${dataState.selected_event_ids.length} selected`
    : 'Select events for analysis';

  if (isCollapsed) {
    return (
      <Button
        variant="ghost"
        onClick={onExpand}
        className="p-2 rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-accent"
        aria-label="Expand Load Data section"
        title="Load Data"
      >
        <Database className="h-4 w-4" />
      </Button>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-32 rounded" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <SidePanelSection
      title="Load Data"
      subtitle={sectionSubtitle}
      defaultExpanded={true}
      contentClassName="overflow-x-auto"
    >
      <HierarchicalEventTree
        events={events}
        isChecked={isEventChecked}
        onToggleEvent={handleToggleEvent}
        onBatchSetChecked={handleBatchToggle}
        onSelectAll={handleSelectAll}
        onSelectNone={handleDeselectAll}
        emptyMessage="No events available"
        showExpandCollapseControls={false}
        defaultExpandPrograms={true}
        {...colorProps}
      />
    </SidePanelSection>
  );
}

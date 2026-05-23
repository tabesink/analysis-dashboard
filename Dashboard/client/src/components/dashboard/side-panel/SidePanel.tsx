'use client';

import { useMemo } from 'react';
import { SidePanelLayout } from '@/components/shared';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useUIStore } from '@/stores/ui-store';
import { useFilterState } from '@/hooks/use-filter-state';
import { useEventCatalog } from '@/hooks/use-event-catalog';
import { CurveSelector } from '@/components/dashboard/interactive-viewer';
import { LoadDataSection } from './LoadDataSection';
import { GlobalFilters } from './GlobalFilters';

export function SidePanel() {
  const sidePanelCollapsed = useUIStore((s) => s.sidePanelCollapsed);
  const toggleSidePanel = useUIStore((s) => s.toggleSidePanel);
  const activeTab = useUIStore((s) => s.activeTab);
  const curveVisibility = useUIStore((s) => s.curveVisibility);
  const toggleCurveVisibility = useUIStore((s) => s.toggleCurveVisibility);
  const { dataState, isSessionReady } = useFilterState();
  const { events, isLoading: isCatalogLoading } = useEventCatalog();
  const isPanelReady = isSessionReady && !isCatalogLoading;

  const selectedEvents = useMemo(() => {
    const selectedSet = new Set(dataState.selected_event_ids);
    return events.filter((e) => selectedSet.has(e.event_id));
  }, [events, dataState.selected_event_ids]);

  return (
    <SidePanelLayout
      isCollapsed={sidePanelCollapsed}
      onToggleCollapse={toggleSidePanel}
      expandedWidth="w-[320px]"
    >
      <ScrollArea className="flex-1 min-h-0 w-full">
        <div className="p-5 space-y-5">
          {activeTab === 'interactive' ? (
            <CurveSelector
              events={selectedEvents}
              curveVisibility={curveVisibility}
              onToggleVisibility={toggleCurveVisibility}
            />
          ) : !isPanelReady ? (
            <div className="space-y-4">
              <Skeleton className="h-5 w-32 rounded" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ) : (
            <>
              <GlobalFilters isCollapsed={sidePanelCollapsed} />
              <div className="py-1">
                <Separator className="bg-border/70" />
              </div>
              <LoadDataSection isCollapsed={sidePanelCollapsed} />
            </>
          )}
        </div>
      </ScrollArea>
    </SidePanelLayout>
  );
}

'use client';

import { useMemo } from 'react';
import { SidePanelLayout } from '@/components/shared';
import { Separator } from '@/components/ui/separator';
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
  const { dataState } = useFilterState();
  const { events } = useEventCatalog();

  const selectedEvents = useMemo(() => {
    const selectedSet = new Set(dataState.selected_event_ids);
    return events.filter((e) => selectedSet.has(e.event_id));
  }, [events, dataState.selected_event_ids]);

  return (
    <SidePanelLayout
      isCollapsed={sidePanelCollapsed}
      onToggleCollapse={toggleSidePanel}
      expandedWidth="w-[400px]"
    >
      <div className="flex-1 min-h-0 flex flex-col w-full">
        <div className="p-5 pb-4 space-y-4 flex flex-col flex-1 min-h-0 overflow-y-auto">
          {activeTab === 'interactive' ? (
            <CurveSelector
              events={selectedEvents}
              curveVisibility={curveVisibility}
              onToggleVisibility={toggleCurveVisibility}
            />
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
      </div>
    </SidePanelLayout>
  );
}

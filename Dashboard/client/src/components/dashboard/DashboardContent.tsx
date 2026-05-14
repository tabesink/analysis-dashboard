'use client';

import { useCallback } from 'react';
import { DashboardTabs } from './DashboardTabs';
import { GridActionToolbar } from './shared';
import { useFilterState } from '@/hooks/use-filter-state';
import { useFilterSelectionSync } from '@/hooks/use-filter-selection-sync';
import { useRenderStore } from '@/stores/render-store';
import { usePinnedEventsStore } from '@/stores/pinned-events-store';
import { useUIStore } from '@/stores/ui-store';
import { useColorSelectionStore } from '@/stores/color-selection-store';
import type { DashboardPageConfig } from '@/types/dashboard';

/**
 * Dashboard content component
 * Single Responsibility: Only responsible for rendering dashboard content area
 * Dependency Inversion: Depends on DashboardPageConfig abstraction
 */
export interface DashboardContentProps {
  config: DashboardPageConfig;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function DashboardContent({
  config,
  activeTab,
  onTabChange,
  className = '',
}: DashboardContentProps) {
  const {
    allSelectedEventIds,
    renderedEventIds,
    hasUnrenderedChanges,
    clearRenderedEventIds,
  } = useFilterState();

  // Prune session.selected_event_ids when a dimension filter hides previously
  // checked events (DEC-037). Must mount inside the dashboard tree where the
  // session and event catalog are available.
  useFilterSelectionSync();

  const isRendering = useRenderStore((s) => s.isRendering);
  const startRendering = useRenderStore((s) => s.startRendering);
  const stopRendering = useRenderStore((s) => s.stopRendering);
  const clearSelectedInteractivePlot = useRenderStore((s) => s.clearSelectedInteractivePlot);
  const pinnedEventIds = usePinnedEventsStore((s) => s.pinnedEventIds);
  const isPinnedModeActive = usePinnedEventsStore((s) => s.isPinnedModeActive);
  const togglePinnedMode = usePinnedEventsStore((s) => s.togglePinnedMode);
  const clearAllPinned = usePinnedEventsStore((s) => s.clearAllPinned);
  const curveVisibility = useUIStore((s) => s.curveVisibility);
  const resetCurveVisibility = useUIStore((s) => s.resetCurveVisibility);
  const resetAllEventOverrideColors = useColorSelectionStore((s) => s.resetAllEventOverrideColors);

  const hasSelection = allSelectedEventIds.length > 0;
  const hasPinnedEvents = pinnedEventIds.length > 0;
  const hasRenderedPlots = renderedEventIds.length > 0;
  const isInteractiveView = activeTab === 'interactive';
  const hasInteractiveVisibilityOverrides = Object.keys(curveVisibility).length > 0;
  const clearDisabled = isInteractiveView ? !hasInteractiveVisibilityOverrides : !hasRenderedPlots;

  const handleRender = useCallback(() => {
    if (isRendering) {
      stopRendering();
    } else {
      // Grid render acts as a reset: clear pinned context and pinned overrides.
      if (!isInteractiveView) {
        clearAllPinned();
        resetAllEventOverrideColors();
      }
      startRendering();
    }
  }, [
    isRendering,
    isInteractiveView,
    clearAllPinned,
    resetAllEventOverrideColors,
    stopRendering,
    startRendering,
  ]);

  const handleClear = useCallback(() => {
    if (isInteractiveView) {
      resetCurveVisibility();
      return;
    }

    clearRenderedEventIds();
    clearSelectedInteractivePlot();
    resetCurveVisibility();
    if (isRendering) {
      stopRendering();
    }
  }, [isInteractiveView, resetCurveVisibility, clearRenderedEventIds, clearSelectedInteractivePlot, isRendering, stopRendering]);

  const handleExport = useCallback(() => {
    // Reserved for upcoming grid export flow.
  }, []);

  return (
    <div className={`flex-1 flex flex-col min-w-0 bg-card border border-border rounded-r-lg shadow-subtle overflow-hidden ${className}`}>
      <div className="relative flex-1 min-h-0">
        <DashboardTabs
          tabs={config.tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
        <GridActionToolbar
          isInteractiveView={isInteractiveView}
          isPinnedModeActive={isPinnedModeActive}
          hasPinnedEvents={hasPinnedEvents}
          isRendering={isRendering}
          hasRenderedPlots={hasRenderedPlots}
          hasPendingRerenderChanges={hasUnrenderedChanges}
          renderDisabled={!hasSelection}
          clearDisabled={clearDisabled}
          exportDisabled
          onRender={handleRender}
          onClear={handleClear}
          onExport={handleExport}
          onReturnToGrid={() => onTabChange('grid')}
          onTogglePinnedMode={togglePinnedMode}
        />
      </div>
    </div>
  );
}


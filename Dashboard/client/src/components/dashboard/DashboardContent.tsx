'use client';

import { useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { DashboardTabs } from './DashboardTabs';
import { DashboardWorkspaceActions } from './shared';
import { useDashboardWorkspace } from '@/modules/dashboard-workspace';
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
  const workspace = useDashboardWorkspace();

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

  const hasPinnedEvents = pinnedEventIds.length > 0;
  const hasRenderedPlots = workspace.state.renderedEventIds.length > 0;
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

    workspace.actions.clearRenderedEventIds();
    clearSelectedInteractivePlot();
    resetCurveVisibility();
    if (isRendering) {
      stopRendering();
    }
  }, [isInteractiveView, resetCurveVisibility, workspace.actions, clearSelectedInteractivePlot, isRendering, stopRendering]);

  const handleExport = useCallback(() => {
    // Reserved for upcoming grid export flow.
  }, []);

  return (
    <Card
      className={`h-full min-w-0 flex-1 rounded-r-lg rounded-l-none flex flex-col gap-0 overflow-hidden shadow-subtle border py-0 ${className}`}
    >
      <div className="shrink-0 flex items-center justify-between border-b px-4 py-3">
        <p className="text-sm font-medium">
          {isInteractiveView ? 'Interactive Layout' : 'Grid Layout'}
        </p>
        <DashboardWorkspaceActions
          isInteractiveView={isInteractiveView}
          isPinnedModeActive={isPinnedModeActive}
          hasPinnedEvents={hasPinnedEvents}
          isRendering={isRendering}
          hasRenderedPlots={hasRenderedPlots}
          hasPendingRerenderChanges={workspace.state.hasUnrenderedChanges}
          renderDisabled={!workspace.state.canRender}
          clearDisabled={clearDisabled}
          exportDisabled
          onRender={handleRender}
          onClear={handleClear}
          onExport={handleExport}
          onReturnToGrid={() => onTabChange('grid')}
          onTogglePinnedMode={togglePinnedMode}
        />
      </div>
      <div className="flex-1 min-h-0">
        <DashboardTabs
          tabs={config.tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
      </div>
    </Card>
  );
}

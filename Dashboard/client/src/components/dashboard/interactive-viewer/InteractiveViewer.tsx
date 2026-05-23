'use client';

import { useEffect, useMemo } from 'react';
import { LineChart, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useUIStore } from '@/stores/ui-store';
import { useRenderStore } from '@/stores/render-store';
import { useFilterState } from '@/hooks/use-filter-state';
import { useLazyPlotFetch } from '@/hooks/use-lazy-plot-fetch';
import { useCurveColoring } from '@/hooks/use-curve-coloring';
import { usePinnedEventsStore } from '@/stores/pinned-events-store';
import { getCurvePoints } from '@/lib/utils/binary-decoder';
import { InteractiveCanvasPlot } from '@/components/charts';
import type { Curve, PlotConfig, ColorConfig } from '@/components/charts/types';
import {
  DEFAULT_HISTORICAL_COLOR,
  getPlotDisplayTitle,
  getPlotXLabel,
  getPlotYLabel,
} from '@/config/constants';
import { getEventDisplayName } from '@/lib/utils';
import { sortCurvesForRendering } from '@/lib/chart-utils/sort';
import { PinnedEventsOverlay } from './PinnedEventsOverlay';

export function InteractiveViewer() {
  const curveVisibility = useUIStore((state) => state.curveVisibility);
  const resetCurveVisibility = useUIStore((state) => state.resetCurveVisibility);
  const selectedPlotKey = useRenderStore((state) => state.selectedPlotKey);
  const cachedPlots = useRenderStore((state) => state.cachedPlots);
  const loadingPlots = useRenderStore((state) => state.loadingPlots);
  const { allSelectedEventIds, renderedEventIds } = useFilterState();
  const { getCurveColor, eventVersionMap } = useCurveColoring();

  const pinnedEventIds = usePinnedEventsStore((state) => state.pinnedEventIds);
  const isPinnedModeActive = usePinnedEventsStore((state) => state.isPinnedModeActive);
  const pinnedModeEnabled = isPinnedModeActive && pinnedEventIds.length > 0;
  const pinnedEventSet = useMemo(() => new Set(pinnedEventIds), [pinnedEventIds]);

  // Use rendered event IDs for fetching (these are the events whose data we have/need)
  const stableRenderedEventIds = useMemo(
    () => [...renderedEventIds].sort(),
    [renderedEventIds],
  );

  // Lazy-fetch into render-store if the selected plot key isn't cached yet
  const { isLoading: isLazyLoading, error: lazyError } = useLazyPlotFetch(
    selectedPlotKey,
    stableRenderedEventIds,
  );

  // Read plot data directly from render-store (single source of truth)
  const cachedPlotData = selectedPlotKey ? cachedPlots.get(selectedPlotKey) : undefined;
  const isGridLoading = selectedPlotKey ? loadingPlots.has(selectedPlotKey) : false;
  const isLoading = isLazyLoading || isGridLoading;
  const error = lazyError;

  // Reset visibility when events change
  useEffect(() => {
    resetCurveVisibility();
  }, [allSelectedEventIds.length, resetCurveVisibility]);

  const UNPINNED_GREY = 'rgba(128, 128, 128, 0.2)';

  // Transform cached store data to Curve[], filtering by visibility locally
  const curves: Curve[] = useMemo(() => {
    if (!cachedPlotData || !selectedPlotKey) return [];

    const mapped = cachedPlotData.curves
      .filter((c) => curveVisibility[c.event_id] !== false)
      .map((c) => {
        const isPinned = pinnedEventSet.has(c.event_id);
        const color = pinnedModeEnabled && !isPinned
          ? UNPINNED_GREY
          : getCurveColor(c.event_id);

        const xArray = c.x_array ?? new Float32Array(c.points.map((p) => p.x));
        const yArray = c.y_array ?? new Float32Array(c.points.map((p) => p.y));

        return {
          eventId: c.event_id,
          eventName: getEventDisplayName(c.event_id),
          points: getCurvePoints({ eventId: c.event_id, plotKey: selectedPlotKey, xArray, yArray }),
          color,
        };
      });

    return sortCurvesForRendering(
      mapped,
      eventVersionMap,
      pinnedEventSet,
    );
  }, [cachedPlotData, selectedPlotKey, curveVisibility, getCurveColor, eventVersionMap, pinnedModeEnabled, pinnedEventSet]);

  const config: PlotConfig = useMemo(
    () => ({
      xLabel: selectedPlotKey ? getPlotXLabel(selectedPlotKey) : '',
      yLabel: selectedPlotKey ? getPlotYLabel(selectedPlotKey) : '',
    }),
    [selectedPlotKey]
  );

  const colorConfig: ColorConfig = useMemo(
    () => ({ defaultColor: DEFAULT_HISTORICAL_COLOR }),
    []
  );

  const displayName = selectedPlotKey ? getPlotDisplayTitle(selectedPlotKey) : 'Plot';

  // No plot selected
  if (!selectedPlotKey) {
    return (
      <div className="relative flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <LineChart className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-base font-medium text-foreground">No plot selected</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Select a plot from the grid view to interact with it, or use Return to grid in the
              header.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full">
      <div className="flex-1 overflow-hidden p-4">
        <Card className="relative w-full h-full flex items-center justify-center bg-white rounded-lg border shadow-subtle overflow-hidden">
          {isLoading ? (
            <LoadingState displayName={displayName} />
          ) : error ? (
            <ErrorState displayName={displayName} error={error} />
          ) : (
            <>
              <div className="absolute inset-0 pb-8">
                <InteractiveCanvasPlot
                  curves={curves}
                  config={config}
                  colorConfig={colorConfig}
                />
              </div>
              {curves.length > 0 && <PinnedEventsOverlay />}
              <PlotLabel displayName={displayName} />
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

// Extracted sub-components for cleaner render logic

function LoadingState({ displayName, message = 'Rendering plot...' }: { displayName: string; message?: string }) {
  return (
    <>
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <PlotLabel displayName={displayName} />
    </>
  );
}

function ErrorState({ displayName, error }: { displayName: string; error: Error }) {
  return (
    <>
      <div className="text-center px-4 space-y-2">
        <p className="text-sm text-destructive font-medium">Error</p>
        <p className="text-xs text-muted-foreground">{error.message}</p>
      </div>
      <PlotLabel displayName={displayName} />
    </>
  );
}

function PlotLabel({ displayName }: { displayName: string }) {
  return (
    <div className="absolute bottom-1.5 left-2 max-w-[calc(100%-1rem)] flex items-center gap-1.5 bg-gray-100/80 px-1.5 py-0.5 rounded">
      <p className="text-xs font-medium text-black leading-none truncate">{displayName}</p>
    </div>
  );
}

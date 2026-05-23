'use client';

import { memo, useEffect, useCallback, useRef, useMemo } from 'react';
import { Maximize2, AlertTriangle } from 'lucide-react';
import { useRenderStore } from '@/stores/render-store';
import { useFilterState } from '@/hooks/use-filter-state';
import { useCurveColoring } from '@/hooks/use-curve-coloring';
import { useSequentialPlotData } from '@/hooks/use-sequential-plot-data';
import { usePinnedEventsStore } from '@/stores/pinned-events-store';
import { useUIStore } from '@/stores/ui-store';
import { Button } from '@/components/ui/button';
import { SVGPlotCard } from '@/components/charts';
import type { Curve, PlotConfig, ColorConfig, AxisLimits } from '@/components/charts/types';
import type { SVGPlotCurvesData } from '@/types/api';
import { calculateAxisLimits } from '@/lib/chart-utils/scales';
import { sortCurvesForRendering } from '@/lib/chart-utils/sort';
import {
  DEFAULT_GRID_COLUMNS,
  DEFAULT_HISTORICAL_COLOR,
  DEFAULT_PLOT_KEYS_ARRAY,
  getPlotDisplayTitle,
  getPlotXLabel,
  getPlotYLabel,
} from '@/config/constants';

type AxisGroup = 'bjShock' | 'bushing';
const SHARED_AXIS_STEP = 1000;
const SHARED_AXIS_HEADROOM = 5000;

function getAxisGroup(plotKey: string): AxisGroup {
  if (plotKey.startsWith('bushing_')) return 'bushing';
  return 'bjShock';
}

function calculateRawAxisLimits(curves: Curve[]): AxisLimits | null {
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;

  for (const curve of curves) {
    if (curve.xArray && curve.yArray) {
      const len = Math.min(curve.xArray.length, curve.yArray.length);
      for (let i = 0; i < len; i++) {
        const x = curve.xArray[i];
        const y = curve.yArray[i];
        if (x < xMin) xMin = x;
        if (x > xMax) xMax = x;
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      }
      continue;
    }

    for (const point of curve.points) {
      if (point.x < xMin) xMin = point.x;
      if (point.x > xMax) xMax = point.x;
      if (point.y < yMin) yMin = point.y;
      if (point.y > yMax) yMax = point.y;
    }
  }

  if (!isFinite(xMin)) return null;

  return { xMin, xMax, yMin, yMax };
}

function snapSharedAxisLimitsToStep(limits: AxisLimits): AxisLimits {
  return {
    xMin: Math.floor(limits.xMin / SHARED_AXIS_STEP) * SHARED_AXIS_STEP - SHARED_AXIS_HEADROOM,
    xMax: Math.ceil(limits.xMax / SHARED_AXIS_STEP) * SHARED_AXIS_STEP + SHARED_AXIS_HEADROOM,
    yMin: Math.floor(limits.yMin / SHARED_AXIS_STEP) * SHARED_AXIS_STEP - SHARED_AXIS_HEADROOM,
    yMax: Math.ceil(limits.yMax / SHARED_AXIS_STEP) * SHARED_AXIS_STEP + SHARED_AXIS_HEADROOM,
  };
}

interface PlotGridProps {
  columns?: number;
  onColumnsChange?: (columns: number) => void;
}

type PlotInfo = {
  curves: Curve[];
  config: PlotConfig;
  axisLimits: AxisLimits;
  rawAxisLimits: AxisLimits | null;
};

interface PlotCacheEntry {
  source: SVGPlotCurvesData | undefined;
  pinnedModeEnabled: boolean;
  pinnedSet: Set<string>;
  getCurveColor: ReturnType<typeof useCurveColoring>['getCurveColor'];
  versionMap: ReturnType<typeof useCurveColoring>['eventVersionMap'];
  value?: PlotInfo;
}

export function PlotGrid({
  columns = DEFAULT_GRID_COLUMNS,
  onColumnsChange,
}: PlotGridProps) {
  const {
    allSelectedEventIds,
    renderedEventIds,
    isSessionReady,
    hasUnrenderedChanges,
    setRenderedEventIds,
  } = useFilterState();

  const isRendering = useRenderStore((state) => state.isRendering);
  const stopRendering = useRenderStore((state) => state.stopRendering);
  const setSelectedPlotKey = useRenderStore((state) => state.setSelectedPlotKey);

  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const pinnedEventIds = usePinnedEventsStore((state) => state.pinnedEventIds);
  const isPinnedModeActive = usePinnedEventsStore((state) => state.isPinnedModeActive);
  const pinnedModeEnabled = isPinnedModeActive && pinnedEventIds.length > 0;

  const { getCurveColor, eventVersionMap } = useCurveColoring({ syncColors: true });
  const colorConfig: ColorConfig = useMemo(
    () => ({ defaultColor: DEFAULT_HISTORICAL_COLOR }),
    []
  );

  // Sequential plot data fetching for progressive rendering
  const {
    plots: streamedPlots,
    loadingPlots,
    plotErrors,
    isStreaming,
    startSequentialFetch,
    stopFetch,
    reset: resetPlots,
  } = useSequentialPlotData();

  // Store latest selected IDs for render capture (avoids stale closure)
  const selectedIdsRef = useRef(allSelectedEventIds);
  selectedIdsRef.current = allSelectedEventIds;

  // Track if we've started this render cycle
  const hasStartedRef = useRef(false);
  const previousRenderedCountRef = useRef<number | null>(null);
  const plotCacheRef = useRef(new Map<string, PlotCacheEntry>());

  // Handle render trigger from RenderButton
  useEffect(() => {
    if (isRendering && !hasStartedRef.current) {
      const idsToRender = selectedIdsRef.current;
      if (idsToRender.length > 0) {
        hasStartedRef.current = true;
        // Snapshot current selection to rendered (persisted to session)
        setRenderedEventIds([...idsToRender]);
        // Start sequential fetching
        startSequentialFetch(idsToRender, DEFAULT_PLOT_KEYS_ARRAY as unknown as string[]);
      }
    } else if (!isRendering) {
      hasStartedRef.current = false;
    }
  }, [isRendering, setRenderedEventIds, startSequentialFetch]);

  // Deterministically cancel in-flight requests when rendering stops.
  useEffect(() => {
    if (!isRendering && isStreaming) {
      stopFetch();
    }
  }, [isRendering, isStreaming, stopFetch]);

  // Update progress based on loaded plots
  const totalPlots = DEFAULT_PLOT_KEYS_ARRAY.length;
  const loadedCount = streamedPlots.size;
  const errorCount = Object.keys(plotErrors).length;

  useEffect(() => {
    if (isRendering || isStreaming) {
      if (
        (loadedCount === totalPlots && loadedCount > 0) ||
        (
          !isStreaming &&
          isRendering &&
          loadingPlots.size === 0 &&
          (loadedCount > 0 || errorCount > 0)
        )
      ) {
        stopRendering();
      }
    }
  }, [
    isRendering,
    isStreaming,
    loadedCount,
    errorCount,
    totalPlots,
    loadingPlots,
    stopRendering,
  ]);

  // Clear plots only when rendered ids transition from non-empty -> empty
  // after session state is ready. This avoids cache wipes during transient
  // remount/rehydration states while preserving Clear button behavior.
  useEffect(() => {
    if (!isSessionReady) {
      previousRenderedCountRef.current = null;
      return;
    }

    const previous = previousRenderedCountRef.current;
    const current = renderedEventIds.length;

    const didExplicitlyClearRendered =
      previous !== null && previous > 0 && current === 0;

    if (didExplicitlyClearRendered && loadedCount > 0) {
      resetPlots();
    }

    previousRenderedCountRef.current = current;
  }, [isSessionReady, renderedEventIds.length, loadedCount, resetPlots]);

  // Note: Plot data now cached in Zustand store (render-store.ts)
  // No re-fetch needed on tab switch - data persists across component unmount/remount

  // Transform API data to component format and compute per-plot limits
  // Filter by pinned events when pinned mode is active
  const pinnedSet = useMemo(
    () => new Set(pinnedEventIds),
    [pinnedEventIds]
  );

  // PlotGrid is unmounted by Radix Tabs whenever the user is on a different
  // tab (no `forceMount` in DashboardTabs), so this memo only runs while the
  // Grid view is visible. Color/selection changes that happen while we're
  // unmounted are picked up on remount: `plotCacheRef` initialises empty,
  // every plotKey misses the cache, and the recompute uses the fresh
  // `getCurveColor` derived from the current store state.
  const plotsData = useMemo(() => {
    const result: Record<string, PlotInfo> = {};
    const nextCache = new Map<string, PlotCacheEntry>();

    for (const plotKey of DEFAULT_PLOT_KEYS_ARRAY as readonly string[]) {
      const plotCurvesData = streamedPlots.get(plotKey);
      const previous = plotCacheRef.current.get(plotKey);

      if (
        previous &&
        previous.source === plotCurvesData &&
        previous.pinnedModeEnabled === pinnedModeEnabled &&
        previous.pinnedSet === pinnedSet &&
        previous.getCurveColor === getCurveColor &&
        previous.versionMap === eventVersionMap
      ) {
        if (previous.value) {
          result[plotKey] = previous.value;
        }
        nextCache.set(plotKey, previous);
        continue;
      }

      if (!plotCurvesData) {
        nextCache.set(plotKey, {
          source: plotCurvesData,
          pinnedModeEnabled,
          pinnedSet,
          getCurveColor,
          versionMap: eventVersionMap,
          value: undefined,
        });
        continue;
      }

      const mapped = plotCurvesData.curves
        .filter((c) => !pinnedModeEnabled || pinnedSet.has(c.event_id))
        .map((c): Curve => ({
          eventId: c.event_id,
          points: c.points,
          xArray: c.x_array,
          yArray: c.y_array,
          color: getCurveColor(c.event_id),
        }));
      const curves = sortCurvesForRendering(mapped, eventVersionMap, pinnedSet);
      const value: PlotInfo = {
        curves,
        config: {
          xLabel: getPlotXLabel(plotKey),
          yLabel: getPlotYLabel(plotKey),
          xUnit: plotCurvesData.x_unit || undefined,
          yUnit: plotCurvesData.y_unit || undefined,
        } as PlotConfig,
        axisLimits: calculateAxisLimits(curves),
        rawAxisLimits: calculateRawAxisLimits(curves),
      };
      result[plotKey] = value;
      nextCache.set(plotKey, {
        source: plotCurvesData,
        pinnedModeEnabled,
        pinnedSet,
        getCurveColor,
        versionMap: eventVersionMap,
        value,
      });
    }

    plotCacheRef.current = nextCache;
    return result;
  }, [streamedPlots, getCurveColor, eventVersionMap, pinnedModeEnabled, pinnedSet]);

  // Compute axis limits per group (BJ+Shock share one envelope, Bushing another)
  const groupAxisLimits = useMemo(() => {
    const buckets: Record<AxisGroup, AxisLimits[]> = { bjShock: [], bushing: [] };
    for (const [plotKey, info] of Object.entries(plotsData)) {
      if (info.rawAxisLimits) {
        buckets[getAxisGroup(plotKey)].push(info.rawAxisLimits);
      }
    }

    const merged: Record<string, AxisLimits | null> = {};
    for (const [group, limits] of Object.entries(buckets)) {
      if (limits.length < 2) {
        merged[group] = null;
        continue;
      }
      merged[group] = snapSharedAxisLimitsToStep({
        xMin: Math.min(...limits.map((l) => l.xMin)),
        xMax: Math.max(...limits.map((l) => l.xMax)),
        yMin: Math.min(...limits.map((l) => l.yMin)),
        yMax: Math.max(...limits.map((l) => l.yMax)),
      });
    }
    return merged as Record<AxisGroup, AxisLimits | null>;
  }, [plotsData]);

  const handleExpand = useCallback(
    (plotKey: string) => {
      setSelectedPlotKey(plotKey);
      setActiveTab('interactive');
    },
    [setSelectedPlotKey, setActiveTab]
  );

  const gridCols =
    {
      2: 'grid-cols-2',
      3: 'grid-cols-3',
      4: 'grid-cols-4',
    }[columns] ?? 'grid-cols-3';

  return (
    <div className="relative flex flex-col h-full">
      {/* Selection Changed Indicator */}
      {hasUnrenderedChanges && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-md shadow-sm">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-label text-amber-600 dark:text-amber-400">
              Selection changed — click Render to update
            </span>
          </div>
        </div>
      )}

      {/* Plot Grid */}
      <div className="flex-1 overflow-auto px-4 pt-2 pb-4">
        <div className={`grid ${gridCols} gap-3`}>
          {(DEFAULT_PLOT_KEYS_ARRAY as readonly string[]).map((plotKey) => (
            <PlotGridItem
              key={plotKey}
              plotKey={plotKey}
              plotInfo={plotsData[plotKey]}
              isPlotLoading={loadingPlots.has(plotKey)}
              plotError={plotErrors[plotKey] ?? null}
              colorConfig={colorConfig}
              globalAxisLimits={groupAxisLimits[getAxisGroup(plotKey)]}
              onExpand={handleExpand}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface PlotGridItemProps {
  plotKey: string;
  plotInfo?: { curves: Curve[]; config: PlotConfig; axisLimits: AxisLimits };
  isPlotLoading: boolean;
  plotError: string | null;
  colorConfig: ColorConfig;
  globalAxisLimits: AxisLimits | null;
  onExpand: (plotKey: string) => void;
}

const PlotGridItem = memo(function PlotGridItem({
  plotKey,
  plotInfo,
  isPlotLoading,
  plotError,
  colorConfig,
  globalAxisLimits,
  onExpand,
}: PlotGridItemProps) {
  const handleClick = useCallback(() => onExpand(plotKey), [onExpand, plotKey]);

  const handleExpandClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onExpand(plotKey);
    },
    [onExpand, plotKey],
  );

  const actionButtons = useMemo(
    () => (
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 rounded-md hover:bg-muted"
        onClick={handleExpandClick}
        title="Expand to interactive view"
      >
        <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    ),
    [handleExpandClick],
  );

  return (
    <SVGPlotCard
      plotKey={plotKey}
      title={getPlotDisplayTitle(plotKey)}
      curves={plotInfo?.curves ?? []}
      config={plotInfo?.config ?? { xLabel: '', yLabel: '' }}
      colorConfig={colorConfig}
      isLoading={isPlotLoading}
      error={plotError}
      onClick={handleClick}
      globalAxisLimits={globalAxisLimits}
      localAxisLimits={plotInfo?.axisLimits}
      actionButtons={actionButtons}
    />
  );
});

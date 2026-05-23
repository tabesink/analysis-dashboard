'use client';

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { calculateAxisLimits, createScale } from '@/lib/chart-utils/scales';
import {
  buildSpatialGrid,
  findCandidates,
  findNearest,
} from '@/lib/chart-utils/spatial-grid';
import {
  createOffscreenCanvasFromArrays,
  drawHighlightedCurveFromArrays,
} from '@/lib/chart-utils/canvas-renderer';
import { getCurveDisplayColor } from '@/lib/chart-utils/color';
import { usePinnedEventsStore } from '@/stores/pinned-events-store';
import { useTabVisibility } from '@/hooks/use-tab-visibility';
import { PlotTooltip } from './PlotTooltip';
import { AXIS_TYPOGRAPHY, SVGAxes } from './SVGAxes';
import type { Curve, PlotConfig, ColorConfig, AxisLimits } from './types';

// ============================================================================
// Types
// ============================================================================

interface InteractiveCanvasPlotProps {
  curves: Curve[];
  config: PlotConfig;
  colorConfig: ColorConfig;
  axisLimits?: AxisLimits;
}

interface HoverState {
  eventId: string;
  eventName: string;
  x: number;
  y: number;
  dataX: number | null;
  dataY: number | null;
}

interface ScaledCurve {
  id: string;
  eventId: string;
  eventName: string;
  color: string;
  opacity: number;
  xPath: Float32Array;
  yPath: Float32Array;
}

// ============================================================================
// Constants
// ============================================================================

const DIMENSIONS = {
  width: 2000,
  height: 1000,
  padding: { top: 40, right: 40, bottom: 100, left: 120 },
};

const GRID_COUNT = 9;
const SPATIAL_CELL_SIZE = 20;
const HIT_THRESHOLD = 15;

// ============================================================================
// Component
// ============================================================================

/**
 * Canvas-based interactive plot with optimized hover detection.
 * 
 * Uses spatial indexing and offscreen canvas for O(1) hit detection
 * and minimal redraws on hover.
 */
export function InteractiveCanvasPlot({
  curves,
  config,
  colorConfig,
  axisLimits: axisLimitsOverride,
}: InteractiveCanvasPlotProps) {
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const rafIdRef = useRef<number>(0);
  const scratchCandidatesRef = useRef(new Set<ScaledCurve>());

  // State
  const [hoverState, setHoverState] = useState<HoverState | null>(null);

  // Store
  const togglePin = usePinnedEventsStore((state) => state.togglePin);
  const isPinned = usePinnedEventsStore((state) => state.isPinned);

  // Tab visibility — release offscreen canvas when tab is hidden
  const { registerOnHide, registerOnShow } = useTabVisibility();
  const needsRedrawRef = useRef(false);

  // Dimensions
  const { width, height, padding } = DIMENSIONS;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // Compute axis limits
  const axisLimits = useMemo(
    () => axisLimitsOverride ?? calculateAxisLimits(curves),
    [axisLimitsOverride, curves]
  );

  // Create scale functions
  const scaleX = useMemo(
    () => createScale(axisLimits.xMin, axisLimits.xMax, padding.left, padding.left + plotWidth),
    [axisLimits.xMin, axisLimits.xMax, plotWidth, padding.left]
  );

  const scaleY = useMemo(
    () => createScale(axisLimits.yMin, axisLimits.yMax, padding.top + plotHeight, padding.top),
    [axisLimits.yMin, axisLimits.yMax, plotHeight, padding.top]
  );

  // Transform curves to scaled coordinates using typed arrays (avoids {x,y}[] allocation)
  const scaledCurves: ScaledCurve[] = useMemo(() => {
    return curves.map((curve) => {
      const len = curve.points.length;
      const xPath = new Float32Array(len);
      const yPath = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        xPath[i] = scaleX(curve.points[i].x);
        yPath[i] = scaleY(curve.points[i].y);
      }
      return {
        id: curve.eventId,
        eventId: curve.eventId,
        eventName: curve.eventName ?? curve.eventId,
        color: getCurveDisplayColor(curve, colorConfig),
        opacity: 1,
        xPath,
        yPath,
      };
    });
  }, [curves, colorConfig, scaleX, scaleY]);

  // Build spatial grid for O(1) hit detection
  const spatialGrid = useMemo(
    () => buildSpatialGrid(scaledCurves, { cellSize: SPATIAL_CELL_SIZE }),
    [scaledCurves]
  );

  // Render base curves to offscreen canvas (only on data change)
  useEffect(() => {
    const prevCanvas = offscreenRef.current;
    offscreenRef.current = createOffscreenCanvasFromArrays(
      scaledCurves,
      DIMENSIONS,
      undefined,
      undefined,
      { drawAxes: false, fillBackground: false }
    );
    if (prevCanvas) {
      prevCanvas.width = 0;
      prevCanvas.height = 0;
    }
    return () => {
      if (offscreenRef.current) {
        offscreenRef.current.width = 0;
        offscreenRef.current.height = 0;
        offscreenRef.current = null;
      }
    };
  }, [scaledCurves]);

  // Draw: composite offscreen + highlight hovered curve
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const offscreen = offscreenRef.current;
    if (!ctx || !canvas || !offscreen) return;

    // Clear first so transparent offscreen pixels don't retain stale highlights.
    ctx.clearRect(0, 0, width, height);

    // Fast blit from offscreen canvas
    ctx.drawImage(offscreen, 0, 0);

    // Draw hover highlight
    if (hoverState) {
      const hovered = scaledCurves.find((c) => c.eventId === hoverState.eventId);
      if (hovered) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(padding.left, padding.top, plotWidth, plotHeight);
        ctx.clip();
        drawHighlightedCurveFromArrays(ctx, hovered);
        ctx.restore();
      }
    }
  }, [scaledCurves, hoverState, padding, plotWidth, plotHeight, width, height]);

  // Redraw on hover change
  useEffect(() => {
    draw();
  }, [draw]);

  // Release offscreen canvas when tab is hidden, rebuild on show
  useEffect(() => {
    const unsubHide = registerOnHide(() => {
      if (offscreenRef.current) {
        offscreenRef.current.width = 0;
        offscreenRef.current.height = 0;
        offscreenRef.current = null;
        needsRedrawRef.current = true;
      }
    });
    const unsubShow = registerOnShow(() => {
      if (needsRedrawRef.current) {
        offscreenRef.current = createOffscreenCanvasFromArrays(
          scaledCurves,
          DIMENSIONS,
          undefined,
          undefined,
          { drawAxes: false, fillBackground: false }
        );
        needsRedrawRef.current = false;
        draw();
      }
    });
    return () => { unsubHide(); unsubShow(); };
  }, [registerOnHide, registerOnShow, scaledCurves, draw]);

  // Mouse move handler with spatial grid lookup
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      cancelAnimationFrame(rafIdRef.current);

      rafIdRef.current = requestAnimationFrame(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const canvasX = (e.clientX - rect.left) * (width / rect.width);
        const canvasY = (e.clientY - rect.top) * (height / rect.height);

        // Check if in plot area
        const inPlotArea =
          canvasX >= padding.left &&
          canvasX <= padding.left + plotWidth &&
          canvasY >= padding.top &&
          canvasY <= padding.top + plotHeight;

        if (!inPlotArea) {
          setHoverState((prev) => (prev ? null : prev));
          return;
        }

        // O(1) spatial lookup
        const candidates = findCandidates(spatialGrid, canvasX, canvasY, SPATIAL_CELL_SIZE, scratchCandidatesRef.current);
        const nearest = findNearest(candidates, canvasX, canvasY, HIT_THRESHOLD);

        if (nearest) {
          const dataX = axisLimits.xMin + ((canvasX - padding.left) / plotWidth) * (axisLimits.xMax - axisLimits.xMin);
          const dataY = axisLimits.yMax - ((canvasY - padding.top) / plotHeight) * (axisLimits.yMax - axisLimits.yMin);

          const nextHover: HoverState = {
            eventId: nearest.eventId,
            eventName: nearest.eventName,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            dataX,
            dataY,
          };

          setHoverState((prev) => {
            if (!prev) return nextHover;
            const sameEvent = prev.eventId === nextHover.eventId;
            const sameScreenPos =
              Math.abs(prev.x - nextHover.x) < 0.5 && Math.abs(prev.y - nextHover.y) < 0.5;
            const sameDataPos =
              prev.dataX !== null &&
              prev.dataY !== null &&
              nextHover.dataX !== null &&
              nextHover.dataY !== null &&
              Math.abs(prev.dataX - nextHover.dataX) < 1e-6 &&
              Math.abs(prev.dataY - nextHover.dataY) < 1e-6;
            if (sameEvent && sameScreenPos && sameDataPos) {
              return prev;
            }
            return nextHover;
          });
        } else {
          setHoverState((prev) => (prev ? null : prev));
        }
      });
    },
    [spatialGrid, width, height, padding, plotWidth, plotHeight, axisLimits]
  );

  // Click handler for pinning
  const handleClick = useCallback(() => {
    if (hoverState) {
      togglePin(hoverState.eventId);
    }
  }, [hoverState, togglePin]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(rafIdRef.current);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0 w-full h-full block pointer-events-none"
        preserveAspectRatio="xMidYMid meet"
      >
        <rect width={width} height={height} fill="white" />
        <SVGAxes
          axisLimits={axisLimits}
          scaleX={scaleX}
          scaleY={scaleY}
          width={width}
          height={height}
          padding={padding}
          config={{ ...config, gridCount: GRID_COUNT }}
          tickFontSize={AXIS_TYPOGRAPHY.interactive.tick}
          labelFontSize={AXIS_TYPOGRAPHY.interactive.label}
        />
      </svg>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="absolute inset-0 w-full h-full block"
        style={{ cursor: hoverState ? 'pointer' : 'default' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverState(null)}
        onClick={handleClick}
      />
      {hoverState && hoverState.x > 0 && (
        <PlotTooltip
          eventName={hoverState.eventName}
          eventId={hoverState.eventId}
          x={hoverState.x}
          y={hoverState.y}
          containerWidth={containerRef.current?.clientWidth ?? 0}
          dataX={hoverState.dataX}
          dataY={hoverState.dataY}
          isPinned={isPinned(hoverState.eventId)}
        />
      )}
    </div>
  );
}

'use client';

import { memo, useMemo, useId } from 'react';
import { SVGAxes } from './SVGAxes';
import { SVGPath } from './SVGPath';
import { calculateAxisLimits, createScale } from '@/lib/chart-utils/scales';
import { getCurveDisplayColor } from '@/lib/chart-utils/color';
import type { Curve, PlotConfig, ColorConfig, Dimensions, AxisLimits } from './types';

interface SVGPlotProps {
  curves: Curve[];
  config: PlotConfig;
  colorConfig: ColorConfig;
  renderMode?: 'default' | 'grid';
  width?: number;
  height?: number;
  /** Optional axis limits override. If provided, uses these instead of calculating from curves. */
  axisLimits?: AxisLimits;
}

/**
 * Default dimensions for plot SVG.
 * Padding sized for readable axis labels.
 */
const DEFAULT_DIMENSIONS: Dimensions = {
  width: 400,
  height: 280,
  padding: {
    top: 10,
    right: 14,
    bottom: 38,
    left: 52,
  },
};

/**
 * Main SVG plot component.
 * 
 * Single Responsibility: Orchestrates axes and paths.
 * Open/Closed: Accepts configuration, doesn't hardcode behavior.
 */
export const SVGPlot = memo(function SVGPlot({
  curves,
  config,
  colorConfig,
  renderMode = 'default',
  width = DEFAULT_DIMENSIONS.width,
  height = DEFAULT_DIMENSIONS.height,
  axisLimits: axisLimitsOverride,
}: SVGPlotProps) {
  const padding = DEFAULT_DIMENSIONS.padding;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // Use provided axis limits or calculate from curve data
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

  // Pre-compute path data
  const pathData = useMemo(
    () => curves.map((curve) => ({
      curve,
      color: getCurveDisplayColor(curve, colorConfig),
      opacity: 1,
    })),
    [curves, colorConfig]
  );

  // Generate unique clip path ID (useId ensures SSR/client consistency)
  const clipPathId = `plot-area${useId()}`;
  const isGridMode = renderMode === 'grid';
  const gridPathBuildOptions = useMemo(
    () => ({ roundToInteger: true, thinDuplicates: true }),
    []
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full block pointer-events-none"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Clean white background */}
      <rect width={width} height={height} fill="white" />

      {/* Axes and grid */}
      <SVGAxes
        axisLimits={axisLimits}
        scaleX={scaleX}
        scaleY={scaleY}
        width={width}
        height={height}
        padding={padding}
        config={config}
      />

      {/* Plot area clip path */}
      <defs>
        <clipPath id={clipPathId}>
          <rect
            x={padding.left}
            y={padding.top}
            width={plotWidth}
            height={plotHeight}
          />
        </clipPath>
      </defs>

      {/* Curves */}
      <g clipPath={`url(#${clipPathId})`}>
        {pathData.map(({ curve, color, opacity }) => (
          <SVGPath
            key={curve.eventId}
            points={curve.points}
            xArray={curve.xArray}
            yArray={curve.yArray}
            scaleX={scaleX}
            scaleY={scaleY}
            color={color}
            opacity={opacity}
            strokeLinecap={isGridMode ? 'butt' : 'round'}
            strokeLinejoin={isGridMode ? 'miter' : 'round'}
            pathBuildOptions={isGridMode ? gridPathBuildOptions : undefined}
          />
        ))}
      </g>
    </svg>
  );
});

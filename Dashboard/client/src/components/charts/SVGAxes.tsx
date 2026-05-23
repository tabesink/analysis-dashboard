'use client';

import { useMemo } from 'react';
import type { AxisLimits, PlotConfig } from './types';

interface SVGAxesProps {
  axisLimits: AxisLimits;
  scaleX: (x: number) => number;
  scaleY: (y: number) => number;
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  config: PlotConfig;
  /** Font size for tick labels (default: 8 for grid) */
  tickFontSize?: number;
  /** Font size for axis titles (default: 8 for grid) */
  labelFontSize?: number;
}

export const AXIS_TYPOGRAPHY = {
  grid: {
    tick: 8,
    label: 8,
  },
  interactive: {
    // Interactive view uses a larger viewport; use a scaled-up value
    // to keep perceived label size aligned with grid cards.
    tick: 16,
    label: 16,
  },
} as const;

/**
 * Renders axes, grid lines, and labels.
 * 
 * Single Responsibility: Only handles axis rendering.
 */
const SVG_COLORS = {
  grid: 'var(--border, #e5e7eb)',
  center: 'var(--foreground, #000000)',
  text: 'var(--muted-foreground, #6b7280)',
};

export function SVGAxes({
  axisLimits,
  scaleX,
  scaleY,
  width,
  height,
  padding,
  config,
  tickFontSize = AXIS_TYPOGRAPHY.grid.tick,
  labelFontSize = AXIS_TYPOGRAPHY.grid.label,
}: SVGAxesProps) {
  const gridCount = config.gridCount ?? 5;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  
  // Scale offsets proportionally to font size
  const tickOffsetY = tickFontSize * 1.75;
  const tickOffsetX = tickFontSize * 0.75;
  const labelOffset = labelFontSize * 1.5;

  // Generate tick values
  const xTicks = useMemo(
    () => generateTicks(axisLimits.xMin, axisLimits.xMax, gridCount),
    [axisLimits.xMin, axisLimits.xMax, gridCount]
  );

  const yTicks = useMemo(
    () => generateTicks(axisLimits.yMin, axisLimits.yMax, gridCount),
    [axisLimits.yMin, axisLimits.yMax, gridCount]
  );

  return (
    <g className="axes">
      {/* Grid lines - horizontal */}
      {yTicks.map((tick, idx) => (
        <line
          key={`h-${idx}`}
          x1={padding.left}
          x2={width - padding.right}
          y1={scaleY(tick)}
          y2={scaleY(tick)}
          stroke={SVG_COLORS.grid}
          strokeWidth={1.0}
        />
      ))}

      {/* Grid lines - vertical */}
      {xTicks.map((tick, idx) => (
        <line
          key={`v-${idx}`}
          x1={scaleX(tick)}
          x2={scaleX(tick)}
          y1={padding.top}
          y2={height - padding.bottom}
          stroke={SVG_COLORS.grid}
          strokeWidth={1.0}
        />
      ))}

      {/* Datum line - horizontal (y=0) */}
      <line
        x1={padding.left}
        x2={width - padding.right}
        y1={scaleY(0)}
        y2={scaleY(0)}
        stroke={SVG_COLORS.center}
        strokeWidth={1}
      />

      {/* Datum line - vertical (x=0) */}
      <line
        x1={scaleX(0)}
        x2={scaleX(0)}
        y1={padding.top}
        y2={height - padding.bottom}
        stroke={SVG_COLORS.center}
        strokeWidth={1}
      />

      {/* X-axis tick labels */}
      {xTicks.map((tick, idx) => (
        <text
          key={`xl-${idx}`}
          x={scaleX(tick)}
          y={height - padding.bottom + tickOffsetY}
          textAnchor="middle"
          fontSize={tickFontSize}
          fontFamily="system-ui, -apple-system, sans-serif"
          fill={SVG_COLORS.text}
        >
          {formatTick(tick)}
        </text>
      ))}

      {/* Y-axis tick labels */}
      {yTicks.map((tick, idx) => (
        <text
          key={`yl-${idx}`}
          x={padding.left - tickOffsetX}
          y={scaleY(tick) + tickFontSize * 0.35}
          textAnchor="end"
          fontSize={tickFontSize}
          fontFamily="system-ui, -apple-system, sans-serif"
          fill={SVG_COLORS.text}
        >
          {formatTick(tick)}
        </text>
      ))}

      {/* X-axis title */}
      <text
        x={padding.left + plotWidth / 2}
        y={height - labelOffset}
        textAnchor="middle"
        fontSize={labelFontSize}
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight={500}
        fill={SVG_COLORS.text}
      >
        {config.xLabel}{config.xUnit ? ` (${config.xUnit})` : ''}
      </text>

      {/* Y-axis title */}
      <text
        x={labelOffset}
        y={padding.top + plotHeight / 2}
        textAnchor="middle"
        fontSize={labelFontSize}
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight={500}
        fill={SVG_COLORS.text}
        transform={`rotate(-90, ${labelOffset}, ${padding.top + plotHeight / 2})`}
      >
        {config.yLabel}{config.yUnit ? ` (${config.yUnit})` : ''}
      </text>
    </g>
  );
}

/**
 * Generate evenly spaced tick values.
 */
function generateTicks(min: number, max: number, count: number): number[] {
  if (count < 2) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + i * step);
}

/**
 * Format tick value for display.
 */
function formatTick(value: number): string {
  if (Math.abs(value) < 0.01 && value !== 0) {
    return value.toExponential(1);
  }
  // Smart precision based on value magnitude
  if (Math.abs(value) < 1) {
    return value.toFixed(2);
  }
  if (Math.abs(value) < 10) {
    return value.toFixed(1);
  }
  return value.toFixed(0);
}

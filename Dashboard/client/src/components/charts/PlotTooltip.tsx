'use client';

import { Flag } from 'lucide-react';

/**
 * Plot Tooltip - Displays curve information on hover
 * 
 * Single Responsibility: Renders tooltip UI with event details
 */

export interface PlotTooltipProps {
  eventName: string;
  eventId: string;
  x: number;
  y: number;
  containerWidth: number;
  dataX: number | null;
  dataY: number | null;
  isPinned: boolean;
}

export function PlotTooltip({
  eventName,
  eventId,
  x,
  y,
  containerWidth,
  dataX,
  dataY,
  isPinned,
}: PlotTooltipProps) {
  const tooltipEstimatedWidth = 240;
  const isNearRightEdge = containerWidth > 0 && x > containerWidth - tooltipEstimatedWidth;
  const left = isNearRightEdge ? x - 12 : x + 12;
  const transform = isNearRightEdge ? 'translate(-100%, -100%)' : 'translateY(-100%)';

  return (
    <div
      className="absolute z-50 pointer-events-none max-w-xs rounded-lg border border-zinc-700/90 bg-zinc-800/90 px-3 py-2 text-sm text-zinc-100 shadow-xl backdrop-blur-xl"
      style={{
        left,
        top: y - 8,
        transform,
      }}
    >
      <div className="font-medium truncate flex items-center gap-1.5">
        {isPinned && <Flag className="h-3 w-3 text-primary shrink-0" />}
        {eventName}
      </div>
      {eventName !== eventId && (
        <div className="text-xs text-zinc-300 truncate">{eventId}</div>
      )}
      {dataX !== null && dataY !== null && (
        <div className="mt-1 font-mono text-xs text-zinc-200">
          X: {dataX.toFixed(2)} | Y: {dataY.toFixed(2)}
        </div>
      )}
      <div className="mt-1 text-caption text-zinc-300">
        Click to {isPinned ? 'unpin' : 'pin'}
      </div>
    </div>
  );
}

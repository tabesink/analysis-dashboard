'use client';

import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, Link, Unlink } from 'lucide-react';
import { SVGPlot } from './SVGPlot';
import { usePlotSettingsStore } from '@/stores/plot-settings-store';
import { useRenderStore } from '@/stores/render-store';
import { cn } from '@/lib/utils';
import type { Curve, PlotConfig, ColorConfig, AxisLimits } from './types';

interface SVGPlotCardProps {
  plotKey: string;
  title: string;
  curves: Curve[];
  config: PlotConfig;
  colorConfig: ColorConfig;
  isLoading?: boolean;
  error?: string | null;
  onClick?: () => void;
  actionButtons?: React.ReactNode;
  /** Global axis limits (used when synced) */
  globalAxisLimits?: AxisLimits | null;
  /** Local axis limits for this specific plot (used when unsynced) */
  localAxisLimits?: AxisLimits;
}

/**
 * Card wrapper for SVG plots.
 * 
 * Single Responsibility: Handles card chrome (title, loading, error states).
 * Delegates actual rendering to SVGPlot.
 */
export const SVGPlotCard = memo(function SVGPlotCard({
  plotKey,
  title,
  curves,
  config,
  colorConfig,
  isLoading = false,
  error = null,
  onClick,
  actionButtons,
  globalAxisLimits,
  localAxisLimits,
}: SVGPlotCardProps) {
  const synced = usePlotSettingsStore((s) => s.syncState[plotKey] ?? true);
  const toggleSync = usePlotSettingsStore((s) => s.toggleSync);
  const isRendering = useRenderStore((s) => s.isRendering);
  const interactiveCardClass = cn(
    'relative aspect-4/3 overflow-hidden rounded-lg border border-border/50 bg-card shadow-sm group cursor-pointer',
    isRendering
      ? 'transition-colors duration-150'
      : 'hover:shadow-md hover:border-primary/25 transition-all duration-200'
  );

  // Determine which axis limits to use based on sync state
  const axisLimits = synced && globalAxisLimits ? globalAxisLimits : localAxisLimits;

  // Loading state
  if (isLoading) {
    return (
      <Card className="relative aspect-4/3 overflow-hidden rounded-lg border border-border/50 bg-card shadow-sm">
        {/* Spinner */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-primary/60 animate-spin" />
        </div>
        
        {/* Bottom label */}
        <CardLabel title={title} />
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="relative aspect-4/3 overflow-hidden rounded-lg border border-destructive/20 bg-card shadow-sm">
        {/* Error content */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <AlertCircle className="h-5 w-5 text-destructive/70" />
            <p className="text-caption text-muted-foreground line-clamp-2 max-w-[160px]">
              {error}
            </p>
          </div>
        </div>
        
        {/* Bottom label */}
        <CardLabel title={title} />
      </Card>
    );
  } 

  // Empty state - show plot with empty axes
  if (curves.length === 0) {
    return (
      <Card
        className={interactiveCardClass}
        onClick={onClick}
      >
        <div className="absolute inset-0">
          <SVGPlot
            curves={[]}
            config={config}
            colorConfig={colorConfig}
            renderMode="grid"
          />
        </div>
        <CardLabel title={title} />
      </Card>
    );
  }

  // Normal render
  return (
    <Card
      className={interactiveCardClass}
      onClick={onClick}
    >
      {/* Plot area - full card */}
      <div className="absolute inset-0">
        <SVGPlot
          curves={curves}
          config={config}
          colorConfig={colorConfig}
          renderMode="grid"
          axisLimits={axisLimits}
        />
      </div>

      {/* Action buttons - top right */}
      <div className="absolute top-1 right-1 flex items-center gap-0.5">
        {/* Sync toggle button */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-5 w-5 rounded-md hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity duration-150',
            synced ? 'text-primary' : 'text-muted-foreground'
          )}
          onClick={(e) => {
            e.stopPropagation();
            toggleSync(plotKey);
          }}
          title={synced ? 'Synced axes (click to unsync)' : 'Unsynced axes (click to sync)'}
        >
          {synced ? (
            <Link className="h-3 w-3" />
          ) : (
            <Unlink className="h-3 w-3" />
          )}
        </Button>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          {actionButtons}
        </div>
      </div>

      {/* Bottom left label */}
      <CardLabel 
        title={title} 
        eventCount={curves.length}
        isSynced={synced}
      />
    </Card>
  );
});

/**
 * Bottom-left label with title and sync indicator.
 */
function CardLabel({ 
  title, 
  eventCount,
  isSynced = true,
}: { 
  title: string; 
  eventCount?: number;
  isSynced?: boolean;
}) {
  return (
    <div className="absolute bottom-1.5 left-2 flex items-center gap-1.5 bg-gray-100/80 px-1.5 py-0.5 rounded">
      {/* Unsync indicator - only show when unsynced */}
      {!isSynced && (
        <div 
          className="shrink-0 h-1.5 w-1.5 rounded-full bg-amber-500" 
          title="Axes unsynced from global" 
        />
      )}
      <span className="text-xs font-medium text-black leading-none">{title}</span>
    </div>
  );
}

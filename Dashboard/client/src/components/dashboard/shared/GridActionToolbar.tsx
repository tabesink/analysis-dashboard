'use client';

import { Download, MapPinPlusInside, Play, Square, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface DashboardWorkspaceActionsProps {
  isInteractiveView: boolean;
  isPinnedModeActive: boolean;
  hasPinnedEvents: boolean;
  isRendering: boolean;
  hasRenderedPlots: boolean;
  hasPendingRerenderChanges: boolean;
  renderDisabled: boolean;
  clearDisabled: boolean;
  exportDisabled?: boolean;
  onRender: () => void;
  onClear: () => void;
  onExport?: () => void;
  onReturnToGrid: () => void;
  onTogglePinnedMode: () => void;
}

function HeaderActionButton({
  label,
  text,
  disabled = false,
  active = false,
  variant = 'outline',
  onClick,
  children,
}: {
  label: string;
  text: string;
  disabled?: boolean;
  active?: boolean;
  variant?: 'outline' | 'default';
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={variant}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'min-w-[5.75rem] justify-center',
        active && 'bg-accent text-accent-foreground',
      )}
    >
      {children}
      {text}
    </Button>
  );
}

export function DashboardWorkspaceActions({
  isInteractiveView,
  isPinnedModeActive,
  hasPinnedEvents,
  isRendering,
  hasRenderedPlots,
  hasPendingRerenderChanges,
  renderDisabled,
  clearDisabled,
  exportDisabled = true,
  onRender,
  onClear,
  onExport,
  onReturnToGrid,
  onTogglePinnedMode,
}: DashboardWorkspaceActionsProps) {
  const renderLabel = isRendering
    ? 'Stop rendering'
    : hasPendingRerenderChanges && hasRenderedPlots
      ? 'Re-render plots'
      : 'Render plots';
  const renderText = isRendering
    ? 'Stop'
    : hasPendingRerenderChanges && hasRenderedPlots
      ? 'Re-render'
      : 'Render';

  const exportLabel = exportDisabled ? 'Export coming soon' : 'Export plots';
  const pinViewLabel = isPinnedModeActive ? 'Disable pinned view' : 'Enable pinned view';

  return (
    <div className="flex items-center gap-2">
      {isInteractiveView ? (
        <HeaderActionButton
          label="Return to grid view"
          text="Return to Grid"
          variant="outline"
          onClick={onReturnToGrid}
        >
          <Undo2 className="size-4" />
        </HeaderActionButton>
      ) : null}
      <HeaderActionButton
        label={pinViewLabel}
        text="Pin"
        disabled={!hasPinnedEvents && !isPinnedModeActive}
        active={isPinnedModeActive}
        onClick={onTogglePinnedMode}
      >
        <MapPinPlusInside className="size-4" />
      </HeaderActionButton>
      <HeaderActionButton
        label={exportLabel}
        text="Export"
        disabled={exportDisabled}
        onClick={onExport}
      >
        <Download className="size-4" />
      </HeaderActionButton>
      <HeaderActionButton
        label={renderLabel}
        text={renderText}
        disabled={renderDisabled}
        active={isRendering}
        variant={isRendering ? 'outline' : 'default'}
        onClick={onRender}
      >
        {isRendering ? <Square className="size-4" /> : <Play className="size-4" />}
      </HeaderActionButton>
      <HeaderActionButton
        label="Clear plots"
        text="Clear"
        disabled={clearDisabled}
        onClick={onClear}
      >
        <X className="size-4" />
      </HeaderActionButton>
    </div>
  );
}

/** @deprecated Use DashboardWorkspaceActions — floating toolbar removed. */
export const GridActionToolbar = DashboardWorkspaceActions;

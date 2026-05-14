'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Flag, Play, Square, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const TOOLBAR_STORAGE_KEY = 'dashboard-grid-toolbar-position-v1';
const TOOLBAR_PADDING = 16;
const CORNER_SNAP_PX = 24;

type DockedCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null;

interface GridActionToolbarProps {
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

function ToolbarIconButton({
  label,
  disabled = false,
  active = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            title={label}
            onClick={onClick}
            disabled={disabled}
            className={`rounded-lg text-zinc-200 hover:bg-zinc-700/80 hover:text-zinc-50 ${active ? 'bg-zinc-600 text-zinc-50' : ''}`}
          >
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function GridActionToolbar({
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
}: GridActionToolbarProps) {
  const renderLabel = isRendering
    ? 'Stop rendering'
    : hasPendingRerenderChanges && hasRenderedPlots
      ? 'Re-render plots'
      : 'Render plots';

  const exportLabel = exportDisabled ? 'Export coming soon' : 'Export plots';
  const pinViewLabel = isPinnedModeActive ? 'Disable pinned view' : 'Enable pinned view';
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const hasLoadedInitialPositionRef = useRef(false);
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const [dockedCorner, setDockedCorner] = useState<DockedCorner>(null);
  const [isDragging, setIsDragging] = useState(false);

  const clampPosition = useCallback((x: number, y: number) => {
    const toolbar = toolbarRef.current;
    const parent = toolbar?.parentElement;
    if (!toolbar || !parent) return { x, y };

    const maxX = Math.max(TOOLBAR_PADDING, parent.clientWidth - toolbar.offsetWidth - TOOLBAR_PADDING);
    const maxY = Math.max(TOOLBAR_PADDING, parent.clientHeight - toolbar.offsetHeight - TOOLBAR_PADDING);
    return {
      x: Math.min(Math.max(TOOLBAR_PADDING, x), maxX),
      y: Math.min(Math.max(TOOLBAR_PADDING, y), maxY),
    };
  }, []);

  const getCornerPosition = useCallback((corner: Exclude<DockedCorner, null>) => {
    const toolbar = toolbarRef.current;
    const parent = toolbar?.parentElement;
    if (!toolbar || !parent) return null;

    const maxX = Math.max(TOOLBAR_PADDING, parent.clientWidth - toolbar.offsetWidth - TOOLBAR_PADDING);
    const maxY = Math.max(TOOLBAR_PADDING, parent.clientHeight - toolbar.offsetHeight - TOOLBAR_PADDING);

    switch (corner) {
      case 'top-left':
        return { x: TOOLBAR_PADDING, y: TOOLBAR_PADDING };
      case 'top-right':
        return { x: maxX, y: TOOLBAR_PADDING };
      case 'bottom-left':
        return { x: TOOLBAR_PADDING, y: maxY };
      case 'bottom-right':
        return { x: maxX, y: maxY };
      default:
        return null;
    }
  }, []);

  const detectDockedCorner = useCallback((x: number, y: number): DockedCorner => {
    const topLeft = getCornerPosition('top-left');
    const topRight = getCornerPosition('top-right');
    const bottomLeft = getCornerPosition('bottom-left');
    const bottomRight = getCornerPosition('bottom-right');
    if (!topLeft || !topRight || !bottomLeft || !bottomRight) {
      return null;
    }

    const isNear = (target: { x: number; y: number }) =>
      Math.abs(x - target.x) <= CORNER_SNAP_PX && Math.abs(y - target.y) <= CORNER_SNAP_PX;

    if (isNear(topLeft)) return 'top-left';
    if (isNear(topRight)) return 'top-right';
    if (isNear(bottomLeft)) return 'bottom-left';
    if (isNear(bottomRight)) return 'bottom-right';
    return null;
  }, [getCornerPosition]);

  const handleDragStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const toolbar = toolbarRef.current;
    const parent = toolbar?.parentElement;
    if (!toolbar || !parent) return;

    const parentRect = parent.getBoundingClientRect();
    dragStateRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - parentRect.left - position.x,
      offsetY: event.clientY - parentRect.top - position.y,
    };
    setDockedCorner(null);
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  }, [position.x, position.y]);

  const handleDragMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    const toolbar = toolbarRef.current;
    const parent = toolbar?.parentElement;
    if (!drag || drag.pointerId !== event.pointerId || !parent) return;

    const parentRect = parent.getBoundingClientRect();
    const next = clampPosition(
      event.clientX - parentRect.left - drag.offsetX,
      event.clientY - parentRect.top - drag.offsetY,
    );
    setPosition(next);
  }, [clampPosition]);

  const handleDragEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    dragStateRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const snappedCorner = detectDockedCorner(position.x, position.y);
    setDockedCorner(snappedCorner);
    if (snappedCorner) {
      const snappedPosition = getCornerPosition(snappedCorner);
      if (snappedPosition) {
        setPosition(snappedPosition);
      }
    }
  }, [detectDockedCorner, getCornerPosition, position.x, position.y]);

  useEffect(() => {
    if (!toolbarRef.current) return;
    const toolbar = toolbarRef.current;
    const parent = toolbar.parentElement;
    if (!parent) return;

    const parentRect = parent.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();
    const fallbackX = Math.max(TOOLBAR_PADDING, parentRect.width - toolbarRect.width - TOOLBAR_PADDING);
    const fallbackY = Math.max(TOOLBAR_PADDING, parentRect.height - toolbarRect.height - TOOLBAR_PADDING);

    let nextPosition = { x: fallbackX, y: fallbackY };
    let nextDockedCorner: DockedCorner = 'bottom-right';
    const raw = window.localStorage.getItem(TOOLBAR_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { x?: number; y?: number; dockedCorner?: DockedCorner };
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          nextPosition = { x: parsed.x, y: parsed.y };
        }
        if (
          parsed.dockedCorner === 'top-left' ||
          parsed.dockedCorner === 'top-right' ||
          parsed.dockedCorner === 'bottom-left' ||
          parsed.dockedCorner === 'bottom-right'
        ) {
          nextDockedCorner = parsed.dockedCorner;
        } else {
          nextDockedCorner = null;
        }
      } catch {
        // Ignore malformed storage values and use fallback.
      }
    }

    setDockedCorner(nextDockedCorner);
    if (nextDockedCorner) {
      const cornerPosition = getCornerPosition(nextDockedCorner);
      setPosition(cornerPosition ?? clampPosition(nextPosition.x, nextPosition.y));
    } else {
      setPosition(clampPosition(nextPosition.x, nextPosition.y));
    }
    hasLoadedInitialPositionRef.current = true;
  }, [clampPosition, getCornerPosition]);

  useEffect(() => {
    if (!hasLoadedInitialPositionRef.current) return;
    window.localStorage.setItem(TOOLBAR_STORAGE_KEY, JSON.stringify({ ...position, dockedCorner }));
  }, [position, dockedCorner]);

  useEffect(() => {
    const handleResize = () => {
      if (dockedCorner) {
        const cornerPosition = getCornerPosition(dockedCorner);
        if (cornerPosition) {
          setPosition(cornerPosition);
          return;
        }
      }
      setPosition((current) => clampPosition(current.x, current.y));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition, dockedCorner, getCornerPosition]);

  return (
    <div
      ref={toolbarRef}
      className="absolute z-30 flex h-[16rem] flex-col rounded-lg border-2 border-zinc-700/90 bg-zinc-800/90 p-1.5 text-zinc-100 backdrop-blur-xl shadow-xl"
      style={{ left: position.x, top: position.y }}
    >
      <div className="flex flex-1 flex-col justify-start gap-2">
        <div className="flex min-h-[4.5rem] flex-col gap-2">
          {isInteractiveView ? (
            <>
              <ToolbarIconButton label="Return to grid view" onClick={onReturnToGrid}>
                <Undo2 className="h-4 w-4" />
              </ToolbarIconButton>
            </>
          ) : (
            <div aria-hidden className="h-8" />
          )}
          <ToolbarIconButton
            label={pinViewLabel}
            disabled={!hasPinnedEvents && !isPinnedModeActive}
            active={isPinnedModeActive}
            onClick={onTogglePinnedMode}
          >
            <Flag className="h-4 w-4" />
          </ToolbarIconButton>
        </div>

        <div className="my-0.5 h-px w-full bg-zinc-600/80" />

        <div className="flex flex-col gap-2">
          <ToolbarIconButton label={exportLabel} disabled={exportDisabled} onClick={onExport}>
            <Download className="h-4 w-4" />
          </ToolbarIconButton>
          <ToolbarIconButton
            label={renderLabel}
            disabled={renderDisabled}
            active={isRendering}
            onClick={onRender}
          >
            {isRendering ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </ToolbarIconButton>
          <ToolbarIconButton label="Clear plots" disabled={clearDisabled} onClick={onClear}>
            <X className="h-4 w-4" />
          </ToolbarIconButton>
        </div>

        <div className="my-0.5 h-px w-full bg-zinc-600/80" />
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Drag toolbar"
        title="Drag toolbar"
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
        onKeyDown={(e) => {
          const step = 16;
          if (e.key === 'ArrowUp') { e.preventDefault(); setPosition((p) => clampPosition(p.x, p.y - step)); }
          if (e.key === 'ArrowDown') { e.preventDefault(); setPosition((p) => clampPosition(p.x, p.y + step)); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); setPosition((p) => clampPosition(p.x - step, p.y)); }
          if (e.key === 'ArrowRight') { e.preventDefault(); setPosition((p) => clampPosition(p.x + step, p.y)); }
        }}
        className={`mt-1.5 flex h-6 items-center justify-center rounded-md text-zinc-300/80 select-none touch-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <div className="grid grid-cols-3 gap-0.5">
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
        </div>
      </div>
    </div>
  );
}

'use client';

/**
 * Verbatim port of `.cursor/skills/database-table/templates/ColumnResizeHandle.tsx`.
 *
 * 1.5px-wide vertical strip pinned to the right edge of a column header. Drag
 * to resize. While dragging, locks `document.body.style.cursor` and `userSelect`
 * through a global event listener so the cursor doesn't flicker as the pointer
 * crosses text nodes. The effect cleanup restores the prior values.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface ColumnResizeHandleProps {
  width: number;
  onResize: (next: number) => void;
  min?: number;
  max?: number;
}

export function ColumnResizeHandle({
  width,
  onResize,
  min = 60,
  max = 600,
}: ColumnResizeHandleProps) {
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      startXRef.current = e.pageX;
      startWidthRef.current = width;
      setDragging(true);
    },
    [width],
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent) => {
      const delta = e.pageX - startXRef.current;
      const next = Math.min(max, Math.max(min, startWidthRef.current + delta));
      onResize(next);
    };
    const handleUp = () => setDragging(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [dragging, max, min, onResize]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={handleMouseDown}
      className="group absolute top-0 right-0 h-full w-1.5 cursor-col-resize select-none flex justify-center"
    >
      <div
        className={cn(
          'h-full w-px transition-colors bg-border/70 group-hover:bg-primary/70',
          dragging && 'bg-primary w-0.5',
        )}
      />
    </div>
  );
}

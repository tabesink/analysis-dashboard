'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100; ignored when `indeterminate` is true */
  value?: number;
  /** Pulsing / indeterminate bar */
  indeterminate?: boolean;
}

/**
 * Lightweight progress bar (Tailwind-only). Pair with a label row for percentage text.
 */
function Progress({ className, value = 0, indeterminate, ...props }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : clamped}
      aria-valuetext={indeterminate ? 'In progress' : `${Math.round(clamped)}%`}
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-muted',
        className,
      )}
      {...props}
    >
      {indeterminate ? (
        <div
          className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-foreground"
          style={{ animation: 'progress-indeterminate 1.2s ease-in-out infinite' }}
        />
      ) : (
        <div
          className="h-full rounded-full bg-foreground transition-[width] duration-300 ease-out"
          style={{ width: `${clamped}%` }}
        />
      )}
    </div>
  );
}

export { Progress };

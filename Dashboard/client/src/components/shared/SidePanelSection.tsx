'use client';

import { useState, useEffect } from 'react';
import { Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface SidePanelSectionProps {
  title: string;
  subtitle?: string;
  defaultExpanded?: boolean;
  headerActions?: React.ReactNode;
  /** Shown below the header even when the main body is collapsed (e.g. summary + search). */
  persistentContent?: React.ReactNode;
  /** When true, expands the collapsible body (e.g. parent-driven focus). */
  forceExpanded?: boolean;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

/**
 * Collapsible section for page-level side panels (Database, Dashboard, Edit Events).
 * Single responsibility: expand/collapse + header layout; no card chrome.
 */
export function SidePanelSection({
  title,
  subtitle,
  defaultExpanded = true,
  headerActions,
  persistentContent,
  forceExpanded = false,
  className,
  contentClassName,
  children,
}: SidePanelSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (forceExpanded) {
      setIsExpanded(true);
    }
  }, [forceExpanded]);

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {headerActions}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full shrink-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {persistentContent ? (
        <div className="mt-4 space-y-4">{persistentContent}</div>
      ) : null}

      {isExpanded && (
        <div className={cn('mt-4 flex-1 min-h-0 flex flex-col', contentClassName)}>
          {children}
        </div>
      )}
    </div>
  );
}

'use client';

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center min-h-[200px] p-6 text-center',
        className
      )}
    >
      {Icon && (
        <Icon className="h-10 w-10 text-muted-foreground/50 mb-4" strokeWidth={1.5} />
      )}
      <h3 className="text-sm font-medium text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground max-w-[250px]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}


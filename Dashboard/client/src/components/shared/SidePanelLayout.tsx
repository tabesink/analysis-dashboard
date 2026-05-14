'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SidePanelLayoutProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  expandedWidth?: string;
  children: React.ReactNode;
}

export function SidePanelLayout({
  isCollapsed,
  onToggleCollapse,
  expandedWidth = 'w-[400px]',
  children,
}: SidePanelLayoutProps) {
  return (
    <div
      className={cn(
        'relative bg-card border border-border rounded-l-lg text-card-foreground transition-all duration-300 ease-out flex flex-col h-full shadow-subtle',
        isCollapsed ? 'w-14' : expandedWidth,
      )}
    >
      <Button
        variant="outline"
        size="icon"
        className="absolute -right-3 top-6 z-10 h-6 w-6 rounded-full bg-background border shadow-subtle hover:shadow-elevated transition-all"
        onClick={onToggleCollapse}
      >
        {isCollapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </Button>

      <div
        className={cn(
          'flex flex-col h-full overflow-hidden transition-opacity duration-200',
          isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100',
        )}
      >
        {children}
      </div>
    </div>
  );
}

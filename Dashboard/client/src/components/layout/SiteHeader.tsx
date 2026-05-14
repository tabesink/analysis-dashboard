"use client"

/**
 * SiteHeader Component
 * 
 * SOLID Principles Applied:
 * - Single Responsibility: Only responsible for rendering header structure
 * - Open/Closed: Extensible through config injection without modification
 * - Dependency Inversion: Depends on HeaderConfig abstraction
 * 
 * Design: Minimal header that blends seamlessly with content.
 * Sidebar trigger removed (sidebar is fixed, non-collapsible).
 */

import { usePathname } from 'next/navigation'
import type { HeaderConfig } from "@/types/layout"
import { getHeaderConfig } from "@/config/header-config"
import { VersionLabel } from "./VersionLabel"
import { Button } from "@/components/ui/button"

/**
 * Header actions component
 * Single Responsibility: Only responsible for rendering header actions
 */
interface HeaderActionsProps {
  actions?: HeaderConfig['actions'];
}

const HeaderActions: React.FC<HeaderActionsProps> = ({ actions }) => {
  if (!actions || actions.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      {actions.map((action, index) => {
        if (action.href) {
          return (
            <a
              key={index}
              href={action.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {action.label}
            </a>
          );
        }
        if (action.onClick) {
          return (
            <button
              key={index}
              onClick={action.onClick}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {action.label}
            </button>
          );
        }
        return null;
      })}
    </div>
  );
};

export interface SiteHeaderProps {
  config?: HeaderConfig;
}

export function SiteHeader({ config }: SiteHeaderProps) {
  const pathname = usePathname();
  
  // Dependency Inversion: Use injected config or fallback to default
  const headerConfig = config ?? getHeaderConfig(pathname || '');
  
  return (
    <header className="flex h-12 shrink-0 items-center border-b border-border/50 bg-background/95 backdrop-blur-subtle w-full sticky top-0 z-10">
      <div className="flex w-full items-center justify-between px-6">
        <div className="flex items-center gap-3">
          {headerConfig.title && (
            <h1 className="text-sm font-medium text-foreground/90 tracking-tight">
              {headerConfig.title}
            </h1>
          )}
        </div>
        <div className="flex items-center gap-4">
          <HeaderActions actions={headerConfig.actions} />
          <VersionLabel />
        </div>
      </div>
    </header>
  )
}

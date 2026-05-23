'use client'

/**
 * ClientLayout Component
 * 
 * SOLID Principles Applied:
 * - Single Responsibility: Only responsible for layout structure and composition
 * - Open/Closed: Extensible through props without modification
 * 
 * Design: Two-panel layout (sidebar + main content).
 * Mobile support intentionally removed for clean, bloat-free code.
 */

import { AppSidebar } from './AppSidebar'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { SiteHeader } from './SiteHeader'
import { usePathname } from 'next/navigation'

export interface ClientLayoutProps {
  children: React.ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  const pathname = usePathname();
  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <SidebarProvider className="h-screen overflow-hidden">
      <div className="flex h-full flex-1 overflow-hidden">
        <AppSidebar />
        <SidebarInset className="min-h-0 flex flex-col overflow-hidden">
          <SiteHeader />
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            {children}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

'use client';

import { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/shared';
import { useUIStore } from '@/stores/ui-store';
import { getDashboardConfig } from '@/config/dashboard-config';
import { DEFAULT_GRID_COLUMNS } from '@/config/constants';
import type { DashboardPageConfig } from '@/types/dashboard';
import { useAuthStore } from '@/stores/auth-store';

const SidePanel = dynamic(
  () => import('@/components/dashboard/side-panel').then((m) => ({ default: m.SidePanel })),
  { loading: () => <div className="w-14 bg-card border border-border rounded-l-lg" /> }
);

const DashboardContent = dynamic(
  () => import('@/components/dashboard/DashboardContent').then((m) => ({ default: m.DashboardContent })),
  { loading: () => <div className="flex-1 flex items-center justify-center"><LoadingSpinner size="lg" /></div> }
);

/**
 * Dashboard page component
 * 
 * SOLID Principles Applied:
 * - Single Responsibility: Only responsible for page composition and layout
 * - Open/Closed: Extensible through config injection without modification
 * - Dependency Inversion: Depends on DashboardPageConfig abstraction
 */
export interface DashboardPageProps {
  config?: DashboardPageConfig;
}

export default function DashboardPage({ config }: DashboardPageProps = {}) {
  const router = useRouter();
  const authStatus = useAuthStore((s) => s.status);
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const [gridColumns, setGridColumns] = useState(DEFAULT_GRID_COLUMNS);
  
  // Dependency Inversion: Use injected config or fallback to default
  const baseConfig = config ?? getDashboardConfig();
  
  // Enhance config with dynamic props for components that need them
  const dashboardConfig = useMemo(() => ({
    ...baseConfig,
    tabs: baseConfig.tabs.map(tab => {
      if (tab.id === 'grid') {
        return {
          ...tab,
          componentProps: {
            columns: gridColumns,
            onColumnsChange: setGridColumns,
          },
        };
      }
      return tab;
    }),
  }), [baseConfig, gridColumns]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as 'grid' | 'interactive');
  };

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/login');
    }
  }, [authStatus, router]);

  if (authStatus === 'loading' || authStatus === 'idle') {
    return (
      <main className="flex-1 flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <LoadingSpinner size="lg" />
      </main>
    );
  }

  return (
    <main className="flex-1 p-4 min-h-[calc(100vh-3.5rem)]">
      <div className="flex gap-0 h-[calc(100vh-7rem)]">
        <SidePanel />
        <DashboardContent
          config={dashboardConfig}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      </div>
    </main>
  );
}

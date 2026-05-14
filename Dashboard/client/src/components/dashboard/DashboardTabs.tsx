'use client';

import { Tabs, TabsContent } from '@/components/ui/tabs';
import type { DashboardTabConfig } from '@/types/dashboard';

export interface DashboardTabsProps {
  tabs: DashboardTabConfig[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function DashboardTabs({
  tabs,
  activeTab,
  onTabChange,
  className = '',
}: DashboardTabsProps) {
  return (
    <div className={`relative flex flex-col h-full ${className}`}>
      <Tabs
        value={activeTab}
        onValueChange={onTabChange}
        className="flex flex-col h-full"
      >
        {tabs.map((tab) => {
          const TabComponent = tab.component;
          return (
            <TabsContent
              key={tab.id}
              value={tab.id}
              className="flex-1 m-0 overflow-hidden"
            >
              <TabComponent />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

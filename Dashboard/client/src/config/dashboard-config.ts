import { PlotGrid } from '@/components/dashboard/plot-grid';
import { InteractiveViewer } from '@/components/dashboard/interactive-viewer';
import type { DashboardTabConfig, DashboardPageConfig } from '@/types/dashboard';

/**
 * Dashboard tab configurations
 * Single Responsibility: Only responsible for dashboard tab configuration
 * Open/Closed: Can be extended without modifying existing code
 */
export const getDashboardTabs = (): DashboardTabConfig[] => [
  {
    id: 'grid',
    label: 'Grid View',
    component: PlotGrid,
  },
  {
    id: 'interactive',
    label: 'Interactive',
    disabled: true,
    component: InteractiveViewer,
  },
];

/**
 * Dashboard page configuration
 * Single Responsibility: Only responsible for dashboard page configuration
 * Dependency Inversion: Returns configuration that can be injected
 */
export const getDashboardConfig = (): DashboardPageConfig => ({
  tabs: getDashboardTabs(),
  defaultTab: 'grid',
});


import {
  Calculator,
  Database,
  FilePen,
  LayoutDashboardIcon,
} from 'lucide-react';
import type { SidebarConfig } from '@/types/layout';

/**
 * Sidebar configuration
 * Single Responsibility: Only responsible for sidebar navigation data
 * Dependency Inversion: Returns a configuration object that can be injected
 */
export const getSidebarConfig = (): SidebarConfig => ({
  navMain: [
    {
      title: 'Database',
      url: '/database',
      icon: Database,
      requirePermission: 'write',
      disabledTooltip: 'Read-only access — contact admin',
    },
    {
      title: 'Edit Metadata',
      url: '/database/edit',
      icon: FilePen,
      requirePermission: 'write',
      disabledTooltip: 'Read-only access — contact admin',
    },
    {
      title: 'Dashboard',
      url: '/dashboard',
      icon: LayoutDashboardIcon,
    },
    {
      title: 'Inspect Damage',
      url: '/inspect-damage',
      icon: Calculator,
    },
  ],
});

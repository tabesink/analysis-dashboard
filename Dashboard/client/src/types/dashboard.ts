/**
 * Dashboard page configuration interfaces
 * Follows Interface Segregation Principle - focused interfaces
 */

export interface DashboardTabConfig {
  id: string;
  label: string;
  disabled?: boolean;
  component: React.ComponentType<Record<string, never>>;
}

export interface DashboardPageConfig {
  tabs: DashboardTabConfig[];
  defaultTab?: string;
}

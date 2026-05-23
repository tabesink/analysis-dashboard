import type { HeaderConfig } from '@/types/layout';

/**
 * Header configuration factory
 * Single Responsibility: Only responsible for header configuration
 * Open/Closed: Can be extended without modifying existing code
 */
export const getHeaderConfig = (pathname: string): HeaderConfig => {
  const routeTitles: Record<string, string | undefined> = {
    '/database': undefined,
    '/dashboard': undefined,
    '/database/edit': undefined,
    '/inspect-damage': undefined,
  };

  return {
    title: routeTitles[pathname],
    actions: [],
  };
};


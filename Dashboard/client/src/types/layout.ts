import type { LucideIcon } from 'lucide-react';

/**
 * Navigation item interface
 * Follows Interface Segregation Principle - focused interface
 */
export type NavigationPermission = 'write' | 'admin';

export interface NavigationItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  items?: NavigationSubItem[];
  /**
   * If set, the item is grayed out (and inert) when the current user lacks
   * the named permission. Admin always satisfies any value.
   */
  requirePermission?: NavigationPermission;
  /**
   * Tooltip shown when the item is gated and the user does not meet
   * `requirePermission`.
   */
  disabledTooltip?: string;
}

export interface NavigationSubItem {
  title: string;
  url: string;
}

/**
 * User data interface
 * Follows Interface Segregation Principle - focused interface
 */
export interface UserData {
  name: string;
  email: string;
  avatar?: string;
}

/**
 * User menu item interface
 * Follows Interface Segregation Principle - focused interface
 */
export interface UserMenuItem {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  href?: string;
  separator?: boolean;
}

/**
 * Sidebar configuration interface
 * Follows Dependency Inversion Principle - depends on abstractions
 */
export interface SidebarConfig {
  navMain: NavigationItem[];
  navSecondary?: NavigationItem[];
  navDocuments?: NavigationItem[];
  navClouds?: NavigationItem[];
}

/**
 * Header configuration interface
 * Follows Dependency Inversion Principle - depends on abstractions
 */
export interface HeaderConfig {
  title?: string;
  actions?: HeaderAction[];
}

export interface HeaderAction {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: 'ghost' | 'default' | 'outline';
  icon?: LucideIcon;
}


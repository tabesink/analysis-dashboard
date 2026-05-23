/**
 * Info API Client
 * 
 * Fetches application version and compatibility information from the server.
 * 
 * SOLID Principles:
 * - Single Responsibility: Info API calls only
 * - Interface Segregation: Clean, focused interface
 */

import { get } from './client';

/**
 * Server info response structure
 */
export interface InfoResponse {
  server_version: string;
  api_version: string;
  client_min_version: string;
  app_env: string;
  database_status: string;
  database_schema_version: number | null;
  database_schema_target_version: number;
  database_schema_needs_migration: boolean;
}

/**
 * Info API endpoints
 */
export const infoApi = {
  /**
   * Get server version and compatibility information.
   * 
   * Clients should call this on startup to verify compatibility.
   * 
   * @returns Promise<InfoResponse> Server version information
   */
  getInfo: (): Promise<InfoResponse> => {
    return get<InfoResponse>('/api/v1/info');
  },
};


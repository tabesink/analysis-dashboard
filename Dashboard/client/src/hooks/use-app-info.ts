/**
 * Application Info Hook
 * 
 * Fetches and manages application version information including
 * server version, client version, and compatibility status.
 * 
 * SOLID Principles:
 * - Single Responsibility: Version info management only
 * - Dependency Inversion: Uses infoApi abstraction
 */

import { useQuery } from '@tanstack/react-query';
import { infoApi, type InfoResponse } from '@/lib/api/info';
import { getClientVersionRaw, isVersionCompatible } from '@/config/version';

/**
 * Unified application info including client and server versions
 */
export interface AppInfo {
  /** Server version string (SemVer) */
  serverVersion: string;
  /** Client version string (SemVer) */
  clientVersion: string;
  /** API version prefix (e.g., 'v1') */
  apiVersion: string;
  /** Minimum client version supported by server */
  clientMinVersion: string;
  /** Whether client meets minimum version requirement */
  isCompatible: boolean;
  /** Runtime mode reported by the server */
  appEnv: string;
  /** Database connectivity status reported by the server */
  databaseStatus: string;
  /** Schema version currently recorded in the database */
  databaseSchemaVersion: number | null;
  /** Schema version expected by this application build */
  databaseSchemaTargetVersion: number;
  /** Whether the database schema differs from the application target */
  databaseSchemaNeedsMigration: boolean;
}

/**
 * Hook return type
 */
export interface UseAppInfoResult {
  /** Application info data */
  data: AppInfo | undefined;
  /** Loading state */
  isLoading: boolean;
  /** Error if request failed */
  error: Error | null;
  /** Whether data is available */
  isSuccess: boolean;
}

/**
 * Transform server response to AppInfo
 */
function transformResponse(serverInfo: InfoResponse): AppInfo {
  const clientVersion = getClientVersionRaw();
  
  return {
    serverVersion: serverInfo.server_version,
    clientVersion,
    apiVersion: serverInfo.api_version,
    clientMinVersion: serverInfo.client_min_version,
    isCompatible: isVersionCompatible(clientVersion, serverInfo.client_min_version),
    appEnv: serverInfo.app_env,
    databaseStatus: serverInfo.database_status,
    databaseSchemaVersion: serverInfo.database_schema_version,
    databaseSchemaTargetVersion: serverInfo.database_schema_target_version,
    databaseSchemaNeedsMigration: serverInfo.database_schema_needs_migration,
  };
}

/**
 * Fetch and manage application version information.
 * 
 * Automatically checks compatibility between client and server versions.
 * 
 * @example
 * ```tsx
 * function Footer() {
 *   const { data, isLoading } = useAppInfo();
 *   
 *   if (isLoading) return <span>Loading...</span>;
 *   
 *   return (
 *     <span>
 *       Client: v{data?.clientVersion} | Server: v{data?.serverVersion}
 *     </span>
 *   );
 * }
 * ```
 */
export function useAppInfo(): UseAppInfoResult {
  const { data, isLoading, error, isSuccess } = useQuery({
    queryKey: ['app-info'],
    queryFn: async () => {
      const serverInfo = await infoApi.getInfo();
      return transformResponse(serverInfo);
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: 1, // Only retry once for version check
  });

  return {
    data,
    isLoading,
    error: error as Error | null,
    isSuccess,
  };
}


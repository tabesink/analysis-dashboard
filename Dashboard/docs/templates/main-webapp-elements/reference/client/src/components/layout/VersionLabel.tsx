'use client';

/**
 * Version Label Component
 * 
 * Displays client/server version in the header.
 * 
 * SOLID Principles:
 * - Single Responsibility: Version display only
 * - Dependency Inversion: Uses useAppInfo hook abstraction
 */

import { useAppInfo } from '@/hooks/use-app-info';
import { getClientVersionRaw } from '@/config/version';

export function VersionLabel() {
  const { data, isLoading } = useAppInfo();
  const clientVersion = getClientVersionRaw();

  // Show client version immediately, server version when loaded
  const serverVersion = isLoading ? '...' : (data?.serverVersion ?? '?');

  return (
    <span className="text-xs text-muted-foreground font-mono bg-muted/70 px-2 py-1 rounded">
      Version: {clientVersion}/{serverVersion}
    </span>
  );
}


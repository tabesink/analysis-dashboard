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

import { useEffect, useState } from 'react';
import { useAppInfo } from '@/hooks/use-app-info';
import { getClientVersionRaw } from '@/config/version';

interface VersionLabelParts {
  clientVersion: string;
  serverVersion: string;
  databaseSchemaVersion?: number | null;
  databaseSchemaTargetVersion?: number | null;
}

export function formatVersionLabel({
  clientVersion,
  serverVersion,
  databaseSchemaVersion,
  databaseSchemaTargetVersion,
}: VersionLabelParts): string {
  const schemaVersion =
    databaseSchemaVersion == null
      ? '?'
      : databaseSchemaTargetVersion != null &&
          databaseSchemaTargetVersion !== databaseSchemaVersion
        ? `${databaseSchemaVersion} -> ${databaseSchemaTargetVersion}`
        : String(databaseSchemaVersion);

  const appVersion =
    serverVersion === '...' || clientVersion === serverVersion
      ? clientVersion
      : `${clientVersion}/${serverVersion}`;

  return `Version: ${appVersion} · DB schema: ${schemaVersion}`;
}

export function VersionLabel() {
  const [mounted, setMounted] = useState(false);
  const { data, isLoading } = useAppInfo();
  const clientVersion = getClientVersionRaw();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Defer server-driven text until after hydration so SSR matches the first client paint.
  const serverVersion =
    !mounted || isLoading ? '...' : (data?.serverVersion ?? '?');
  const label = formatVersionLabel({
    clientVersion,
    serverVersion,
    databaseSchemaVersion: mounted ? data?.databaseSchemaVersion : null,
    databaseSchemaTargetVersion: mounted
      ? data?.databaseSchemaTargetVersion
      : null,
  });

  return (
    <span className="text-xs text-muted-foreground font-mono bg-muted/70 px-2 py-1 rounded">
      {label}
    </span>
  );
}


'use client';

import { useQuery } from '@tanstack/react-query';
import { databaseApi } from '@/lib/api/database';
import type { CertificateListQuery } from '@/types/database';

export function useCertificateHierarchy(query: CertificateListQuery) {
  return useQuery({
    queryKey: ['database', 'certificates', query],
    queryFn: ({ signal }) => databaseApi.listCertificates(query, signal),
  });
}

export function useCertificatePages(certificateId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['database', 'certificates', certificateId, 'pages'],
    queryFn: ({ signal }) => databaseApi.listPages(certificateId, signal),
    enabled,
  });
}

export function usePageTables(pageId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['database', 'pages', pageId, 'tables'],
    queryFn: ({ signal }) => databaseApi.listTables(pageId, signal),
    enabled,
  });
}


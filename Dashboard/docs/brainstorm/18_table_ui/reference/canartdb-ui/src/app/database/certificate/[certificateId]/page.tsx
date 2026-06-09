'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CertificatePagesTable,
  DatabaseSidePanel,
} from '@/components/upload';
import { useCertificatePages } from '@/hooks/use-certificate-hierarchy';
import { useUploadJob } from '@/hooks/use-upload';
import { databaseApi } from '@/lib/api/database';
import { isNotImplementedError } from '@/lib/api/client';
import type {
  CertificateSummary,
  FailureKind,
  PageIngestFailure,
} from '@/types/database';

const EXPANDED_PAGES_PARAM = 'expandedPageIds';

export default function CertificateDetailPage() {
  return (
    <Suspense
      fallback={
        <section className="flex-1 p-4 text-sm text-muted-foreground">
          Loading certificate detail...
        </section>
      }
    >
      <CertificateDetailContent />
    </Suspense>
  );
}

function CertificateDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ certificateId: string }>();
  const queryClient = useQueryClient();
  const certificateId = params.certificateId ?? '';
  const didNotifyNotImplementedRef = useRef(false);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState('');

  const certificateSummaryQuery = useQuery({
    queryKey: ['database', 'certificate-summary', certificateId],
    queryFn: ({ signal }) => fetchCertificateSummary(certificateId, signal),
    enabled: Boolean(certificateId),
  });

  const pagesQuery = useCertificatePages(certificateId, Boolean(certificateId));
  const uploadJob = useUploadJob();

  // Expansion state contract: when the URL param is absent (initial nav from
  // the cert root), all pages start expanded. Once the user toggles, every
  // toggle writes the param explicitly (including the empty-list "all
  // collapsed" state) so subsequent renders honor the explicit selection.
  const rawExpandedParam = searchParams.get(EXPANDED_PAGES_PARAM);
  const pagesItems = pagesQuery.data?.items;
  const expandedPageIds = useMemo(() => {
    if (rawExpandedParam === null) {
      return (pagesItems ?? []).map((page) => String(page.page_id));
    }
    return readListParam(rawExpandedParam);
  }, [rawExpandedParam, pagesItems]);

  useEffect(() => {
    if (
      pagesQuery.error
      && !didNotifyNotImplementedRef.current
      && isNotImplementedError(pagesQuery.error)
    ) {
      didNotifyNotImplementedRef.current = true;
      toast.info('Database endpoints are not implemented yet. UI remains fully navigable.');
    }
  }, [pagesQuery.error]);

  const failuresByPageNumber = useMemo(() => {
    const map = new Map<number, PageIngestFailure>();
    const failures = pagesQuery.data?.diagnostics?.page_ingest_failures ?? [];
    for (const failure of failures) {
      if (!map.has(failure.page_number)) {
        map.set(failure.page_number, failure);
      }
    }
    return map;
  }, [pagesQuery.data?.diagnostics?.page_ingest_failures]);

  function updateParams(mutator: (params: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams.toString());
    mutator(next);
    const queryString = next.toString();
    router.replace(
      queryString
        ? `/database/certificate/${certificateId}?${queryString}`
        : `/database/certificate/${certificateId}`,
    );
  }

  function handleTogglePage(pageId: string) {
    const exists = expandedPageIds.includes(pageId);
    const next = exists
      ? expandedPageIds.filter((entry) => entry !== pageId)
      : [...expandedPageIds, pageId];
    // Always write the param (even empty) once the user has toggled, so the
    // default-all-expanded behavior only fires on first navigation. An empty
    // value here is the explicit "all collapsed" state.
    updateParams((p) => {
      p.set(EXPANDED_PAGES_PARAM, next.join(','));
    });
  }

  function handleBack() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete(EXPANDED_PAGES_PARAM);
    const queryString = next.toString();
    router.push(queryString ? `/database?${queryString}` : '/database');
  }

  function handleOpenTable(tableId: string) {
    const queryString = searchParams.toString();
    router.push(
      queryString
        ? `/database/table/${tableId}?${queryString}`
        : `/database/table/${tableId}`,
    );
  }

  function handleOpenFailedTable(input: {
    tableId: string;
    certificateId: string;
    pageNumber: number;
    failureKind: FailureKind;
  }) {
    const next = new URLSearchParams(searchParams.toString());
    next.set('mode', 'fix');
    next.set('certificateId', input.certificateId);
    next.set('pageNumber', String(input.pageNumber));
    next.set('failureKind', input.failureKind);
    router.push(`/database/table/${input.tableId}?${next.toString()}`);
  }

  function handleSelectFiles(fileList: FileList | null) {
    setSelectedFiles(fileList ? Array.from(fileList) : []);
  }

  function handleRemoveFile(fileName: string) {
    setSelectedFiles((previous) => previous.filter((file) => file.name !== fileName));
  }

  async function handleUpload() {
    if (selectedFiles.length === 0) {
      toast.error('Select at least one PDF before upload.');
      return;
    }
    const invalid = selectedFiles.filter((file) => !file.name.toLowerCase().endsWith('.pdf'));
    if (invalid.length > 0) {
      toast.error('Only PDF files are allowed for upload.');
      return;
    }
    try {
      const result = await uploadJob.startUpload({ files: selectedFiles, notes });
      const createdCount = result?.created_certificates.length ?? 0;
      const failureCount = result?.failures.length ?? 0;

      if (createdCount > 0) {
        void queryClient.invalidateQueries({ queryKey: ['database'] });
      }

      if (createdCount > 0 && failureCount === 0) {
        toast.success('Upload job completed. Extraction data refresh requested.');
        return;
      }

      if (createdCount === 0 && failureCount > 0) {
        const firstReason = result?.failures[0]?.reason;
        toast.error(firstReason || 'Upload failed');
      }
    } catch (error) {
      if (isNotImplementedError(error)) {
        toast.info('Upload endpoint is pending backend implementation. Placeholder flow is active.');
        return;
      }
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    }
  }

  async function handleCancelUpload() {
    await uploadJob.cancelUpload();
    void queryClient.invalidateQueries({ queryKey: ['database'] });
  }

  const certificate = certificateSummaryQuery.data ?? null;
  const certificateName = certificate?.certificate_name ?? `Certificate ${certificateId}`;
  const isRefreshing = pagesQuery.isFetching && !pagesQuery.isLoading;

  return (
    <section className="flex-1 p-4">
      <div className="flex h-[calc(100vh-7rem)] gap-0">
        <DatabaseSidePanel
          selectedFiles={selectedFiles}
          notes={notes}
          uploadState={uploadJob.state}
          isUploading={uploadJob.isBusy}
          onSelectFiles={handleSelectFiles}
          onRemoveFile={handleRemoveFile}
          onClearFiles={() => setSelectedFiles([])}
          onChangeNotes={setNotes}
          onUpload={handleUpload}
          onCancelUpload={handleCancelUpload}
        />
        <div className="min-w-0 flex-1">
          <CertificatePagesTable
            certificateId={certificateId}
            certificateName={certificateName}
            certificateMetadata={{
              dateModified: certificate?.date_modified ?? '',
              modifiedBy: certificate?.modified_by ?? '',
              notes: certificate?.notes ?? null,
            }}
            pages={pagesQuery.data?.items ?? []}
            failuresByPageNumber={failuresByPageNumber}
            expandedPageIds={expandedPageIds}
            isLoading={pagesQuery.isLoading}
            isRefreshing={isRefreshing}
            onTogglePage={handleTogglePage}
            onOpenTable={handleOpenTable}
            onOpenFailedTable={handleOpenFailedTable}
            onBack={handleBack}
          />
        </div>
      </div>
    </section>
  );
}

async function fetchCertificateSummary(
  certificateId: string,
  signal: AbortSignal | undefined,
): Promise<CertificateSummary | null> {
  // The backend doesn't expose a per-cert summary endpoint, so we look the cert
  // up on the first page of the cert list. If the user navigated directly to a
  // cert ID outside that page we still render with a fallback name.
  if (!certificateId) {
    return null;
  }
  const response = await databaseApi.listCertificates(
    { limit: 100, offset: 0 },
    signal,
  );
  return (
    response.items.find(
      (entry) => String(entry.certificate_id) === String(certificateId),
    ) ?? null
  );
}

function readListParam(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

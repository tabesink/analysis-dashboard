'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CertificateFlatTable, DatabaseSidePanel } from '@/components/upload';
import { useCertificateHierarchy } from '@/hooks/use-certificate-hierarchy';
import { useUploadJob } from '@/hooks/use-upload';
import { databaseApi } from '@/lib/api/database';
import { isNotImplementedError } from '@/lib/api/client';
import type { CertificateSortField, SortDirection } from '@/types/database';

const PAGE_PARAM = 'page';
const ROWS_PARAM = 'rows';
const SORT_BY_PARAM = 'sortBy';
const SORT_PARAM = 'sortDir';

export default function DatabasePage() {
  return (
    <Suspense
      fallback={
        <section className="flex-1 p-4 text-sm text-muted-foreground">
          Loading database page...
        </section>
      }
    >
      <DatabasePageContent />
    </Suspense>
  );
}

function DatabasePageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const didNotifyNotImplementedRef = useRef(false);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState('');
  const [selectedCertificateIds, setSelectedCertificateIds] = useState<string[]>([]);
  const [isDeletingCertificates, setIsDeletingCertificates] = useState(false);

  const page = readNumberParam(searchParams.get(PAGE_PARAM), 1);
  const rowsPerPage = readNumberParam(searchParams.get(ROWS_PARAM), 10);
  const sortField = readSortFieldParam(searchParams.get(SORT_BY_PARAM));
  const sortDirection = readSortParam(searchParams.get(SORT_PARAM));

  const listQuery = useCertificateHierarchy({
    limit: rowsPerPage,
    offset: (page - 1) * rowsPerPage,
    sort: `${sortField}:${sortDirection}`,
  });

  const uploadJob = useUploadJob();

  useEffect(() => {
    if (
      listQuery.error
      && !didNotifyNotImplementedRef.current
      && isNotImplementedError(listQuery.error)
    ) {
      didNotifyNotImplementedRef.current = true;
      toast.info('Database endpoints are not implemented yet. UI remains fully navigable.');
    }
  }, [listQuery.error]);

  function updateParams(mutator: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutator(params);
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  }

  function setPage(nextPage: number) {
    updateParams((params) => {
      params.set(PAGE_PARAM, String(Math.max(1, nextPage)));
    });
  }

  function setRowsPerPage(nextRows: number) {
    updateParams((params) => {
      params.set(ROWS_PARAM, String(nextRows));
      params.set(PAGE_PARAM, '1');
    });
  }

  function setSort(nextField: CertificateSortField, nextDirection: SortDirection) {
    updateParams((params) => {
      params.set(SORT_BY_PARAM, nextField);
      params.set(SORT_PARAM, nextDirection);
      params.set(PAGE_PARAM, '1');
    });
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

    const invalidFiles = selectedFiles.filter(
      (file) => !file.name.toLowerCase().endsWith('.pdf'),
    );
    if (invalidFiles.length > 0) {
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
    // Cancel deletes any certs that were already created by this job; refresh
    // the table immediately so they disappear without a manual reload.
    void queryClient.invalidateQueries({ queryKey: ['database'] });
  }

  function handleOpenCertificate(certificateId: string) {
    const queryString = searchParams.toString();
    router.push(
      queryString
        ? `/database/certificate/${certificateId}?${queryString}`
        : `/database/certificate/${certificateId}`,
    );
  }

  function toggleCertificateSelection(certificateId: string) {
    setSelectedCertificateIds((current) =>
      current.includes(certificateId)
        ? current.filter((id) => id !== certificateId)
        : [...current, certificateId],
    );
  }

  function toggleAllVisibleSelections(checked: boolean) {
    const visibleIds = certificates.map((certificate) => String(certificate.certificate_id));
    setSelectedCertificateIds(checked ? visibleIds : []);
  }

  async function handleDeleteSelectedCertificates() {
    if (selectedCertificateIds.length === 0 || isDeletingCertificates) {
      return;
    }
    const confirmed = window.confirm(
      `Delete ${selectedCertificateIds.length} selected certificate(s)? This will remove related DB rows and tracked staged files.`,
    );
    if (!confirmed) {
      return;
    }
    const certificateIds = selectedCertificateIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
    if (certificateIds.length === 0) {
      toast.error('No valid certificate IDs selected.');
      return;
    }
    setIsDeletingCertificates(true);
    try {
      const response = await databaseApi.deleteCertificates({ certificate_ids: certificateIds });
      const warningCount = response.cleanup_warnings.length;
      const notFoundCount = response.not_found_ids.length;
      toast.success(
        `Deleted ${response.deleted_count} certificate(s).`
          + (notFoundCount > 0 ? ` ${notFoundCount} not found.` : '')
          + (warningCount > 0 ? ` ${warningCount} cleanup warning(s).` : ''),
      );
      setSelectedCertificateIds([]);
      void queryClient.invalidateQueries({ queryKey: ['database'] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Certificate delete failed');
    } finally {
      setIsDeletingCertificates(false);
    }
  }

  const certificates = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const isRefreshing = listQuery.isFetching && !listQuery.isLoading;

  useEffect(() => {
    const visibleIds = new Set(certificates.map((certificate) => String(certificate.certificate_id)));
    setSelectedCertificateIds((current) => {
      const filtered = current.filter((certificateId) => visibleIds.has(certificateId));
      if (
        filtered.length === current.length
        && filtered.every((certificateId, index) => certificateId === current[index])
      ) {
        return current;
      }
      return filtered;
    });
  }, [certificates]);

  const panelSubtitle = useMemo(() => {
    if (selectedFiles.length === 0) {
      return 'Select PDFs and submit extraction.';
    }
    return `${selectedFiles.length} file(s) ready`;
  }, [selectedFiles.length]);

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
          <CertificateFlatTable
            certificates={certificates}
            isLoading={listQuery.isLoading}
            isRefreshing={isRefreshing}
            selectedCertificateIds={selectedCertificateIds}
            isDeletingSelected={isDeletingCertificates}
            total={total}
            page={page}
            rowsPerPage={rowsPerPage}
            sortField={sortField}
            sortDirection={sortDirection}
            onChangePage={setPage}
            onChangeRowsPerPage={setRowsPerPage}
            onChangeSort={setSort}
            onToggleCertificateSelection={toggleCertificateSelection}
            onToggleAllVisibleSelections={toggleAllVisibleSelections}
            onDeleteSelected={handleDeleteSelectedCertificates}
            onOpenCertificate={handleOpenCertificate}
          />
        </div>
      </div>
      <p className="sr-only">{panelSubtitle}</p>
    </section>
  );
}

function readNumberParam(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readSortParam(value: string | null): SortDirection {
  return value === 'asc' ? 'asc' : 'desc';
}

function readSortFieldParam(value: string | null): CertificateSortField {
  switch (value) {
    case 'certificate_name':
    case 'date_modified':
    case 'modified_by':
      return value;
    default:
      return 'date_modified';
  }
}

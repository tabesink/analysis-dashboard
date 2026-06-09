'use client';

import { Suspense, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, RefreshCw, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  FailedPageEditor,
  SaveConfirmDialog,
  TableResultsEditor,
} from '@/components/upload';
import { useCertificateBatchSave } from '@/hooks/use-certificate-batch-save';
import { useTableResults } from '@/hooks/use-table-results';
import { databaseApi } from '@/lib/api/database';
import { ApiError, isNotImplementedError } from '@/lib/api/client';
import type {
  BatchChange,
  CommitFailedPageRequest,
  CommitFailedPageResponse,
  FailureKind,
  PageMetadataPayload,
  TableResultRow,
} from '@/types/database';
import 'handsontable/styles/handsontable.min.css';

export default function TableDetailPage() {
  return (
    <Suspense fallback={<section className="flex-1 p-4 text-sm text-muted-foreground">Loading table...</section>}>
      <TableDetailPageContent />
    </Suspense>
  );
}

function TableDetailPageContent() {
  const params = useParams<{ tableId: string }>();
  const searchParams = useSearchParams();
  const rawTableId = params.tableId ?? null;
  // useParams hands back the raw URL-encoded segment for special chars (e.g. ":"
  // arrives as "%3A"); decode once here so downstream split-on-":" works.
  const tableId = rawTableId ? safeDecode(rawTableId) : null;

  const isFixMode = searchParams.get('mode') === 'fix';

  if (isFixMode && tableId) {
    return <FixModeView tableId={tableId} />;
  }

  return <ResultsView tableId={tableId} />;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function ResultsView({ tableId }: { tableId: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tableQuery = useTableResults(tableId);
  const batchSaveMutation = useCertificateBatchSave();

  const [editorRows, setEditorRows] = useState<TableResultRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hasUserEditedRows, setHasUserEditedRows] = useState(false);
  const editSessionId = useMemo(() => crypto.randomUUID(), []);

  const activeRows = useMemo(
    () => (hasUserEditedRows ? editorRows : tableQuery.data?.rows ?? []),
    [editorRows, hasUserEditedRows, tableQuery.data?.rows],
  );

  const goBack = () => {
    const certificateId = tableQuery.data?.table.certificate_id;
    const queryString = searchParams.toString();
    if (certificateId) {
      router.push(
        queryString
          ? `/database/certificate/${certificateId}?${queryString}`
          : `/database/certificate/${certificateId}`,
      );
      return;
    }
    router.push(queryString ? `/database?${queryString}` : '/database');
  };

  const pendingChanges = useMemo(() => {
    if (!tableQuery.data) {
      return [];
    }
    return diffRows(tableQuery.data.rows, activeRows);
  }, [activeRows, tableQuery.data]);

  async function confirmSave() {
    if (!tableQuery.data) {
      return;
    }

    try {
      await batchSaveMutation.mutateAsync({
        certificateId: tableQuery.data.table.certificate_id,
        payload: {
          changes: pendingChanges,
          client_edit_session_id: editSessionId,
        },
      });
      toast.success(`Saved ${pendingChanges.length} row update(s).`);
      setDialogOpen(false);
    } catch (error) {
      if (isNotImplementedError(error)) {
        toast.info('Save endpoint is pending backend implementation. Placeholder flow is active.');
      } else {
        toast.error(error instanceof Error ? error.message : 'Save failed');
      }
    }
  }

  return (
    <section className="flex-1 p-4">
      <Card className="h-[calc(100vh-7rem)] rounded-lg py-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">
              Table {tableQuery.data?.table.table_number ?? ''}
            </h2>
            <p className="text-xs text-muted-foreground">
              Edit and save test results for the selected table.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={goBack}>
              <ArrowLeft className="size-4" />
              Return
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setHasUserEditedRows(false);
                setEditorRows([]);
                void tableQuery.refetch();
              }}
              disabled={
                batchSaveMutation.isPending ||
                tableQuery.isFetching ||
                (pendingChanges.length === 0 && !tableQuery.isFetching)
              }
              title="Discard local edits and reload table results from the server."
            >
              <RotateCcw className="size-4" />
              Reset
            </Button>
            <Button
              type="button"
              onClick={() => setDialogOpen(true)}
              disabled={pendingChanges.length === 0 || batchSaveMutation.isPending}
            >
              <Save className="size-4" />
              Save
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {tableQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading table data...</p>
          ) : tableQuery.error ? (
            <p className="text-sm text-muted-foreground">
              {isNotImplementedError(tableQuery.error)
                ? 'Table results endpoint is pending backend implementation.'
                : 'Unable to load table results.'}
            </p>
          ) : tableQuery.data ? (
            <TableResultsEditor
              columns={tableQuery.data.columns}
              rows={activeRows}
              onRowsChange={(rows) => {
                setHasUserEditedRows(true);
                setEditorRows(rows);
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No table data available.</p>
          )}
        </div>
      </Card>

      <SaveConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={confirmSave}
        isSaving={batchSaveMutation.isPending}
      />
    </section>
  );
}

function FixModeView({ tableId }: { tableId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const certificateId = searchParams.get('certificateId') ?? '';
  const pageNumber = Number(searchParams.get('pageNumber') ?? '0');
  const failureKind = (searchParams.get('failureKind') ?? '') as FailureKind | '';

  const pageId = extractPageIdFromTableId(tableId);
  const tableNumber = extractTableNumberFromTableId(tableId);

  const csvQuery = useQuery({
    queryKey: ['database', 'pages', pageId, 'csv-content', tableNumber ?? null],
    queryFn: ({ signal }) =>
      databaseApi.getPageCsvContent(pageId, { tableNumber, signal }),
    enabled: Boolean(pageId),
    retry: false,
  });

  const pagesQuery = useQuery({
    queryKey: ['database', 'certificates', certificateId, 'pages'],
    queryFn: ({ signal }) => databaseApi.listPages(certificateId, signal),
    enabled: Boolean(certificateId),
  });

  const [isCommitting, setIsCommitting] = useState(false);

  const initialMetadata = useMemo<PageMetadataPayload>(() => {
    const page = (pagesQuery.data?.items ?? []).find(
      (entry) => entry.page_number === pageNumber,
    );
    return {
      order_item: page?.order_item ?? null,
      part_num: page?.part_num ?? null,
      descrip: page?.descrip ?? null,
      die_num: page?.die_num ?? null,
      alloy_temper: page?.alloy_temper ?? null,
      cert_code: page?.cert_code ?? null,
    };
  }, [pagesQuery.data, pageNumber]);

  const goBack = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('mode');
    params.delete('certificateId');
    params.delete('pageNumber');
    params.delete('failureKind');
    const queryString = params.toString();
    if (certificateId) {
      router.push(
        queryString
          ? `/database/certificate/${certificateId}?${queryString}`
          : `/database/certificate/${certificateId}`,
      );
      return;
    }
    router.push(queryString ? `/database?${queryString}` : '/database');
  };

  async function handleCommit(payload: CommitFailedPageRequest) {
    if (!certificateId || !pageNumber) {
      toast.error('Missing certificate or page context.');
      return;
    }
    setIsCommitting(true);
    try {
      const response: CommitFailedPageResponse = await databaseApi.commitFailedPage(
        certificateId,
        pageNumber,
        payload,
      );
      if (response.rejections.length > 0) {
        const summary = response.rejections
          .slice(0, 3)
          .map(
            (entry) =>
              `Row ${entry.row_number ?? '?'} ${entry.column ?? ''}: ${entry.message}`,
          )
          .join(' \u2022 ');
        toast.error(`Server rejected ${response.rejections.length} row(s). ${summary}`);
        return;
      }
      toast.success(
        `Committed ${response.inserted_row_count} row(s) and cleared ${response.deleted_failure_count} failure record(s).`,
      );
      void queryClient.invalidateQueries({ queryKey: ['database'] });
      goBack();
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        const details = (error.payload?.details ?? null) as
          | { rejections?: Array<{ row_number?: number; column?: string; message?: string }> }
          | null;
        const rejections = details?.rejections ?? [];
        const summary = rejections
          .slice(0, 3)
          .map(
            (entry) =>
              `Row ${entry.row_number ?? '?'} ${entry.column ?? ''}: ${entry.message ?? ''}`,
          )
          .join(' \u2022 ');
        toast.error(
          `Server validation failed${summary ? `: ${summary}` : '.'}`,
        );
      } else {
        toast.error(error instanceof Error ? error.message : 'Commit failed');
      }
    } finally {
      setIsCommitting(false);
    }
  }

  return (
    <section className="flex-1 p-4">
      <Card className="h-[calc(100vh-7rem)] rounded-lg py-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">
              {'Fix Mode \u2014 Page '}{pageNumber}
              {failureKind ? (
                <span className="ml-2 inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground">
                  <AlertTriangle className="size-3" aria-hidden="true" />
                  {failureKind}
                </span>
              ) : null}
            </h2>
            <p className="text-xs text-muted-foreground">
              Edit the on-disk CSV evidence and commit corrected rows. The original
              CSV file is not modified.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={goBack}>
              <ArrowLeft className="size-4" />
              Return
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {csvQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading CSV evidence...</p>
          ) : csvQuery.error ? (
            <CsvLoadError
              error={csvQuery.error}
              onRetry={() => {
                void csvQuery.refetch();
              }}
              isRetrying={csvQuery.isFetching}
            />
          ) : csvQuery.data ? (
            <FailedPageEditor
              csvPayload={csvQuery.data}
              initialMetadata={initialMetadata}
              isSaving={isCommitting}
              onCommit={handleCommit}
              onReset={() => {
                void csvQuery.refetch();
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No CSV available.</p>
          )}
        </div>
      </Card>
    </section>
  );
}

function extractPageIdFromTableId(tableId: string): string {
  const colonIndex = tableId.indexOf(':');
  if (colonIndex === -1) {
    return tableId;
  }
  return tableId.slice(0, colonIndex);
}

function extractTableNumberFromTableId(tableId: string): number | undefined {
  const colonIndex = tableId.indexOf(':');
  if (colonIndex === -1) {
    return undefined;
  }
  const suffix = tableId.slice(colonIndex + 1);
  const parsed = Number(suffix);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function CsvLoadError({
  error,
  onRetry,
  isRetrying,
}: {
  error: unknown;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  const { headline, detail } = describeCsvLoadError(error);
  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="space-y-1 text-sm text-foreground">
          <p className="font-medium">{headline}</p>
          {detail ? <p className="text-xs text-muted-foreground break-words">{detail}</p> : null}
        </div>
      </div>
      <div>
        <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
          <RefreshCw className={`size-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
          {isRetrying ? 'Retrying...' : 'Retry'}
        </Button>
      </div>
    </div>
  );
}

function describeCsvLoadError(error: unknown): { headline: string; detail: string | null } {
  if (error instanceof ApiError) {
    const detail = readApiErrorDetail(error);
    if (error.status === 401) {
      return {
        headline: 'Not authorized to read CSV evidence.',
        detail: detail ?? 'Sign in (or re-establish your session) and retry.',
      };
    }
    if (error.status === 404) {
      return {
        headline: 'No CSV file is available on disk for this page.',
        detail: detail ?? 'Re-run extraction or contact the operator.',
      };
    }
    if (error.status === 422) {
      return {
        headline: 'CSV evidence request was rejected by the server (422).',
        detail: detail ?? 'The page identifier in the URL is invalid.',
      };
    }
    if (error.status >= 500) {
      return {
        headline: `Server error while loading CSV evidence (${error.status}).`,
        detail: detail ?? error.message,
      };
    }
    return {
      headline: `Unable to load CSV content (${error.status}).`,
      detail: detail ?? error.message,
    };
  }
  return {
    headline: 'Unable to load CSV content.',
    detail: error instanceof Error ? error.message : null,
  };
}

function readApiErrorDetail(error: ApiError): string | null {
  const payload = error.payload as Record<string, unknown> | undefined;
  if (!payload) {
    return null;
  }
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === 'string' && detail.trim().length > 0) {
    return detail;
  }
  if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
    return payload.message;
  }
  return null;
}

function diffRows(originalRows: TableResultRow[], updatedRows: TableResultRow[]): BatchChange[] {
  const originalById = new Map(originalRows.map((row) => [row.result_row_id, row]));
  const output: BatchChange[] = [];

  for (const updatedRow of updatedRows) {
    const originalRow = originalById.get(updatedRow.result_row_id);
    if (!originalRow) {
      continue;
    }

    const patch: Record<string, string | number | null> = {};
    for (const key of Object.keys(updatedRow) as Array<keyof TableResultRow>) {
      if (key === 'result_row_id') {
        continue;
      }
      const nextValue = updatedRow[key];
      const previousValue = originalRow[key];
      if (previousValue !== nextValue) {
        patch[key] = (nextValue as string | number | null) ?? null;
      }
    }

    if (Object.keys(patch).length > 0) {
      output.push({
        result_row_id: updatedRow.result_row_id,
        patch,
      });
    }
  }

  return output;
}

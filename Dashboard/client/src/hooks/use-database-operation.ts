'use client';

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { exportApi, inferImportOutcomeAfterTaskLost } from '@/lib/api';
import type {
  DatabaseValidationResponse,
  TaskStatusResponse,
} from '@/lib/api/export';
import type {
  DatabaseCompletionResult,
  DatabaseOperationMode,
  DatabaseWizardStep,
  DatabaseOperationModalProps,
} from '@/components/upload/DatabaseOperationModal';
import { useUIStore } from '@/stores/ui-store';

function estimateDownloadTime(sizeMb: number): string | null {
  const connection = (navigator as Navigator & { connection?: { downlink?: number } }).connection;
  const downlinkMbps = connection?.downlink;
  if (!downlinkMbps || downlinkMbps <= 0) return null;

  const bytesPerSecond = (downlinkMbps * 1_000_000) / 8;
  const totalBytes = sizeMb * 1024 * 1024;
  const seconds = totalBytes / bytesPerSecond;

  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  return `${Math.round(seconds / 60)}m`;
}

export interface UseDatabaseOperationOptions {
  currentEventCount: number;
  onImportComplete: () => void;
}

export interface UseDatabaseOperationReturn {
  isExporting: boolean;
  isImporting: boolean;
  isImportBusy: boolean;
  exportProgress: string;
  startExport: () => Promise<void>;
  openImport: () => void;
  modalProps: DatabaseOperationModalProps;
}

export function useDatabaseOperation({
  currentEventCount,
  onImportComplete,
}: UseDatabaseOperationOptions): UseDatabaseOperationReturn {
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<DatabaseOperationMode>('import');
  const [wizardStep, setWizardStep] = useState<DatabaseWizardStep>('confirm');

  const [taskStatus, setTaskStatus] = useState<TaskStatusResponse | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [taskConnectionLost, setTaskConnectionLost] = useState(false);
  const [taskConnectionMessage, setTaskConnectionMessage] = useState<string | undefined>();
  const [isCancelling, setIsCancelling] = useState(false);
  const setDatabaseImportInProgress = useUIStore((s) => s.setDatabaseImportInProgress);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');

  const [exportDownloadActive, setExportDownloadActive] = useState(false);
  const [exportFileName, setExportFileName] = useState('dashboard_export.zip');
  const [exportSaveMethod, setExportSaveMethod] = useState<'picker' | 'download'>('download');

  const [completionResult, setCompletionResult] = useState<DatabaseCompletionResult | null>(null);

  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [pendingUploadId, setPendingUploadId] = useState<string | null>(null);
  const [importValidation, setImportValidation] = useState<DatabaseValidationResponse | null>(null);

  const [importUploadLoading, setImportUploadLoading] = useState(false);
  const [importUploadPercent, setImportUploadPercent] = useState<number | undefined>(undefined);
  const [importUploadServerValidating, setImportUploadServerValidating] = useState(false);

  const uploadAbortRef = useRef<AbortController | null>(null);

  const resetModal = useCallback(() => {
    setWizardStep('confirm');
    setTaskStatus(null);
    setActiveTaskId(null);
    setTaskConnectionLost(false);
    setTaskConnectionMessage(undefined);
    setIsCancelling(false);
    setCompletionResult(null);
    setExportDownloadActive(false);
    setPendingImportFile(null);
    setPendingUploadId(null);
    setImportValidation(null);
    setImportUploadLoading(false);
    setImportUploadPercent(undefined);
    setImportUploadServerValidating(false);
  }, []);

  const closeModal = useCallback(() => {
    if (mode === 'import' && pendingUploadId && wizardStep === 'confirm') {
      void exportApi.cancelParquetUpload(pendingUploadId).catch(() => {});
    }
    if (uploadAbortRef.current) {
      uploadAbortRef.current.abort();
      uploadAbortRef.current = null;
    }
    resetModal();
    setModalOpen(false);
  }, [mode, pendingUploadId, wizardStep, resetModal]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        closeModal();
      } else {
        setModalOpen(true);
      }
    },
    [closeModal],
  );

  const cancelOperation = useCallback(async () => {
    if (importUploadLoading && uploadAbortRef.current) {
      uploadAbortRef.current.abort();
      uploadAbortRef.current = null;
      return;
    }

    if (!activeTaskId) return;
    setIsCancelling(true);
    try {
      await exportApi.cancelParquetTask(activeTaskId);
    } catch {
      setIsCancelling(false);
      toast.error('Could not cancel the operation.');
    }
  }, [activeTaskId, importUploadLoading]);

  const startExport = useCallback(async () => {
    const runExport = async (
      writeBlob: (blob: Blob) => Promise<void>,
      fileName: string,
      saveMethod: 'picker' | 'download',
    ) => {
      setMode('export');
      setModalOpen(true);
      setWizardStep('progress');
      setCompletionResult(null);
      setTaskStatus(null);
      setActiveTaskId(null);
      setTaskConnectionLost(false);
      setTaskConnectionMessage(undefined);
      setIsCancelling(false);
      setExportDownloadActive(false);
      setExportFileName(fileName);
      setExportSaveMethod(saveMethod);

      const started = Date.now();
      setIsExporting(true);
      setExportProgress('Starting…');

      try {
        try {
          const info = await exportApi.getDatabaseInfo();
          const estimated = estimateDownloadTime(info.size_mb);
          const estimateLabel = estimated ? ` (~${estimated})` : '';
          toast.info(
            `Live DB ~${info.size_mb.toFixed(1)} MB on disk${estimateLabel}. Building compressed export…`,
          );
        } catch {
          // Continue if info fails
        }

        const { task_id } = await exportApi.startParquetExport();
        setActiveTaskId(task_id);

        const final = await exportApi.waitForParquetTask(task_id, (s) => {
          setTaskStatus(s);
          setExportProgress(s.progress);
        });

        setActiveTaskId(null);
        setIsCancelling(false);

        if (final.status === 'cancelled') {
          setCompletionResult({
            success: false,
            title: 'Export cancelled',
            message: 'The export was stopped before completion.',
            elapsedSeconds: (Date.now() - started) / 1000,
          });
          setWizardStep('summary');
          return;
        }

        if (final.status === 'failed') {
          setCompletionResult({
            success: false,
            title: 'Export failed',
            message: final.error || 'Export failed',
            elapsedSeconds: (Date.now() - started) / 1000,
          });
          setWizardStep('summary');
          return;
        }

        setTaskStatus(final);
        setExportDownloadActive(true);
        const blob = await exportApi.downloadParquetExport(task_id);
        setExportDownloadActive(false);
        await writeBlob(blob);

        const sizeMb = (final.result as { size_mb?: number } | null)?.size_mb;
        setCompletionResult({
          success: true,
          title: 'Export complete',
          message: 'Load-data archive saved successfully.',
          elapsedSeconds: (Date.now() - started) / 1000,
          detailLines: [
            `File: ${fileName}`,
            saveMethod === 'picker'
              ? 'Saved to the location you chose in the save dialog.'
              : 'Saved to your Downloads folder (browser default).',
            typeof sizeMb === 'number' ? `Archive size: ~${sizeMb.toFixed(2)} MB` : '',
          ].filter(Boolean),
        });
        setWizardStep('summary');
        toast.success('Load data exported successfully');
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Failed to export load data';
        setCompletionResult({
          success: false,
          title: 'Export failed',
          message,
          elapsedSeconds: (Date.now() - started) / 1000,
        });
        setWizardStep('summary');
        toast.error(`Load-data export failed: ${message}`);
      } finally {
        setIsExporting(false);
        setExportProgress('');
        setActiveTaskId(null);
        setExportDownloadActive(false);
        setIsCancelling(false);
      }
    };

    const canUseSavePicker = 'showSaveFilePicker' in window;

    if (!canUseSavePicker) {
      await runExport(async (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'dashboard_export.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'dashboard_export.zip', 'download');
      return;
    }

    let fileHandle: FileSystemFileHandle | null = null;
    try {
      fileHandle = await (
        window as unknown as {
          showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle>;
        }
      ).showSaveFilePicker({
        suggestedName: 'dashboard_export.zip',
        types: [
          {
            description: 'Compressed load-data export',
            accept: { 'application/zip': ['.zip'] },
          },
        ],
      });
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Failed to open save dialog';
      toast.error(`Export failed: ${message}`);
      return;
    }

    const pickedName = fileHandle?.name ?? 'dashboard_export.zip';
    await runExport(async (blob) => {
      if (fileHandle) {
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      }
    }, pickedName, 'picker');
  }, []);

  const openImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,application/zip';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setMode('import');
      setWizardStep('confirm');
      setCompletionResult(null);
      setTaskStatus(null);
      setTaskConnectionLost(false);
      setTaskConnectionMessage(undefined);
      setIsCancelling(false);
      setPendingImportFile(file);
      setPendingUploadId(null);
      setImportValidation(null);
      setModalOpen(true);
      setImportUploadLoading(true);
      setImportUploadPercent(0);
      setImportUploadServerValidating(false);

      const abortCtrl = new AbortController();
      uploadAbortRef.current = abortCtrl;

      try {
        try {
          const info = await exportApi.getDatabaseInfo();
          const maxBytes = info.max_upload_size_mb * 1024 * 1024;
          if (file.size > maxBytes) {
            const gb = file.size / (1024 * 1024 * 1024);
            toast.error(
              `File is ${gb >= 1 ? `${gb.toFixed(2)} GB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`} — maximum is ${info.max_upload_size_mb} MB.`,
            );
            setModalOpen(false);
            setPendingImportFile(null);
            setImportUploadPercent(undefined);
            return;
          }
        } catch {
          /* server still enforces max size */
        }

        const { upload_id, validation } = await exportApi.uploadParquetZip(file, {
          onProgress: (pct, processing) => {
            if (processing) {
              setImportUploadServerValidating(true);
              setImportUploadPercent(100);
            } else {
              setImportUploadServerValidating(false);
              setImportUploadPercent(pct);
            }
          },
          signal: abortCtrl.signal,
        });
        setPendingUploadId(upload_id);
        setImportValidation(validation);
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setModalOpen(false);
          setPendingImportFile(null);
          toast.info('Upload cancelled');
          return;
        }
        const message =
          error instanceof Error ? error.message : 'Upload or validation failed';
        toast.error(message);
        setModalOpen(false);
        setPendingImportFile(null);
      } finally {
        uploadAbortRef.current = null;
        setImportUploadLoading(false);
        setImportUploadPercent(undefined);
        setImportUploadServerValidating(false);
      }
    };
    input.click();
  }, []);

  const confirmImport = useCallback(async () => {
    if (!pendingUploadId) return;

    setWizardStep('progress');
    setTaskStatus(null);
    setTaskConnectionLost(false);
    setTaskConnectionMessage(undefined);
    setIsImporting(true);
    setDatabaseImportInProgress(true);
    setIsCancelling(false);

    const started = Date.now();
    try {
      const { task_id } = await exportApi.startParquetImport(pendingUploadId);
      setActiveTaskId(task_id);

      const final = await exportApi.waitForParquetTask(
        task_id,
        (s) => {
          setTaskStatus(s);
        },
        (state) => {
          setTaskConnectionLost(state.connectionLost);
          setTaskConnectionMessage(state.message);
        },
      );

      setActiveTaskId(null);
      setIsCancelling(false);

      if (final.status === 'cancelled') {
        setPendingUploadId(null);
        setPendingImportFile(null);
        setImportValidation(null);
        setCompletionResult({
          success: false,
          title: 'Import cancelled',
          message: 'The import was stopped before completion.',
          elapsedSeconds: (Date.now() - started) / 1000,
        });
        setWizardStep('summary');
        return;
      }

      if (final.status === 'failed') {
        setPendingUploadId(null);
        setPendingImportFile(null);
        setImportValidation(null);
        setCompletionResult({
          success: false,
          title: 'Import failed',
          message: final.error || 'Import failed',
          elapsedSeconds: (Date.now() - started) / 1000,
          detailLines: ['Check server logs before retrying if the API was unavailable during import.'],
        });
        setWizardStep('summary');
        return;
      }

      const result = final.result as { events?: number } | null;

      onImportComplete();

      setPendingUploadId(null);
      setPendingImportFile(null);
      setImportValidation(null);

      setCompletionResult({
        success: true,
        title: 'Import complete',
        message: `${result?.events ?? '—'} events loaded. Target users and admin configuration were preserved.`,
        elapsedSeconds: (Date.now() - started) / 1000,
        eventsLoaded: typeof result?.events === 'number' ? result.events : undefined,
        detailLines: ['Backup file: dashboard.db.bak (next to your live database)'],
      });
      setWizardStep('summary');

      toast.success(
        `Load data imported successfully. ${result?.events ?? '—'} events loaded.`,
        { duration: 5000 },
      );
    } catch (error) {
      const baseMessage =
        error instanceof Error ? error.message : 'Failed to import load data';
      const lostTaskState =
        baseMessage.includes('no longer available') ||
        baseMessage.includes('Lost contact with the server');

      let inferred: Awaited<ReturnType<typeof inferImportOutcomeAfterTaskLost>> | null = null;
      if (lostTaskState) {
        inferred = await inferImportOutcomeAfterTaskLost(importValidation);
        if (inferred.likelySucceeded) {
          onImportComplete();
          setPendingUploadId(null);
          setPendingImportFile(null);
          setImportValidation(null);
          setCompletionResult({
            success: true,
            title: 'Import may have completed',
            message: inferred.message,
            elapsedSeconds: (Date.now() - started) / 1000,
            eventsLoaded: inferred.eventCount,
            detailLines: [
              'Task polling stopped because the API restarted or lost task state.',
              'Backup file: dashboard.db.bak (if import ran far enough)',
            ],
          });
          setWizardStep('summary');
          toast.success(inferred.message, { duration: 8000 });
          return;
        }
      }

      const message =
        lostTaskState && inferred
          ? `${baseMessage}\n\n${inferred.message}`
          : baseMessage;

      setCompletionResult({
        success: false,
        title: 'Import failed',
        message,
        elapsedSeconds: (Date.now() - started) / 1000,
        detailLines: [
          'Check server logs for Database imported, Import task failed, OOM, or killed before retrying.',
        ],
      });
      setWizardStep('summary');
      toast.error(`Load-data import failed: ${baseMessage}`);
    } finally {
      setIsImporting(false);
      setDatabaseImportInProgress(false);
      setIsCancelling(false);
    }
  }, [pendingUploadId, onImportComplete, setDatabaseImportInProgress]);

  const blocking =
    (mode === 'export' && wizardStep === 'progress' && isExporting) ||
    (mode === 'import' && wizardStep === 'progress' && isImporting);

  const modalProps: DatabaseOperationModalProps = {
    open: modalOpen,
    onOpenChange: handleOpenChange,
    mode,
    wizardStep,
    blocking,
    exportFileName,
    exportSaveMethod,
    exportDownloadActive,
    file: pendingImportFile,
    validation: importValidation,
    isUploadingPreview: importUploadLoading,
    importUploadPercent,
    importUploadServerValidating,
    currentEventCount,
    onConfirmImport: confirmImport,
    taskStatus,
    taskConnectionLost,
    taskConnectionMessage,
    activeTaskId,
    isCancelling,
    onCancelOperation: cancelOperation,
    completionResult,
    onCloseSummary: resetModal,
  };

  return {
    isExporting,
    isImporting,
    isImportBusy: importUploadLoading,
    exportProgress,
    startExport,
    openImport,
    modalProps,
  };
}

'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Loader2,
  XCircle,
  Download,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import type { DatabaseValidationResponse, TaskStatusResponse } from '@/lib/api/export';

export type DatabaseOperationMode = 'export' | 'import';

export type DatabaseWizardStep = 'confirm' | 'progress' | 'summary';

export interface DatabaseCompletionResult {
  success: boolean;
  title: string;
  message: string;
  elapsedSeconds?: number;
  /** Short lines shown under the message (paths, counts, etc.) */
  detailLines?: string[];
  /** Import: final event count from server (shown in summary) */
  eventsLoaded?: number;
}

export interface DatabaseOperationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: DatabaseOperationMode;
  wizardStep: DatabaseWizardStep;
  /** When false, backdrop / X still call onOpenChange(false). When true, ignore dismiss attempts. */
  blocking: boolean;
  /** Export */
  exportFileName?: string;
  exportSaveMethod?: 'picker' | 'download';
  /** While the browser is saving the export blob after the server task completed */
  exportDownloadActive?: boolean;
  /** Import — confirmation step */
  file?: File | null;
  validation?: DatabaseValidationResponse | null;
  isUploadingPreview?: boolean;
  /** 0–100 during ZIP upload on the confirm step */
  importUploadPercent?: number;
  /** True after bytes are sent while server validates the archive */
  importUploadServerValidating?: boolean;
  currentEventCount?: number;
  onConfirmImport?: () => void;
  /** Live task polling */
  taskStatus?: TaskStatusResponse | null;
  activeTaskId?: string | null;
  /** True while the cancel request is in flight (shows spinner on button) */
  isCancelling?: boolean;
  onCancelOperation?: () => void | Promise<void>;
  /** Final screen */
  completionResult?: DatabaseCompletionResult | null;
  onCloseSummary?: () => void;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function formatPhaseDuration(seconds: number): string {
  if (seconds < 1) return '<1s';
  return formatElapsed(seconds);
}

type StepTone = 'pending' | 'active' | 'done';

interface PhaseStepProps {
  label: string;
  tone: StepTone;
  isLast: boolean;
  /** Right column: e.g. "48%" while active, "12s" when done */
  trailing?: ReactNode;
  /** Shown under the label row when active (or one line when done) */
  children?: ReactNode;
}

function PhaseStep({ label, tone, isLast, trailing, children }: PhaseStepProps) {
  const pending = tone === 'pending';

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center w-5 shrink-0 pt-0.5">
        {tone === 'done' ? (
          <div className="h-2.5 w-2.5 rounded-full bg-foreground shrink-0" aria-hidden />
        ) : tone === 'active' ? (
          <div
            className="h-2.5 w-2.5 rounded-full bg-foreground shrink-0 animate-stepper-pulse"
            aria-hidden
          />
        ) : (
          <div
            className="h-2.5 w-2.5 rounded-full border-2 border-muted-foreground/40 shrink-0"
            aria-hidden
          />
        )}
        {!isLast ? (
          <div className="w-px flex-1 min-h-[10px] bg-border mt-1 mb-0" aria-hidden />
        ) : null}
      </div>
      <div className={`min-w-0 flex-1 space-y-2 ${pending ? 'opacity-50' : ''} pb-5`}>
        <div className="flex items-start justify-between gap-3">
          <span
            className={
              tone === 'active'
                ? 'text-sm font-medium text-foreground'
                : 'text-sm text-muted-foreground'
            }
          >
            {label}
          </span>
          {trailing != null ? (
            <span className="tabular-nums text-xs text-muted-foreground shrink-0 pt-0.5">
              {trailing}
            </span>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

function StepperTimeline({ children }: { children: ReactNode }) {
  return <div className="space-y-0">{children}</div>;
}

export function DatabaseOperationModal({
  open,
  onOpenChange,
  mode,
  wizardStep,
  blocking,
  exportFileName,
  exportSaveMethod = 'download',
  exportDownloadActive = false,
  file,
  validation,
  isUploadingPreview = false,
  importUploadPercent,
  importUploadServerValidating = false,
  currentEventCount = 0,
  onConfirmImport,
  taskStatus,
  activeTaskId,
  isCancelling = false,
  onCancelOperation,
  completionResult,
  onCloseSummary,
}: DatabaseOperationModalProps) {
  const handleOpenChange = (next: boolean) => {
    if (!next && blocking) return;
    onOpenChange(next);
  };

  const [elapsedSec, setElapsedSec] = useState(0);
  const [phaseDurationsSec, setPhaseDurationsSec] = useState<Record<string, number>>({});
  const phaseTimingRef = useRef<{
    uiPhase: string | null;
    phaseStartAt: number | null;
  }>({ uiPhase: null, phaseStartAt: null });
  const prevWizardRef = useRef(wizardStep);

  const exportUiPhase = useMemo(() => {
    if (wizardStep !== 'progress' || mode !== 'export') return null;
    const phase = taskStatus?.phase ?? '';
    const st = taskStatus?.status ?? '';
    if (exportDownloadActive || phase === 'downloading' || phase === 'pending_download') {
      return 'download';
    }
    if (phase === 'compressing') {
      return 'compress';
    }
    if (phase === 'exporting' || st === 'running') {
      return 'export_tables';
    }
    if (st === 'failed' || st === 'cancelled') {
      return 'export_tables';
    }
    return 'export_tables';
  }, [wizardStep, mode, taskStatus?.phase, taskStatus?.status, exportDownloadActive]);

  const importUiPhase = useMemo(() => {
    if (wizardStep !== 'progress' || mode !== 'import') return null;
    const phase = taskStatus?.phase ?? '';
    const st = taskStatus?.status ?? '';
    if (st === 'completed' || st === 'failed' || st === 'cancelled') {
      return 'import_tables';
    }
    if (phase === 'importing' && st === 'running') return 'import_tables';
    if (phase === 'extracting') return 'extract';
    return 'upload';
  }, [wizardStep, mode, taskStatus?.phase, taskStatus?.status]);

  useEffect(() => {
    if (prevWizardRef.current !== 'progress' && wizardStep === 'progress') {
      setPhaseDurationsSec({});
      setElapsedSec(0);
      if (mode === 'import') {
        phaseTimingRef.current = { uiPhase: 'upload', phaseStartAt: Date.now() };
      } else {
        phaseTimingRef.current = { uiPhase: null, phaseStartAt: null };
      }
    }
    prevWizardRef.current = wizardStep;
  }, [wizardStep, mode]);

  useEffect(() => {
    if (!open || wizardStep !== 'progress') return;
    const t0 = Date.now();
    const id = window.setInterval(() => {
      setElapsedSec((Date.now() - t0) / 1000);
    }, 1000);
    return () => window.clearInterval(id);
  }, [open, wizardStep, mode]);

  const uiPhaseKey = mode === 'export' ? exportUiPhase : importUiPhase;

  useEffect(() => {
    if (wizardStep !== 'progress' || !uiPhaseKey) return;
    const now = Date.now();
    const ref = phaseTimingRef.current;
    if (ref.uiPhase === uiPhaseKey) return;

    if (ref.uiPhase != null && ref.phaseStartAt != null) {
      const elapsed = (now - ref.phaseStartAt) / 1000;
      setPhaseDurationsSec((prev) => ({
        ...prev,
        [ref.uiPhase!]: (prev[ref.uiPhase!] ?? 0) + elapsed,
      }));
    }

    phaseTimingRef.current = { uiPhase: uiPhaseKey, phaseStartAt: now };
  }, [uiPhaseKey, wizardStep]);

  useEffect(() => {
    if (wizardStep !== 'summary') return;
    const ref = phaseTimingRef.current;
    if (ref.uiPhase != null && ref.phaseStartAt != null) {
      const now = Date.now();
      const elapsed = (now - ref.phaseStartAt) / 1000;
      setPhaseDurationsSec((prev) => ({
        ...prev,
        [ref.uiPhase!]: (prev[ref.uiPhase!] ?? 0) + elapsed,
      }));
      phaseTimingRef.current = { uiPhase: null, phaseStartAt: null };
    }
  }, [wizardStep]);

  const title =
    mode === 'export'
      ? wizardStep === 'summary'
        ? completionResult?.success
          ? 'Export complete'
          : 'Export failed'
        : 'Database export'
      : wizardStep === 'confirm'
        ? 'Replace current database?'
        : wizardStep === 'summary'
          ? completionResult?.success
            ? 'Import complete'
            : 'Import failed'
          : 'Database import';

  const subtitle =
    mode === 'export' && wizardStep === 'progress'
      ? exportSaveMethod === 'picker' && exportFileName
        ? `Saving to chosen location as ${exportFileName}`
        : exportSaveMethod === 'download'
          ? 'Saving to your Downloads folder as dashboard_export.zip (browser default)'
          : undefined
      : mode === 'import' && wizardStep === 'progress' && file
        ? `Reading from: ${file.name}`
        : mode === 'import' && wizardStep === 'confirm' && file
          ? file.name
          : undefined;

  const exportTablePct =
    taskStatus &&
    taskStatus.total > 0 &&
    (taskStatus.phase === 'exporting' || taskStatus.status === 'running')
      ? Math.min(100, (100 * taskStatus.current) / taskStatus.total)
      : 0;

  const importTablePct =
    taskStatus && taskStatus.total > 0 && taskStatus.phase === 'importing'
      ? Math.min(100, (100 * taskStatus.current) / taskStatus.total)
      : 0;

  const renderExportProgress = () => {
    const phase = taskStatus?.phase ?? '';
    const st = taskStatus?.status ?? '';

    const tablesDone =
      ['compressing', 'pending_download', 'downloading'].includes(phase) ||
      st === 'completed' ||
      st === 'failed' ||
      st === 'cancelled';

    const tablesActive =
      !tablesDone &&
      (phase === 'exporting' || st === 'running' || taskStatus == null);

    const compressingComplete =
      ['pending_download', 'downloading'].includes(phase) ||
      st === 'completed' ||
      st === 'failed' ||
      st === 'cancelled';

    const compressingActive = phase === 'compressing' && st === 'running';

    const compressTone: StepTone = compressingComplete
      ? 'done'
      : compressingActive
        ? 'active'
        : 'pending';

    const downloadIndeterminate =
      exportDownloadActive ||
      (st === 'completed' && ['pending_download', 'downloading'].includes(phase));

    const downloadDone =
      !downloadIndeterminate &&
      compressingComplete &&
      !exportDownloadActive &&
      st === 'completed';

    const downloadTone: StepTone =
      st === 'failed' || st === 'cancelled'
        ? 'pending'
        : downloadDone
          ? 'done'
          : downloadIndeterminate
            ? 'active'
            : 'pending';

    const tablesTone: StepTone = tablesDone ? 'done' : tablesActive ? 'active' : 'pending';

    const statusLine = taskStatus?.progress || 'Starting…';

    return (
      <div className="px-6 py-4 space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed border-b border-border pb-3">
          {statusLine}
        </p>
        <StepperTimeline>
          <PhaseStep
            label="Export tables"
            tone={tablesTone}
            isLast={false}
            trailing={
              tablesTone === 'done' ? (
                formatPhaseDuration(phaseDurationsSec.export_tables ?? 0)
              ) : tablesTone === 'active' ? (
                `${Math.round(exportTablePct)}%`
              ) : null
            }
          >
            {tablesTone === 'active' && taskStatus && taskStatus.total > 0 ? (
              <div className="space-y-2 pl-0">
                {taskStatus.current_table ? (
                  <p className="text-xs font-mono text-foreground/90 truncate">
                    {taskStatus.current_table}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground tabular-nums">
                  {taskStatus.current} of {taskStatus.total} tables
                </p>
                <Progress value={exportTablePct} className="h-1.5" />
              </div>
            ) : tablesTone === 'active' ? (
              <p className="text-xs text-muted-foreground">{taskStatus?.progress || 'Working…'}</p>
            ) : tablesTone === 'done' && taskStatus && taskStatus.total > 0 ? (
              <p className="text-xs text-muted-foreground tabular-nums">
                {taskStatus.total} of {taskStatus.total} tables
              </p>
            ) : null}
          </PhaseStep>

          <PhaseStep
            label="Compress archive"
            tone={compressTone}
            isLast={false}
            trailing={
              compressTone === 'done' ? (
                formatPhaseDuration(phaseDurationsSec.compress ?? 0)
              ) : compressTone === 'active' ? (
                '…'
              ) : null
            }
          >
            {compressTone === 'active' ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{taskStatus?.progress || 'Working…'}</p>
                <Progress value={0} indeterminate className="h-1.5" />
              </div>
            ) : null}
          </PhaseStep>

          <PhaseStep
            label="Download"
            tone={downloadTone}
            isLast
            trailing={
              downloadTone === 'done' ? (
                formatPhaseDuration(phaseDurationsSec.download ?? 0)
              ) : downloadTone === 'active' ? (
                '…'
              ) : null
            }
          >
            {downloadTone === 'active' ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {exportDownloadActive
                    ? 'Saving file in your browser…'
                    : taskStatus?.progress || 'Preparing download…'}
                </p>
                <Progress value={0} indeterminate className="h-1.5" />
              </div>
            ) : null}
          </PhaseStep>
        </StepperTimeline>
      </div>
    );
  };

  const renderImportProgress = () => {
    const phase = taskStatus?.phase ?? '';
    const st = taskStatus?.status ?? '';

    const uploadTone: StepTone = 'done';

    const extractDone =
      phase === 'importing' || st === 'completed' || st === 'failed' || st === 'cancelled';
    const extractActive = phase === 'extracting';

    const extractTone: StepTone = extractDone ? 'done' : extractActive ? 'active' : 'pending';

    const importDone = st === 'completed' || st === 'failed' || st === 'cancelled';
    const importActive = phase === 'importing' && st === 'running';

    const importTone: StepTone = importDone ? 'done' : importActive ? 'active' : 'pending';

    const statusLine = taskStatus?.progress || 'Starting…';
    const eventsLoaded = taskStatus?.events_loaded;

    const extractPct =
      extractActive && taskStatus && taskStatus.total > 0
        ? Math.min(100, (100 * taskStatus.current) / taskStatus.total)
        : 0;

    return (
      <div className="px-6 py-4 space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed border-b border-border pb-3">
          {statusLine}
        </p>
        <StepperTimeline>
          <PhaseStep
            label="Upload and validate"
            tone={uploadTone}
            isLast={false}
            trailing={formatPhaseDuration(phaseDurationsSec.upload ?? 0)}
          />

          <PhaseStep
            label="Extract archive"
            tone={extractTone}
            isLast={false}
            trailing={
              extractTone === 'done' ? (
                formatPhaseDuration(phaseDurationsSec.extract ?? 0)
              ) : extractTone === 'active' && taskStatus && taskStatus.total > 0 ? (
                `${Math.round(extractPct)}%`
              ) : extractTone === 'active' ? (
                '…'
              ) : null
            }
          >
            {extractTone === 'active' && taskStatus && taskStatus.total > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground tabular-nums">
                  {taskStatus.current} of {taskStatus.total} files
                </p>
                <Progress value={extractPct} className="h-1.5" />
              </div>
            ) : extractTone === 'active' ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{taskStatus?.progress || 'Working…'}</p>
                <Progress value={0} indeterminate className="h-1.5" />
              </div>
            ) : null}
          </PhaseStep>

          <PhaseStep
            label="Import tables"
            tone={importTone}
            isLast
            trailing={
              importTone === 'done' ? (
                formatPhaseDuration(phaseDurationsSec.import_tables ?? 0)
              ) : importTone === 'active' ? (
                `${Math.round(importTablePct)}%`
              ) : null
            }
          >
            {importTone === 'active' && taskStatus && taskStatus.total > 0 ? (
              <div className="space-y-2">
                {taskStatus.current_table ? (
                  <p className="text-xs font-mono text-foreground/90 truncate">
                    {taskStatus.current_table}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground tabular-nums">
                  {taskStatus.current} of {taskStatus.total} tables
                </p>
                {typeof eventsLoaded === 'number' ? (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {eventsLoaded.toLocaleString()} events loaded
                  </p>
                ) : null}
                <Progress value={importTablePct} className="h-1.5" />
              </div>
            ) : importTone === 'active' ? (
              <p className="text-xs text-muted-foreground">{taskStatus?.progress || 'Working…'}</p>
            ) : importTone === 'done' && taskStatus && taskStatus.total > 0 ? (
              <p className="text-xs text-muted-foreground tabular-nums">
                {taskStatus.total} of {taskStatus.total} tables
              </p>
            ) : null}
          </PhaseStep>
        </StepperTimeline>
      </div>
    );
  };

  const summaryPhaseLabelsExport: { key: string; label: string }[] = [
    { key: 'export_tables', label: 'Export tables' },
    { key: 'compress', label: 'Compress archive' },
    { key: 'download', label: 'Download' },
  ];

  const summaryPhaseLabelsImport: { key: string; label: string }[] = [
    { key: 'upload', label: 'Upload and validate' },
    { key: 'extract', label: 'Extract archive' },
    { key: 'import_tables', label: 'Import tables' },
  ];

  const renderSummary = () => {
    const r = completionResult;
    if (!r) return null;
    const ok = r.success;
    const phaseLabels = mode === 'export' ? summaryPhaseLabelsExport : summaryPhaseLabelsImport;
    const hasPhaseBreakdown = phaseLabels.some(({ key }) => (phaseDurationsSec[key] ?? 0) > 0);

    return (
      <div className="px-6 py-4 space-y-4">
        <div className="flex items-start gap-3">
          {ok ? (
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-6 w-6 text-foreground" aria-hidden />
            </div>
          ) : (
            <XCircle className="h-10 w-10 text-destructive shrink-0" />
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-semibold text-foreground">{r.title}</p>
            <p className="text-sm text-muted-foreground">{r.message}</p>
            {typeof r.eventsLoaded === 'number' && mode === 'import' && ok ? (
              <p className="text-xs text-muted-foreground tabular-nums">
                {r.eventsLoaded.toLocaleString()} events loaded
              </p>
            ) : null}
            {typeof r.elapsedSeconds === 'number' && (
              <p className="text-xs text-muted-foreground tabular-nums">
                Total time: {formatElapsed(r.elapsedSeconds)}
              </p>
            )}
            {hasPhaseBreakdown ? (
              <div className="pt-2 space-y-1 border-t border-border mt-2">
                <p className="text-label font-medium text-muted-foreground uppercase tracking-wide">
                  Phase times
                </p>
                {phaseLabels.map(({ key, label }) => {
                  const sec = phaseDurationsSec[key] ?? 0;
                  if (sec <= 0) return null;
                  return (
                    <div
                      key={key}
                      className="flex justify-between gap-2 text-xs text-muted-foreground"
                    >
                      <span>{label}</span>
                      <span className="tabular-nums shrink-0">{formatPhaseDuration(sec)}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
            {r.detailLines?.map((line, i) => (
              <p key={i} className="text-xs text-muted-foreground break-all">
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderImportConfirm = () => (
    <div className="px-6 py-4 space-y-4">
      <div className="rounded-lg bg-muted/80 border border-border p-3">
        <p className="text-sm text-foreground">
          <strong className="font-semibold">Warning:</strong> Importing a database will replace all
          existing data. A backup of the current database will be created automatically.
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">Current database</h4>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <Database className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">{currentEventCount} events</p>
            <p className="text-xs text-muted-foreground">Will be replaced</p>
          </div>
          <XCircle className="h-4 w-4 text-destructive" />
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">File to import</h4>
        <div className="p-3 rounded-lg bg-muted/50">
          {isUploadingPreview ? (
            <div className="space-y-3 w-full">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {importUploadServerValidating
                      ? 'Validating archive on server…'
                      : 'Uploading and validating…'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{file?.name}</p>
                </div>
              </div>
              {(typeof importUploadPercent === 'number' || importUploadServerValidating) && (
                <div className="space-y-2">
                  <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {importUploadServerValidating ? 'Server validation' : 'Upload progress'}
                    </span>
                    {!importUploadServerValidating && typeof importUploadPercent === 'number' ? (
                      <span className="tabular-nums shrink-0">{importUploadPercent}%</span>
                    ) : null}
                  </div>
                  <Progress
                    value={importUploadServerValidating ? 0 : (importUploadPercent ?? 0)}
                    indeterminate={importUploadServerValidating}
                    className="h-2"
                  />
                </div>
              )}
            </div>
          ) : validation ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-foreground shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{validation.event_count} events</p>
                  <p className="text-xs text-muted-foreground">
                    {file?.name} ({validation.size_mb.toFixed(2)} MB compressed)
                  </p>
                </div>
              </div>
              {validation.warnings.length > 0 && (
                <div className="mt-2 space-y-1">
                  {validation.warnings.map((warning, idx) => (
                    <p key={idx} className="text-xs text-muted-foreground">
                      • {warning}
                    </p>
                  ))}
                </div>
              )}
              {validation.schema_compatibility.is_legacy && (
                <p className="text-xs text-muted-foreground mt-2">
                  Note: This export has limited schema metadata. Current schema configuration will be
                  applied after import.
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">{file?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'No file selected'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
        <p>
          Your current database will be backed up to{' '}
          <code className="text-caption bg-muted px-1 py-0.5 rounded">dashboard.db.bak</code> before
          import.
        </p>
      </div>
    </div>
  );

  const showHeaderIcon =
    mode === 'import' && wizardStep === 'confirm' ? (
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0 border border-border">
        <AlertTriangle className="h-5 w-5 text-foreground" />
      </div>
    ) : mode === 'export' ? (
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
        <Download className="h-5 w-5 text-muted-foreground" />
      </div>
    ) : (
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
        <Upload className="h-5 w-5 text-muted-foreground" />
      </div>
    );

  const showProgressTimer = wizardStep === 'progress';

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <div className="flex items-start gap-3 pr-8">
            {wizardStep !== 'summary' ? showHeaderIcon : null}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-start justify-between gap-3">
                <AlertDialogTitle className="text-lg flex-1">{title}</AlertDialogTitle>
                {showProgressTimer ? (
                  <span
                    className="tabular-nums text-sm text-muted-foreground shrink-0 pt-0.5"
                    aria-live="polite"
                  >
                    {formatElapsed(elapsedSec)}
                  </span>
                ) : null}
              </div>
              {subtitle ? (
                <p className="text-sm text-muted-foreground break-all">{subtitle}</p>
              ) : null}
            </div>
          </div>
        </AlertDialogHeader>

        {wizardStep === 'summary' && renderSummary()}

        {mode === 'import' && wizardStep === 'confirm' && renderImportConfirm()}

        {wizardStep === 'progress' && mode === 'export' && renderExportProgress()}

        {wizardStep === 'progress' && mode === 'import' && renderImportProgress()}

        <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between sm:items-center">
          {wizardStep === 'progress' &&
          (taskStatus?.status === 'running' || isCancelling) &&
          activeTaskId ? (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={isCancelling}
              onClick={() => void onCancelOperation?.()}
            >
              {isCancelling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Cancelling…
                </>
              ) : (
                'Cancel operation'
              )}
            </Button>
          ) : (
            <span className="hidden sm:block sm:flex-1" />
          )}

          <div className="flex gap-2 w-full sm:w-auto justify-end">
            {wizardStep === 'summary' ? (
              <Button
                type="button"
                className="min-w-[100px]"
                onClick={() => {
                  onCloseSummary?.();
                  onOpenChange(false);
                }}
              >
                Close
              </Button>
            ) : wizardStep === 'progress' ? null : mode === 'import' ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (isUploadingPreview) {
                      void onCancelOperation?.();
                    } else {
                      handleOpenChange(false);
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => onConfirmImport?.()}
                  disabled={
                    isUploadingPreview || !validation || !validation.valid
                  }
                >
                  Replace database
                </Button>
              </>
            ) : null}
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

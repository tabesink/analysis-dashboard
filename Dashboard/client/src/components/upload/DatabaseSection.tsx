'use client';

import { Loader2, Download, Upload, ChevronRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidePanelSection } from '@/components/shared';

export interface DatabaseSectionProps {
  isExporting: boolean;
  isImporting: boolean;
  /** Uploading ZIP for validation or running background export */
  isImportBusy?: boolean;
  currentEventCount?: number;
  /** Shown under Export when a background export task is running */
  exportProgress?: string;
  onExportDatabase: () => void;
  onImportClick: () => void;
}

export function DatabaseSection({
  isExporting,
  isImporting,
  isImportBusy = false,
  currentEventCount = 0,
  exportProgress,
  onExportDatabase,
  onImportClick,
}: DatabaseSectionProps) {
  const subtitle =
    currentEventCount > 0 ? `${currentEventCount} events` : 'Export or import';

  return (
    <SidePanelSection title="Database" subtitle={subtitle}>
      <div className="space-y-2">
        <Button
          variant="ghost"
          onClick={onExportDatabase}
          disabled={isExporting}
          className="w-full group flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-all disabled:opacity-50 h-auto justify-start"
        >
          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            )}
          </div>
          <div className="flex-1 text-left min-w-0">
            <span className="text-sm font-medium block">Export Database</span>
            <span className="text-xs text-muted-foreground block truncate">
              {exportProgress || 'Compressed Parquet archive (.zip)'}
            </span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
        </Button>

        <div className="h-px bg-border/50 mx-3" />

        <Button
          variant="ghost"
          onClick={onImportClick}
          disabled={isImporting || isImportBusy}
          className="w-full group flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-all disabled:opacity-50 h-auto justify-start"
        >
          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center group-hover:bg-amber-100 dark:group-hover:bg-amber-900/30 transition-colors">
            {isImporting ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <Upload className="h-4 w-4 text-muted-foreground group-hover:text-amber-600 transition-colors" />
            )}
          </div>
          <div className="flex-1 text-left">
            <span className="text-sm font-medium block">Import Database</span>
            <span className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Replaces all data
            </span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
        </Button>
      </div>
    </SidePanelSection>
  );
}

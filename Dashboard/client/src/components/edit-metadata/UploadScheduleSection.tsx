'use client';

import { useEffect, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileDropZone, SidePanelSection } from '@/components/shared';

export interface UploadScheduleSectionProps {
  enabled: boolean;
  selectionKey: string;
  onExtract?: () => void;
  isExtracting?: boolean;
}

export function UploadScheduleSection({
  enabled,
  selectionKey,
  onExtract,
  isExtracting = false,
}: UploadScheduleSectionProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    setSelectedFile(null);
  }, [selectionKey]);

  const subtitle = enabled
    ? selectedFile
      ? selectedFile.name
      : 'Select a .sch durability schedule file'
    : 'Select program ID and version to upload a schedule';

  const handleFilesSelected = (files: File[]) => {
    const schFile = files.find((file) => file.name.toLowerCase().endsWith('.sch'));
    if (schFile) {
      setSelectedFile(schFile);
    }
  };

  return (
    <SidePanelSection title="Upload Schedule" subtitle={subtitle} defaultExpanded>
      <div className="space-y-2">
        <FileDropZone
          inputId="edit-metadata-schedule-upload-input"
          accept=".sch"
          disabled={!enabled}
          primaryLabel="Upload schedule file"
          hint=".sch durability schedule"
          onFilesSelected={handleFilesSelected}
        />

        {selectedFile && enabled ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-muted-foreground">1 selected</span>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setSelectedFile(null)}
              >
                Clear
              </Button>
            </div>
            <div className="flex items-center gap-2 rounded px-2 py-1 text-xs">
              <FileText className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{selectedFile.name}</span>
            </div>
          </div>
        ) : null}

        <div className="flex justify-center pt-1">
          <Button
            type="button"
            size="sm"
            onClick={onExtract}
            disabled={!enabled || !selectedFile || isExtracting}
            className="h-8 px-6 text-xs font-medium"
          >
            {isExtracting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Extracting...
              </>
            ) : (
              'Extract'
            )}
          </Button>
        </div>
      </div>
    </SidePanelSection>
  );
}

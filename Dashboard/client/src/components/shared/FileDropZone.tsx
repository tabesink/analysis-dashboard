'use client';

import { type DragEvent, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FileDropZoneProps {
  inputId: string;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  primaryLabel: string;
  hint?: string;
  onFilesSelected: (files: File[]) => void;
}

export function FileDropZone({
  inputId,
  accept,
  multiple = false,
  disabled = false,
  primaryLabel,
  hint,
  onFilesSelected,
}: FileDropZoneProps) {
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) {
      return;
    }
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
    event.target.value = '';
  };

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    if (disabled) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer.types.includes('Files')) {
      event.dataTransfer.dropEffect = 'copy';
      setIsDraggingFiles(true);
    }
  };

  const handleDragLeave = () => {
    setIsDraggingFiles(false);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    if (disabled) {
      return;
    }
    event.preventDefault();
    setIsDraggingFiles(false);
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  return (
    <div
      className={cn(
        disabled && 'opacity-50 pointer-events-none cursor-not-allowed',
      )}
    >
      <input
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
        id={inputId}
        disabled={disabled}
      />
      <label
        htmlFor={disabled ? undefined : inputId}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-8 text-center transition-colors hover:bg-muted/40',
          isDraggingFiles && !disabled && 'border-foreground bg-muted/40',
          disabled && 'cursor-not-allowed hover:bg-card',
        )}
      >
        <span className="mb-5 flex size-11 items-center justify-center rounded-md text-foreground">
          <UploadCloud className="size-9 stroke-[1.5]" />
        </span>
        <span className="text-sm font-medium text-foreground">{primaryLabel}</span>
        {hint ? (
          <span className="mt-4 text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </label>
    </div>
  );
}

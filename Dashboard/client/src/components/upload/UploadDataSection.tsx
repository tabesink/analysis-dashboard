'use client';

import { useMemo } from 'react';
import {
  AlertTriangle,
  FileText,
  Loader2,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileDropZone, SidePanelSection } from '@/components/shared';
import type { FilterOptions } from '@/types/api';

export interface UploadDataSectionProps {
  // File selection
  selectedFiles: File[];
  onFilesChange: (files: File[]) => void;
  // Upload state
  isUploading: boolean;
  uploadProgress: number;
  uploadMessage: string;
  onUpload: () => void;
  onCancelUpload: () => void;
  // Metadata
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  filterOptions: FilterOptions;
  isAdmin: boolean;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  missingFieldsCount: number;
}

export function UploadDataSection({
  selectedFiles,
  onFilesChange,
  isUploading,
  uploadProgress,
  uploadMessage,
  onUpload,
  onCancelUpload,
  filters,
  onFilterChange,
  filterOptions,
  isAdmin,
  hasActiveFilters,
  onClearFilters,
  missingFieldsCount,
}: UploadDataSectionProps) {
  const uploadSummary = useMemo(() => {
    const isChannelMap = (file: File) =>
      file.name === 'channel_map.yaml' ||
      file.name === 'channel_map.yml' ||
      file.name.endsWith('channel_map.yaml') ||
      file.name.endsWith('channel_map.yml');

    const csvCount = selectedFiles.filter((file) => file.name.toLowerCase().endsWith('.csv')).length;
    const rspCount = selectedFiles.filter((file) => file.name.toLowerCase().endsWith('.rsp')).length;
    const channelMapCount = selectedFiles.filter(isChannelMap).length;
    const hasChannelMap = channelMapCount > 0;
    const dataCount = csvCount + rspCount;
    const ignoredCount = selectedFiles.length - dataCount - channelMapCount;

    return {
      csvCount,
      rspCount,
      hasChannelMap,
      dataCount,
      ignoredCount: Math.max(0, ignoredCount),
      hasMixedDataTypes: csvCount > 0 && rspCount > 0,
    };
  }, [selectedFiles]);

  const showMissingChannelMapNotice = uploadSummary.dataCount > 0 && !uploadSummary.hasChannelMap;
  const showDataFileError = selectedFiles.length > 0 && uploadSummary.dataCount === 0;
  const showMixedDataTypeError = uploadSummary.hasMixedDataTypes;
  const canUpload =
    uploadSummary.dataCount > 0 &&
    !uploadSummary.hasMixedDataTypes &&
    missingFieldsCount === 0;

  const hiddenFilterLabels = new Set([
    'RFQ',
    'DV',
    'PV',
    'Post-Prod',
    'Suspension Component',
    'Axle Location',
    'Drive Type',
    "Mat'l & Const",
    'Steering',
    'Damper Type',
    'Vehicle Type',
    'Gross Vehicle Weight Range (lbs)',
    'FGAWR Range (lbs)',
    'RGAWR Range (lbs)',
  ]);

  const subtitle =
    selectedFiles.length > 0
      ? `${selectedFiles.length} files selected`
      : 'Select files to upload';

  const clearFiltersAction =
    hasActiveFilters ? (
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearFilters}
        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        Clear
      </Button>
    ) : null;

  return (
    <SidePanelSection
      title="Upload Data"
      subtitle={subtitle}
      defaultExpanded={true}
      headerActions={clearFiltersAction}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <FileDropZone
            inputId="database-upload-input"
            accept=".csv,.rsp,.yaml,.yml"
            multiple
            primaryLabel="Upload CSV/RSP files"
            hint="channel_map.yml (optional)"
            onFilesSelected={onFilesChange}
          />

          {selectedFiles.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-muted-foreground">
                  {selectedFiles.length} selected
                </span>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => onFilesChange([])}
                >
                  Clear
                </Button>
              </div>
              <div className="h-[160px] rounded-md border overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="space-y-1 p-2">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="group flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-muted/50"
                      >
                        <span className="inline-flex min-w-0 items-center gap-2 text-xs">
                          <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{file.name}</span>
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => onFilesChange(selectedFiles.filter((_, i) => i !== index))}
                          aria-label={`Remove ${file.name}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}

          {showMissingChannelMapNotice && (
            <p className="text-xs text-muted-foreground px-1">
              No channel_map.yaml selected. Files will be uploaded as pending until a channel map is defined.
            </p>
          )}
          {showDataFileError && (
            <p className="text-xs text-destructive px-1">No CSV or RSP files found</p>
          )}
          {showMixedDataTypeError && (
            <p className="text-xs text-destructive px-1">
              Upload either CSV files or RSP files, not both.
            </p>
          )}
          {uploadSummary.ignoredCount > 0 && !showDataFileError && (
            <p className="text-xs text-muted-foreground px-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {uploadSummary.ignoredCount} unrelated file
              {uploadSummary.ignoredCount === 1 ? '' : 's'} will be ignored.
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Job ID <span className="text-destructive">*</span>
            </p>
            <Input
              value={filters['Program ID'] || ''}
              onChange={(e) => onFilterChange('Program ID', e.target.value)}
              placeholder="Enter value..."
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Load Version <span className="text-destructive">*</span>
            </p>
            <Input
              value={filters['Load Version'] || ''}
              onChange={(e) => onFilterChange('Load Version', e.target.value)}
              placeholder="Enter value..."
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Program ID <span className="text-destructive">*</span>
            </p>
            <Input
              value={filters['Job Number'] || ''}
              onChange={(e) => onFilterChange('Job Number', e.target.value)}
              placeholder="Enter value..."
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Work Order <span className="text-destructive">*</span>
            </p>
            <Input
              value={filters['Work Order'] || ''}
              onChange={(e) => onFilterChange('Work Order', e.target.value)}
              placeholder="Enter value..."
            />
          </div>

          {Object.entries(filterOptions)
            .sort(([, a], [, b]) => a.order - b.order)
            .filter(([key]) => !hiddenFilterLabels.has(key))
            .map(([key, filterOption]) => (
              <div key={key} className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{key}</p>
                <Select
                  value={key === 'Status' && !isAdmin ? (filters[key] || 'Pending') : (filters[key] || '')}
                  onValueChange={(value) => {
                    if (key === 'Status' && !isAdmin) return;
                    onFilterChange(key, value);
                  }}
                  disabled={key === 'Status' && !isAdmin}
                >
                  <SelectTrigger
                    className={`w-full ${key === 'Status' && !isAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {filterOption.values.map((option) => (
                      <SelectItem key={option} value={option} className="text-xs">
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {key === 'Status' && !isAdmin && (
                  <span className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1">
                    Admin access is required to edit this field.
                  </span>
                )}
              </div>
            ))}
        </div>

        <div className="space-y-3 pt-2">
          {isUploading && (
            <div className="space-y-2 rounded-md border bg-muted/20 p-3">
              <div className="flex justify-between text-xs">
                <span className="truncate text-muted-foreground">
                  {uploadMessage || 'Uploading...'}
                </span>
                <span className="font-medium">{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <span className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1">
                Large files may take several minutes to process
              </span>
            </div>
          )}

          <div className="flex justify-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={onUpload}
              disabled={!canUpload || isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Importing...
                </>
              ) : (
                'Import'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!isUploading}
              onClick={onCancelUpload}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </SidePanelSection>
  );
}

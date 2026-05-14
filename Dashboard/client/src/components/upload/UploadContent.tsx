'use client';

import { FolderOpen, FileSpreadsheet, X, Upload, ChevronRight, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FilterOptions } from '@/types/api';

export interface UploadContentProps {
  selectedFiles: File[];
  onFilesChange: (files: File[]) => void;
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  filterOptions: FilterOptions;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  missingFieldsCount: number;
  isUploading: boolean;
  uploadProgress: number;
  uploadMessage: string;
  onUpload: () => void;
  onCancelUpload: () => void;
  isMetadataExpanded: boolean;
  onToggleMetadata: () => void;
}

export function UploadContent({
  selectedFiles,
  onFilesChange,
  filters,
  onFilterChange,
  filterOptions,
  hasActiveFilters,
  onClearFilters,
  missingFieldsCount,
  isUploading,
  uploadProgress,
  uploadMessage,
  onUpload,
  onCancelUpload,
  isMetadataExpanded,
  onToggleMetadata,
}: UploadContentProps) {
  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesChange(files);
    }
    e.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    onFilesChange(selectedFiles.filter((_, i) => i !== index));
  };

  return (
    <>
      {/* File Upload Section - Fixed at top */}
      <div className="flex-none p-4 pb-0">
        {/* Top Divider */}
        <div className="h-px bg-border mb-4" />
        
        <div className="space-y-3">
          <input
            type="file"
            {...({
              webkitdirectory: '',
              directory: '',
            } as React.InputHTMLAttributes<HTMLInputElement>)}
            multiple
            onChange={handleFolderSelect}
            className="hidden"
            id="folder-upload"
          />
            <Button
              variant="ghost"
              onClick={() => document.getElementById('folder-upload')?.click()}
              className="w-full group flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-all h-auto justify-start"
            >
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <FolderOpen className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="flex-1 text-left">
              <span className="text-sm font-medium block">Select Folder</span>
              <span className="text-[11px] text-muted-foreground">
                CSV files + channel map required
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
          </Button>

          {/* Selected Files List - Scrollable */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-muted-foreground">
                  {selectedFiles.length} files selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFilesChange([])}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors h-auto py-0 px-1"
                >
                  Clear
                </Button>
              </div>
              <ScrollArea className="max-h-[140px]">
                <div className="space-y-1 pr-2">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-2.5 py-1.5 bg-muted/50 rounded-md text-xs group"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1 text-foreground/80">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-4 w-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-0 min-w-0"
                        onClick={() => handleRemoveFile(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="flex-none px-4 py-4">
        <div className="h-px bg-border" />
      </div>

      {/* Metadata Filters - Collapsible */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-none px-4 pb-2">
          <Button
            variant="ghost"
            onClick={onToggleMetadata}
            className="flex items-center justify-between w-full px-1 py-1 hover:bg-muted/50 rounded transition-colors group h-auto"
          >
            <div className="flex items-center gap-2">
              {isMetadataExpanded ? (
                <Minus className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
              ) : (
                <Plus className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
              )}
              <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                Metadata
              </span>
              {!isMetadataExpanded && missingFieldsCount > 0 && (
                <span className="text-caption text-destructive">
                  ({missingFieldsCount} required)
                </span>
              )}
            </div>
            {hasActiveFilters && isMetadataExpanded && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onClearFilters();
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </span>
            )}
          </Button>
        </div>

        {isMetadataExpanded && (
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-4 pb-4 space-y-1">
            {/* Job ID */}
            <div className="overflow-hidden rounded border border-border/50">
              <div className="bg-background px-2 py-0.5">
                <span className="text-[11px] text-muted-foreground">
                  Job ID <span className="text-destructive">*</span>
                </span>
              </div>
              <Input
                value={filters['Program ID'] || ''}
                onChange={(e) => onFilterChange('Program ID', e.target.value)}
                placeholder="Enter value..."
                className="h-6 px-2 rounded-none border-0 border-t border-border/30 text-xs text-foreground/80 bg-muted/30 focus:bg-muted/40 focus:border-border/30 focus-visible:border-border/30 focus-visible:ring-0 focus-visible:ring-transparent shadow-none transition-[background-color] placeholder:text-xs placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Load Version */}
            <div className="overflow-hidden rounded border border-border/50">
              <div className="bg-background px-2 py-0.5">
                <span className="text-[11px] text-muted-foreground">
                  Load Version <span className="text-destructive">*</span>
                </span>
              </div>
              <Input
                value={filters['Load Version'] || ''}
                onChange={(e) => onFilterChange('Load Version', e.target.value)}
                placeholder="Enter value..."
                className="h-6 px-2 rounded-none border-0 border-t border-border/30 text-xs text-foreground/80 bg-muted/30 focus:bg-muted/40 focus:border-border/30 focus-visible:border-border/30 focus-visible:ring-0 focus-visible:ring-transparent shadow-none transition-[background-color] placeholder:text-xs placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Dynamic Filters from Server */}
            {Object.entries(filterOptions)
              .sort(([, a], [, b]) => a.order - b.order)
              .map(([key, filterOption]) => (
              <div key={key} className="overflow-hidden rounded border border-border/50">
                <div className="bg-background px-2 py-0.5">
                  <span className="text-[11px] text-muted-foreground">
                    {key} <span className="text-destructive">*</span>
                  </span>
                </div>
                <Select
                  value={filters[key] || ''}
                  onValueChange={(value) => onFilterChange(key, value)}
                >
                  <SelectTrigger className="h-6 w-full px-2 rounded-none border-0 border-t border-border/30 text-xs text-foreground/80 bg-muted/30 focus:bg-muted/40 focus:outline-none focus:ring-0 focus:border-border/30 focus-visible:outline-none focus-visible:ring-0 shadow-none transition-all [&>span]:text-left [&>span]:text-foreground/80">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-md max-h-[200px]">
                    {filterOption.values.map((option) => (
                      <SelectItem key={option} value={option} className="text-xs">
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Upload Button - Fixed at bottom */}
      <div className="flex-none p-4 border-t border-border flex flex-col items-center space-y-3">
        {isUploading ? (
          <>
            <div className="w-full space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  {uploadMessage || 'Uploading...'}
                </span>
                <span className="font-medium text-foreground/80">
                  {Math.round(uploadProgress)}%
                </span>
              </div>
              <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onCancelUpload}
              className="h-8 px-4 rounded-md text-xs"
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            onClick={onUpload}
            disabled={selectedFiles.length === 0 || missingFieldsCount > 0}
            className="h-8 px-4 rounded-md text-xs font-medium"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Upload
          </Button>
        )}
      </div>
    </>
  );
}


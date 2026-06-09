'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SidePanelSection } from '@/components/shared';

export type SelectionMetadata = {
  lastUpdatedBy: string | null;
  lastUpdatedAt: string | null;
  uploadedBy: string | null;
  uploadedAt: string | null;
  status: string | null;
};

export interface SelectDatasetSectionProps {
  selectedProgramId: string;
  selectedVersion: string;
  programIds: string[];
  versions: string[];
  isProgramIdsLoading: boolean;
  isVersionsLoading: boolean;
  isPrefillLoading: boolean;
  isSaving: boolean;
  selectedEventMetadata: SelectionMetadata | null;
  formatTimestamp: (value: string | null) => string;
  onProgramIdChange: (value: string) => void;
  onVersionChange: (value: string) => void;
  onClearFields: () => void;
}

export function SelectDatasetSection({
  selectedProgramId,
  selectedVersion,
  programIds,
  versions,
  isProgramIdsLoading,
  isVersionsLoading,
  isPrefillLoading,
  isSaving,
  selectedEventMetadata,
  formatTimestamp,
  onProgramIdChange,
  onVersionChange,
  onClearFields,
}: SelectDatasetSectionProps) {
  return (
    <SidePanelSection
      title="Select Dataset"
      subtitle="Edit event metadata for the selected program/version."
      defaultExpanded
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Program ID</p>
          <Select
            value={selectedProgramId}
            onValueChange={onProgramIdChange}
            disabled={isProgramIdsLoading || isPrefillLoading || isSaving}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select program ID" />
            </SelectTrigger>
            <SelectContent>
              {programIds.map((programId) => (
                <SelectItem key={programId} value={programId}>
                  {programId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Version</p>
          <Select
            value={selectedVersion}
            onValueChange={onVersionChange}
            disabled={
              !selectedProgramId || isVersionsLoading || isPrefillLoading || isSaving
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select version" />
            </SelectTrigger>
            <SelectContent>
              {versions.map((version) => (
                <SelectItem key={version} value={version}>
                  {version}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border bg-muted/20 p-3 text-xs">
          <p className="font-medium text-foreground">Current Selection Summary</p>
          <div className="mt-2 space-y-1 text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Last update by:</span>{' '}
              {selectedEventMetadata?.lastUpdatedBy ?? 'N/A'}
            </p>
            <p>
              <span className="font-medium text-foreground">Last update time:</span>{' '}
              {formatTimestamp(selectedEventMetadata?.lastUpdatedAt ?? null)}
            </p>
            <p>
              <span className="font-medium text-foreground">Uploaded by:</span>{' '}
              {selectedEventMetadata?.uploadedBy ?? 'N/A'}
            </p>
            <p>
              <span className="font-medium text-foreground">Uploaded time:</span>{' '}
              {formatTimestamp(selectedEventMetadata?.uploadedAt ?? null)}
            </p>
            <p>
              <span className="font-medium text-foreground">Status:</span>{' '}
              {selectedEventMetadata?.status ?? 'N/A'}
            </p>
          </div>
        </div>

        <div className="flex justify-center pt-1">
          <Button
            type="button"
            size="sm"
            onClick={onClearFields}
            disabled={
              isPrefillLoading ||
              isSaving ||
              !selectedProgramId ||
              !selectedVersion
            }
            className="h-8 px-6 text-xs font-medium"
          >
            <X className="h-3.5 w-3.5 mr-1.5" />
            Clear
          </Button>
        </div>
      </div>
    </SidePanelSection>
  );
}

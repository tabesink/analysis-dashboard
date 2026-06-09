'use client';

import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SidePanelLayout } from '@/components/shared';
import {
  SelectDatasetSection,
  type SelectDatasetSectionProps,
} from './SelectDatasetSection';
import {
  UploadScheduleSection,
  type UploadScheduleSectionProps,
} from './UploadScheduleSection';

export interface EditMetadataSidePanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  selectDatasetProps: SelectDatasetSectionProps;
  uploadScheduleProps: UploadScheduleSectionProps;
}

export function EditMetadataSidePanel({
  isCollapsed,
  onToggleCollapse,
  selectDatasetProps,
  uploadScheduleProps,
}: EditMetadataSidePanelProps) {
  return (
    <SidePanelLayout
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      expandedWidth="w-[320px]"
    >
      <ScrollArea className="flex-1 min-h-0 w-full">
        <div className="p-5 space-y-5 overflow-hidden">
          <SelectDatasetSection {...selectDatasetProps} />
          <Separator />
          <UploadScheduleSection {...uploadScheduleProps} />
        </div>
      </ScrollArea>
    </SidePanelLayout>
  );
}

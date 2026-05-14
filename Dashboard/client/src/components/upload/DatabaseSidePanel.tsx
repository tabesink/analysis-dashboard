'use client';

import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SidePanelLayout } from '@/components/shared';
import { UploadDataSection, type UploadDataSectionProps } from './UploadDataSection';
import { DatabaseSection, type DatabaseSectionProps } from './DatabaseSection';

export interface DatabaseSidePanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  uploadDataProps: UploadDataSectionProps;
  databaseProps: DatabaseSectionProps;
}

export function DatabaseSidePanel({
  isCollapsed,
  onToggleCollapse,
  uploadDataProps,
  databaseProps,
}: DatabaseSidePanelProps) {
  return (
    <SidePanelLayout
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      expandedWidth="w-[320px]"
    >
      <ScrollArea className="flex-1 min-h-0 w-full">
        <div className="p-5 space-y-5 overflow-hidden">
          <UploadDataSection {...uploadDataProps} />
          {/* Temporarily hidden per request:
              <Separator />
              <DatabaseSection {...databaseProps} />
          */}
        </div>
      </ScrollArea>
    </SidePanelLayout>
  );
}

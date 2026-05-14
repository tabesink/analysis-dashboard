'use client';

import { SidePanelLayout } from '@/components/shared';
import { UploadContent, type UploadContentProps } from './UploadContent';

export interface UploadSidePanelProps extends UploadContentProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function UploadSidePanel({
  isCollapsed,
  onToggleCollapse,
  ...uploadContentProps
}: UploadSidePanelProps) {
  return (
    <SidePanelLayout
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      expandedWidth="w-[340px]"
    >
      <UploadContent {...uploadContentProps} />
    </SidePanelLayout>
  );
}

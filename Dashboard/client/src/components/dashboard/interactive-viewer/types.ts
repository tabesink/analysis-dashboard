import type { EventMetadata } from '@/types/api';

/**
 * Main CurveSelector props
 */
export interface CurveSelectorProps {
  events: EventMetadata[];
  curveVisibility: Record<string, boolean>;
  onToggleVisibility: (eventId: string) => void;
}

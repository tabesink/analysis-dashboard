import type { FilterField } from './types';

export const NON_GLOBAL_FILTER_FIELDS = new Set<FilterField>(['status']);

export const SHORT_LABELS: Record<string, string> = {
  RFQ: 'RFQ',
  DV: 'DV',
  PV: 'PV',
  'Post-Prod': 'Post',
  'Suspension Component': 'Suspension',
  'Axle Location': 'Axle',
  'Gross Vehicle Weight Range (lbs)': 'GVW Range',
  'FGAWR Range (lbs)': 'FGAWR',
  'RGAWR Range (lbs)': 'RGAWR',
  'Drive Type': 'Drive',
  "Mat'l & Const": 'Material',
  Steering: 'Steering',
  'Damper Type': 'Damper',
  'Vehicle Type': 'Vehicle',
};

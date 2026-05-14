export type FilterField = string;
export type GlobalFilterChipField = FilterField | 'event_id_query';

export interface ActiveFilterChip {
  field: GlobalFilterChipField;
  displayName: string;
  value: string;
}

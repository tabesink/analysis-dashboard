import type { EventMetadata, GlobalFilters as GlobalFiltersType } from '@/types/api';
import type { ActiveFilterChip, FilterField } from './types';

export function isGlobalFiltersActive(filters: GlobalFiltersType): boolean {
  return Object.entries(filters).some(([key, values]) => {
    if (key === 'event_id_query') {
      return typeof values === 'string' && values.trim().length > 0;
    }
    return Array.isArray(values) && values.length > 0;
  });
}

export function normalizeFilters(filters: GlobalFiltersType): GlobalFiltersType {
  const normalized = Object.fromEntries(
    Object.entries(filters).filter(([key, values]) => {
      if (key === 'event_id_query') {
        return typeof values === 'string' && values.trim().length > 0;
      }
      return Array.isArray(values) && values.length > 0;
    })
  ) as GlobalFiltersType;
  if (typeof normalized.event_id_query === 'string') {
    normalized.event_id_query = normalized.event_id_query.trim();
  }
  return normalized;
}

export function upsertFilterValue(
  filters: GlobalFiltersType,
  field: FilterField,
  value: string,
  checked: boolean
): GlobalFiltersType {
  const currentRaw = filters[field];
  const currentValues = Array.isArray(currentRaw) ? currentRaw : [];
  const nextValues = checked
    ? [...new Set([...currentValues, value])]
    : currentValues.filter((v) => v !== value);
  const next = { ...filters, [field]: nextValues };
  return normalizeFilters(next);
}

export function removeFilterField(
  filters: GlobalFiltersType,
  field: FilterField
): GlobalFiltersType {
  const { [field]: _, ...rest } = filters;
  return rest;
}

export function buildCountsByField(
  allVisibleEvents: EventMetadata[],
  filterFields: FilterField[]
): Record<FilterField, Map<string, number>> {
  const index: Record<FilterField, Map<string, number>> = {};
  filterFields.forEach((field) => {
    index[field] = new Map<string, number>();
  });

  for (const event of allVisibleEvents) {
    for (const field of filterFields) {
      const coreValue = event[field as keyof EventMetadata];
      const customValue = event.custom_fields?.[field];
      const value =
        typeof coreValue === 'string'
          ? coreValue
          : typeof coreValue === 'boolean'
            ? coreValue
              ? 'Applicable'
              : 'Not Applicable'
          : typeof customValue === 'string'
            ? customValue
            : undefined;
      if (!value) continue;
      index[field].set(value, (index[field].get(value) ?? 0) + 1);
    }
  }

  return index;
}

export function buildActiveFilterChips(
  globalFilters: GlobalFiltersType,
  displayNameByField: Record<string, string>
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  for (const [field, rawValues] of Object.entries(globalFilters)) {
    if (field === 'event_id_query') continue;
    const values = Array.isArray(rawValues) ? rawValues : [];
    const displayName = displayNameByField[field] ?? field;
    for (const value of values) {
      chips.push({ field, displayName, value });
    }
  }
  if (globalFilters.event_id_query?.trim()) {
    chips.push({
      field: 'event_id_query',
      displayName: 'Event ID',
      value: globalFilters.event_id_query.trim(),
    });
  }
  return chips;
}

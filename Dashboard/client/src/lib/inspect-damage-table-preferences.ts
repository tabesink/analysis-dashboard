export const INSPECT_DAMAGE_TABLE_PREFS_STORAGE_KEY = 'inspect_damage_table_prefs_v1';

export type SortDirection = 'asc' | 'desc';

export type InspectDamageTablePreferences = {
  visibleColumns: Record<string, boolean>;
  columnWidths: Record<string, number>;
  expandedPrograms: string[];
  expandedVersions: string[];
  sortField: string;
  sortDirection: SortDirection;
  columnFilters: Record<string, string[]>;
  updatedAt: string;
};

export type TreeExpansionState = {
  expandedPrograms: string[];
  expandedVersions: string[];
};

const DEFAULT_SORT_FIELD = 'job_number';
const DEFAULT_SORT_DIRECTION: SortDirection = 'asc';
const DEFAULT_FILTER_COLUMNS = ['work_order', 'job_number'] as const;

export function getDefaultColumnFilters(): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  for (const column of DEFAULT_FILTER_COLUMNS) {
    next[column] = [];
  }
  return next;
}

export function getDefaultInspectDamageTablePreferences(): InspectDamageTablePreferences {
  return {
    visibleColumns: {},
    columnWidths: {},
    expandedPrograms: [],
    expandedVersions: [],
    sortField: DEFAULT_SORT_FIELD,
    sortDirection: DEFAULT_SORT_DIRECTION,
    columnFilters: getDefaultColumnFilters(),
    updatedAt: new Date().toISOString(),
  };
}

function isSortDirection(value: unknown): value is SortDirection {
  return value === 'asc' || value === 'desc';
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function parseColumnFilters(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object') {
    return getDefaultColumnFilters();
  }
  const defaults = getDefaultColumnFilters();
  const parsed = value as Record<string, unknown>;
  const next: Record<string, string[]> = { ...defaults };
  for (const [key, rawValues] of Object.entries(parsed)) {
    if (!Array.isArray(rawValues)) continue;
    next[key] = rawValues.filter((item): item is string => typeof item === 'string');
  }
  return next;
}

export function parseInspectDamageTablePreferences(
  raw: string | null,
): InspectDamageTablePreferences | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const defaults = getDefaultInspectDamageTablePreferences();
    const visibleColumns =
      typeof parsed.visibleColumns === 'object' && parsed.visibleColumns !== null
        ? (parsed.visibleColumns as Record<string, boolean>)
        : defaults.visibleColumns;
    const columnWidths =
      typeof parsed.columnWidths === 'object' && parsed.columnWidths !== null
        ? (parsed.columnWidths as Record<string, number>)
        : defaults.columnWidths;

    return {
      visibleColumns,
      columnWidths,
      expandedPrograms: parseStringArray(parsed.expandedPrograms),
      expandedVersions: parseStringArray(parsed.expandedVersions),
      sortField:
        typeof parsed.sortField === 'string' ? parsed.sortField : defaults.sortField,
      sortDirection: isSortDirection(parsed.sortDirection)
        ? parsed.sortDirection
        : defaults.sortDirection,
      columnFilters: parseColumnFilters(parsed.columnFilters),
      updatedAt:
        typeof parsed.updatedAt === 'string'
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function serializeInspectDamageTablePreferences(
  prefs: InspectDamageTablePreferences,
): string {
  return JSON.stringify(prefs);
}

export function mergeTreeExpansionWithTreeKeys(
  stored: TreeExpansionState,
  programIds: string[],
  versionKeys: string[],
): TreeExpansionState {
  const programIdSet = new Set(programIds);
  const versionKeySet = new Set(versionKeys);

  const storedPrograms = stored.expandedPrograms.filter((id) => programIdSet.has(id));
  const storedVersions = stored.expandedVersions.filter((key) => versionKeySet.has(key));

  const expandedPrograms = [...storedPrograms];
  for (const programId of programIds) {
    if (!expandedPrograms.includes(programId)) {
      expandedPrograms.push(programId);
    }
  }

  return {
    expandedPrograms,
    expandedVersions: storedVersions,
  };
}

export function treeKeysFromEvents(
  events: Array<{ program_id: string; version: string }>,
): { programIds: string[]; versionKeys: string[] } {
  const programIds = new Set<string>();
  const versionKeys = new Set<string>();

  for (const event of events) {
    programIds.add(event.program_id);
    versionKeys.add(`${event.program_id}::${event.version}`);
  }

  return {
    programIds: [...programIds].sort((a, b) => a.localeCompare(b)),
    versionKeys: [...versionKeys].sort((a, b) => a.localeCompare(b)),
  };
}

import type {
  InspectDamageState,
  InspectDamageTablePreferencesState,
} from '@/types/session';

export function getDefaultTablePreferencesState(): InspectDamageTablePreferencesState {
  return {
    visible_columns: {},
    column_widths: {},
    expanded_programs: [],
    expanded_versions: [],
    sort_field: DEFAULT_SORT_FIELD,
    sort_direction: DEFAULT_SORT_DIRECTION,
    column_filters: getDefaultColumnFilters(),
  };
}

export function mergeInspectDamageState(
  current: InspectDamageState | undefined | null,
  patch: Partial<InspectDamageState>,
): InspectDamageState {
  const base: InspectDamageState = {
    table_preferences: current?.table_preferences,
  };

  return {
    table_preferences:
      patch.table_preferences !== undefined
        ? patch.table_preferences
        : base.table_preferences,
  };
}

export function uiTablePrefsFromSession(
  stored: InspectDamageTablePreferencesState | undefined,
): InspectDamageTablePreferences | null {
  if (!stored) return null;

  return {
    visibleColumns: stored.visible_columns ?? {},
    columnWidths: stored.column_widths ?? {},
    expandedPrograms: stored.expanded_programs ?? [],
    expandedVersions: stored.expanded_versions ?? [],
    sortField: stored.sort_field ?? DEFAULT_SORT_FIELD,
    sortDirection:
      stored.sort_direction === 'desc' ? 'desc' : DEFAULT_SORT_DIRECTION,
    columnFilters: stored.column_filters ?? getDefaultColumnFilters(),
    updatedAt: new Date().toISOString(),
  };
}

export function uiTablePrefsToSession(
  prefs: Omit<InspectDamageTablePreferences, 'updatedAt'>,
): InspectDamageTablePreferencesState {
  return {
    visible_columns: prefs.visibleColumns,
    column_widths: prefs.columnWidths,
    expanded_programs: prefs.expandedPrograms,
    expanded_versions: prefs.expandedVersions,
    sort_field: prefs.sortField,
    sort_direction: prefs.sortDirection,
    column_filters: prefs.columnFilters,
  };
}

export function tablePreferencesUiEqual(
  left: Omit<InspectDamageTablePreferences, 'updatedAt'> | null | undefined,
  right: Omit<InspectDamageTablePreferences, 'updatedAt'>,
): boolean {
  if (!left) return false;
  return (
    JSON.stringify(left.visibleColumns) === JSON.stringify(right.visibleColumns) &&
    JSON.stringify(left.columnWidths) === JSON.stringify(right.columnWidths) &&
    JSON.stringify(left.expandedPrograms) === JSON.stringify(right.expandedPrograms) &&
    JSON.stringify(left.expandedVersions) === JSON.stringify(right.expandedVersions) &&
    left.sortField === right.sortField &&
    left.sortDirection === right.sortDirection &&
    JSON.stringify(left.columnFilters) === JSON.stringify(right.columnFilters)
  );
}

export function resolvePersistedExpansion(
  isTreeHydrated: boolean,
  liveExpansion: TreeExpansionState,
  storedExpansion: TreeExpansionState | null | undefined,
): TreeExpansionState {
  if (isTreeHydrated) {
    return {
      expandedPrograms: [...liveExpansion.expandedPrograms],
      expandedVersions: [...liveExpansion.expandedVersions],
    };
  }

  return {
    expandedPrograms: [...(storedExpansion?.expandedPrograms ?? [])],
    expandedVersions: [...(storedExpansion?.expandedVersions ?? [])],
  };
}

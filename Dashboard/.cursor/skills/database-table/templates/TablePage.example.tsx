'use client';

/**
 * Example page wiring for the hierarchical-table card.
 *
 * Distilled from client/src/app/database/page.tsx (lines 587-893):
 *   - Card chrome + scroll wrapper
 *   - Sticky header with sort + filter + resize per column
 *   - Column visibility popover
 *   - Batch action bar (Delete shown as the example)
 *   - Empty / initial-loading / refreshing-with-data states
 *   - Indent math constants (re-exported from tokens.md)
 *   - Per-column width seeding heuristic
 *
 * The data layer (`useExampleData`) is a stub. Replace with the target's data
 * hook(s) — the only contract is `rows: LeafRow[]` and `summary: GroupSummary[]`.
 *
 * Variant: this file uses the 3-level table. To use the 2-level variant,
 * swap the import and remove subgroup-level state from the data shape.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpIcon,
  ArrowDownIcon,
  FilterIcon,
  Loader2,
  Trash2,
  Columns,
  FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ColumnResizeHandle } from './ColumnResizeHandle';
import { HierarchicalTable } from './HierarchicalTable.three-level';
import {
  exampleStatusClassName,
  EXAMPLE_STATUS_PRIORITY,
} from './rollup';
import type { ColumnDef, GroupSummary, LeafRow, RollupConfig } from './types';

// =============================================================================
// Width tokens (see ../tokens.md)
// =============================================================================

const CHAR_PX = 7.2;
const PADDING_PX = 32;
const MIN_COLUMN_PX = 80;
const MAX_COLUMN_PX = 400;
const LEVEL_1_DEFAULT_PX = 250;
const LEVEL_1_KEY = '__level1__';

function widthForValues(label: string, values: string[]): number {
  const longest = values.reduce(
    (max, v) => Math.max(max, v.length),
    label.length,
  );
  return Math.min(
    MAX_COLUMN_PX,
    Math.max(MIN_COLUMN_PX, Math.ceil(longest * CHAR_PX) + PADDING_PX),
  );
}

// =============================================================================
// Example column definitions — replace per target
// =============================================================================

const EXAMPLE_COLUMNS: ColumnDef[] = [
  { key: 'component', label: 'Component' },
  { key: 'axleLocation', label: 'Axle Location' },
  { key: 'driveType', label: 'Drive Type' },
  { key: 'status', label: 'Status' },
];

const EXAMPLE_ROLLUP: RollupConfig = {
  field: 'status',
  priority: EXAMPLE_STATUS_PRIORITY,
  classNameFor: exampleStatusClassName,
};

// =============================================================================
// Stub data hook — replace with the target's actual hook
// =============================================================================

interface DataHookResult {
  rows: LeafRow[];
  summary: GroupSummary[];
  isLoading: boolean;
  isRefreshing: boolean;
  refetch: () => void;
  deleteRows: (ids: string[]) => Promise<boolean>;
  isDeletingIds: string[];
}

function useExampleData(): DataHookResult {
  // Replace with the target's actual data hook.
  return {
    rows: [],
    summary: [],
    isLoading: false,
    isRefreshing: false,
    refetch: () => {},
    deleteRows: async () => true,
    isDeletingIds: [],
  };
}

// =============================================================================
// Page
// =============================================================================

type SortDirection = 'asc' | 'desc';

export default function ExampleTablePage() {
  const {
    rows,
    summary,
    isLoading,
    isRefreshing,
    refetch,
    deleteRows,
    isDeletingIds,
  } = useExampleData();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<string>('component');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>(
    () =>
      EXAMPLE_COLUMNS.reduce<Record<string, string[]>>((acc, col) => {
        acc[col.key] = [];
        return acc;
      }, {}),
  );

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    () =>
      EXAMPLE_COLUMNS.reduce<Record<string, boolean>>((acc, col) => {
        acc[col.key] = true;
        return acc;
      }, {}),
  );

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  // Seed per-column widths from the longest known value.
  useEffect(() => {
    setColumnWidths((prev) => {
      const next = { ...prev };
      let changed = false;
      if (next[LEVEL_1_KEY] === undefined) {
        next[LEVEL_1_KEY] = LEVEL_1_DEFAULT_PX;
        changed = true;
      }
      for (const col of EXAMPLE_COLUMNS) {
        if (next[col.key] !== undefined) continue;
        const values = Array.from(
          new Set(rows.map((r) => String(r[col.key] ?? '')).filter(Boolean)),
        );
        next[col.key] = widthForValues(col.label, values);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [rows]);

  const setColumnWidth = useCallback((key: string, next: number) => {
    setColumnWidths((prev) =>
      prev[key] === next ? prev : { ...prev, [key]: next },
    );
  }, []);

  const getColumnValue = useCallback((row: LeafRow, key: string): string => {
    const value = row[key];
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return value == null ? '' : String(value);
  }, []);

  const toggleableColumns = useMemo(
    () => EXAMPLE_COLUMNS.filter((col) => col.key !== EXAMPLE_ROLLUP.field),
    [],
  );

  const handleColumnVisibilityToggle = (key: string, checked: boolean) => {
    if (key === EXAMPLE_ROLLUP.field) return;
    const visibleCount = Object.values(visibleColumns).filter(Boolean).length;
    if (!checked && visibleCount <= 1) {
      toast.error('At least one column must be visible');
      return;
    }
    setVisibleColumns((prev) => ({ ...prev, [key]: checked }));
  };

  const visibleColumnDefs = useMemo(
    () => EXAMPLE_COLUMNS.filter((col) => visibleColumns[col.key]),
    [visibleColumns],
  );

  const uniqueValuesByColumn = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const col of EXAMPLE_COLUMNS) {
      const set = new Set<string>();
      for (const row of rows) {
        const v = getColumnValue(row, col.key);
        if (v) set.add(v);
      }
      out[col.key] = Array.from(set).sort();
    }
    return out;
  }, [rows, getColumnValue]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      for (const [col, selectedValues] of Object.entries(columnFilters)) {
        if (selectedValues.length === 0) continue;
        if (!selectedValues.includes(getColumnValue(row, col))) return false;
      }
      return true;
    });
  }, [rows, columnFilters, getColumnValue]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const av = getColumnValue(a, sortField);
      const bv = getColumnValue(b, sortField);
      const m = sortDirection === 'asc' ? 1 : -1;
      return m * av.localeCompare(bv);
    });
  }, [filteredRows, sortField, sortDirection, getColumnValue]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleColumnFilterChange = (col: string, value: string, checked: boolean) => {
    setColumnFilters((prev) => {
      const current = prev[col] ?? [];
      return {
        ...prev,
        [col]: checked ? [...current, value] : current.filter((v) => v !== value),
      };
    });
  };

  const handleBatchSelect = (leafIds: string[], checked: boolean) => {
    setSelectedIds((prev) => {
      const set = new Set(prev);
      if (checked) leafIds.forEach((id) => set.add(id));
      else leafIds.forEach((id) => set.delete(id));
      return [...set];
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) {
      toast.error('No rows selected');
      return;
    }
    if (!confirm(`Delete ${selectedIds.length} rows? This cannot be undone.`)) {
      return;
    }
    const success = await deleteRows(selectedIds);
    if (success) {
      setSelectedIds([]);
      toast.success(`Deleted ${selectedIds.length} rows`);
      refetch();
    }
  };

  const renderFilterableColumnHeader = (
    label: string,
    field: string,
    width: number,
  ) => (
    <div key={field} className="relative shrink-0 px-2" style={{ width }}>
      <div className="flex items-center gap-1">
        <button
          onClick={() => handleSort(field)}
          className="flex items-center gap-1 hover:text-foreground transition-colors text-left min-w-0"
        >
          <span className="truncate">{label}</span>
          {sortField === field && (
            <span className="text-primary shrink-0">
              {sortDirection === 'asc' ? (
                <ArrowUpIcon size={10} />
              ) : (
                <ArrowDownIcon size={10} />
              )}
            </span>
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`shrink-0 p-1 rounded hover:bg-accent transition-colors ${
                columnFilters[field]?.length > 0
                  ? 'text-primary'
                  : 'text-muted-foreground/50 hover:text-muted-foreground'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <FilterIcon size={10} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 max-h-[280px] overflow-y-auto rounded-lg shadow-lg"
          >
            {uniqueValuesByColumn[field]?.length > 0 ? (
              uniqueValuesByColumn[field].map((value) => (
                <DropdownMenuCheckboxItem
                  key={value}
                  checked={columnFilters[field]?.includes(value) || false}
                  onCheckedChange={(checked: boolean) =>
                    handleColumnFilterChange(field, value, checked)
                  }
                  className="text-xs"
                >
                  {value}
                </DropdownMenuCheckboxItem>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                No values
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ColumnResizeHandle
        width={width}
        onResize={(next) => setColumnWidth(field, next)}
      />
    </div>
  );

  const dataColumnsTotalWidth = useMemo(
    () =>
      visibleColumnDefs.reduce(
        (sum, col) => sum + (columnWidths[col.key] ?? MIN_COLUMN_PX),
        0,
      ),
    [visibleColumnDefs, columnWidths],
  );
  const level1Width = columnWidths[LEVEL_1_KEY] ?? LEVEL_1_DEFAULT_PX;
  const totalRowWidth = level1Width + dataColumnsTotalWidth;

  return (
    <main className="flex-1 p-4 min-h-[calc(100vh-3.5rem)]">
      <div className="flex gap-0 h-[calc(100vh-7rem)]">
        <div className="flex-1 min-w-0 min-h-0">
          <Card className="h-full rounded-lg flex flex-col gap-0 overflow-hidden shadow-subtle border py-0">
            {/* Header bar — column visibility + batch actions + inline refresh indicator */}
            <div className="shrink-0 flex items-center justify-end gap-2 px-4 py-3 border-b">
              {isRefreshing && (
                <div className="mr-auto flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Refreshing...
                </div>
              )}

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg px-3 gap-2"
                  >
                    <Columns className="h-4 w-4" />
                    <span className="text-xs">Columns</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3" align="end">
                  <div className="space-y-3">
                    <div className="text-xs font-semibold">Column Visibility</div>
                    <div className="space-y-2 bg-muted/70 rounded-md p-2">
                      {toggleableColumns.map((col) => (
                        <div key={col.key} className="flex items-center space-x-2">
                          <Checkbox
                            id={col.key}
                            checked={visibleColumns[col.key]}
                            onCheckedChange={(checked) =>
                              handleColumnVisibilityToggle(col.key, checked as boolean)
                            }
                            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                          <label
                            htmlFor={col.key}
                            className="text-xs cursor-pointer flex-1"
                          >
                            {col.label}
                          </label>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      {Object.values(visibleColumns).filter(Boolean).length} columns visible
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteSelected}
                disabled={selectedIds.length === 0 || isDeletingIds.length > 0}
                className={`h-8 rounded-lg px-3 gap-2 ${
                  selectedIds.length > 0
                    ? 'text-destructive border-destructive/30 hover:bg-destructive/10'
                    : ''
                }`}
              >
                {isDeletingIds.length > 0 ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs">Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span className="text-xs">Delete</span>
                  </>
                )}
              </Button>
            </div>

            {/* Body — sticky header + tree share one horizontal scroll */}
            <CardContent className="flex-1 min-h-0 overflow-auto p-0">
              {summary.length > 0 ? (
                <div style={{ minWidth: totalRowWidth }}>
                  <div className="sticky top-0 z-10 flex items-center py-2 px-3 border-b bg-card text-xs font-semibold text-foreground/70">
                    <div
                      className="relative flex items-center gap-2 shrink-0 pl-1"
                      style={{ width: level1Width }}
                    >
                      <span>Group</span>
                      <ColumnResizeHandle
                        width={level1Width}
                        onResize={(next) => setColumnWidth(LEVEL_1_KEY, next)}
                      />
                    </div>
                    <div className="flex items-center">
                      {visibleColumnDefs.map((col) =>
                        renderFilterableColumnHeader(
                          col.label,
                          col.key,
                          columnWidths[col.key] ?? MIN_COLUMN_PX,
                        ),
                      )}
                    </div>
                  </div>
                  <HierarchicalTable
                    rows={sortedRows}
                    summary={summary}
                    selectedIds={selectedIds}
                    onBatchSelect={handleBatchSelect}
                    isDeletingIds={isDeletingIds}
                    columnDefinitions={visibleColumnDefs}
                    getColumnValue={getColumnValue}
                    columnWidths={columnWidths}
                    level1Width={level1Width}
                    rollup={EXAMPLE_ROLLUP}
                  />
                </div>
              ) : isLoading || isRefreshing ? (
                <div className="flex flex-col items-center justify-center h-[400px] text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                  <p className="text-xs text-muted-foreground">Loading...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] text-center">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-sm font-medium text-foreground mb-1">
                    No data yet
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-[280px]">
                    Replace this empty-state copy with something specific to
                    the target's data shape.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

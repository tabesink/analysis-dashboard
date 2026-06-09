'use client';

/**
 * Single-tier certificate table.
 *
 * Adapts the `database-table` skill template chrome (sticky `bg-card` header,
 * column-resize handles, single-row borders) to a flat one-row-per-certificate
 * surface. The 2-level cert-detail surface lives at
 * `client/src/components/upload/CertificatePagesTable.tsx` and shares the same
 * spacing / typography tokens so the two screens visually rhyme.
 *
 * See `docs/decisions/log.md` DEC-016 for documented deviations from the
 * 3-level template.
 */

import type { CSSProperties } from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  FileSpreadsheet,
  Info,
  Loader2,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { isNeedsReview } from '@/lib/review-status';
import { cn } from '@/lib/utils';
import type {
  CertificateSortField,
  CertificateSummary,
  SortDirection,
} from '@/types/database';
import { ColumnResizeHandle } from './ColumnResizeHandle';

const FALLBACK_COLUMN_PX = 80;
const MIN_COLUMN_PX = 80;
const MAX_COLUMN_PX = 400;
const LEVEL_1_DEFAULT_PX = 320;
const SELECT_COLUMN_PX = 36;
const CHAR_PX = 7.2;
const PADDING_PX = 32;

const LEVEL_1_KEY = '__certificate__';

/**
 * Build a CSS flex spec where the column starts at `basis` px, refuses to
 * shrink below it, and grows proportionally to its basis when the row has
 * leftover space. Result: at any container width, all columns share the row
 * proportionally to their declared widths.
 */
function flexFor(basis: number): CSSProperties {
  return { flex: `${basis} 0 ${basis}px` };
}

const SELECT_CELL_FLEX: CSSProperties = { flex: `0 0 ${SELECT_COLUMN_PX}px` };

type DataColumnKey = 'date_modified' | 'modified_by' | 'notes';

const DATA_COLUMNS: ReadonlyArray<{
  key: DataColumnKey;
  label: string;
  sortField: CertificateSortField | null;
  defaultWidth: number;
}> = [
  { key: 'date_modified', label: 'Date Modified', sortField: 'date_modified', defaultWidth: 160 },
  { key: 'modified_by', label: 'Modified By', sortField: 'modified_by', defaultWidth: 200 },
  { key: 'notes', label: 'Notes', sortField: null, defaultWidth: 120 },
];

interface CertificateFlatTableProps {
  certificates: CertificateSummary[];
  isLoading: boolean;
  isRefreshing: boolean;
  selectedCertificateIds: string[];
  isDeletingSelected: boolean;
  total: number;
  page: number;
  rowsPerPage: number;
  sortField: CertificateSortField;
  sortDirection: SortDirection;
  onChangePage: (next: number) => void;
  onChangeRowsPerPage: (next: number) => void;
  onChangeSort: (field: CertificateSortField, direction: SortDirection) => void;
  onToggleCertificateSelection: (certificateId: string) => void;
  onToggleAllVisibleSelections: (checked: boolean) => void;
  onDeleteSelected: () => void;
  onOpenCertificate: (certificateId: string) => void;
}

export default function CertificateFlatTable({
  certificates,
  isLoading,
  isRefreshing,
  selectedCertificateIds,
  isDeletingSelected,
  total,
  page,
  rowsPerPage,
  sortField,
  sortDirection,
  onChangePage,
  onChangeRowsPerPage,
  onChangeSort,
  onToggleCertificateSelection,
  onToggleAllVisibleSelections,
  onDeleteSelected,
  onOpenCertificate,
}: CertificateFlatTableProps) {
  // User-driven width overrides; columns the user hasn't resized fall back to
  // a content-derived default computed in `derivedWidths`.
  const [columnWidthOverrides, setColumnWidthOverrides] = useState<Record<string, number>>({});

  const derivedWidths = useMemo<Record<string, number>>(() => {
    const next: Record<string, number> = {
      [LEVEL_1_KEY]: LEVEL_1_DEFAULT_PX,
    };
    for (const col of DATA_COLUMNS) {
      const values = certificates.map((cert) => formatColumnValue(cert, col.key));
      next[col.key] = widthForValues(col.label, values, col.defaultWidth);
    }
    return next;
  }, [certificates]);

  const setColumnWidth = useCallback((key: string, next: number) => {
    setColumnWidthOverrides((prev) => (prev[key] === next ? prev : { ...prev, [key]: next }));
  }, []);

  const widthOf = useCallback(
    (key: string) => columnWidthOverrides[key] ?? derivedWidths[key] ?? FALLBACK_COLUMN_PX,
    [columnWidthOverrides, derivedWidths],
  );

  const startRow = useMemo(() => (page - 1) * rowsPerPage + 1, [page, rowsPerPage]);
  const endRow = useMemo(
    () => Math.min(total, (page - 1) * rowsPerPage + certificates.length),
    [certificates.length, page, rowsPerPage, total],
  );
  const hasPrev = page > 1;
  const hasNext = page * rowsPerPage < total;

  const visibleCertificateIds = useMemo(
    () => certificates.map((cert) => String(cert.certificate_id)),
    [certificates],
  );
  const selectedVisibleCount = useMemo(
    () =>
      visibleCertificateIds.filter((id) => selectedCertificateIds.includes(id)).length,
    [selectedCertificateIds, visibleCertificateIds],
  );
  const allVisibleSelected =
    visibleCertificateIds.length > 0 &&
    selectedVisibleCount === visibleCertificateIds.length;
  const hasSelection = selectedCertificateIds.length > 0;

  const level1Width = widthOf(LEVEL_1_KEY);
  const dataColumnsTotalWidth = useMemo(
    () => DATA_COLUMNS.reduce((sum, col) => sum + widthOf(col.key), 0),
    [widthOf],
  );
  const totalRowWidth = SELECT_COLUMN_PX + level1Width + dataColumnsTotalWidth;

  return (
    <Card className="h-full rounded-r-lg rounded-l-none flex flex-col gap-0 overflow-hidden border py-0 shadow-none">
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b">
        <div className="text-xs text-muted-foreground">
          {isRefreshing ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" />
              Refreshing certificates...
            </span>
          ) : (
            'Certificates'
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(rowsPerPage)}
            onValueChange={(value) => onChangeRowsPerPage(Number(value))}
          >
            <SelectTrigger className="h-8 w-[110px] text-xs">
              <SelectValue placeholder="Rows/page" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 rows</SelectItem>
              <SelectItem value="25">25 rows</SelectItem>
              <SelectItem value="50">50 rows</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasSelection || isDeletingSelected}
            onClick={onDeleteSelected}
            className={cn(
              'h-8 rounded-md px-3 gap-2',
              hasSelection && 'text-destructive border-destructive/30 hover:bg-destructive/10',
            )}
          >
            {isDeletingSelected ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span className="text-xs">Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="size-3.5" />
                <span className="text-xs">Delete ({selectedCertificateIds.length})</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <CardContent className="flex-1 min-h-0 overflow-auto p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-xs text-muted-foreground">Loading certificates...</p>
          </div>
        ) : certificates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-1">No certificates yet</h3>
            <p className="text-xs text-muted-foreground max-w-[280px]">
              Upload PDFs from the side panel to start populating this view.
            </p>
          </div>
        ) : (
          <div style={{ minWidth: totalRowWidth }}>
            <div className="sticky top-0 z-10 flex items-center py-2 px-3 border-b bg-card text-xs font-semibold text-foreground/70">
              <div className="flex items-center justify-center" style={SELECT_CELL_FLEX}>
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={(checked) =>
                    onToggleAllVisibleSelections(checked === true)
                  }
                  aria-label="Select all certificates on this page"
                />
              </div>
              <div
                className="relative flex items-center gap-1 pl-1 min-w-0"
                style={flexFor(level1Width)}
              >
                <SortableHeader
                  label="Certificate"
                  field="certificate_name"
                  activeField={sortField}
                  direction={sortDirection}
                  onChangeSort={onChangeSort}
                />
                <ColumnResizeHandle
                  width={level1Width}
                  onResize={(next) => setColumnWidth(LEVEL_1_KEY, next)}
                />
              </div>
              {DATA_COLUMNS.map((col) => (
                <div
                  key={col.key}
                  className="relative px-2 min-w-0"
                  style={flexFor(widthOf(col.key))}
                >
                  {col.sortField ? (
                    <SortableHeader
                      label={col.label}
                      field={col.sortField}
                      activeField={sortField}
                      direction={sortDirection}
                      onChangeSort={onChangeSort}
                    />
                  ) : (
                    <span className="truncate">{col.label}</span>
                  )}
                  <ColumnResizeHandle
                    width={widthOf(col.key)}
                    onResize={(next) => setColumnWidth(col.key, next)}
                  />
                </div>
              ))}
            </div>

            <div>
              {certificates.map((certificate, index) => {
                const certificateId = String(certificate.certificate_id);
                const selected = selectedCertificateIds.includes(certificateId);
                const needsReview = isNeedsReview(certificate.review_status);
                const isLast = index === certificates.length - 1;

                return (
                  <div
                    key={certificateId}
                    className={cn(
                      'flex items-center py-1.5 px-3 border-b hover:bg-muted/30 transition-colors group',
                      isLast && 'border-b-0',
                    )}
                  >
                    <div className="flex items-center justify-center" style={SELECT_CELL_FLEX}>
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => onToggleCertificateSelection(certificateId)}
                        aria-label={`Select ${certificate.certificate_name}`}
                      />
                    </div>
                    <div
                      className="flex items-center gap-2 pl-1 min-w-0"
                      style={flexFor(level1Width)}
                    >
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 text-left text-xs font-medium text-foreground hover:text-primary transition-colors min-w-0"
                        onClick={() => onOpenCertificate(certificateId)}
                      >
                        <StatusIcon needsReview={needsReview} />
                        <span className="truncate" title={certificate.certificate_name}>
                          {certificate.certificate_name}
                        </span>
                      </button>
                    </div>
                    {DATA_COLUMNS.map((col) => (
                      <div
                        key={col.key}
                        className="px-2 min-w-0"
                        style={flexFor(widthOf(col.key))}
                      >
                        {col.key === 'notes' ? (
                          certificate.notes ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  aria-label="View note"
                                >
                                  <Info className="size-3.5" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-72 text-xs">
                                {certificate.notes}
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )
                        ) : (
                          <span
                            className="block truncate text-xs text-foreground/80"
                            title={formatColumnValue(certificate, col.key)}
                          >
                            {formatColumnValue(certificate, col.key) || '-'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>

      <div className="shrink-0 flex items-center justify-between border-t px-4 py-3 text-xs">
        <div className="text-muted-foreground">
          {total === 0 ? '0 results' : `${startRow}-${endRow} of ${total}`}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPrev}
            onClick={() => onChangePage(page - 1)}
            className="h-8 rounded-md px-3 text-xs"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNext}
            onClick={() => onChangePage(page + 1)}
            className="h-8 rounded-md px-3 text-xs"
          >
            Next
          </Button>
        </div>
      </div>
    </Card>
  );
}

function SortableHeader({
  label,
  field,
  activeField,
  direction,
  onChangeSort,
}: {
  label: string;
  field: CertificateSortField;
  activeField: CertificateSortField;
  direction: SortDirection;
  onChangeSort: (field: CertificateSortField, direction: SortDirection) => void;
}) {
  const isActive = activeField === field;
  const nextDirection: SortDirection = isActive && direction === 'desc' ? 'asc' : 'desc';

  return (
    <button
      type="button"
      className="flex items-center gap-1 hover:text-foreground transition-colors text-left min-w-0"
      onClick={() => onChangeSort(field, nextDirection)}
      aria-label={`Sort ${label}`}
    >
      <span className="truncate">{label}</span>
      {isActive ? (
        direction === 'desc' ? (
          <ArrowDown className="size-3 text-primary shrink-0" />
        ) : (
          <ArrowUp className="size-3 text-primary shrink-0" />
        )
      ) : (
        <ArrowUpDown className="size-3 text-muted-foreground/60 shrink-0" />
      )}
    </button>
  );
}

function StatusIcon({ needsReview }: { needsReview: boolean }) {
  if (!needsReview) {
    return <span className="inline-block size-3.5" />;
  }
  return (
    <AlertTriangle
      className="size-3.5 text-muted-foreground shrink-0"
      aria-label="Needs review"
    />
  );
}

function formatColumnValue(certificate: CertificateSummary, key: DataColumnKey): string {
  switch (key) {
    case 'date_modified':
      return formatDate(certificate.date_modified);
    case 'modified_by':
      return certificate.modified_by ?? '';
    case 'notes':
      return certificate.notes ?? '';
    default:
      return '';
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

function widthForValues(label: string, values: string[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  const longest = values.reduce(
    (max, v) => Math.max(max, v.length),
    label.length,
  );
  return Math.min(
    MAX_COLUMN_PX,
    Math.max(MIN_COLUMN_PX, Math.ceil(longest * CHAR_PX) + PADDING_PX),
  );
}

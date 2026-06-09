'use client';

/**
 * 2-level (Page > Table) hierarchical card for the cert detail surface.
 *
 * Structure ported from `.cursor/skills/database-table/templates/HierarchicalTable.two-level.tsx`
 * and the locked decisions in `docs/decisions/log.md` DEC-016:
 *
 *   - Page Subgroup row (level 1) carries the 7 page-metadata cells.
 *     Indeterminate batch checkboxes are intentionally omitted (selection
 *     scope is certificates only, edited from `/database`).
 *   - Table Leaf row (level 2) shows only "Table N" link in the first cell;
 *     all 7 data column cells render empty (no dashes), per the locked plan.
 *   - Failed pages: the Page Subgroup row gets an `<AlertTriangle>` next to
 *     its label; expanding shows a single Leaf row "Table N - Open in fix mode"
 *     wired to `onOpenFailedTable`.
 *   - Tables lazy-load via `usePageTables` only when the page is in
 *     `expandedPageIds`.
 *
 * Indent tokens copied verbatim from `.cursor/skills/database-table/tokens.md`.
 */

import type { CSSProperties } from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  FileSpreadsheet,
  Loader2,
  TableProperties,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePageTables } from '@/hooks/use-certificate-hierarchy';
import { ApiError } from '@/lib/api/client';
import { isNeedsReview } from '@/lib/review-status';
import { cn } from '@/lib/utils';
import type {
  FailureKind,
  PageIngestFailure,
  PageSummary,
  TableSummary,
} from '@/types/database';
import { ColumnResizeHandle } from './ColumnResizeHandle';

const FALLBACK_COLUMN_PX = 80;
const MIN_COLUMN_PX = 80;
const MAX_COLUMN_PX = 400;
const LEVEL_1_DEFAULT_PX = 200;
const CHAR_PX = 7.2;
const PADDING_PX = 32;

const LEVEL_1_KEY = '__page__';

/**
 * Build a CSS flex spec where the column starts at `basis` px, refuses to
 * shrink below it, and grows proportionally to its basis when the row has
 * leftover space. Same helper as `CertificateFlatTable` so both surfaces
 * distribute width identically.
 */
function flexFor(basis: number): CSSProperties {
  return { flex: `${basis} 0 ${basis}px` };
}

type DataColumnKey =
  | 'order_item'
  | 'part_num'
  | 'descrip'
  | 'die_num'
  | 'alloy_temper'
  | 'cert_code'
  | 'applicable_specs';

interface DataColumnDef {
  key: DataColumnKey;
  label: string;
  defaultWidth: number;
}

const DATA_COLUMNS: ReadonlyArray<DataColumnDef> = [
  { key: 'order_item', label: 'Order Item #', defaultWidth: 130 },
  { key: 'part_num', label: 'Part #', defaultWidth: 120 },
  { key: 'descrip', label: 'Description', defaultWidth: 240 },
  { key: 'die_num', label: 'Die #', defaultWidth: 110 },
  { key: 'alloy_temper', label: 'Alloy/Temper', defaultWidth: 140 },
  { key: 'cert_code', label: 'Cert Code', defaultWidth: 120 },
  { key: 'applicable_specs', label: 'Applicable Specs', defaultWidth: 200 },
];

interface CertificatePagesTableProps {
  certificateName: string;
  certificateMetadata: { dateModified: string; modifiedBy: string; notes: string | null };
  pages: PageSummary[];
  failuresByPageNumber: Map<number, PageIngestFailure>;
  expandedPageIds: string[];
  isLoading: boolean;
  isRefreshing: boolean;
  onTogglePage: (pageId: string) => void;
  onOpenTable: (tableId: string) => void;
  onOpenFailedTable: (params: {
    tableId: string;
    certificateId: string;
    pageNumber: number;
    failureKind: FailureKind;
  }) => void;
  onBack: () => void;
  certificateId: string;
}

export default function CertificatePagesTable({
  certificateName,
  certificateMetadata,
  pages,
  failuresByPageNumber,
  expandedPageIds,
  isLoading,
  isRefreshing,
  onTogglePage,
  onOpenTable,
  onOpenFailedTable,
  onBack,
  certificateId,
}: CertificatePagesTableProps) {
  const [columnWidthOverrides, setColumnWidthOverrides] = useState<Record<string, number>>({});

  const derivedWidths = useMemo<Record<string, number>>(() => {
    const next: Record<string, number> = {
      [LEVEL_1_KEY]: LEVEL_1_DEFAULT_PX,
    };
    for (const col of DATA_COLUMNS) {
      const values = pages.map((page) => readPageColumn(page, col.key));
      next[col.key] = widthForValues(col.label, values, col.defaultWidth);
    }
    return next;
  }, [pages]);

  const setColumnWidth = useCallback((key: string, next: number) => {
    setColumnWidthOverrides((prev) => (prev[key] === next ? prev : { ...prev, [key]: next }));
  }, []);

  const widthOf = useCallback(
    (key: string) => columnWidthOverrides[key] ?? derivedWidths[key] ?? FALLBACK_COLUMN_PX,
    [columnWidthOverrides, derivedWidths],
  );

  const level1Width = widthOf(LEVEL_1_KEY);
  const dataColumnsTotalWidth = useMemo(
    () => DATA_COLUMNS.reduce((sum, col) => sum + widthOf(col.key), 0),
    [widthOf],
  );
  const totalRowWidth = level1Width + dataColumnsTotalWidth;

  const expandedSet = useMemo(() => new Set(expandedPageIds), [expandedPageIds]);

  return (
    <Card className="h-full rounded-r-lg rounded-l-none flex flex-col gap-0 overflow-hidden border py-0">
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b">
        <div className="min-w-0">
          <h2
            className="truncate text-sm font-semibold text-foreground"
            title={certificateName}
          >
            {certificateName}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            <MetadataStrip metadata={certificateMetadata} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRefreshing ? (
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Refreshing...
            </span>
          ) : null}
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="size-4" />
            Return
          </Button>
        </div>
      </div>

      <CardContent className="flex-1 min-h-0 overflow-auto p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-xs text-muted-foreground">Loading pages...</p>
          </div>
        ) : pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-1">No pages found</h3>
            <p className="text-xs text-muted-foreground max-w-[280px]">
              This certificate has no pages on record yet.
            </p>
          </div>
        ) : (
          <div style={{ minWidth: totalRowWidth }}>
            <div className="sticky top-0 z-10 flex items-center py-2 px-3 border-b bg-card text-xs font-semibold text-foreground/70">
              <div
                className="relative flex items-center gap-1 pl-1 min-w-0"
                style={flexFor(level1Width)}
              >
                <span className="truncate">Page</span>
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
                  <span className="truncate">{col.label}</span>
                  <ColumnResizeHandle
                    width={widthOf(col.key)}
                    onResize={(next) => setColumnWidth(col.key, next)}
                  />
                </div>
              ))}
            </div>

            <PagesTree
              pages={pages}
              failuresByPageNumber={failuresByPageNumber}
              expandedSet={expandedSet}
              onTogglePage={onTogglePage}
              onOpenTable={onOpenTable}
              onOpenFailedTable={onOpenFailedTable}
              certificateId={certificateId}
              level1Width={level1Width}
              widthOf={widthOf}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetadataStrip({
  metadata,
}: {
  metadata: { dateModified: string; modifiedBy: string; notes: string | null };
}) {
  const parts: string[] = [];
  const dateText = formatDate(metadata.dateModified);
  if (dateText) parts.push(`Modified ${dateText}`);
  if (metadata.modifiedBy) parts.push(`by ${metadata.modifiedBy}`);
  if (metadata.notes) parts.push(metadata.notes);
  const text = parts.join(' \u2022 ') || '\u2014';
  return <span title={text}>{text}</span>;
}

interface PagesTreeProps {
  pages: PageSummary[];
  failuresByPageNumber: Map<number, PageIngestFailure>;
  expandedSet: Set<string>;
  onTogglePage: (pageId: string) => void;
  onOpenTable: (tableId: string) => void;
  onOpenFailedTable: (params: {
    tableId: string;
    certificateId: string;
    pageNumber: number;
    failureKind: FailureKind;
  }) => void;
  certificateId: string;
  level1Width: number;
  widthOf: (key: string) => number;
}

function PagesTree({
  pages,
  failuresByPageNumber,
  expandedSet,
  onTogglePage,
  onOpenTable,
  onOpenFailedTable,
  certificateId,
  level1Width,
  widthOf,
}: PagesTreeProps) {
  return (
    <div className="w-full">
      {pages.map((page, pageIndex) => {
        const pageId = String(page.page_id);
        const isOpen = expandedSet.has(pageId);
        const failure = failuresByPageNumber.get(page.page_number) ?? null;
        const needsReview = failure !== null || isNeedsReview(page.review_status);
        const isLastPage = pageIndex === pages.length - 1;
        const suppressLastRowBorder = !isLastPage;
        const groupRowIsGroupTail = !isOpen;

        return (
          <Collapsible
            key={pageId}
            open={isOpen}
            onOpenChange={() => onTogglePage(pageId)}
          >
            <div
              className={cn(
                'flex items-center py-2 px-3 border-t border-b bg-muted/60 hover:bg-muted/70 transition-colors',
                pageIndex === 0 && '-mt-px',
                groupRowIsGroupTail && suppressLastRowBorder && 'border-b-0',
              )}
            >
              <div
                className="flex items-center gap-2 pl-1 min-w-0"
                style={flexFor(level1Width)}
              >
                <CollapsibleTrigger className="p-0.5 hover:bg-muted rounded-sm transition-colors">
                  <ChevronDown
                    className={cn(
                      'size-3.5 text-muted-foreground transition-transform duration-200',
                      !isOpen && '-rotate-90',
                    )}
                  />
                </CollapsibleTrigger>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-xs font-medium text-foreground select-none cursor-pointer min-w-0"
                  onClick={() => onTogglePage(pageId)}
                >
                  <StatusIcon needsReview={needsReview} />
                  <span className="truncate">Page {page.page_number}</span>
                  {failure ? (
                    <span
                      className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground"
                      title={failure.failure_reason}
                    >
                      <AlertTriangle className="size-3" aria-hidden="true" />
                      {failure.failure_kind}
                    </span>
                  ) : null}
                </button>
              </div>
              {DATA_COLUMNS.map((col) => {
                const value = readPageColumn(page, col.key);
                return (
                  <span
                    key={col.key}
                    className="truncate text-xs text-foreground/80 px-2 min-w-0"
                    style={flexFor(widthOf(col.key))}
                    title={value}
                  >
                    {value || '-'}
                  </span>
                );
              })}
            </div>

            <CollapsibleContent>
              {failure ? (
                <FailedPageLeafRow
                  certificateId={certificateId}
                  pageId={pageId}
                  failure={failure}
                  onOpenFailedTable={onOpenFailedTable}
                  level1Width={level1Width}
                  widthOf={widthOf}
                  isGroupTail={isLastPage}
                  suppressLastRowBorder={suppressLastRowBorder}
                />
              ) : (
                <PageTablesLeafRows
                  pageId={pageId}
                  onOpenTable={onOpenTable}
                  level1Width={level1Width}
                  widthOf={widthOf}
                  isLastPage={isLastPage}
                  suppressLastRowBorder={suppressLastRowBorder}
                />
              )}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

function FailedPageLeafRow({
  certificateId,
  pageId,
  failure,
  onOpenFailedTable,
  level1Width,
  widthOf,
  isGroupTail,
  suppressLastRowBorder,
}: {
  certificateId: string;
  pageId: string;
  failure: PageIngestFailure;
  onOpenFailedTable: (params: {
    tableId: string;
    certificateId: string;
    pageNumber: number;
    failureKind: FailureKind;
  }) => void;
  level1Width: number;
  widthOf: (key: string) => number;
  isGroupTail: boolean;
  suppressLastRowBorder: boolean;
}) {
  const tableNumber = extractTableNumberFromCsvPath(failure.source_csv_path) ?? 1;
  const tableId = `${pageId}:${tableNumber}`;
  return (
    <div
      className={cn(
        'flex items-center py-1.5 px-3 border-b hover:bg-muted/30 transition-colors group',
        isGroupTail && suppressLastRowBorder && 'border-b-0',
      )}
    >
      <div
        className="flex items-center gap-2 pl-[20px] border-l border-border min-w-0"
        style={flexFor(level1Width)}
      >
        <button
          type="button"
          className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors min-w-0"
          onClick={() =>
            onOpenFailedTable({
              tableId,
              certificateId,
              pageNumber: failure.page_number,
              failureKind: failure.failure_kind,
            })
          }
        >
          <AlertTriangle className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
          <TableProperties className="size-3.5 text-muted-foreground shrink-0" />
          <span className="truncate font-medium">
            {`Table ${tableNumber} \u2014 Open in fix mode`}
          </span>
        </button>
      </div>
      {DATA_COLUMNS.map((col) => (
        <span
          key={col.key}
          className="px-2 min-w-0"
          style={flexFor(widthOf(col.key))}
        />
      ))}
    </div>
  );
}

function PageTablesLeafRows({
  pageId,
  onOpenTable,
  level1Width,
  widthOf,
  isLastPage,
  suppressLastRowBorder,
}: {
  pageId: string;
  onOpenTable: (tableId: string) => void;
  level1Width: number;
  widthOf: (key: string) => number;
  isLastPage: boolean;
  suppressLastRowBorder: boolean;
}) {
  const tablesQuery = usePageTables(pageId, true);

  if (tablesQuery.isLoading) {
    return (
      <div
        className={cn(
          'flex items-center py-1.5 px-3 border-b text-xs text-muted-foreground',
          isLastPage && suppressLastRowBorder && 'border-b-0',
        )}
      >
        <span
          className="pl-[20px] border-l border-border min-w-0"
          style={flexFor(level1Width)}
        >
          Loading tables...
        </span>
      </div>
    );
  }

  if (tablesQuery.isError) {
    const message =
      tablesQuery.error instanceof ApiError
        ? tablesQuery.error.message
        : tablesQuery.error instanceof Error
          ? tablesQuery.error.message
          : 'Unknown error';
    return (
      <div
        className={cn(
          'flex items-center py-1.5 px-3 border-b text-xs text-destructive',
          isLastPage && suppressLastRowBorder && 'border-b-0',
        )}
      >
        <span
          className="pl-[20px] border-l border-border min-w-0 truncate"
          style={flexFor(level1Width)}
          title={message}
        >
          Failed to load tables: {message}
        </span>
      </div>
    );
  }

  const tables = tablesQuery.data?.items ?? [];

  if (tables.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center py-1.5 px-3 border-b text-xs text-muted-foreground',
          isLastPage && suppressLastRowBorder && 'border-b-0',
        )}
      >
        <span
          className="pl-[20px] border-l border-border min-w-0"
          style={flexFor(level1Width)}
        >
          No tables found for this page.
        </span>
      </div>
    );
  }

  return (
    <>
      {tables.map((table, tableIndex) => {
        const isLastTable = tableIndex === tables.length - 1;
        const isGroupTail = isLastPage && isLastTable;
        return (
          <TableLeafRow
            key={table.table_id}
            table={table}
            onOpenTable={onOpenTable}
            level1Width={level1Width}
            widthOf={widthOf}
            isGroupTail={isGroupTail}
            suppressLastRowBorder={suppressLastRowBorder}
          />
        );
      })}
    </>
  );
}

function TableLeafRow({
  table,
  onOpenTable,
  level1Width,
  widthOf,
  isGroupTail,
  suppressLastRowBorder,
}: {
  table: TableSummary;
  onOpenTable: (tableId: string) => void;
  level1Width: number;
  widthOf: (key: string) => number;
  isGroupTail: boolean;
  suppressLastRowBorder: boolean;
}) {
  const needsReview = isNeedsReview(table.review_status);

  return (
    <div
      className={cn(
        'flex items-center py-1.5 px-3 border-b hover:bg-muted/30 transition-colors group',
        isGroupTail && suppressLastRowBorder && 'border-b-0',
      )}
    >
      <div
        className="flex items-center gap-2 pl-[20px] border-l border-border min-w-0"
        style={flexFor(level1Width)}
      >
        <button
          type="button"
          className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors min-w-0"
          onClick={() => onOpenTable(table.table_id)}
        >
          <StatusIcon needsReview={needsReview} />
          <TableProperties className="size-3.5 text-muted-foreground shrink-0" />
          <span
            className={cn(
              'truncate font-medium underline decoration-dotted',
              needsReview ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            Table {table.table_number}
          </span>
        </button>
      </div>
      {DATA_COLUMNS.map((col) => (
        <span
          key={col.key}
          className="px-2 min-w-0"
          style={flexFor(widthOf(col.key))}
        />
      ))}
    </div>
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

function readPageColumn(page: PageSummary, key: DataColumnKey): string {
  const augmented = page as PageSummary & {
    applicable_specification?: string | null;
    applicable_specs?: string | null;
  };
  switch (key) {
    case 'order_item':
      return cleanCell(page.order_item);
    case 'part_num':
      return cleanCell(page.part_num);
    case 'descrip':
      return cleanCell(page.descrip);
    case 'die_num':
      return cleanCell(page.die_num);
    case 'alloy_temper':
      return cleanCell(page.alloy_temper);
    case 'cert_code':
      return cleanCell(page.cert_code);
    case 'applicable_specs':
      return cleanCell(
        augmented.applicable_specification ?? augmented.applicable_specs ?? null,
      );
    default:
      return '';
  }
}

function cleanCell(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return '';
  return trimmed.length <= 80 ? trimmed : `${trimmed.slice(0, 80)}...`;
}

function extractTableNumberFromCsvPath(path: string | null | undefined): number | null {
  if (!path) return null;
  const match = /table_(\d+)\.csv$/.exec(path);
  return match ? Number(match[1]) : null;
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

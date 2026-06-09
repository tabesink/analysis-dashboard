'use client';

import Handsontable from 'handsontable/base';
import { HotTable } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Plus, RotateCcw, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type {
  CommitFailedPageRequest,
  PageMetadataPayload,
  RawCsvPayload,
} from '@/types/database';

registerAllModules();

const CANONICAL_COLUMNS: string[] = [
  'TicketNum',
  'SampleID',
  'Lot Num',
  'Cast Num',
  'Ult',
  'Yield',
  'Elong',
  'Bend',
  'Hard',
  'Si',
  'Fe',
  'Cu',
  'Mn',
  'Mg',
  'Cr',
  'Zn',
  'V',
  'Ti',
  'Other',
];

const NUMERIC_COLUMNS = new Set([
  'Ult',
  'Yield',
  'Elong',
  'Bend',
  'Hard',
  'Si',
  'Fe',
  'Cu',
  'Mn',
  'Mg',
  'Cr',
  'Zn',
  'V',
  'Ti',
  'Other',
]);

const EXTRA_PREFIX = '__extra_';

type CellMap = Record<string, string>;

interface RowState {
  id: string;
  values: CellMap;
  extras: CellMap;
}

interface FailedPageEditorProps {
  csvPayload: RawCsvPayload;
  initialMetadata: PageMetadataPayload;
  isSaving: boolean;
  onCommit: (payload: CommitFailedPageRequest) => Promise<void>;
  // Optional callback fired when the user clicks Reset. The editor always
  // resets local state from the current csvPayload + initialMetadata; the
  // parent may additionally re-fetch the CSV from disk to discard any in-flight
  // server-side mutations the user no longer wants to keep.
  onReset?: () => void;
}

interface RowValidation {
  hasError: boolean;
  errorsByColumn: Record<string, string>;
}

export default function FailedPageEditor({
  csvPayload,
  initialMetadata,
  isSaving,
  onCommit,
  onReset,
}: FailedPageEditorProps) {
  const initialExtraColumns = useMemo(
    () => csvPayload.header.filter((column) => column.startsWith(EXTRA_PREFIX)),
    [csvPayload.header],
  );

  const [extraColumns, setExtraColumns] = useState<string[]>(initialExtraColumns);
  const [rows, setRows] = useState<RowState[]>(() => buildInitialRows(csvPayload));

  useEffect(() => {
    setRows(buildInitialRows(csvPayload));
    setExtraColumns(initialExtraColumns);
  }, [csvPayload, initialExtraColumns]);

  const validations = useMemo(
    () => rows.map((row) => validateRow(row, extraColumns)),
    [rows, extraColumns],
  );

  const allValid = validations.every((entry) => !entry.hasError) && rows.length > 0;

  const columns = useMemo(
    () => [...CANONICAL_COLUMNS, ...extraColumns],
    [extraColumns],
  );

  // Stable refs for Handsontable callbacks so we don't unmount/remount the
  // grid on every render (loses selection state and copy buffer otherwise).
  const rowsRef = useRef(rows);
  const validationsRef = useRef(validations);
  const extraColumnsRef = useRef(extraColumns);
  const columnsRef = useRef(columns);
  useEffect(() => {
    rowsRef.current = rows;
    validationsRef.current = validations;
    extraColumnsRef.current = extraColumns;
    columnsRef.current = columns;
  });

  const data = useMemo(
    () =>
      rows.map((row) =>
        columns.map((column) => readCell(row, column)),
      ),
    [rows, columns],
  );

  function addRow() {
    setRows((current) => [...current, blankRow(extraColumnsRef.current)]);
  }

  function deleteExtraColumn(column: string) {
    setExtraColumns((current) => current.filter((entry) => entry !== column));
    setRows((current) =>
      current.map((row) => {
        if (!(column in row.extras)) {
          return row;
        }
        const rest: CellMap = {};
        for (const [key, value] of Object.entries(row.extras)) {
          if (key !== column) {
            rest[key] = value;
          }
        }
        return { ...row, extras: rest };
      }),
    );
  }

  async function handleCommit() {
    if (!allValid) {
      return;
    }
    const payload: CommitFailedPageRequest = {
      page_metadata: initialMetadata,
      table_number: csvPayload.table_number,
      rows: rows.map((row) => buildSubmitRow(row)),
    };
    await onCommit(payload);
  }

  function handleReset() {
    setRows(buildInitialRows(csvPayload));
    setExtraColumns(initialExtraColumns);
    onReset?.();
  }

  function applyChanges(
    changes: Handsontable.CellChange[] | null,
    source: Handsontable.ChangeSource,
  ) {
    if (!changes || source === 'loadData') {
      return;
    }
    setRows((current) => {
      const next = current.map((row) => ({
        ...row,
        values: { ...row.values },
        extras: { ...row.extras },
      }));
      const cols = columnsRef.current;
      for (const change of changes) {
        const [rowIndex, prop, , nextValue] = change;
        const colIndex = Number(prop);
        const column = cols[colIndex];
        if (column === undefined) {
          continue;
        }
        const target = next[rowIndex];
        if (!target) {
          continue;
        }
        const stringified =
          nextValue === null || nextValue === undefined
            ? ''
            : typeof nextValue === 'string'
              ? nextValue
              : String(nextValue);
        if (column.startsWith(EXTRA_PREFIX)) {
          target.extras[column] = stringified;
        } else {
          target.values[column] = stringified;
        }
      }
      return next;
    });
  }

  function handleRemoveRow(index: number, amount: number) {
    setRows((current) => {
      const next = current.slice();
      next.splice(index, amount);
      return next;
    });
  }

  function guardRemoveCol(index: number, amount: number): boolean {
    const cols = columnsRef.current;
    const targets = cols.slice(index, index + amount);
    const blocked = targets.filter((column) => !column.startsWith(EXTRA_PREFIX));
    if (blocked.length > 0) {
      toast.error(
        `Only __extra_* OCR-drift columns can be removed (blocked: ${blocked.join(', ')}).`,
      );
      return false;
    }
    return true;
  }

  function handleRemoveCol(index: number, amount: number) {
    const cols = columnsRef.current;
    const removed = cols.slice(index, index + amount).filter((column) =>
      column.startsWith(EXTRA_PREFIX),
    );
    if (removed.length === 0) {
      return;
    }
    setExtraColumns((current) => current.filter((column) => !removed.includes(column)));
    setRows((current) =>
      current.map((row) => {
        const nextExtras: CellMap = {};
        for (const [key, value] of Object.entries(row.extras)) {
          if (!removed.includes(key)) {
            nextExtras[key] = value;
          }
        }
        return { ...row, extras: nextExtras };
      }),
    );
  }

  return (
    <div className="space-y-4">
      {extraColumns.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-md border bg-muted p-3 text-xs text-foreground">
          <div className="flex items-start gap-2">
            <AlertTriangle
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p>
              OCR drift columns detected. Copy salvageable values into the canonical
              column, then remove each <code>__extra_*</code> column with the chip
              below or by right-clicking its header. Commit is blocked while extras
              remain.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 pl-6">
            {extraColumns.map((column) => (
              <button
                key={column}
                type="button"
                onClick={() => deleteExtraColumn(column)}
                className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px] text-foreground transition-colors hover:bg-accent"
                aria-label={`Remove drift column ${column}`}
                title={`Remove drift column ${column}`}
              >
                <span>{column}</span>
                <X className="size-3" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {rows.length} row(s){' '}
          {extraColumns.length > 0 ? `\u00b7 ${extraColumns.length} extra column(s)` : ''}
          {' \u00b7 '}Right-click for row actions
          {extraColumns.length > 0 ? ' or to remove a drift column' : ''}.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isSaving}
            title="Discard local edits and reload the on-disk CSV evidence."
          >
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={isSaving}>
            <Plus className="size-3.5" />
            Add row
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleCommit}
            disabled={!allValid || extraColumns.length > 0 || isSaving}
            title={
              extraColumns.length > 0
                ? 'Delete all __extra_* columns before committing.'
                : !allValid
                  ? 'All rows must be valid before committing.'
                  : undefined
            }
          >
            <Save className="size-3.5" />
            Commit
          </Button>
        </div>
      </div>

      <div className="rounded border">
        <HotTable
          data={data}
          colHeaders={columns}
          rowHeaders={true}
          stretchH="all"
          height="60vh"
          licenseKey="non-commercial-and-evaluation"
          contextMenu={['row_above', 'row_below', 'remove_row', '---------', 'remove_col']}
          cells={(row, col) => {
            const cellMeta: Handsontable.CellMeta = {} as Handsontable.CellMeta;
            const column = columnsRef.current[col];
            if (!column) {
              return cellMeta;
            }
            const validation = validationsRef.current[row];
            const classNames: string[] = [];
            if (column.startsWith(EXTRA_PREFIX)) {
              classNames.push('htDimmed');
            }
            if (validation && validation.errorsByColumn[column]) {
              classNames.push('htInvalid');
            }
            if (classNames.length > 0) {
              cellMeta.className = classNames.join(' ');
            }
            return cellMeta;
          }}
          afterChange={applyChanges}
          afterRemoveRow={handleRemoveRow}
          beforeRemoveCol={guardRemoveCol}
          afterRemoveCol={handleRemoveCol}
        />
      </div>
    </div>
  );
}

function buildInitialRows(payload: RawCsvPayload): RowState[] {
  const headerToIndex = new Map<string, number>();
  payload.header.forEach((column, index) => {
    headerToIndex.set(column, index);
  });

  return payload.rows.map((rawRow) => {
    const values: CellMap = {};
    for (const column of CANONICAL_COLUMNS) {
      const index = headerToIndex.get(column);
      values[column] = index !== undefined ? (rawRow[index] ?? '') : '';
    }
    const extras: CellMap = {};
    for (const column of payload.header) {
      if (!column.startsWith(EXTRA_PREFIX)) {
        continue;
      }
      const index = headerToIndex.get(column);
      extras[column] = index !== undefined ? (rawRow[index] ?? '') : '';
    }
    return { id: nextRowId(), values, extras };
  });
}

function blankRow(extraColumns: string[]): RowState {
  const values: CellMap = {};
  for (const column of CANONICAL_COLUMNS) {
    values[column] = '';
  }
  const extras: CellMap = {};
  for (const column of extraColumns) {
    extras[column] = '';
  }
  return { id: nextRowId(), values, extras };
}

function readCell(row: RowState, column: string): string {
  if (column.startsWith(EXTRA_PREFIX)) {
    return row.extras[column] ?? '';
  }
  return row.values[column] ?? '';
}

function validateRow(row: RowState, extraColumns: string[]): RowValidation {
  const errorsByColumn: Record<string, string> = {};

  for (const column of CANONICAL_COLUMNS) {
    const raw = (row.values[column] ?? '').trim();
    if (raw === '') {
      errorsByColumn[column] = 'Required';
      continue;
    }
    if (raw.toLowerCase() === 'nan') {
      errorsByColumn[column] = 'NaN not allowed';
      continue;
    }
    if (NUMERIC_COLUMNS.has(column)) {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        errorsByColumn[column] = 'Must be numeric';
      }
    }
  }

  if (extraColumns.length > 0) {
    errorsByColumn.__extras__ = 'Delete __extra_* columns before commit';
  }

  return {
    hasError: Object.keys(errorsByColumn).length > 0,
    errorsByColumn,
  };
}

function buildSubmitRow(row: RowState): Record<string, string | number | null> {
  const result: Record<string, string | number | null> = {};
  for (const column of CANONICAL_COLUMNS) {
    const raw = (row.values[column] ?? '').trim();
    if (NUMERIC_COLUMNS.has(column)) {
      const parsed = Number(raw);
      result[column] = Number.isFinite(parsed) ? parsed : raw;
    } else {
      result[column] = raw;
    }
  }
  return result;
}

let _rowIdCounter = 0;

function nextRowId(): string {
  _rowIdCounter += 1;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `row-${_rowIdCounter}-${Date.now()}`;
}

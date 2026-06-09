'use client';

import Handsontable from 'handsontable/base';
import { HotTable } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';
import type { TableResultRow } from '@/types/database';

registerAllModules();

interface TableResultsEditorProps {
  columns: string[];
  rows: TableResultRow[];
  onRowsChange: (rows: TableResultRow[]) => void;
}

const NUMERIC_FIELDS = new Set([
  'ult',
  'yield',
  'elong',
  'bend',
  'hard',
  'si',
  'fe',
  'cu',
  'mn',
  'mg',
  'cr',
  'zn',
  'v',
  'ti',
  'other',
]);

const READ_ONLY_FIELDS = new Set(['ticket_num', 'sample_id', 'lot_num', 'cast_num']);

export default function TableResultsEditor({
  columns,
  rows,
  onRowsChange,
}: TableResultsEditorProps) {
  const effectiveColumns = columns.length > 0 ? columns : inferColumns(rows);
  const data = rows.map((row) => effectiveColumns.map((column) => getCellValue(row, column)));

  const columnSettings = effectiveColumns.map((columnName) => ({
    readOnly: READ_ONLY_FIELDS.has(columnName),
  }));

  return (
    <HotTable
      data={data}
      colHeaders={effectiveColumns}
      columns={columnSettings}
      rowHeaders={true}
      stretchH="all"
      height="70vh"
      licenseKey="non-commercial-and-evaluation"
      contextMenu={['row_above', 'row_below', 'remove_row']}
      afterChange={(changes, source) => {
        if (!changes || source === 'loadData') {
          return;
        }

        const nextRows = rows.map((row) => ({ ...row }));

        for (const change of changes) {
          const rowIndex = change[0];
          const columnIndex = Number(change[1]);
          const nextValue = change[3];
          const field = effectiveColumns[columnIndex];
          if (!field || !(field in nextRows[rowIndex])) {
            continue;
          }

          if (NUMERIC_FIELDS.has(field)) {
            const parsed = normalizeNumeric(nextValue);
            (nextRows[rowIndex] as unknown as Record<string, unknown>)[field] = parsed;
          } else {
            (nextRows[rowIndex] as unknown as Record<string, unknown>)[field] =
              typeof nextValue === 'string' ? nextValue : String(nextValue ?? '');
          }
        }

        onRowsChange(nextRows);
      }}
      afterRemoveRow={(index, amount) => {
        const nextRows = rows.slice();
        nextRows.splice(index, amount);
        onRowsChange(nextRows);
      }}
    />
  );
}

function inferColumns(rows: TableResultRow[]): string[] {
  if (rows.length === 0) {
    return [];
  }
  return Object.keys(rows[0]).filter((key) => key !== 'result_row_id');
}

function getCellValue(row: TableResultRow, column: string): string | number | null {
  if (!(column in row)) {
    return '';
  }
  const value = (row as unknown as Record<string, unknown>)[column];
  if (typeof value === 'number' || typeof value === 'string' || value === null) {
    return value;
  }
  return '';
}

function normalizeNumeric(value: Handsontable.CellValue): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}


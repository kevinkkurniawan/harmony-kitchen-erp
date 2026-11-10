'use client';

import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import ColumnFilterRow from '@/components/ColumnFilterRow';
import { fmtDate, fmtN0 } from './format';
import { lx } from './LegacyWindow';

export interface LegacyColumn<T> {
  key: string;
  /** Old column caption, exactly as in Module Manager */
  caption: React.ReactNode;
  format?: 'text' | 'n0' | 'date';
  align?: 'left' | 'right' | 'center';
  /** Custom cell; defaults to row[key] formatted with `format` */
  render?: (row: T) => React.ReactNode;
  /** Sort key passed to onSort; omit to make the header not sortable */
  sortKey?: string;
  /** Server filter key for the auto-filter row (f_<key>) */
  filterKey?: string;
  /** Footer cell: a value already summed by the caller, or any node */
  footer?: React.ReactNode;
  width?: number;
}

interface LegacyGridProps<T> {
  isDark: boolean;
  columns: LegacyColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  emptyText?: string;
  focusedKey?: string | number | null;
  onRowClick?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
  onRowContextMenu?: (row: T, e: React.MouseEvent) => void;
  rowClassName?: (row: T) => string;
  sort?: { key: string; order: 'asc' | 'desc' } | null;
  onSort?: (key: string) => void;
  /** Auto-filter row values (keyed by column.filterKey) */
  filters?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  showFooter?: boolean;
  /** Group rows like a DevExpress grouped column: a caption row starts each run of equal keys (pass rows sorted by it). */
  groupBy?: (row: T) => string;
  /** Group row caption; defaults to the key */
  groupCaption?: (key: string, rows: T[]) => React.ReactNode;
}

/** Legacy-style data grid: compact rows, sortable headers, optional filter row and footer totals. */
export default function LegacyGrid<T>({
  isDark, columns, rows, rowKey, loading, emptyText = 'Tidak ada data.', focusedKey,
  onRowClick, onRowDoubleClick, onRowContextMenu, rowClassName, sort, onSort, filters, onFilterChange, showFooter,
  groupBy, groupCaption,
}: LegacyGridProps<T>) {
  const c = lx(isDark);
  const cellAlign = (col: LegacyColumn<T>) =>
    col.align === 'right' || (!col.align && col.format === 'n0') ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
  const value = (row: T, col: LegacyColumn<T>) => {
    if (col.render) return col.render(row);
    const v = (row as Record<string, unknown>)[col.key];
    return col.format === 'n0' ? fmtN0(v) : col.format === 'date' ? fmtDate(v) : v == null ? '' : String(v);
  };

  // Rows per group key, built once (O(n)) for the group captions
  const groupRows = new Map<string, T[]>();
  if (groupBy && groupCaption) {
    for (const r of rows) {
      const g = groupBy(r);
      const list = groupRows.get(g);
      if (list) list.push(r); else groupRows.set(g, [r]);
    }
  }

  return (
    <div className={`flex-1 min-h-0 overflow-auto border rounded ${c.panel}`}>
      <table data-column-resize-table className="w-full border-separate border-spacing-0 text-xs">
        <thead className="sticky top-0 z-20">
          <tr className={`h-8 whitespace-nowrap font-semibold ${c.head}`}>
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                onClick={col.sortKey && onSort ? () => onSort(col.sortKey!) : undefined}
                className={`px-2 border-b border-r ${c.border} ${cellAlign(col)} ${col.sortKey && onSort ? 'cursor-pointer select-none hover:text-blue-600' : ''}`}
              >
                <span className="inline-flex items-center gap-1">
                  {col.caption}
                  {sort && col.sortKey === sort.key && (sort.order === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                </span>
              </th>
            ))}
          </tr>
          {filters && onFilterChange && (
            <ColumnFilterRow
              cells={columns.map((col) => ({ key: col.filterKey }))}
              values={filters}
              onChange={onFilterChange}
              isDark={isDark}
            />
          )}
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={columns.length} className={`py-10 text-center ${c.muted}`}>Memuat data...</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={columns.length} className={`py-10 text-center ${c.muted}`}>{emptyText}</td></tr>
          ) : (
            rows.map((row, i) => {
              const k = rowKey(row);
              const focused = focusedKey != null && focusedKey === k;
              // Group caption row before the first row of each run of equal group keys
              const g = groupBy?.(row);
              const groupStart = g !== undefined && (i === 0 || groupBy!(rows[i - 1]) !== g);
              return (
                <React.Fragment key={k}>
                {groupStart && (
                  <tr className={`font-bold ${c.bar}`}>
                    <td colSpan={columns.length} className={`px-2 py-1 border-b ${c.border}`}>
                      {groupCaption ? groupCaption(g!, groupRows.get(g!) ?? []) : g}
                    </td>
                  </tr>
                )}
                <tr
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick(row) : undefined}
                  onContextMenu={onRowContextMenu ? (e) => { e.preventDefault(); onRowContextMenu(row, e); } : undefined}
                  className={`whitespace-nowrap ${onRowClick || onRowDoubleClick ? 'cursor-pointer' : ''} ${focused ? c.rowFocus : c.rowHover} ${rowClassName?.(row) ?? ''}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-2 py-1 border-b ${c.border} ${cellAlign(col)} ${col.format === 'n0' ? 'tabular-nums' : ''}`}>
                      {value(row, col)}
                    </td>
                  ))}
                </tr>
                </React.Fragment>
              );
            })
          )}
        </tbody>
        {showFooter && (
          <tfoot className="sticky bottom-0 z-10">
            <tr className={`h-7 font-bold whitespace-nowrap ${c.head}`}>
              {columns.map((col) => (
                <td key={col.key} className={`px-2 border-t ${c.border} ${cellAlign(col)} tabular-nums`}>{col.footer ?? ''}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/** Paging footer for grids the server pages (client doc item 13: 100 rows by default). */
export function LegacyPager({ isDark, page, totalPages, total, shown, onPage, pageSize, onPageSize, unit = 'data' }: {
  isDark: boolean;
  page: number;
  totalPages: number;
  total: number;
  shown: number;
  onPage: (page: number) => void;
  pageSize?: number;
  onPageSize?: (size: number) => void;
  unit?: string;
}) {
  const c = lx(isDark);
  const btn = `px-2 py-0.5 rounded border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? 'border-slate-600 hover:bg-slate-800' : 'border-slate-400 hover:bg-slate-100'}`;
  return (
    <div className={`px-2 py-1 border rounded flex items-center justify-between gap-2 ${c.panel}`}>
      <div className="flex items-center gap-3">
        <span>Menampilkan {fmtN0(shown)} dari total {fmtN0(total)} {unit}</span>
        {pageSize && onPageSize && (
          <label className="flex items-center gap-1">
            <span>Rows:</span>
            <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} className={`px-1 py-0.5 rounded border ${c.input}`}>
              {[100, 200, 500].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={btn}>Sebelumnya</button>
        <span>Halaman {page} / {totalPages}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)} className={btn}>Berikutnya</button>
      </div>
    </div>
  );
}

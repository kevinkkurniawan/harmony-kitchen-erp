'use client';

import React from 'react';
import { Search } from 'lucide-react';

export interface ColumnFilterCell {
  /** Filter key (sent as the f_<key> query param). Omit for columns without a filter. */
  key?: string;
  placeholder?: string;
}

interface ColumnFilterRowProps {
  cells: ColumnFilterCell[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  isDark: boolean;
}

/** Per-column search row rendered under the table header (like the legacy grid's filter row). */
export default function ColumnFilterRow({ cells, values, onChange, isDark }: ColumnFilterRowProps) {
  return (
    <tr className={isDark ? 'bg-slate-900' : 'bg-slate-100'}>
      {cells.map((cell, idx) => (
        <th
          key={cell.key ?? `empty-${idx}`}
          className={`py-1 px-1.5 border-b-2 font-normal ${isDark ? 'border-slate-700' : 'border-slate-300'}`}
        >
          {cell.key && (
            <div className="relative">
              <Search className={`w-3 h-3 absolute left-1.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                type="text"
                value={values[cell.key] || ''}
                onChange={(e) => onChange(cell.key!, e.target.value)}
                placeholder={cell.placeholder ?? 'Cari...'}
                aria-label={`Filter ${cell.key}`}
                className={`w-full min-w-[60px] rounded-md border pl-5 pr-1.5 py-0.5 text-[11px] font-semibold normal-case tracking-normal outline-none focus:ring-1 focus:ring-amber-500 ${
                  isDark
                    ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600'
                    : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                }`}
              />
            </div>
          )}
        </th>
      ))}
    </tr>
  );
}

/** Builds the f_* query string for the active column filters (leading '&' included when non-empty). */
export function columnFilterQuery(values: Record<string, string>): string {
  return Object.entries(values)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `&f_${k}=${encodeURIComponent(v.trim())}`)
    .join('');
}

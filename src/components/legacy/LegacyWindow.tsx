'use client';

import React from 'react';
import { twMerge } from 'tailwind-merge';

// Shared look of the legacy kit: light, flat, compact (DevExpress-like), with a dark variant.
export const lx = (isDark: boolean) => ({
  page: isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900',
  panel: isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300',
  bar: isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300',
  muted: isDark ? 'text-slate-400' : 'text-slate-500',
  input: isDark
    ? 'bg-slate-950 border-slate-600 text-slate-100 placeholder:text-slate-500'
    : 'bg-white border-slate-400 text-slate-900 placeholder:text-slate-400',
  head: isDark ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-slate-200 text-slate-800 border-slate-300',
  rowHover: isDark ? 'hover:bg-slate-800' : 'hover:bg-blue-50',
  rowFocus: isDark ? 'bg-blue-900/50' : 'bg-blue-100',
  border: isDark ? 'border-slate-700' : 'border-slate-300',
});

interface LegacyWindowProps {
  /** Old window title, exactly as in Module Manager */
  title: string;
  isDark: boolean;
  toolbar?: React.ReactNode;
  status?: React.ReactNode;
  children: React.ReactNode;
}

/** Page frame: title bar, toolbar row, body (fills the remaining height), optional status line. */
export default function LegacyWindow({ title, isDark, toolbar, status, children }: LegacyWindowProps) {
  const c = lx(isDark);
  return (
    <div className={`flex-1 flex flex-col h-full min-h-0 overflow-hidden text-xs ${c.page}`}>
      <div className={`px-3 py-1.5 border-b font-bold text-[13px] tracking-tight ${c.bar}`}>{title}</div>
      {toolbar && (
        <div className={`px-3 py-2 border-b flex flex-wrap items-center gap-2 ${c.panel}`}>{toolbar}</div>
      )}
      <div className="flex-1 min-h-0 flex flex-col p-2 gap-2 overflow-hidden">{children}</div>
      {status && <div className={`px-3 py-1 border-t text-[11px] ${c.bar} ${c.muted}`}>{status}</div>}
    </div>
  );
}

interface LegacyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isDark: boolean;
  icon?: React.ReactNode;
  variant?: 'default' | 'primary' | 'danger';
}

/** Toolbar / form button with the old caption. */
export function LegacyButton({ isDark, icon, variant = 'default', className = '', children, ...rest }: LegacyButtonProps) {
  const tone =
    variant === 'primary'
      ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-700'
      : variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-700'
      : isDark
      ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-600'
      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-400';
  return (
    <button
      type="button"
      {...rest}
      className={twMerge(`px-3 py-1 rounded border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${tone}`, className)}
    >
      {icon}
      {children}
    </button>
  );
}

/** Group box with a caption, like a DevExpress LayoutControlGroup (".:: Detail ::." etc.). */
export function GroupBox({ caption, isDark, className = '', children, actions }: {
  caption?: string;
  isDark: boolean;
  className?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const c = lx(isDark);
  return (
    <section className={`border rounded flex flex-col min-h-0 ${c.panel} ${className}`}>
      {(caption || actions) && (
        <div className={`px-2 py-1 border-b flex items-center justify-between gap-2 font-bold ${c.bar}`}>
          <span>{caption}</span>
          {actions && <div className="flex items-center gap-1.5">{actions}</div>}
        </div>
      )}
      <div className="flex-1 min-h-0 flex flex-col p-2 gap-2">{children}</div>
    </section>
  );
}

/** Label-left form row with the old label text (e.g. "Nama Barang :"). */
export function FieldRow({ label, isDark, children, labelWidth = 'w-32' }: {
  label: string;
  isDark: boolean;
  children: React.ReactNode;
  labelWidth?: string;
}) {
  return (
    <label className="flex items-center gap-2 min-w-0">
      <span className={`${labelWidth} shrink-0 text-right ${lx(isDark).muted}`}>{label}</span>
      <div className="flex-1 min-w-0 flex items-center gap-1.5">{children}</div>
    </label>
  );
}

/** Text input styled for the kit; a page's own classes (e.g. width) override the defaults via twMerge. */
export const LegacyInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { isDark: boolean }>(
  function LegacyInput({ isDark, className = '', ...rest }, ref) {
    return (
      <input
        ref={ref}
        {...rest}
        className={twMerge(`w-full min-w-0 px-2 py-1 rounded border text-xs outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 ${lx(isDark).input}`, className)}
      />
    );
  },
);

export function LegacySelect({ isDark, className = '', children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { isDark: boolean }) {
  return (
    <select
      {...rest}
      className={twMerge(`w-full min-w-0 px-2 py-1 rounded border text-xs outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${lx(isDark).input}`, className)}
    >
      {children}
    </select>
  );
}

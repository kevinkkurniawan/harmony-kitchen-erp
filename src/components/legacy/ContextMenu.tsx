'use client';

import React, { useEffect } from 'react';
import { lx } from './LegacyWindow';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}

export interface ContextMenuState<T> {
  x: number;
  y: number;
  row: T;
}

/** Position for a right-click menu, kept on screen near the right / bottom edge. */
export function menuAt<T>(e: React.MouseEvent, row: T, itemCount = 3): ContextMenuState<T> {
  const height = itemCount * 28 + 8;
  return {
    x: Math.min(e.clientX, window.innerWidth - 200),
    y: Math.min(e.clientY, window.innerHeight - height),
    row,
  };
}

/** Right-click menu like the legacy grids'; closes on outside click, scroll or Escape. */
export default function ContextMenu({ isDark, x, y, items, onClose }: {
  isDark: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('click', onClose);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', onClose);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
      className={`fixed z-50 min-w-44 rounded border shadow-xl py-1 text-xs ${lx(isDark).panel}`}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          disabled={item.disabled}
          onClick={() => { onClose(); item.onClick(); }}
          className={`w-full px-3 py-1.5 text-left flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            item.danger ? 'hover:bg-rose-600 hover:text-white' : 'hover:bg-blue-600 hover:text-white'
          }`}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

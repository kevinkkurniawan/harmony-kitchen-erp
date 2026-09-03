'use client';

import React from 'react';
import { StickyNote, Sparkles } from 'lucide-react';

interface MemoWidgetProps {
  isDark: boolean;
}

export default function MemoWidget({ isDark }: MemoWidgetProps) {
  return (
    <div className="px-2 py-1">
      <div
        className={`relative rounded-2xl p-3 border transition-all shadow-sm ${
          isDark
            ? 'bg-amber-950/20 border-amber-500/30 text-slate-200'
            : 'bg-amber-50/70 border-amber-300/80 text-slate-800'
        }`}
      >
        <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-amber-500/20">
          <div className="p-1 rounded-md bg-amber-500/20 text-amber-500">
            <StickyNote className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-500 flex items-center gap-1">
            Memo Operasional
            <Sparkles className="w-2.5 h-2.5 opacity-80" />
          </span>
        </div>
        <div className="text-xs font-bold leading-relaxed text-amber-600 dark:text-amber-300 flex items-center gap-2">
          <span className="text-amber-500 text-sm">📌</span>
          <p>Cek Sync Stock dan Opname</p>
        </div>
      </div>
    </div>
  );
}

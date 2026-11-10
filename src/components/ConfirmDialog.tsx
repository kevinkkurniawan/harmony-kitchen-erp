'use client';

import React, { useCallback, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmOptions {
  title?: string;
  confirmText?: string;
}

interface PendingConfirm extends ConfirmOptions {
  message: string;
  resolve: (confirmed: boolean) => void;
}

// In-app replacement for window.confirm(): `if (!(await confirmDialog('...'))) return;`
export function useConfirmDialog(isDark: boolean) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirmDialog = useCallback(
    (message: string, options: ConfirmOptions = {}) =>
      new Promise<boolean>((resolve) => setPending({ message, resolve, ...options })),
    []
  );

  const close = (confirmed: boolean) => {
    pending?.resolve(confirmed);
    setPending(null);
  };

  const dialog = pending ? (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => close(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-2xl border shadow-2xl p-6 flex flex-col items-center text-center gap-4 ${
          isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
        }`}
      >
        <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <div>
          <h2 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {pending.title || 'Konfirmasi Hapus'}
          </h2>
          <p className={`text-sm whitespace-pre-line ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{pending.message}</p>
        </div>
        <div className="flex gap-3 w-full mt-1">
          <button
            type="button"
            onClick={() => close(false)}
            className={`flex-1 py-2.5 rounded-xl font-bold border transition-colors cursor-pointer ${
              isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Batal
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => close(true)}
            className="flex-1 py-2.5 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-lg cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-rose-500/30"
          >
            {pending.confirmText || 'Hapus'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirmDialog, dialog };
}

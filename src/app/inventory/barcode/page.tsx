'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import AuthGuard from '@/components/AuthGuard';
import BarcodePrintManager from '@/components/BarcodePrintManager';

export default function BarcodePage() {
  const router = useRouter();

  return (
    <AuthGuard>
      {({ user, permissions }) => {
        const isAdmin = user.userLevel === 'Admin' || user.username.toLowerCase() === 'admin';
        const hasBarcodeAccess =
          isAdmin ||
          permissions.some(
            (p) =>
              (p.moduleCode === 'BARCODE_MANAGE' ||
                p.moduleCode === 'BARCODE_PRINT' ||
                p.moduleCode === 'MD_INVENTORY') &&
              p.canView
          );

        if (!hasBarcodeAccess) {
          return (
            <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center mb-4 shadow-lg">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h1 className="text-xl font-black text-slate-900 mb-2">Akses Ditolak (403 Forbidden)</h1>
              <p className="text-xs text-slate-600 max-w-md mb-6">
                Akun Anda (@{user.username}) tidak memiliki izin <code className="font-mono font-bold text-rose-600">BARCODE_MANAGE</code> atau <code className="font-mono font-bold text-rose-600">BARCODE_PRINT</code> untuk mengakses halaman pembuatan barcode ini.
              </p>
              <button
                onClick={() => router.push('/')}
                className="cursor-pointer px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-black font-bold text-xs flex items-center gap-2 transition-all shadow-md active:scale-95"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali ke Dashboard</span>
              </button>
            </div>
          );
        }

        return (
          <BarcodePrintManager
            isDark={false}
            onBack={() => router.push('/')}
          />
        );
      }}
    </AuthGuard>
  );
}

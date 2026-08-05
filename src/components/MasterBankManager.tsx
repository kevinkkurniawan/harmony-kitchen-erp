'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Landmark,
  Plus,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit,
  Zap,
  X,
  AlertTriangle,
} from 'lucide-react';

export interface BankAccount {
  id: string | number;
  bank_code: string;
  bank_name: string;
  is_active: boolean;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

interface MasterBankManagerProps {
  isDark: boolean;
}

export default function MasterBankManager({ isDark }: MasterBankManagerProps) {
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);

  // Form Fields (Exact 1:1 Frm_BankTransfer & M_Bank in Module Manager)
  const [bankCode, setBankCode] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);

  // Submit & Toasts
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((text: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Fetch Banks List
  const fetchBanks = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/banks?q=${encodeURIComponent(searchQuery)}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setBanks(json.data);
      }
    } catch (err) {
      console.error('Error fetching banks:', err);
      addToast('Gagal memuat data Rekening Bank', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, addToast]);

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  const handleOpenAddModal = () => {
    setEditingBank(null);
    setBankCode('BANK-' + Math.floor(100 + Math.random() * 900));
    setBankName('');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (b: BankAccount) => {
    setEditingBank(b);
    setBankCode(b.bank_code);
    setBankName(b.bank_name);
    setIsActive(b.is_active);
    setIsModalOpen(true);
  };

  const handleSaveBank = async () => {
    if (!bankCode.trim() || !bankName.trim()) {
      addToast('Kode Bank (BankNo) dan Nama Bank (BankName) wajib diisi!', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        id: editingBank ? editingBank.id : undefined,
        bank_code: bankCode,
        bank_name: bankName,
        account_no: bankCode,
        account_holder: bankName,
        is_active: isActive,
      };

      const res = await fetch('/api/banks', {
        method: editingBank ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        addToast(`Bank ${bankName} berhasil ${editingBank ? 'diperbarui' : 'ditambahkan'}!`, 'success');
        setIsModalOpen(false);
        fetchBanks();
      } else {
        addToast(json.error || 'Gagal menyimpan data Rekening', 'error');
      }
    } catch (err) {
      console.error('Save bank error:', err);
      addToast('Terjadi kesalahan koneksi saat menyimpan', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBank = async (id: string | number, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus bank ${name}?`)) return;

    try {
      const res = await fetch(`/api/banks?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        addToast(`Bank ${name} berhasil dihapus`, 'success');
        fetchBanks();
      } else {
        addToast(json.error || 'Gagal menghapus Rekening', 'error');
      }
    } catch (err) {
      console.error('Delete bank error:', err);
      addToast('Gagal menghapus data Rekening', 'error');
    }
  };

  // Stats
  const totalBanks = banks.length;
  const activeBanks = banks.filter((b) => b.is_active).length;

  return (
    <div
      className={`h-full w-full flex flex-col font-sans transition-colors duration-200 ${
        isDark ? 'bg-[#0b0f19] text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Toast Notification */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-xl border flex items-center gap-3 text-xs font-semibold animate-in slide-in-from-bottom-5 duration-200 ${
              t.type === 'success'
                ? 'bg-emerald-500/90 text-white border-emerald-400'
                : t.type === 'error'
                ? 'bg-rose-500/90 text-white border-rose-400'
                : t.type === 'warning'
                ? 'bg-amber-500/90 text-white border-amber-400'
                : 'bg-blue-500/90 text-white border-blue-400'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
            {t.type === 'error' && <XCircle className="w-4 h-4" />}
            {t.type === 'warning' && <AlertTriangle className="w-4 h-4" />}
            {t.type === 'info' && <Zap className="w-4 h-4" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      {/* TOP HEADER */}
      <header
        className={`h-16 px-6 border-b flex items-center justify-between shrink-0 shadow-sm ${
          isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight flex items-center gap-2">
              Master Bank (Frm_BankTransfer / M_Bank)
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                MD_BANK 1:1
              </span>
            </h1>
            <p className="text-xs text-slate-400">Pengelolaan master data bank (BankNo, BankName, isActive)</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Tambah Bank Baru
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            className={`p-4 rounded-2xl border flex items-center gap-4 ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold">Total Bank</p>
              <p className="text-xl font-extrabold">{totalBanks} Bank</p>
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border flex items-center gap-4 ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold">Bank Aktif</p>
              <p className="text-xl font-extrabold text-teal-400">{activeBanks} Aktif</p>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Cari BankNo, BankName..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 text-xs rounded-xl border outline-none transition-colors ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500'
                  : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-emerald-500'
              }`}
            />
          </div>

          <button
            onClick={fetchBanks}
            className={`p-2 rounded-xl border active:scale-95 transition-all ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-300 text-slate-600'
            }`}
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Table List (Strict 1:1 Frm_BankTransfer & M_Bank) */}
        <div
          className={`rounded-2xl border overflow-hidden ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead
                className={`uppercase font-bold border-b tracking-wider ${
                  isDark ? 'bg-slate-800/50 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
              >
                <tr>
                  <th className="px-4 py-3.5">Bank No (Kode Bank)</th>
                  <th className="px-4 py-3.5">Bank Name (Nama Bank)</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                      <span>Memuat data Bank...</span>
                    </td>
                  </tr>
                ) : banks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-slate-400">
                      Tidak ada data Bank ditemukan.
                    </td>
                  </tr>
                ) : (
                  banks.map((b) => (
                    <tr key={b.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-3 font-mono font-bold text-emerald-400">{b.bank_code}</td>
                      <td className="px-4 py-3 font-bold text-white flex items-center gap-2">
                        <Landmark className="w-4 h-4 text-emerald-400" />
                        <span>{b.bank_name}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            b.is_active
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {b.is_active ? 'Aktif' : 'Non-Aktif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(b)}
                            className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 active:scale-95 transition-all"
                            title="Edit Data"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteBank(b.id, b.bank_name)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 active:scale-95 transition-all"
                            title="Hapus Data"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div
            className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-emerald-500" />
                <h3 className="font-extrabold text-sm">{editingBank ? 'Edit Data Bank' : 'Tambah Bank Baru'}</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 font-sans space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-400">Bank No (Kode Bank) *</label>
                <input
                  type="text"
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border font-mono font-bold outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-emerald-400' : 'bg-slate-100 border-slate-300 text-emerald-600'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-400">Bank Name (Nama Bank) *</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Nama Bank (e.g. Bank BCA, Bank Mandiri)..."
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-400">Status Aktif (isActive)</label>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`w-full px-3 py-2 text-xs font-bold rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}
                >
                  {isActive ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {isActive ? 'Aktif' : 'Non-Aktif'}
                </button>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-950/50">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl border text-xs font-bold text-slate-400 hover:text-white border-slate-700"
              >
                Batal
              </button>
              <button
                onClick={handleSaveBank}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all cursor-pointer"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Data Bank'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

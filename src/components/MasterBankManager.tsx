'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  RefreshCw,
  Printer,
  CheckCircle2,
  XCircle,
  Building2,
  Trash2,
  Edit,
  Zap,
  DollarSign,
  Landmark,
  QrCode,
  ShieldCheck,
  X,
  AlertTriangle,
  Wallet,
  Building,
} from 'lucide-react';

export interface BankAccount {
  id: string | number;
  bank_code: string;
  bank_name: string;
  account_no: string;
  account_holder: string;
  branch: string;
  balance: number;
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

  // Form Fields
  const [bankCode, setBankCode] = useState<string>('');
  const [bankName, setBankName] = useState<string>('Bank BCA');
  const [accountNo, setAccountNo] = useState<string>('');
  const [accountHolder, setAccountHolder] = useState<string>('PT. Harmony Kitchen Indonesia');
  const [branch, setBranch] = useState<string>('Cabang Pemuda Surabaya');
  const [balance, setBalance] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(true);

  // Transfer Voucher Modal
  const [selectedVoucherBank, setSelectedVoucherBank] = useState<BankAccount | null>(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState<boolean>(false);

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
    setBankName('Bank BCA');
    setAccountNo('');
    setAccountHolder('PT. Harmony Kitchen Indonesia');
    setBranch('Cabang Pemuda Surabaya');
    setBalance(0);
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (b: BankAccount) => {
    setEditingBank(b);
    setBankCode(b.bank_code);
    setBankName(b.bank_name);
    setAccountNo(b.account_no);
    setAccountHolder(b.account_holder);
    setBranch(b.branch || '');
    setBalance(Number(b.balance || 0));
    setIsActive(b.is_active);
    setIsModalOpen(true);
  };

  const handleSaveBank = async () => {
    if (!bankCode.trim() || !bankName.trim() || !accountNo.trim()) {
      addToast('Kode Bank, Nama Bank, dan Nomor Rekening wajib diisi!', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        id: editingBank ? editingBank.id : undefined,
        bank_code: bankCode,
        bank_name: bankName,
        account_no: accountNo,
        account_holder: accountHolder,
        branch,
        balance,
        is_active: isActive,
      };

      const res = await fetch('/api/banks', {
        method: editingBank ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        addToast(`Rekening ${bankName} (${accountNo}) berhasil ${editingBank ? 'diperbarui' : 'ditambahkan'}!`, 'success');
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
    if (!confirm(`Apakah Anda yakin ingin menghapus rekening bank ${name}?`)) return;

    try {
      const res = await fetch(`/api/banks?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        addToast(`Rekening ${name} berhasil dihapus`, 'success');
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
  const totalBalance = banks.reduce((acc, b) => acc + Number(b.balance || 0), 0);
  const activeBankCount = banks.filter((b) => b.is_active).length;
  const transferAccounts = banks.filter((b) => b.bank_name.includes('Bank')).length;
  const qrisEdcAccounts = banks.filter((b) => b.bank_name.includes('QRIS') || b.bank_name.includes('EDC')).length;

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
              Master Bank & Metode Pembayaran (Bank Account)
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                MD_BANK 1:1
              </span>
            </h1>
            <p className="text-xs text-slate-400">Pengelolaan nomor rekening bank perusahaan, QRIS Merchant, & saldo kas</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Tambah Rekening Bank
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div
            className={`p-4 rounded-2xl border flex items-center gap-4 ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold">Total Saldo Kas & Bank</p>
              <p className="text-lg font-extrabold text-emerald-400">Rp {totalBalance.toLocaleString('id-ID')}</p>
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border flex items-center gap-4 ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center font-bold">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold">Rekening Aktif</p>
              <p className="text-xl font-extrabold text-teal-400">{activeBankCount} Akun</p>
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border flex items-center gap-4 ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold">Akun Transfer Bank</p>
              <p className="text-xl font-extrabold text-blue-400">{transferAccounts} Bank</p>
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border flex items-center gap-4 ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold">QRIS & EDC Merchant</p>
              <p className="text-xl font-extrabold text-purple-400">{qrisEdcAccounts} Merchant</p>
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
              placeholder="Cari Kode Bank, Nama Bank, No. Rekening, A.N Pemilik..."
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

        {/* Table List */}
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
                  <th className="px-4 py-3.5">Kode Bank</th>
                  <th className="px-4 py-3.5">Nama Bank / Merchant</th>
                  <th className="px-4 py-3.5">Nomor Rekening</th>
                  <th className="px-4 py-3.5">A.N. Pemilik Rekening</th>
                  <th className="px-4 py-3.5">Cabang</th>
                  <th className="px-4 py-3.5 text-right">Saldo (Rp)</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                      <span>Memuat data Rekening Bank...</span>
                    </td>
                  </tr>
                ) : banks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      Tidak ada data Rekening Bank ditemukan.
                    </td>
                  </tr>
                ) : (
                  banks.map((b) => (
                    <tr key={b.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-3 font-mono font-bold text-emerald-400">{b.bank_code}</td>
                      <td className="px-4 py-3 font-bold text-white flex items-center gap-2">
                        {b.bank_name.includes('QRIS') ? (
                          <QrCode className="w-4 h-4 text-purple-400" />
                        ) : (
                          <Landmark className="w-4 h-4 text-emerald-400" />
                        )}
                        <span>{b.bank_name}</span>
                      </td>
                      <td className="px-4 py-3 font-mono font-extrabold text-amber-400">{b.account_no}</td>
                      <td className="px-4 py-3 text-slate-300">{b.account_holder}</td>
                      <td className="px-4 py-3 text-slate-400">{b.branch || '-'}</td>
                      <td className="px-4 py-3 text-right font-extrabold text-emerald-400">
                        Rp {Number(b.balance || 0).toLocaleString('id-ID')}
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
                            onClick={() => {
                              setSelectedVoucherBank(b);
                              setIsVoucherModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 active:scale-95 transition-all"
                            title="Preview Info Transfer"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </button>
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
            className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-emerald-500" />
                <h3 className="font-extrabold text-sm">{editingBank ? 'Edit Rekening Bank' : 'Tambah Rekening Baru'}</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 font-sans space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-400">Kode Bank *</label>
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
                  <label className="block text-xs font-semibold mb-1 text-slate-400">Nama Bank / Merchant *</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Bank BCA, Mandiri, BRI, QRIS..."
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border outline-none ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-400">Nomor Rekening / Merchant ID *</label>
                <input
                  type="text"
                  value={accountNo}
                  onChange={(e) => setAccountNo(e.target.value)}
                  placeholder="8830198888..."
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border font-mono font-bold outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-amber-400' : 'bg-white border-slate-300 text-amber-600'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-400">A.N. Pemilik Rekening *</label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="PT. Harmony Kitchen Indonesia..."
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-400">Cabang Bank</label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="Cabang Pemuda Surabaya..."
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-400">Saldo Rekening (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={balance}
                    onChange={(e) => setBalance(parseFloat(e.target.value) || 0)}
                    className={`w-full px-3 py-2 text-xs font-extrabold rounded-xl border outline-none ${
                      isDark ? 'bg-slate-800 border-slate-700 text-emerald-400' : 'bg-white border-slate-300 text-emerald-600'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-400">Status Rekening</label>
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
                {isSubmitting ? 'Menyimpan...' : 'Simpan Rekening Bank'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOUCHER / INFO TRANSFER MODAL */}
      {isVoucherModalOpen && selectedVoucherBank && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-500" />
                <h3 className="font-extrabold text-sm">Info Rekening Transfer Official</h3>
              </div>
              <button
                onClick={() => setIsVoucherModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col items-center justify-center font-sans">
              <div className="w-full bg-white text-slate-900 p-6 rounded-2xl shadow-xl border-2 border-slate-300 flex flex-col items-center text-center">
                <h4 className="font-black text-xs tracking-widest text-emerald-700 uppercase mb-1">
                  HARMONY KITCHEN & RESTO
                </h4>
                <p className="text-[10px] text-slate-500 mb-4">REKENING RESMI PEMBAYARAN SUPPLIER / CUSTOMER</p>

                <div className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 mb-4">
                  <p className="text-xs font-bold text-slate-500 uppercase">{selectedVoucherBank.bank_name}</p>
                  <p className="text-xl font-mono font-black text-emerald-700 tracking-wider">
                    {selectedVoucherBank.account_no}
                  </p>
                  <p className="text-xs font-extrabold text-slate-800">A.N. {selectedVoucherBank.account_holder}</p>
                  <p className="text-[10px] text-slate-500">{selectedVoucherBank.branch}</p>
                </div>

                <div className="text-[11px] font-extrabold text-emerald-600">
                  SALDO TERSEDIA: Rp {Number(selectedVoucherBank.balance || 0).toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-950/50">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-500/20"
              >
                <Printer className="w-4 h-4" /> Cetak Info Rekening
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Crown,
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
  Phone,
  Mail,
  MapPin,
  BadgeCheck,
  CreditCard,
  ShieldCheck,
  X,
  AlertTriangle,
  Users,
  Building,
  Tag,
  DollarSign,
  Store,
} from 'lucide-react';

export interface Customer {
  id: string | number;
  customer_code: string;
  customer_name: string;
  customer_type: string;
  phone: string;
  email: string;
  address: string;
  special_discount_pct: number;
  credit_limit: number;
  is_active: boolean;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

interface MasterCustomerManagerProps {
  isDark: boolean;
}

export default function MasterCustomerManager({ isDark }: MasterCustomerManagerProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCust, setEditingCust] = useState<Customer | null>(null);

  // Form Fields
  const [customerCode, setCustomerCode] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerType, setCustomerType] = useState<string>('Retail Store Customer');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [specialDiscountPct, setSpecialDiscountPct] = useState<number>(0);
  const [creditLimit, setCreditLimit] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(true);

  // VIP Member Card Modal
  const [selectedVipCust, setSelectedVipCust] = useState<Customer | null>(null);
  const [isVipModalOpen, setIsVipModalOpen] = useState<boolean>(false);

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

  // Fetch Customers List
  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = `/api/customers?q=${encodeURIComponent(searchQuery)}`;
      if (typeFilter !== 'ALL') {
        url += `&type=${encodeURIComponent(typeFilter)}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setCustomers(json.data);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
      addToast('Gagal memuat data Customer', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, typeFilter, addToast]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleOpenAddModal = () => {
    setEditingCust(null);
    setCustomerCode('CUST-' + Math.floor(100 + Math.random() * 900));
    setCustomerName('');
    setCustomerType('Retail Store Customer');
    setPhone('');
    setEmail('');
    setAddress('');
    setSpecialDiscountPct(0);
    setCreditLimit(0);
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (c: Customer) => {
    setEditingCust(c);
    setCustomerCode(c.customer_code);
    setCustomerName(c.customer_name);
    setCustomerType(c.customer_type || 'Retail Store Customer');
    setPhone(c.phone || '');
    setEmail(c.email || '');
    setAddress(c.address || '');
    setSpecialDiscountPct(Number(c.special_discount_pct || 0));
    setCreditLimit(Number(c.credit_limit || 0));
    setIsActive(c.is_active);
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async () => {
    if (!customerCode.trim() || !customerName.trim()) {
      addToast('Kode Customer dan Nama Pelanggan wajib diisi!', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        id: editingCust ? editingCust.id : undefined,
        customer_code: customerCode,
        customer_name: customerName,
        customer_type: customerType,
        phone,
        email,
        address,
        special_discount_pct: specialDiscountPct,
        credit_limit: creditLimit,
        is_active: isActive,
      };

      const res = await fetch('/api/customers', {
        method: editingCust ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        addToast(`Customer ${customerName} berhasil ${editingCust ? 'diperbarui' : 'ditambahkan'}!`, 'success');
        setIsModalOpen(false);
        fetchCustomers();
      } else {
        addToast(json.error || 'Gagal menyimpan data Customer', 'error');
      }
    } catch (err) {
      console.error('Save customer error:', err);
      addToast('Terjadi kesalahan koneksi saat menyimpan', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (id: string | number, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus data customer ${name}?`)) return;

    try {
      const res = await fetch(`/api/customers?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        addToast(`Data customer ${name} berhasil dihapus`, 'success');
        fetchCustomers();
      } else {
        addToast(json.error || 'Gagal menghapus Customer', 'error');
      }
    } catch (err) {
      console.error('Delete customer error:', err);
      addToast('Gagal menghapus data Customer', 'error');
    }
  };

  // Stats
  const totalCustomers = customers.length;
  const vipGoldCount = customers.filter((c) => c.customer_type.includes('VIP')).length;
  const wholesaleCount = customers.filter((c) => c.customer_type.includes('Wholesale') || c.customer_type.includes('Grosir')).length;
  const totalCreditLimit = customers.reduce((acc, c) => acc + Number(c.credit_limit || 0), 0);

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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-pink-500/20">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight flex items-center gap-2">
              Master Pelanggan & Customer (Customer)
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/10 text-pink-500 border border-pink-500/20">
                MD_CUST 1:1
              </span>
            </h1>
            <p className="text-xs text-slate-400">Pengelolaan database pelanggan retail, toko grosir, hotel/resto B2B, & member VIP</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-pink-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Tambah Customer Baru
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
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 text-pink-500 flex items-center justify-center font-bold">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold">Total Pelanggan Terdaftar</p>
              <p className="text-xl font-extrabold">{totalCustomers} Akun</p>
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border flex items-center gap-4 ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold">Member VIP Gold</p>
              <p className="text-xl font-extrabold text-amber-400">{vipGoldCount} Member</p>
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border flex items-center gap-4 ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold">Wholesale / Toko Grosir</p>
              <p className="text-xl font-extrabold text-blue-400">{wholesaleCount} Perusahaan</p>
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border flex items-center gap-4 ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold">Total Plafon Kredit B2B</p>
              <p className="text-lg font-extrabold text-emerald-400">Rp {totalCreditLimit.toLocaleString('id-ID')}</p>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Cari Nama Customer, Kode, Email, No. HP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 text-xs rounded-xl border outline-none transition-colors ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500 focus:border-pink-500'
                  : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-pink-500'
              }`}
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-400">Tipe Customer:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={`px-3 py-2 text-xs rounded-xl border outline-none cursor-pointer ${
                isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              <option value="ALL">Semua Tipe</option>
              <option value="Retail Store Customer">Retail Store Customer</option>
              <option value="Member VIP Gold">Member VIP Gold</option>
              <option value="Wholesale / Toko Grosir">Wholesale / Toko Grosir</option>
              <option value="Restaurant & Hotel Client (B2B)">Restaurant & Hotel Client (B2B)</option>
            </select>

            <button
              onClick={fetchCustomers}
              className={`p-2 rounded-xl border active:scale-95 transition-all ${
                isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-300 text-slate-600'
              }`}
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
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
                  <th className="px-4 py-3.5">Kode</th>
                  <th className="px-4 py-3.5">Nama Customer / Perusahaan</th>
                  <th className="px-4 py-3.5">Tipe Customer</th>
                  <th className="px-4 py-3.5">No. HP</th>
                  <th className="px-4 py-3.5 text-center">Diskon Spesial</th>
                  <th className="px-4 py-3.5 text-right">Plafon Kredit (Rp)</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-pink-500" />
                      <span>Memuat data Customer...</span>
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      Tidak ada data Customer ditemukan.
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <tr key={c.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-3 font-mono font-bold text-pink-400">{c.customer_code}</td>
                      <td className="px-4 py-3 font-bold text-white">{c.customer_name}</td>
                      <td className="px-4 py-3 font-semibold text-slate-300">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            c.customer_type.includes('VIP')
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : c.customer_type.includes('Wholesale')
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {c.customer_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{c.phone || '-'}</td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-400">
                        {Number(c.special_discount_pct || 0)}%
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-blue-400">
                        Rp {Number(c.credit_limit || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            c.is_active
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {c.is_active ? 'Aktif' : 'Non-Aktif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedVipCust(c);
                              setIsVipModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border border-pink-500/30 active:scale-95 transition-all"
                            title="Kartu Member"
                          >
                            <Crown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(c)}
                            className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 active:scale-95 transition-all"
                            title="Edit Data"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCustomer(c.id, c.customer_name)}
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
            className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-pink-500" />
                <h3 className="font-extrabold text-sm">{editingCust ? 'Edit Data Customer' : 'Tambah Customer Baru'}</h3>
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
                  <label className="block text-xs font-semibold mb-1 text-slate-400">Kode Customer *</label>
                  <input
                    type="text"
                    value={customerCode}
                    onChange={(e) => setCustomerCode(e.target.value)}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border font-mono font-bold outline-none ${
                      isDark ? 'bg-slate-800 border-slate-700 text-pink-400' : 'bg-slate-100 border-slate-300 text-pink-600'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-400">Tipe Customer *</label>
                  <select
                    value={customerType}
                    onChange={(e) => setCustomerType(e.target.value)}
                    className={`w-full px-3 py-2 text-xs rounded-xl border outline-none cursor-pointer ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="Retail Store Customer">Retail Store Customer</option>
                    <option value="Member VIP Gold">Member VIP Gold</option>
                    <option value="Wholesale / Toko Grosir">Wholesale / Toko Grosir</option>
                    <option value="Restaurant & Hotel Client (B2B)">Restaurant & Hotel Client (B2B)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-400">Nama Customer / Perusahaan *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nama Perusahaan atau Nama Perorangan..."
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-400">No. HP / WhatsApp</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0812..."
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border outline-none ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-400">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@..."
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border outline-none ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-400">Alamat Lengkap</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Alamat domisili / kantor..."
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-400">Diskon Spesial (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={specialDiscountPct}
                    onChange={(e) => setSpecialDiscountPct(parseFloat(e.target.value) || 0)}
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border outline-none ${
                      isDark ? 'bg-slate-800 border-slate-700 text-emerald-400' : 'bg-white border-slate-300 text-emerald-600'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-400">Plafon Kredit B2B (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(parseFloat(e.target.value) || 0)}
                    className={`w-full px-3 py-2 text-xs font-bold rounded-xl border outline-none ${
                      isDark ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-white border-slate-300 text-blue-600'
                    }`}
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-semibold mb-1 text-slate-400">Status Aktif</label>
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
                  {isActive ? 'Status Aktif' : 'Non-Aktif'}
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
                onClick={handleSaveCustomer}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all cursor-pointer"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Data Customer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MEMBER VIP CARD MODAL */}
      {isVipModalOpen && selectedVipCust && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500" />
                <h3 className="font-extrabold text-sm">Preview Kartu Member VIP</h3>
              </div>
              <button
                onClick={() => setIsVipModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col items-center justify-center">
              {/* VIP Card */}
              <div className="w-full bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 text-slate-950 p-6 rounded-2xl border-2 border-amber-300 shadow-2xl flex flex-col justify-between relative overflow-hidden h-44">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-black text-xs tracking-widest uppercase">HARMONY KITCHENWARE</h4>
                    <p className="text-[9px] font-bold text-slate-800">EXCLUSIVE VIP MEMBER CARD</p>
                  </div>
                  <Crown className="w-6 h-6 text-slate-950" />
                </div>

                <div>
                  <h3 className="font-black text-base tracking-wide">{selectedVipCust.customer_name}</h3>
                  <p className="text-xs font-mono font-bold tracking-wider">{selectedVipCust.customer_code}</p>
                </div>

                <div className="flex justify-between items-end border-t border-slate-950/20 pt-2 text-[10px] font-bold">
                  <span>DISCOUNT: {selectedVipCust.special_discount_pct}% OFF</span>
                  <span>STATUS: VIP GOLD</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-950/50">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-500/20"
              >
                <Printer className="w-4 h-4" /> Cetak Kartu Member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

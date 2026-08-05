'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Package,
  Plus,
  Search,
  RefreshCw,
  Printer,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
  Calendar,
  Trash2,
  Eye,
  ArrowLeft,
  AlertTriangle,
  X,
  Zap,
  DollarSign,
  UserCheck,
  Flame,
  Store,
  Layers,
} from 'lucide-react';
import { ERPProduct } from '@/types/erp';

export interface UsageItem {
  inventoryId: string;
  barcode: string;
  inventoryNo: string;
  inventoryName: string;
  uomName: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
  notes: string;
}

export interface UsageHeader {
  id: string | number;
  usage_no: string;
  usage_date: string;
  department_name: string;
  usage_type: string;
  wh_name: string;
  pic_name: string;
  description: string;
  total_amount: number;
  status: 'Draft' | 'Approved' | 'Completed' | 'Cancelled' | string;
  created_by?: string;
  item_count?: number;
  total_qty?: number;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

interface InventoryUsageManagerProps {
  isDark: boolean;
}

export default function InventoryUsageManager({ isDark }: InventoryUsageManagerProps) {
  // View Mode: 'list' | 'create'
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');

  // List View States
  const [usagesList, setUsagesList] = useState<UsageHeader[]>([]);
  const [listSearch, setListSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);

  // Form Header States
  const [usageNo, setUsageNo] = useState<string>(
    () => 'USG-' + new Date().toISOString().slice(2, 7).replace('-', '') + '-' + Math.floor(1000 + Math.random() * 9000)
  );
  const [usageDate, setUsageDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [departmentName, setDepartmentName] = useState<string>('Showroom / Toko Utama');
  const [usageType, setUsageType] = useState<string>('Display Showroom / Sample Produk');
  const [whName, setWhName] = useState<string>('Gudang Utama Kitchenware');
  const [picName, setPicName] = useState<string>('Supervisor Gudang');
  const [description, setDescription] = useState<string>('');

  // Item Entry States
  const [items, setItems] = useState<UsageItem[]>([]);
  const [productSearch, setProductSearch] = useState<string>('');
  const [searchResults, setSearchResults] = useState<ERPProduct[]>([]);
  const [isSearchingProduct, setIsSearchingProduct] = useState<boolean>(false);

  // Detail / Print Modal
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [selectedUsage, setSelectedUsage] = useState<{ header: UsageHeader; items: UsageItem[] } | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  // Submit & Toast
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const productSearchRef = useRef<HTMLInputElement>(null);

  const addToast = useCallback((text: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Fetch Usages List
  const fetchUsagesList = useCallback(async () => {
    setIsLoadingList(true);
    try {
      let url = `/api/inventory/usage?q=${encodeURIComponent(listSearch)}`;
      if (statusFilter !== 'ALL') {
        url += `&status=${encodeURIComponent(statusFilter)}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setUsagesList(json.data);
      }
    } catch (err) {
      console.error('Error fetching usages:', err);
      addToast('Gagal memuat data Pemakaian Barang', 'error');
    } finally {
      setIsLoadingList(false);
    }
  }, [listSearch, statusFilter, addToast]);

  useEffect(() => {
    fetchUsagesList();
  }, [fetchUsagesList]);

  // Product Search debounce for adding items
  useEffect(() => {
    if (!productSearch.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingProduct(true);
      try {
        const res = await fetch(`/api/inventory?q=${encodeURIComponent(productSearch)}&limit=8`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setSearchResults(json.data);
        }
      } catch (err) {
        console.error('Product search error:', err);
      } finally {
        setIsSearchingProduct(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [productSearch]);

  const handleSelectProduct = (product: ERPProduct) => {
    const existingIndex = items.findIndex((i) => i.inventoryId === String(product.id));
    const name = product.inventoryName || (product as any).inventory_name || 'Item';
    const no = product.inventoryNo || (product as any).inventory_no || `INV-${product.id}`;
    const uom = product.uomName || (product as any).uom_name || 'PCS';
    const price = Number(product.hpp || product.price || 25000);

    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex].qty += 1;
      updated[existingIndex].subtotal = updated[existingIndex].qty * updated[existingIndex].unitPrice;
      setItems(updated);
    } else {
      const newItem: UsageItem = {
        inventoryId: String(product.id),
        barcode: product.barcode || '',
        inventoryNo: no,
        inventoryName: name,
        uomName: uom,
        qty: 1,
        unitPrice: price,
        subtotal: price,
        notes: '',
      };
      setItems([...items, newItem]);
    }

    setProductSearch('');
    setSearchResults([]);
    addToast(`Item ${name} ditambahkan`, 'info');
  };

  const handleUpdateItemQty = (index: number, newQty: number) => {
    const qty = Math.max(1, newQty);
    const updated = [...items];
    updated[index].qty = qty;
    updated[index].subtotal = qty * updated[index].unitPrice;
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculatedTotalAmount = items.reduce((acc, item) => acc + item.subtotal, 0);

  // Save Usage
  const handleSaveUsage = async (status: 'Draft' | 'Approved') => {
    if (items.length === 0) {
      addToast('Tambahkan minimal 1 item barang yang dipakai!', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        usage_no: usageNo,
        usage_date: usageDate,
        department_name: departmentName,
        usage_type: usageType,
        wh_name: whName,
        pic_name: picName,
        description,
        status,
        items,
      };

      const res = await fetch('/api/inventory/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        addToast(`Pemakaian Barang ${usageNo} berhasil disimpan (${status})!`, 'success');
        setUsageNo('USG-' + new Date().toISOString().slice(2, 7).replace('-', '') + '-' + Math.floor(1000 + Math.random() * 9000));
        setItems([]);
        setDescription('');
        setViewMode('list');
        fetchUsagesList();
      } else {
        addToast(json.error || 'Gagal menyimpan pemakaian barang', 'error');
      }
    } catch (err: any) {
      console.error('Save Usage error:', err);
      addToast('Terjadi kesalahan koneksi saat menyimpan pemakaian barang', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // View Details Modal
  const handleOpenDetailModal = async (usgId: string | number) => {
    setIsLoadingDetail(true);
    setIsDetailModalOpen(true);
    try {
      const res = await fetch(`/api/inventory/usage?id=${usgId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setSelectedUsage({
          header: json.data.header,
          items: json.data.items.map((i: any) => ({
            inventoryId: String(i.inventory_id),
            barcode: i.barcode,
            inventoryNo: i.inventory_no,
            inventoryName: i.inventory_name,
            uomName: i.uom_name,
            qty: Number(i.qty),
            unitPrice: Number(i.unit_price),
            subtotal: Number(i.subtotal),
            notes: i.notes || '',
          })),
        });
      }
    } catch (err) {
      console.error('Error loading Usage detail:', err);
      addToast('Gagal memuat detail pemakaian barang', 'error');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleUpdateStatus = async (usgId: string | number, newStatus: string) => {
    try {
      const res = await fetch('/api/inventory/usage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: usgId, status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        addToast(`Status pemakaian diperbarui menjadi ${newStatus}`, 'success');
        if (selectedUsage) {
          setSelectedUsage({
            ...selectedUsage,
            header: { ...selectedUsage.header, status: newStatus },
          });
        }
        fetchUsagesList();
      }
    } catch (err) {
      console.error('Update status error:', err);
    }
  };

  // Stats
  const totalUsageCount = usagesList.length;
  const completedCount = usagesList.filter((u) => u.status === 'Completed' || u.status === 'Approved').length;
  const totalQtyUsed = usagesList.reduce((acc, u) => acc + Number(u.total_qty || 0), 0);
  const totalHPPValue = usagesList.reduce((acc, u) => acc + Number(u.total_amount || 0), 0);

  return (
    <div
      className={`h-full w-full flex flex-col font-sans transition-colors duration-200 ${
        isDark ? 'bg-[#0b0f19] text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Toast Container */}
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight flex items-center gap-2">
              Pemakaian Barang Internal (Usage)
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                MD_USAGE 1:1
              </span>
            </h1>
            <p className="text-xs text-slate-400">Pencatatan pemakaian produk display showroom, barang cacat packing, & sampel toko</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {viewMode === 'create' ? (
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 active:scale-95 transition-all cursor-pointer ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Daftar Pemakaian
            </button>
          ) : (
            <button
              onClick={() => {
                setUsageNo('USG-' + new Date().toISOString().slice(2, 7).replace('-', '') + '-' + Math.floor(1000 + Math.random() * 9000));
                setItems([]);
                setViewMode('create');
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Input Pemakaian Barang Baru
            </button>
          )}
        </div>
      </header>

      {/* CONTENT AREA */}
      {viewMode === 'list' ? (
        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div
              className={`p-4 rounded-2xl border flex items-center gap-4 ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold">Total Transaksi Usage</p>
                <p className="text-xl font-extrabold">{totalUsageCount} Transaksi</p>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border flex items-center gap-4 ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold">
                <Flame className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold">Disetujui / Selesai</p>
                <p className="text-xl font-extrabold text-orange-400">{completedCount} Usage</p>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border flex items-center gap-4 ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold">Total Item Dipakai</p>
                <p className="text-xl font-extrabold text-blue-400">{totalQtyUsed} Pcs</p>
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
                <p className="text-xs text-slate-400 font-semibold">Total Nilai HPP Pemakaian</p>
                <p className="text-lg font-extrabold text-emerald-400">Rp {totalHPPValue.toLocaleString('id-ID')}</p>
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
                placeholder="Cari No. Usage, Departemen, Jenis Pemakaian, PIC..."
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 text-xs rounded-xl border outline-none transition-colors ${
                  isDark
                    ? 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500 focus:border-amber-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500'
                }`}
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-xs font-semibold text-slate-400">Filter Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`px-3 py-2 text-xs rounded-xl border outline-none cursor-pointer ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                <option value="ALL">Semua Status</option>
                <option value="Approved">Approved</option>
                <option value="Completed">Completed</option>
                <option value="Draft">Draft</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              <button
                onClick={fetchUsagesList}
                className={`p-2 rounded-xl border active:scale-95 transition-all ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-300 text-slate-600'
                }`}
                title="Refresh Data"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingList ? 'animate-spin' : ''}`} />
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
                    <th className="px-4 py-3.5">No. Usage</th>
                    <th className="px-4 py-3.5">Tanggal</th>
                    <th className="px-4 py-3.5">Departemen</th>
                    <th className="px-4 py-3.5">Jenis Pemakaian</th>
                    <th className="px-4 py-3.5">Penanggung Jawab (PIC)</th>
                    <th className="px-4 py-3.5 text-center">Items</th>
                    <th className="px-4 py-3.5 text-right">Nilai HPP (Rp)</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {isLoadingList ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                        <span>Memuat data Pemakaian Barang...</span>
                      </td>
                    </tr>
                  ) : usagesList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                        Tidak ada transaksi Pemakaian Barang ditemukan.
                      </td>
                    </tr>
                  ) : (
                    usagesList.map((usg) => (
                      <tr key={usg.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                        <td className="px-4 py-3 font-bold text-amber-400">{usg.usage_no}</td>
                        <td className="px-4 py-3 text-slate-300">
                          {new Date(usg.usage_date).toLocaleDateString('id-ID')}
                        </td>
                        <td className="px-4 py-3 font-semibold text-white">{usg.department_name}</td>
                        <td className="px-4 py-3 text-slate-300">{usg.usage_type}</td>
                        <td className="px-4 py-3 text-slate-300">{usg.pic_name}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium">
                            {usg.item_count || 0} item ({usg.total_qty || 0} pcs)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold text-emerald-400">
                          Rp {Number(usg.total_amount || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                              usg.status === 'Completed' || usg.status === 'Approved'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : usg.status === 'Cancelled'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {usg.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleOpenDetailModal(usg.id)}
                            className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold text-xs flex items-center gap-1.5 mx-auto active:scale-95 transition-all"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Detail / Voucher
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* FORM CREATE / EDIT USAGE */
        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
          {/* Header Card */}
          <div
            className={`p-6 rounded-2xl border flex flex-col gap-5 ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-amber-500 flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Header Pemakaian Barang Internal
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">No. Pemakaian (Auto Generated)</label>
                <input
                  type="text"
                  value={usageNo}
                  onChange={(e) => setUsageNo(e.target.value)}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border font-mono font-bold outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-amber-400' : 'bg-slate-100 border-slate-300 text-amber-600'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">Departemen *</label>
                <select
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none cursor-pointer ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="Showroom / Toko Utama">Showroom / Toko Utama</option>
                  <option value="Gudang Utama">Gudang Utama</option>
                  <option value="Divisi Logistik">Divisi Logistik</option>
                  <option value="Divisi Display & Event">Divisi Display & Event</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">Jenis Pemakaian *</label>
                <select
                  value={usageType}
                  onChange={(e) => setUsageType(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none cursor-pointer ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="Display Showroom / Sample Produk">Display Showroom / Sample Produk</option>
                  <option value="Barang Cacat / Damaged Pack">Barang Cacat / Damaged Pack</option>
                  <option value="Operasional Toko / Packing">Operasional Toko / Packing</option>
                  <option value="Waste / Rusak Pengiriman">Waste / Rusak Pengiriman</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">Tanggal Pemakaian</label>
                <input
                  type="date"
                  value={usageDate}
                  onChange={(e) => setUsageDate(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">Penanggung Jawab (PIC)</label>
                <input
                  type="text"
                  value={picName}
                  onChange={(e) => setPicName(e.target.value)}
                  placeholder="Contoh: Supervisor Gudang"
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">Gudang Asal Barang</label>
                <input
                  type="text"
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 text-slate-400">Keterangan Pemakaian</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Peruntukan pemakaian, alasan barang cacat, atau pameran..."
                className={`w-full px-3.5 py-2 text-xs rounded-xl border outline-none ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
            </div>
          </div>

          {/* Add Product Search Input */}
          <div
            className={`p-6 rounded-2xl border flex flex-col gap-4 relative ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-amber-500 flex items-center gap-2">
              <Package className="w-4 h-4" /> Cari & Tambah Produk Dipakai
            </h2>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                ref={productSearchRef}
                type="text"
                placeholder="Ketik Nama Produk / Scan Barcode yang akan dikeluarkan dari stok..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border outline-none transition-colors ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-amber-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500'
                }`}
              />

              {/* Product Search Dropdown Popup */}
              {searchResults.length > 0 && (
                <div
                  className={`absolute left-0 right-0 top-full mt-2 rounded-2xl border shadow-2xl z-40 overflow-hidden ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                >
                  <div className="p-2 divide-y divide-slate-800">
                    {searchResults.map((product) => (
                      <div
                        key={product.id}
                        onClick={() => handleSelectProduct(product)}
                        className={`p-3 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                          isDark ? 'hover:bg-slate-800' : 'hover:bg-amber-50'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-amber-400">
                            {product.inventoryName || (product as any).inventory_name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {product.inventoryNo || (product as any).inventory_no} | Barcode: {product.barcode || '-'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-emerald-400">
                            HPP: Rp {Number(product.hpp || product.price || 0).toLocaleString('id-ID')}
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            {product.uomName || (product as any).uom_name || 'PCS'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Added Items Table */}
            <div className="overflow-x-auto border rounded-xl border-slate-800">
              <table className="w-full text-left text-xs">
                <thead
                  className={`uppercase font-bold border-b tracking-wider ${
                    isDark ? 'bg-slate-800/50 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  <tr>
                    <th className="px-4 py-3">Nama Barang</th>
                    <th className="px-4 py-3">Satuan</th>
                    <th className="px-4 py-3 text-center w-28">Qty Pemakaian</th>
                    <th className="px-4 py-3 text-right w-36">HPP Satuan (Rp)</th>
                    <th className="px-4 py-3 text-right w-40">Subtotal HPP (Rp)</th>
                    <th className="px-4 py-3 text-center w-16">Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        Belum ada item ditambahkan. Gunakan kolom pencarian di atas.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => (
                      <tr key={idx} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                        <td className="px-4 py-3">
                          <div className="font-bold text-white">{item.inventoryName}</div>
                          <div className="text-[10px] text-slate-400">{item.inventoryNo}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{item.uomName}</td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => handleUpdateItemQty(idx, parseInt(e.target.value) || 1)}
                            className={`w-20 px-2 py-1 text-center font-bold rounded-lg border outline-none ${
                              isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-300">
                          Rp {item.unitPrice.toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold text-emerald-400">
                          Rp {item.subtotal.toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Summary */}
            <div className="flex flex-col sm:flex-row justify-end gap-6 pt-4 border-t border-slate-800">
              <div className="w-full sm:w-80 flex flex-col gap-2 text-xs">
                <div className="flex justify-between pt-3 border-t border-slate-800 text-sm font-extrabold">
                  <span className="text-amber-500">Total Nilai HPP Pemakaian:</span>
                  <span className="text-emerald-400">Rp {calculatedTotalAmount.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => handleSaveUsage('Draft')}
                disabled={isSubmitting}
                className={`px-5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 active:scale-95 transition-all ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-amber-500/30'
                    : 'bg-white hover:bg-amber-50 text-amber-600 border-amber-300'
                }`}
              >
                <Clock className="w-4 h-4" />
                Simpan Draft Usage
              </button>

              <button
                onClick={() => handleSaveUsage('Approved')}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Simpan & Setujui (Approved)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL / PRINT MODAL */}
      {isDetailModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div
            className={`w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-500" />
                <h3 className="font-extrabold text-sm">Voucher Pemakaian Barang #{selectedUsage?.header.usage_no}</h3>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 font-sans">
              {isLoadingDetail ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                  <span>Memuat detail pemakaian barang...</span>
                </div>
              ) : selectedUsage ? (
                <div className="bg-white text-slate-900 p-8 rounded-xl border border-slate-300 shadow-inner">
                  {/* Header */}
                  <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-6">
                    <div>
                      <h2 className="text-xl font-black tracking-tight text-amber-600 uppercase">
                        HARMONY KITCHENWARE
                      </h2>
                      <p className="text-xs text-slate-600">Voucher Pemakaian Barang Internal (Usage)</p>
                    </div>
                    <div className="text-right">
                      <h3 className="text-lg font-extrabold uppercase tracking-wide text-slate-800">
                        PEMAKAIAN BARANG
                      </h3>
                      <p className="text-xs font-mono font-bold text-amber-600">{selectedUsage.header.usage_no}</p>
                      <p className="text-xs text-slate-500">
                        Tgl: {new Date(selectedUsage.header.usage_date).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-6 text-xs mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <p className="font-extrabold text-slate-500 uppercase text-[10px] mb-1">Departemen / PIC:</p>
                      <p className="font-bold text-sm text-slate-800">{selectedUsage.header.department_name}</p>
                      <p className="text-slate-600">PIC: {selectedUsage.header.pic_name}</p>
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-500 uppercase text-[10px] mb-1">Jenis & Gudang:</p>
                      <p className="font-bold text-slate-800">{selectedUsage.header.usage_type}</p>
                      <p className="text-slate-600">Gudang Asal: {selectedUsage.header.wh_name}</p>
                    </div>
                  </div>

                  {/* Table */}
                  <table className="w-full text-left text-xs mb-6 border border-slate-300">
                    <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-300">
                      <tr>
                        <th className="p-2 border-r border-slate-300">No.</th>
                        <th className="p-2 border-r border-slate-300">Nama Barang</th>
                        <th className="p-2 border-r border-slate-300 text-center">Satuan</th>
                        <th className="p-2 border-r border-slate-300 text-center">Qty Dipakai</th>
                        <th className="p-2 border-r border-slate-300 text-right">HPP Satuan</th>
                        <th className="p-2 text-right">Subtotal HPP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {selectedUsage.items.map((it, i) => (
                        <tr key={i}>
                          <td className="p-2 border-r border-slate-200 text-center">{i + 1}</td>
                          <td className="p-2 border-r border-slate-200 font-semibold text-slate-800">
                            {it.inventoryName}
                          </td>
                          <td className="p-2 border-r border-slate-200 text-center text-slate-600">{it.uomName}</td>
                          <td className="p-2 border-r border-slate-200 text-center font-bold text-amber-700">{it.qty}</td>
                          <td className="p-2 border-r border-slate-200 text-right">
                            Rp {it.unitPrice.toLocaleString('id-ID')}
                          </td>
                          <td className="p-2 text-right font-extrabold text-slate-900">
                            Rp {it.subtotal.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex justify-end text-xs mb-8">
                    <div className="w-64 space-y-1">
                      <div className="flex justify-between pt-2 border-t-2 border-slate-800 text-sm font-extrabold text-slate-900">
                        <span>Total Nilai HPP:</span>
                        <span className="text-emerald-600">
                          Rp {Number(selectedUsage.header.total_amount || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="grid grid-cols-2 gap-4 text-center text-[11px] text-slate-600 pt-8 border-t border-slate-200">
                    <div>
                      <p>Pemohon / PIC Gudang,</p>
                      <div className="h-16"></div>
                      <p className="font-bold text-slate-800">( {selectedUsage.header.pic_name} )</p>
                    </div>
                    <div>
                      <p>Mengetahui (Manager Gudang),</p>
                      <div className="h-16"></div>
                      <p className="font-bold text-slate-800">( Warehouse Manager )</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div />
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-500/20"
              >
                <Printer className="w-4 h-4" /> Cetak Voucher Pemakaian
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

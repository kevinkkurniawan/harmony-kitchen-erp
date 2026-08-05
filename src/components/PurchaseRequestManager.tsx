'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ClipboardList,
  Plus,
  Search,
  RefreshCw,
  Printer,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
  Calendar,
  Package,
  Trash2,
  Eye,
  ArrowLeft,
  AlertTriangle,
  X,
  Zap,
  ShoppingBag,
  ArrowRight,
  FileCheck,
} from 'lucide-react';
import { ERPProduct } from '@/types/erp';

export interface PRItem {
  inventoryId: string;
  barcode: string;
  inventoryNo: string;
  inventoryName: string;
  uomName: string;
  qty: number;
  notes: string;
}

export interface PRHeader {
  id: string | number;
  pr_no: string;
  pr_date: string;
  department_name: string;
  request_reason: string;
  required_date: string;
  description: string;
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'Processed to PO' | 'Rejected' | string;
  requested_by?: string;
  item_count?: number;
  total_qty?: number;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

interface PurchaseRequestManagerProps {
  isDark: boolean;
}

export default function PurchaseRequestManager({ isDark }: PurchaseRequestManagerProps) {
  // View Mode: 'list' | 'create'
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');

  // List View States
  const [requestsList, setRequestsList] = useState<PRHeader[]>([]);
  const [listSearch, setListSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);

  // Form Header States
  const [prNo, setPrNo] = useState<string>(
    () => 'PR-' + new Date().toISOString().slice(2, 7).replace('-', '') + '-' + Math.floor(1000 + Math.random() * 9000)
  );
  const [prDate, setPrDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [departmentName, setDepartmentName] = useState<string>('Dapur Utama');
  const [requestReason, setRequestReason] = useState<string>('Operasional Dapur Harian');
  const [requiredDate, setRequiredDate] = useState<string>(
    () => new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [description, setDescription] = useState<string>('');

  // Item Entry States
  const [items, setItems] = useState<PRItem[]>([]);
  const [productSearch, setProductSearch] = useState<string>('');
  const [searchResults, setSearchResults] = useState<ERPProduct[]>([]);
  const [isSearchingProduct, setIsSearchingProduct] = useState<boolean>(false);

  // Detail / Print Modal
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [selectedPR, setSelectedPR] = useState<{ header: PRHeader; items: PRItem[] } | null>(null);
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

  // Fetch PR List
  const fetchRequestsList = useCallback(async () => {
    setIsLoadingList(true);
    try {
      let url = `/api/purchasing/requests?q=${encodeURIComponent(listSearch)}`;
      if (statusFilter !== 'ALL') {
        url += `&status=${encodeURIComponent(statusFilter)}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setRequestsList(json.data);
      }
    } catch (err) {
      console.error('Error fetching PRs:', err);
      addToast('Gagal memuat daftar Pengajuan Pembelian', 'error');
    } finally {
      setIsLoadingList(false);
    }
  }, [listSearch, statusFilter, addToast]);

  useEffect(() => {
    fetchRequestsList();
  }, [fetchRequestsList]);

  // Product Search debounce for adding items to PR
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

    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex].qty += 1;
      setItems(updated);
    } else {
      const newItem: PRItem = {
        inventoryId: String(product.id),
        barcode: product.barcode || '',
        inventoryNo: no,
        inventoryName: name,
        uomName: uom,
        qty: 1,
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
    setItems(updated);
  };

  const handleUpdateItemNotes = (index: number, text: string) => {
    const updated = [...items];
    updated[index].notes = text;
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Save PR
  const handleSavePR = async (status: 'Draft' | 'Pending Approval') => {
    if (items.length === 0) {
      addToast('Tambahkan minimal 1 item produk untuk diajukan!', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        pr_no: prNo,
        pr_date: prDate,
        department_name: departmentName,
        request_reason: requestReason,
        required_date: requiredDate,
        description,
        status,
        items,
      };

      const res = await fetch('/api/purchasing/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        addToast(`Pengajuan Pembelian ${prNo} berhasil disimpan (${status})!`, 'success');
        // Reset Form
        setPrNo('PR-' + new Date().toISOString().slice(2, 7).replace('-', '') + '-' + Math.floor(1000 + Math.random() * 9000));
        setItems([]);
        setDescription('');
        setViewMode('list');
        fetchRequestsList();
      } else {
        addToast(json.error || 'Gagal menyimpan PR', 'error');
      }
    } catch (err: any) {
      console.error('Save PR error:', err);
      addToast('Terjadi kesalahan koneksi saat menyimpan PR', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // View Details Modal
  const handleOpenDetailModal = async (prId: string | number) => {
    setIsLoadingDetail(true);
    setIsDetailModalOpen(true);
    try {
      const res = await fetch(`/api/purchasing/requests?id=${prId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setSelectedPR({
          header: json.data.header,
          items: json.data.items.map((i: any) => ({
            inventoryId: String(i.inventory_id),
            barcode: i.barcode,
            inventoryNo: i.inventory_no,
            inventoryName: i.inventory_name,
            uomName: i.uom_name,
            qty: Number(i.qty),
            notes: i.notes || '',
          })),
        });
      }
    } catch (err) {
      console.error('Error loading PR detail:', err);
      addToast('Gagal memuat detail PR', 'error');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleUpdateStatus = async (prId: string | number, newStatus: string) => {
    try {
      const res = await fetch('/api/purchasing/requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: prId, status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        addToast(`Status PR diperbarui menjadi ${newStatus}`, 'success');
        if (selectedPR) {
          setSelectedPR({
            ...selectedPR,
            header: { ...selectedPR.header, status: newStatus },
          });
        }
        fetchRequestsList();
      }
    } catch (err) {
      console.error('Update status error:', err);
    }
  };

  // Filter totals stats
  const totalPRCount = requestsList.length;
  const pendingCount = requestsList.filter((r) => r.status === 'Pending Approval' || r.status === 'Draft').length;
  const approvedCount = requestsList.filter((r) => r.status === 'Approved' || r.status === 'Processed to PO').length;
  const totalItemsQty = requestsList.reduce((acc, r) => acc + Number(r.total_qty || 0), 0);

  return (
    <div
      className={`h-full w-full flex flex-col font-sans transition-colors duration-200 ${
        isDark ? 'bg-[#0b0f19] text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Toast Notification Container */}
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
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight flex items-center gap-2">
              Pengajuan Pembelian (Purchase Request)
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                PUR_PR 1:1
              </span>
            </h1>
            <p className="text-xs text-slate-400">Permintaan pengadaan bahan baku & alat dapur dari outlet/departemen</p>
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
              Kembali ke Daftar PR
            </button>
          ) : (
            <button
              onClick={() => {
                setPrNo('PR-' + new Date().toISOString().slice(2, 7).replace('-', '') + '-' + Math.floor(1000 + Math.random() * 9000));
                setItems([]);
                setViewMode('create');
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Buat Pengajuan (PR) Baru
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
                <ClipboardList className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold">Total Pengajuan PR</p>
                <p className="text-xl font-extrabold">{totalPRCount} Request</p>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border flex items-center gap-4 ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold">Menunggu Persetujuan</p>
                <p className="text-xl font-extrabold text-orange-500">{pendingCount} PR</p>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border flex items-center gap-4 ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold">Disetujui / Ke PO</p>
                <p className="text-xl font-extrabold text-emerald-500">{approvedCount} PR</p>
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
                <p className="text-xs text-slate-400 font-semibold">Total Item Diajukan</p>
                <p className="text-xl font-extrabold text-blue-400">{totalItemsQty} Pcs</p>
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
                placeholder="Cari No. PR, Departemen, Alasan Pengajuan..."
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
                <option value="Pending Approval">Pending Approval</option>
                <option value="Approved">Approved</option>
                <option value="Processed to PO">Processed to PO</option>
                <option value="Rejected">Rejected</option>
              </select>

              <button
                onClick={fetchRequestsList}
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
                    <th className="px-4 py-3.5">No. PR</th>
                    <th className="px-4 py-3.5">Tanggal PR</th>
                    <th className="px-4 py-3.5">Departemen</th>
                    <th className="px-4 py-3.5">Alasan / Keperluan</th>
                    <th className="px-4 py-3.5 text-center">Items</th>
                    <th className="px-4 py-3.5 text-center">Tgl Dibutuhkan</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {isLoadingList ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                        <span>Memuat data Purchase Requests...</span>
                      </td>
                    </tr>
                  ) : requestsList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                        Tidak ada Purchase Request ditemukan.
                      </td>
                    </tr>
                  ) : (
                    requestsList.map((pr) => (
                      <tr
                        key={pr.id}
                        className={`transition-colors ${
                          isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-4 py-3 font-bold text-amber-400">{pr.pr_no}</td>
                        <td className="px-4 py-3 font-medium text-slate-300">
                          {new Date(pr.pr_date).toLocaleDateString('id-ID')}
                        </td>
                        <td className="px-4 py-3 font-semibold text-white">{pr.department_name}</td>
                        <td className="px-4 py-3 text-slate-300 max-w-xs truncate">{pr.request_reason}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium">
                            {pr.item_count || 0} item ({pr.total_qty || 0} pcs)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-400">
                          {pr.required_date ? new Date(pr.required_date).toLocaleDateString('id-ID') : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                              pr.status === 'Approved'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : pr.status === 'Processed to PO'
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                : pr.status === 'Rejected'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {pr.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleOpenDetailModal(pr.id)}
                            className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold text-xs flex items-center gap-1.5 mx-auto active:scale-95 transition-all"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Detail / Review
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
        /* FORM CREATE / EDIT PR */
        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
          {/* Header Card */}
          <div
            className={`p-6 rounded-2xl border flex flex-col gap-5 ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-amber-500 flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Header Pengajuan Pembelian
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">Nomor PR (Auto Generated)</label>
                <input
                  type="text"
                  value={prNo}
                  onChange={(e) => setPrNo(e.target.value)}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border font-mono font-bold outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-amber-400' : 'bg-slate-100 border-slate-300 text-amber-600'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">Departement Pemohon *</label>
                <select
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none cursor-pointer ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="Dapur Utama">Dapur Utama (Main Kitchen)</option>
                  <option value="Bar & Beverage">Bar & Beverage</option>
                  <option value="Pastry & Bakery">Pastry & Bakery</option>
                  <option value="Service / Restaurant">Service / Restaurant</option>
                  <option value="Gudang Utama">Gudang Utama & Logistik</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">Tanggal Pengajuan</label>
                <input
                  type="date"
                  value={prDate}
                  onChange={(e) => setPrDate(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">Tanggal Dibutuhkan</label>
                <input
                  type="date"
                  value={requiredDate}
                  onChange={(e) => setRequiredDate(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">Alasan / Keperluan Pengajuan *</label>
                <input
                  type="text"
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="Contoh: Kebutuhan bahan baku dapur persediaan event wedding weekend"
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Add Product Search Input */}
          <div
            className={`p-6 rounded-2xl border flex flex-col gap-4 relative ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-amber-500 flex items-center gap-2">
              <Package className="w-4 h-4" /> Cari & Tambah Item Barang yang Diajukan
            </h2>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                ref={productSearchRef}
                type="text"
                placeholder="Ketik Nama Produk / Scan Barcode untuk diajukan..."
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
                          <span className="font-bold text-slate-300">
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
                    <th className="px-4 py-3 text-center w-28">Qty Pengajuan</th>
                    <th className="px-4 py-3">Catatan / Spesifikasi Item</th>
                    <th className="px-4 py-3 text-center w-16">Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        Belum ada item diajukan. Gunakan kolom pencarian di atas.
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
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            placeholder="Catatan prioritas / merk..."
                            value={item.notes}
                            onChange={(e) => handleUpdateItemNotes(idx, e.target.value)}
                            className={`w-full px-2 py-1 rounded-lg border outline-none ${
                              isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          />
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

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => handleSavePR('Draft')}
                disabled={isSubmitting}
                className={`px-5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 active:scale-95 transition-all ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-amber-500/30'
                    : 'bg-white hover:bg-amber-50 text-amber-600 border-amber-300'
                }`}
              >
                <Clock className="w-4 h-4" />
                Simpan Draft PR
              </button>

              <button
                onClick={() => handleSavePR('Pending Approval')}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Kirim Pengajuan (Pending Approval)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL / PREVIEW MODAL */}
      {isDetailModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div
            className={`w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-amber-500" />
                <h3 className="font-extrabold text-sm">Preview Purchase Request #{selectedPR?.header.pr_no}</h3>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Voucher Content */}
            <div className="p-6 overflow-y-auto flex-1 font-sans">
              {isLoadingDetail ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                  <span>Memuat detail Purchase Request...</span>
                </div>
              ) : selectedPR ? (
                <div className="bg-white text-slate-900 p-8 rounded-xl border border-slate-300 shadow-inner">
                  {/* Voucher Header */}
                  <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-6">
                    <div>
                      <h2 className="text-xl font-black tracking-tight text-amber-600 uppercase">
                        HARMONY KITCHEN & RESTO
                      </h2>
                      <p className="text-xs text-slate-600">Form Pengajuan Pembelian Internal (Purchase Request)</p>
                    </div>
                    <div className="text-right">
                      <h3 className="text-lg font-extrabold uppercase tracking-wide text-slate-800">
                        PURCHASE REQUEST
                      </h3>
                      <p className="text-xs font-mono font-bold text-amber-600">{selectedPR.header.pr_no}</p>
                      <p className="text-xs text-slate-500">
                        Tgl PR: {new Date(selectedPR.header.pr_date).toLocaleDateString('id-ID')}
                      </p>
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                        STATUS: {selectedPR.header.status}
                      </span>
                    </div>
                  </div>

                  {/* Header Grid */}
                  <div className="grid grid-cols-2 gap-6 text-xs mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <p className="font-extrabold text-slate-500 uppercase text-[10px] mb-1">Departemen Pemohon:</p>
                      <p className="font-bold text-sm text-slate-800">{selectedPR.header.department_name}</p>
                      <p className="text-slate-600">Alasan: {selectedPR.header.request_reason}</p>
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-500 uppercase text-[10px] mb-1">Target Tgl Dibutuhkan:</p>
                      <p className="font-bold text-slate-800">
                        {selectedPR.header.required_date
                          ? new Date(selectedPR.header.required_date).toLocaleDateString('id-ID')
                          : '-'}
                      </p>
                      <p className="text-slate-600">Keterangan: {selectedPR.header.description || '-'}</p>
                    </div>
                  </div>

                  {/* Items Table */}
                  <table className="w-full text-left text-xs mb-6 border border-slate-300">
                    <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-300">
                      <tr>
                        <th className="p-2 border-r border-slate-300">No.</th>
                        <th className="p-2 border-r border-slate-300">Nama Barang</th>
                        <th className="p-2 border-r border-slate-300 text-center">Satuan</th>
                        <th className="p-2 border-r border-slate-300 text-center">Qty Request</th>
                        <th className="p-2">Catatan Spesifikasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {selectedPR.items.map((it, i) => (
                        <tr key={i}>
                          <td className="p-2 border-r border-slate-200 text-center">{i + 1}</td>
                          <td className="p-2 border-r border-slate-200 font-semibold text-slate-800">
                            {it.inventoryName}
                          </td>
                          <td className="p-2 border-r border-slate-200 text-center text-slate-600">{it.uomName}</td>
                          <td className="p-2 border-r border-slate-200 text-center font-bold text-amber-700">{it.qty}</td>
                          <td className="p-2 text-slate-600">{it.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Signatures */}
                  <div className="grid grid-cols-3 gap-4 text-center text-[11px] text-slate-600 pt-8 border-t border-slate-200">
                    <div>
                      <p>Pemohon (Chef / Head),</p>
                      <div className="h-16"></div>
                      <p className="font-bold text-slate-800">( Staff Dapur )</p>
                    </div>
                    <div>
                      <p>Persetujuan Manager,</p>
                      <div className="h-16"></div>
                      <p className="font-bold text-slate-800">( Head Kitchen Manager )</p>
                    </div>
                    <div>
                      <p>Diterima Purchasing,</p>
                      <div className="h-16"></div>
                      <p className="font-bold text-slate-800">( Purchasing Staff )</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2">
                {selectedPR?.header.status === 'Pending Approval' && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus(selectedPR.header.id, 'Approved')}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve PR
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedPR.header.id, 'Rejected')}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 font-bold text-xs flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject PR
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-500/20"
                >
                  <Printer className="w-4 h-4" /> Cetak Document PR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

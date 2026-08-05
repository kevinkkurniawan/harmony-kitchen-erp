'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  RotateCcw,
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
  AlertOctagon,
  DollarSign,
} from 'lucide-react';
import { ERPProduct, Supplier } from '@/types/erp';

export interface ReturnItem {
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

export interface ReturnHeader {
  id: string | number;
  return_no: string;
  return_date: string;
  mr_no: string;
  supplier_id: string | number;
  supplier_name: string;
  wh_name: string;
  return_reason: string;
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

interface PurchaseReturnManagerProps {
  isDark: boolean;
}

export default function PurchaseReturnManager({ isDark }: PurchaseReturnManagerProps) {
  // Mode View: 'list' | 'create'
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');

  // List View States
  const [returnsList, setReturnsList] = useState<ReturnHeader[]>([]);
  const [listSearch, setListSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);

  // Form Header States
  const [returnNo, setReturnNo] = useState<string>(
    () => 'RET-' + new Date().toISOString().slice(2, 7).replace('-', '') + '-' + Math.floor(1000 + Math.random() * 9000)
  );
  const [returnDate, setReturnDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [mrNo, setMrNo] = useState<string>('');
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedSupplierName, setSelectedSupplierName] = useState<string>('');
  const [whName, setWhName] = useState<string>('Gudang Utama Dapur');
  const [returnReason, setReturnReason] = useState<string>('Barang Cacat / Damage');
  const [description, setDescription] = useState<string>('');

  // Item Entry States
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [productSearch, setProductSearch] = useState<string>('');
  const [searchResults, setSearchResults] = useState<ERPProduct[]>([]);
  const [isSearchingProduct, setIsSearchingProduct] = useState<boolean>(false);

  // Detail / Print Modal
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [selectedReturn, setSelectedReturn] = useState<{ header: ReturnHeader; items: ReturnItem[] } | null>(null);
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

  // Fetch Suppliers
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await fetch('/api/suppliers');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setSuppliersList(json.data);
          if (json.data.length > 0 && !selectedSupplierId) {
            setSelectedSupplierId(String(json.data[0].id));
            setSelectedSupplierName(json.data[0].supplierName || (json.data[0] as any).supplier_name || '');
          }
        }
      } catch (err) {
        console.error('Failed to fetch suppliers:', err);
      }
    };
    fetchSuppliers();
  }, []);

  // Fetch Returns List
  const fetchReturnsList = useCallback(async () => {
    setIsLoadingList(true);
    try {
      let url = `/api/purchasing/returns?q=${encodeURIComponent(listSearch)}`;
      if (statusFilter !== 'ALL') {
        url += `&status=${encodeURIComponent(statusFilter)}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setReturnsList(json.data);
      }
    } catch (err) {
      console.error('Error fetching Returns:', err);
      addToast('Gagal memuat daftar Retur Pembelian', 'error');
    } finally {
      setIsLoadingList(false);
    }
  }, [listSearch, statusFilter, addToast]);

  useEffect(() => {
    fetchReturnsList();
  }, [fetchReturnsList]);

  // Product Search debounce for adding items to Return
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
    const price = Number(product.hpp || product.price || 50000);

    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex].qty += 1;
      updated[existingIndex].subtotal = updated[existingIndex].qty * updated[existingIndex].unitPrice;
      setItems(updated);
    } else {
      const newItem: ReturnItem = {
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
    addToast(`Item ${name} ditambahkan ke retur`, 'info');
  };

  const handleUpdateItemQty = (index: number, newQty: number) => {
    const qty = Math.max(1, newQty);
    const updated = [...items];
    updated[index].qty = qty;
    updated[index].subtotal = qty * updated[index].unitPrice;
    setItems(updated);
  };

  const handleUpdateItemPrice = (index: number, newPrice: number) => {
    const price = Math.max(0, newPrice);
    const updated = [...items];
    updated[index].unitPrice = price;
    updated[index].subtotal = updated[index].qty * price;
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculatedTotalAmount = items.reduce((acc, item) => acc + item.subtotal, 0);

  // Save Return
  const handleSaveReturn = async (status: 'Draft' | 'Approved') => {
    if (!selectedSupplierName) {
      addToast('Pilih Supplier terlebih dahulu!', 'warning');
      return;
    }
    if (items.length === 0) {
      addToast('Tambahkan minimal 1 item produk yang diretur!', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        return_no: returnNo,
        return_date: returnDate,
        mr_no: mrNo,
        supplier_id: selectedSupplierId,
        supplier_name: selectedSupplierName,
        wh_name: whName,
        return_reason: returnReason,
        description,
        status,
        items,
      };

      const res = await fetch('/api/purchasing/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        addToast(`Retur Pembelian ${returnNo} berhasil disimpan (${status})!`, 'success');
        setReturnNo('RET-' + new Date().toISOString().slice(2, 7).replace('-', '') + '-' + Math.floor(1000 + Math.random() * 9000));
        setItems([]);
        setDescription('');
        setViewMode('list');
        fetchReturnsList();
      } else {
        addToast(json.error || 'Gagal menyimpan Retur', 'error');
      }
    } catch (err: any) {
      console.error('Save Return error:', err);
      addToast('Terjadi kesalahan koneksi saat menyimpan Retur', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // View Details Modal
  const handleOpenDetailModal = async (retId: string | number) => {
    setIsLoadingDetail(true);
    setIsDetailModalOpen(true);
    try {
      const res = await fetch(`/api/purchasing/returns?id=${retId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setSelectedReturn({
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
      console.error('Error loading Return detail:', err);
      addToast('Gagal memuat detail Retur', 'error');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleUpdateStatus = async (retId: string | number, newStatus: string) => {
    try {
      const res = await fetch('/api/purchasing/returns', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: retId, status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        addToast(`Status Retur diperbarui menjadi ${newStatus}`, 'success');
        if (selectedReturn) {
          setSelectedReturn({
            ...selectedReturn,
            header: { ...selectedReturn.header, status: newStatus },
          });
        }
        fetchReturnsList();
      }
    } catch (err) {
      console.error('Update status error:', err);
    }
  };

  // Stats
  const totalReturnCount = returnsList.length;
  const completedCount = returnsList.filter((r) => r.status === 'Completed').length;
  const activeCount = returnsList.filter((r) => r.status === 'Approved').length;
  const totalReturnValue = returnsList.reduce((acc, r) => acc + Number(r.total_amount || 0), 0);

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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight flex items-center gap-2">
              Retur Pembelian (Purchase Return)
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                PUR_RET 1:1
              </span>
            </h1>
            <p className="text-xs text-slate-400">Pengembalian barang rusak / cacat / tidak sesuai ke supplier</p>
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
              Kembali ke Daftar Retur
            </button>
          ) : (
            <button
              onClick={() => {
                setReturnNo('RET-' + new Date().toISOString().slice(2, 7).replace('-', '') + '-' + Math.floor(1000 + Math.random() * 9000));
                setItems([]);
                setViewMode('create');
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-600 hover:from-rose-600 hover:to-amber-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-rose-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Buat Retur Pembelian Baru
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
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold">Total Dokumen Retur</p>
                <p className="text-xl font-extrabold">{totalReturnCount} Document</p>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border flex items-center gap-4 ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold">Retur Disetujui (Active)</p>
                <p className="text-xl font-extrabold text-amber-400">{activeCount} Retur</p>
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
                <p className="text-xs text-slate-400 font-semibold">Selesai (Completed)</p>
                <p className="text-xl font-extrabold text-emerald-400">{completedCount} Retur</p>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border flex items-center gap-4 ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold">Total Nilai Barang Diretur</p>
                <p className="text-lg font-extrabold text-purple-400">Rp {totalReturnValue.toLocaleString('id-ID')}</p>
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
                placeholder="Cari No. Retur, Supplier, No. Receiving..."
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 text-xs rounded-xl border outline-none transition-colors ${
                  isDark
                    ? 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500 focus:border-rose-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-rose-500'
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
                <option value="Draft">Draft</option>
                <option value="Approved">Approved</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              <button
                onClick={fetchReturnsList}
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
                    <th className="px-4 py-3.5">No. Retur</th>
                    <th className="px-4 py-3.5">Tanggal</th>
                    <th className="px-4 py-3.5">No. Receiving / MR</th>
                    <th className="px-4 py-3.5">Supplier</th>
                    <th className="px-4 py-3.5">Alasan Retur</th>
                    <th className="px-4 py-3.5 text-center">Items</th>
                    <th className="px-4 py-3.5 text-right">Nilai Retur (Rp)</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {isLoadingList ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-500" />
                        <span>Memuat data Retur Pembelian...</span>
                      </td>
                    </tr>
                  ) : returnsList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                        Tidak ada dokumen Retur Pembelian ditemukan.
                      </td>
                    </tr>
                  ) : (
                    returnsList.map((ret) => (
                      <tr key={ret.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                        <td className="px-4 py-3 font-bold text-rose-400">{ret.return_no}</td>
                        <td className="px-4 py-3 text-slate-300">
                          {new Date(ret.return_date).toLocaleDateString('id-ID')}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-400">{ret.mr_no || '-'}</td>
                        <td className="px-4 py-3 font-semibold text-white">{ret.supplier_name}</td>
                        <td className="px-4 py-3 text-slate-300">{ret.return_reason}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium">
                            {ret.item_count || 0} item ({ret.total_qty || 0} pcs)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold text-rose-400">
                          Rp {Number(ret.total_amount || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                              ret.status === 'Completed'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : ret.status === 'Approved'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : ret.status === 'Cancelled'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                            }`}
                          >
                            {ret.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleOpenDetailModal(ret.id)}
                            className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold text-xs flex items-center gap-1.5 mx-auto active:scale-95 transition-all"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Detail / Print
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
        /* FORM CREATE / EDIT RETUR */
        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
          {/* Header Card */}
          <div
            className={`p-6 rounded-2xl border flex flex-col gap-5 ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-rose-500 flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Header Retur Pembelian
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">No. Retur (Auto Generated)</label>
                <input
                  type="text"
                  value={returnNo}
                  onChange={(e) => setReturnNo(e.target.value)}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border font-mono font-bold outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-rose-400' : 'bg-slate-100 border-slate-300 text-rose-600'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">Supplier *</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => {
                    setSelectedSupplierId(e.target.value);
                    const sup = suppliersList.find((s) => String(s.id) === e.target.value);
                    if (sup) setSelectedSupplierName(sup.supplierName || (sup as any).supplier_name || '');
                  }}
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none cursor-pointer ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">-- Pilih Supplier --</option>
                  {suppliersList.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.supplierName || (sup as any).supplier_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">No. Receiving / MR (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: MR-EXP-241101"
                  value={mrNo}
                  onChange={(e) => setMrNo(e.target.value)}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border font-mono outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">Tanggal Retur</label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">Alasan Retur *</label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none cursor-pointer ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="Barang Cacat / Damage">Barang Cacat / Damage Saat Pengiriman</option>
                  <option value="Kadaluarsa / Expired">Kadaluarsa / Expired</option>
                  <option value="Tidak Sesuai Spesifikasi">Tidak Sesuai Spesifikasi Pesanan</option>
                  <option value="Kelebihan Kirim Supplier">Kelebihan Kirim dari Supplier</option>
                </select>
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
              <label className="block text-xs font-semibold mb-1.5 text-slate-400">Catatan Retur</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Rincian alasan retur, nomor berita acara barang rusak, dll."
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
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-rose-500 flex items-center gap-2">
              <Package className="w-4 h-4" /> Cari & Tambah Produk Diretur
            </h2>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                ref={productSearchRef}
                type="text"
                placeholder="Ketik Nama Produk / Scan Barcode yang akan diretur..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border outline-none transition-colors ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-rose-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-rose-500'
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
                          isDark ? 'hover:bg-slate-800' : 'hover:bg-rose-50'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-rose-400">
                            {product.inventoryName || (product as any).inventory_name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {product.inventoryNo || (product as any).inventory_no} | Barcode: {product.barcode || '-'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-emerald-400">
                            Rp {Number(product.hpp || product.price || 0).toLocaleString('id-ID')}
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
                    <th className="px-4 py-3 text-center w-28">Qty Retur</th>
                    <th className="px-4 py-3 text-right w-36">Harga Beli (Rp)</th>
                    <th className="px-4 py-3 text-right w-40">Subtotal Retur (Rp)</th>
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
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => handleUpdateItemPrice(idx, parseFloat(e.target.value) || 0)}
                            className={`w-32 px-2 py-1 text-right font-bold rounded-lg border outline-none ${
                              isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold text-rose-400">
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
                  <span className="text-rose-500">Total Nilai Retur:</span>
                  <span className="text-rose-400">Rp {calculatedTotalAmount.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            {/* Submit Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => handleSaveReturn('Draft')}
                disabled={isSubmitting}
                className={`px-5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 active:scale-95 transition-all ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-amber-500/30'
                    : 'bg-white hover:bg-amber-50 text-amber-600 border-amber-300'
                }`}
              >
                <Clock className="w-4 h-4" />
                Simpan Draft Retur
              </button>

              <button
                onClick={() => handleSaveReturn('Approved')}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-600 hover:from-rose-600 hover:to-amber-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-rose-500/25 active:scale-95 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Simpan & Setujui Retur (Approved)
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
                <RotateCcw className="w-5 h-5 text-rose-500" />
                <h3 className="font-extrabold text-sm">Preview Retur Pembelian #{selectedReturn?.header.return_no}</h3>
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
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-500" />
                  <span>Memuat rincian Retur Pembelian...</span>
                </div>
              ) : selectedReturn ? (
                <div className="bg-white text-slate-900 p-8 rounded-xl border border-slate-300 shadow-inner">
                  {/* Voucher Header */}
                  <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-6">
                    <div>
                      <h2 className="text-xl font-black tracking-tight text-rose-600 uppercase">
                        HARMONY KITCHEN & RESTO
                      </h2>
                      <p className="text-xs text-slate-600">Form Pengembalian Barang Pembelian (Purchase Return)</p>
                    </div>
                    <div className="text-right">
                      <h3 className="text-lg font-extrabold uppercase tracking-wide text-slate-800">
                        RETUR PEMBELIAN
                      </h3>
                      <p className="text-xs font-mono font-bold text-rose-600">{selectedReturn.header.return_no}</p>
                      <p className="text-xs text-slate-500">
                        Tgl Retur: {new Date(selectedReturn.header.return_date).toLocaleDateString('id-ID')}
                      </p>
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-rose-100 text-rose-800 border border-rose-300">
                        STATUS: {selectedReturn.header.status}
                      </span>
                    </div>
                  </div>

                  {/* Header Details */}
                  <div className="grid grid-cols-2 gap-6 text-xs mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <p className="font-extrabold text-slate-500 uppercase text-[10px] mb-1">Kepada Supplier:</p>
                      <p className="font-bold text-sm text-slate-800">{selectedReturn.header.supplier_name}</p>
                      <p className="text-slate-600">Ref. Receiving: {selectedReturn.header.mr_no || '-'}</p>
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-500 uppercase text-[10px] mb-1">Alasan Retur:</p>
                      <p className="font-bold text-slate-800">{selectedReturn.header.return_reason}</p>
                      <p className="text-slate-600">Gudang Asal: {selectedReturn.header.wh_name}</p>
                      <p className="text-slate-600">Keterangan: {selectedReturn.header.description || '-'}</p>
                    </div>
                  </div>

                  {/* Items Table */}
                  <table className="w-full text-left text-xs mb-6 border border-slate-300">
                    <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-300">
                      <tr>
                        <th className="p-2 border-r border-slate-300">No.</th>
                        <th className="p-2 border-r border-slate-300">Nama Barang</th>
                        <th className="p-2 border-r border-slate-300 text-center">Satuan</th>
                        <th className="p-2 border-r border-slate-300 text-center">Qty Retur</th>
                        <th className="p-2 border-r border-slate-300 text-right">Harga Beli</th>
                        <th className="p-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {selectedReturn.items.map((it, i) => (
                        <tr key={i}>
                          <td className="p-2 border-r border-slate-200 text-center">{i + 1}</td>
                          <td className="p-2 border-r border-slate-200 font-semibold text-slate-800">
                            {it.inventoryName}
                          </td>
                          <td className="p-2 border-r border-slate-200 text-center text-slate-600">{it.uomName}</td>
                          <td className="p-2 border-r border-slate-200 text-center font-bold text-rose-700">{it.qty}</td>
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
                        <span>Total Nilai Retur:</span>
                        <span className="text-rose-600">
                          Rp {Number(selectedReturn.header.total_amount || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="grid grid-cols-3 gap-4 text-center text-[11px] text-slate-600 pt-8 border-t border-slate-200">
                    <div>
                      <p>Dibuat Oleh (Gudang),</p>
                      <div className="h-16"></div>
                      <p className="font-bold text-slate-800">( Staf Logistik / Gudang )</p>
                    </div>
                    <div>
                      <p>Disetujui Oleh,</p>
                      <div className="h-16"></div>
                      <p className="font-bold text-slate-800">( Head Kitchen Manager )</p>
                    </div>
                    <div>
                      <p>Diterima (Supplier),</p>
                      <div className="h-16"></div>
                      <p className="font-bold text-slate-800">( Kurir / Supir Supplier )</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div>
                {selectedReturn?.header.status === 'Approved' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedReturn.header.id, 'Completed')}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Tandai Selesai (Completed)
                  </button>
                )}
              </div>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-rose-500/20"
              >
                <Printer className="w-4 h-4" /> Cetak Document Retur
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

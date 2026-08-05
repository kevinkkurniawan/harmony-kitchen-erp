'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  Plus,
  Search,
  RefreshCw,
  Printer,
  CheckCircle2,
  Clock,
  Send,
  XCircle,
  Building2,
  Calendar,
  Truck,
  DollarSign,
  Package,
  Trash2,
  Eye,
  ArrowLeft,
  AlertTriangle,
  X,
  Zap,
  ShoppingBag,
  Percent,
} from 'lucide-react';
import { ERPProduct, Supplier } from '@/types/erp';

export interface POItem {
  inventoryId: string;
  barcode: string;
  inventoryNo: string;
  inventoryName: string;
  uomName: string;
  qty: number;
  unitPrice: number;
  discountPct: number;
  subtotal: number;
  notes: string;
}

export interface POHeader {
  id: string | number;
  po_no: string;
  po_date: string;
  supplier_id: string | number;
  supplier_name: string;
  payment_term: string;
  delivery_date: string;
  wh_name: string;
  description: string;
  subtotal: number;
  tax_pct: number;
  tax_amount: number;
  discount_amount: number;
  grand_total: number;
  status: 'Draft' | 'Approved' | 'Sent' | 'Completed' | 'Cancelled' | string;
  item_count?: number;
  total_qty?: number;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

interface PurchaseOrderManagerProps {
  isDark: boolean;
}

export default function PurchaseOrderManager({ isDark }: PurchaseOrderManagerProps) {
  // Mode View: 'list' | 'create'
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');

  // List View States
  const [ordersList, setOrdersList] = useState<POHeader[]>([]);
  const [listSearch, setListSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);

  // Form Header States
  const [poNo, setPoNo] = useState<string>(
    () => 'PO-' + new Date().toISOString().slice(2, 7).replace('-', '') + '-' + Math.floor(1000 + Math.random() * 9000)
  );
  const [poDate, setPoDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedSupplierName, setSelectedSupplierName] = useState<string>('');
  const [paymentTerm, setPaymentTerm] = useState<string>('TOP 30 Hari');
  const [deliveryDate, setDeliveryDate] = useState<string>(
    () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [whName, setWhName] = useState<string>('Gudang Utama Dapur');
  const [description, setDescription] = useState<string>('');
  const [taxPct, setTaxPct] = useState<number>(11);
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // Item Entry States
  const [items, setItems] = useState<POItem[]>([]);
  const [productSearch, setProductSearch] = useState<string>('');
  const [searchResults, setSearchResults] = useState<ERPProduct[]>([]);
  const [isSearchingProduct, setIsSearchingProduct] = useState<boolean>(false);

  // Detail / Print Modal
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [selectedPO, setSelectedPO] = useState<{ header: POHeader; items: POItem[] } | null>(null);
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

  // Fetch Suppliers for dropdown
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await fetch('/api/suppliers');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setSuppliersList(json.data);
          if (json.data.length > 0 && !selectedSupplierId) {
            setSelectedSupplierId(String(json.data[0].id));
            setSelectedSupplierName(json.data[0].supplier_name);
          }
        }
      } catch (err) {
        console.error('Failed to fetch suppliers:', err);
      }
    };
    fetchSuppliers();
  }, []);

  // Fetch PO List
  const fetchOrdersList = useCallback(async () => {
    setIsLoadingList(true);
    try {
      let url = `/api/purchasing/orders?q=${encodeURIComponent(listSearch)}`;
      if (statusFilter !== 'ALL') {
        url += `&status=${encodeURIComponent(statusFilter)}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setOrdersList(json.data);
      }
    } catch (err) {
      console.error('Error fetching POs:', err);
      addToast('Gagal memuat daftar Order Pembelian', 'error');
    } finally {
      setIsLoadingList(false);
    }
  }, [listSearch, statusFilter, addToast]);

  useEffect(() => {
    fetchOrdersList();
  }, [fetchOrdersList]);

  // Product Search debounce for adding items to PO
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

    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex].qty += 1;
      updated[existingIndex].subtotal =
        updated[existingIndex].qty *
        updated[existingIndex].unitPrice *
        (1 - updated[existingIndex].discountPct / 100);
      setItems(updated);
    } else {
      const price = Number(product.hpp || product.price || 50000);
      const name = product.inventoryName || (product as any).inventory_name || 'Item';
      const no = product.inventoryNo || (product as any).inventory_no || `INV-${product.id}`;
      const uom = product.uomName || (product as any).uom_name || 'PCS';
      const newItem: POItem = {
        inventoryId: String(product.id),
        barcode: product.barcode || '',
        inventoryNo: no,
        inventoryName: name,
        uomName: uom,
        qty: 1,
        unitPrice: price,
        discountPct: 0,
        subtotal: price,
        notes: '',
      };
      setItems([...items, newItem]);
    }

    setProductSearch('');
    setSearchResults([]);
    addToast(`Item ${product.inventoryName || (product as any).inventory_name} ditambahkan`, 'info');
  };

  const handleUpdateItemQty = (index: number, newQty: number) => {
    const qty = Math.max(1, newQty);
    const updated = [...items];
    updated[index].qty = qty;
    updated[index].subtotal = qty * updated[index].unitPrice * (1 - updated[index].discountPct / 100);
    setItems(updated);
  };

  const handleUpdateItemPrice = (index: number, newPrice: number) => {
    const price = Math.max(0, newPrice);
    const updated = [...items];
    updated[index].unitPrice = price;
    updated[index].subtotal = updated[index].qty * price * (1 - updated[index].discountPct / 100);
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculations
  const calculatedSubtotal = items.reduce((acc, item) => acc + item.subtotal, 0);
  const netSubtotal = Math.max(0, calculatedSubtotal - discountAmount);
  const calculatedTaxAmount = Math.round(netSubtotal * (taxPct / 100));
  const calculatedGrandTotal = netSubtotal + calculatedTaxAmount;

  // Handle Save PO
  const handleSavePO = async (status: 'Draft' | 'Approved') => {
    if (!selectedSupplierName) {
      addToast('Pilih Supplier terlebih dahulu!', 'warning');
      return;
    }
    if (items.length === 0) {
      addToast('Tambahkan minimal 1 item produk untuk PO!', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        po_no: poNo,
        po_date: poDate,
        supplier_id: selectedSupplierId,
        supplier_name: selectedSupplierName,
        payment_term: paymentTerm,
        delivery_date: deliveryDate,
        wh_name: whName,
        description,
        tax_pct: taxPct,
        discount_amount: discountAmount,
        status,
        items,
      };

      const res = await fetch('/api/purchasing/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        addToast(`Order Pembelian ${poNo} berhasil disimpan (${status})!`, 'success');
        // Reset Form
        setPoNo('PO-' + new Date().toISOString().slice(2, 7).replace('-', '') + '-' + Math.floor(1000 + Math.random() * 9000));
        setItems([]);
        setDescription('');
        setViewMode('list');
        fetchOrdersList();
      } else {
        addToast(json.error || 'Gagal menyimpan PO', 'error');
      }
    } catch (err: any) {
      console.error('Save PO error:', err);
      addToast('Terjadi kesalahan koneksi saat menyimpan PO', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // View Details Modal
  const handleOpenDetailModal = async (poId: string | number) => {
    setIsLoadingDetail(true);
    setIsDetailModalOpen(true);
    try {
      const res = await fetch(`/api/purchasing/orders?id=${poId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setSelectedPO({
          header: json.data.header,
          items: json.data.items.map((i: any) => ({
            inventoryId: String(i.inventory_id),
            barcode: i.barcode,
            inventoryNo: i.inventory_no,
            inventoryName: i.inventory_name,
            uomName: i.uom_name,
            qty: Number(i.qty),
            unitPrice: Number(i.unit_price),
            discountPct: Number(i.discount_pct),
            subtotal: Number(i.subtotal),
            notes: i.notes || '',
          })),
        });
      }
    } catch (err) {
      console.error('Error loading PO detail:', err);
      addToast('Gagal memuat detail PO', 'error');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleUpdateStatus = async (poId: string | number, newStatus: string) => {
    try {
      const res = await fetch('/api/purchasing/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: poId, status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        addToast(`Status PO diperbarui menjadi ${newStatus}`, 'success');
        if (selectedPO) {
          setSelectedPO({
            ...selectedPO,
            header: { ...selectedPO.header, status: newStatus },
          });
        }
        fetchOrdersList();
      }
    } catch (err) {
      console.error('Update status error:', err);
    }
  };

  // Filter totals stats
  const totalPOCount = ordersList.length;
  const draftCount = ordersList.filter((o) => o.status === 'Draft').length;
  const activeCount = ordersList.filter((o) => o.status === 'Approved' || o.status === 'Sent').length;
  const totalValue = ordersList.reduce((acc, o) => acc + Number(o.grand_total || 0), 0);

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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight flex items-center gap-2">
              Order Pembelian (Purchase Order)
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-500 border border-orange-500/20">
                PUR_PO 1:1
              </span>
            </h1>
            <p className="text-xs text-slate-400">Pemesanan barang & perlengkapan kitchen ke supplier</p>
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
              Kembali ke Daftar PO
            </button>
          ) : (
            <button
              onClick={() => {
                setPoNo('PO-' + new Date().toISOString().slice(2, 7).replace('-', '') + '-' + Math.floor(1000 + Math.random() * 9000));
                setItems([]);
                setViewMode('create');
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Buat Purchase Order Baru
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
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold">Total Order PO</p>
                <p className="text-xl font-extrabold">{totalPOCount} Document</p>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border flex items-center gap-4 ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold">Draft / Pending</p>
                <p className="text-xl font-extrabold text-amber-500">{draftCount} PO</p>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border flex items-center gap-4 ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                <Send className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold">Active / Sent</p>
                <p className="text-xl font-extrabold text-blue-500">{activeCount} PO</p>
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
                <p className="text-xs text-slate-400 font-semibold">Total Nilai Pemesanan</p>
                <p className="text-lg font-extrabold text-emerald-500">Rp {totalValue.toLocaleString('id-ID')}</p>
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
                placeholder="Cari No. PO, Supplier, Keterangan..."
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 text-xs rounded-xl border outline-none transition-colors ${
                  isDark
                    ? 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500 focus:border-orange-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-orange-500'
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
                <option value="Sent">Sent (Terkirim)</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              <button
                onClick={fetchOrdersList}
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
                    <th className="px-4 py-3.5">No. PO</th>
                    <th className="px-4 py-3.5">Tanggal</th>
                    <th className="px-4 py-3.5">Supplier</th>
                    <th className="px-4 py-3.5">Term / Est. Kirim</th>
                    <th className="px-4 py-3.5 text-center">Items</th>
                    <th className="px-4 py-3.5 text-right">Grand Total (Rp)</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {isLoadingList ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-500" />
                        <span>Memuat data Purchase Orders...</span>
                      </td>
                    </tr>
                  ) : ordersList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                        Tidak ada Purchase Order ditemukan.
                      </td>
                    </tr>
                  ) : (
                    ordersList.map((po) => (
                      <tr
                        key={po.id}
                        className={`transition-colors ${
                          isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-4 py-3 font-bold text-orange-400">{po.po_no}</td>
                        <td className="px-4 py-3 font-medium text-slate-300">
                          {new Date(po.po_date).toLocaleDateString('id-ID')}
                        </td>
                        <td className="px-4 py-3 font-semibold text-white">{po.supplier_name}</td>
                        <td className="px-4 py-3 text-slate-400">
                          <div>{po.payment_term}</div>
                          <div className="text-[10px] text-slate-500">
                            Est: {po.delivery_date ? new Date(po.delivery_date).toLocaleDateString('id-ID') : '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium">
                            {po.item_count || 0} item ({po.total_qty || 0} pcs)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold text-emerald-400">
                          Rp {Number(po.grand_total || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                              po.status === 'Approved'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : po.status === 'Sent'
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                : po.status === 'Completed'
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                                : po.status === 'Cancelled'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {po.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleOpenDetailModal(po.id)}
                            className="px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 font-semibold text-xs flex items-center gap-1.5 mx-auto active:scale-95 transition-all"
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
        /* FORM CREATE / EDIT PO */
        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
          {/* Header Card */}
          <div
            className={`p-6 rounded-2xl border flex flex-col gap-5 ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-orange-500 flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Informasi Utama Purchase Order
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">Nomor PO (Auto Generated)</label>
                <input
                  type="text"
                  value={poNo}
                  onChange={(e) => setPoNo(e.target.value)}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border font-mono font-bold outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-orange-400' : 'bg-slate-100 border-slate-300 text-orange-600'
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
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">Jangka Waktu Pembayaran (Term)</label>
                <select
                  value={paymentTerm}
                  onChange={(e) => setPaymentTerm(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none cursor-pointer ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="TOP 14 Hari">TOP 14 Hari</option>
                  <option value="TOP 30 Hari">TOP 30 Hari</option>
                  <option value="TOP 60 Hari">TOP 60 Hari</option>
                  <option value="Cash on Delivery (COD)">Cash on Delivery (COD)</option>
                  <option value="Cash / Transfer">Cash / Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">Tanggal PO</label>
                <input
                  type="date"
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">Estimasi Tgl Pengiriman</label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">Gudang Tujuan</label>
                <input
                  type="text"
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  placeholder="Contoh: Gudang Utama Dapur"
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 text-slate-400">Keterangan / Catatan Order</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Catatan khusus pemesanan, peruntukan dapur, spesifikasi merk, dll."
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
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-orange-500 flex items-center gap-2">
              <Package className="w-4 h-4" /> Cari & Tambah Item Produk
            </h2>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                ref={productSearchRef}
                type="text"
                placeholder="Ketik Nama Produk / Scan Barcode / No Inventory untuk ditambahkan..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border outline-none transition-colors ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-orange-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-orange-500'
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
                          isDark ? 'hover:bg-slate-800' : 'hover:bg-orange-50'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-orange-400">
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
                    <th className="px-4 py-3 text-center w-28">Qty PO</th>
                    <th className="px-4 py-3 text-right w-36">Harga Satuan (Rp)</th>
                    <th className="px-4 py-3 text-center w-24">Disc (%)</th>
                    <th className="px-4 py-3 text-right w-40">Subtotal (Rp)</th>
                    <th className="px-4 py-3 text-center w-16">Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        Belum ada item ditambahkan ke PO. Gunakan kolom pencarian di atas.
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
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discountPct}
                            onChange={(e) => {
                              const updated = [...items];
                              const disc = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                              updated[idx].discountPct = disc;
                              updated[idx].subtotal = updated[idx].qty * updated[idx].unitPrice * (1 - disc / 100);
                              setItems(updated);
                            }}
                            className={`w-16 px-2 py-1 text-center rounded-lg border outline-none ${
                              isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          />
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

            {/* Calculations Box */}
            <div className="flex flex-col sm:flex-row justify-end gap-6 pt-4 border-t border-slate-800">
              <div className="w-full sm:w-80 flex flex-col gap-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span className="font-bold text-white">Rp {calculatedSubtotal.toLocaleString('id-ID')}</span>
                </div>

                <div className="flex justify-between items-center text-slate-400">
                  <span>Diskon Tambahan (Rp):</span>
                  <input
                    type="number"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className={`w-32 px-2 py-1 text-right font-bold rounded-lg border outline-none ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div className="flex justify-between items-center text-slate-400">
                  <span>PPN ({taxPct}%):</span>
                  <span className="font-bold text-white">Rp {calculatedTaxAmount.toLocaleString('id-ID')}</span>
                </div>

                <div className="flex justify-between pt-3 border-t border-slate-800 text-sm font-extrabold">
                  <span className="text-orange-500">Grand Total:</span>
                  <span className="text-emerald-400">Rp {calculatedGrandTotal.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            {/* Submit Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => handleSavePO('Draft')}
                disabled={isSubmitting}
                className={`px-5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 active:scale-95 transition-all ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-amber-500/30'
                    : 'bg-white hover:bg-amber-50 text-amber-600 border-amber-300'
                }`}
              >
                <Clock className="w-4 h-4" />
                Simpan sebagai Draft
              </button>

              <button
                onClick={() => handleSavePO('Approved')}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-orange-500/25 active:scale-95 transition-all cursor-pointer"
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
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-500" />
                <h3 className="font-extrabold text-sm">Preview Purchase Order #{selectedPO?.header.po_no}</h3>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Printable Voucher Content */}
            <div className="p-6 overflow-y-auto flex-1 font-sans">
              {isLoadingDetail ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-500" />
                  <span>Memuat detail Purchase Order...</span>
                </div>
              ) : selectedPO ? (
                <div className="bg-white text-slate-900 p-8 rounded-xl border border-slate-300 shadow-inner">
                  {/* Voucher Header */}
                  <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-6">
                    <div>
                      <h2 className="text-xl font-black tracking-tight text-orange-600 uppercase">
                        HARMONY KITCHEN & RESTO
                      </h2>
                      <p className="text-xs text-slate-600">Jl. Dapur Utama No. 88, Surabaya, Jawa Timur</p>
                      <p className="text-xs text-slate-600">Telp: (031) 8829-1002 | Email: purchasing@harmonykitchen.com</p>
                    </div>
                    <div className="text-right">
                      <h3 className="text-lg font-extrabold uppercase tracking-wide text-slate-800">
                        PURCHASE ORDER
                      </h3>
                      <p className="text-xs font-mono font-bold text-orange-600">{selectedPO.header.po_no}</p>
                      <p className="text-xs text-slate-500">
                        Tgl PO: {new Date(selectedPO.header.po_date).toLocaleDateString('id-ID')}
                      </p>
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-orange-100 text-orange-700 border border-orange-300">
                        STATUS: {selectedPO.header.status}
                      </span>
                    </div>
                  </div>

                  {/* Supplier & Delivery Details Grid */}
                  <div className="grid grid-cols-2 gap-6 text-xs mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <p className="font-extrabold text-slate-500 uppercase text-[10px] mb-1">Kepada Supplier:</p>
                      <p className="font-bold text-sm text-slate-800">{selectedPO.header.supplier_name}</p>
                      <p className="text-slate-600">Jangka Waktu: {selectedPO.header.payment_term}</p>
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-500 uppercase text-[10px] mb-1">Tujuan Pengiriman:</p>
                      <p className="font-bold text-slate-800">{selectedPO.header.wh_name}</p>
                      <p className="text-slate-600">
                        Est. Kirim:{' '}
                        {selectedPO.header.delivery_date
                          ? new Date(selectedPO.header.delivery_date).toLocaleDateString('id-ID')
                          : '-'}
                      </p>
                      <p className="text-slate-600">Catatan: {selectedPO.header.description || '-'}</p>
                    </div>
                  </div>

                  {/* Items Table */}
                  <table className="w-full text-left text-xs mb-6 border border-slate-300">
                    <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-300">
                      <tr>
                        <th className="p-2 border-r border-slate-300">No.</th>
                        <th className="p-2 border-r border-slate-300">Nama Barang</th>
                        <th className="p-2 border-r border-slate-300 text-center">Satuan</th>
                        <th className="p-2 border-r border-slate-300 text-center">Qty</th>
                        <th className="p-2 border-r border-slate-300 text-right">Harga Satuan</th>
                        <th className="p-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {selectedPO.items.map((it, i) => (
                        <tr key={i}>
                          <td className="p-2 border-r border-slate-200 text-center">{i + 1}</td>
                          <td className="p-2 border-r border-slate-200 font-semibold text-slate-800">
                            {it.inventoryName}
                          </td>
                          <td className="p-2 border-r border-slate-200 text-center text-slate-600">{it.uomName}</td>
                          <td className="p-2 border-r border-slate-200 text-center font-bold">{it.qty}</td>
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

                  {/* Totals Summary */}
                  <div className="flex justify-end text-xs mb-8">
                    <div className="w-64 space-y-1">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal:</span>
                        <span className="font-bold">
                          Rp {Number(selectedPO.header.subtotal || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>PPN (11%):</span>
                        <span className="font-bold">
                          Rp {Number(selectedPO.header.tax_amount || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t-2 border-slate-800 text-sm font-extrabold text-slate-900">
                        <span>Grand Total:</span>
                        <span className="text-orange-600">
                          Rp {Number(selectedPO.header.grand_total || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="grid grid-cols-3 gap-4 text-center text-[11px] text-slate-600 pt-8 border-t border-slate-200">
                    <div>
                      <p>Dibuat Oleh,</p>
                      <div className="h-16"></div>
                      <p className="font-bold text-slate-800">( Staff Purchasing )</p>
                    </div>
                    <div>
                      <p>Disetujui Oleh,</p>
                      <div className="h-16"></div>
                      <p className="font-bold text-slate-800">( Kitchen Manager )</p>
                    </div>
                    <div>
                      <p>Supplier Confirmation,</p>
                      <div className="h-16"></div>
                      <p className="font-bold text-slate-800">( Ttd & Stempel Supplier )</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2">
                {selectedPO?.header.status === 'Draft' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedPO.header.id, 'Approved')}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve PO
                  </button>
                )}
                {selectedPO?.header.status === 'Approved' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedPO.header.id, 'Sent')}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 font-bold text-xs flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> Tandai Terkirim (Sent)
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-orange-500/20"
                >
                  <Printer className="w-4 h-4" /> Cetak Document PO
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

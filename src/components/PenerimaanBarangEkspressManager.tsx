'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  RefreshCw,
  Package,
  Trash2,
  CheckCircle,
  XCircle,
  X,
  AlertTriangle,
  Zap,
  Printer,
  Building2,
  FileText,
  Truck,
  ScanLine,
  Search,
  Plus,
  ArrowLeft,
  Eye,
} from 'lucide-react';
import { ERPProduct, Supplier } from '@/types/erp';

export interface ExpressReceiptItem {
  inventoryId: string;
  barcode: string;
  inventoryNo: string;
  inventoryName: string;
  uomName: string;
  qty: number;
  description: string;
}

export interface ExpressReceiptHeader {
  id: string;
  mrNo: string;
  mrDate: string;
  supplierId: string;
  supplierName: string;
  doNo: string;
  driverName: string;
  vehicleNo: string;
  whName: string;
  description: string;
  isExpress: boolean;
  isVoid: boolean;
  totalQty?: number;
  itemCount?: number;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

interface PenerimaanBarangEkspressManagerProps {
  isDark: boolean;
}

export default function PenerimaanBarangEkspressManager({ isDark }: PenerimaanBarangEkspressManagerProps) {
  // Mode View: 'list' (Daftar Penerimaan) | 'create' (Form Input Baru)
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');

  // List View States
  const [receiptsList, setReceiptsList] = useState<ExpressReceiptHeader[]>([]);
  const [listSearch, setListSearch] = useState<string>('');
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);

  // Form Header States
  const [mrNo, setMrNo] = useState<string>(() => 'MR-EXP-' + Math.floor(100000 + Math.random() * 900000));
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedSupplierName, setSelectedSupplierName] = useState<string>('');
  const [doNo, setDoNo] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');
  const [vehicleNo, setVehicleNo] = useState<string>('');
  const [whName, setWhName] = useState<string>('Gudang Utama Dapur');
  const [headerDesc, setHeaderDesc] = useState<string>('');

  // Item Entry States
  const [items, setItems] = useState<ExpressReceiptItem[]>([]);
  const [productSearch, setProductSearch] = useState<string>('');
  const [searchResults, setSearchResults] = useState<ERPProduct[]>([]);
  const [isSearchingProduct, setIsSearchingProduct] = useState<boolean>(false);

  // General Loading & Toasts
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Print Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printData, setPrintData] = useState<{ header: ExpressReceiptHeader; items: ExpressReceiptItem[] } | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const addToast = useCallback((text: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // Fetch Express Receipts List
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoadingList(true);
      try {
        const res = await fetch(`/api/purchasing/express?q=${encodeURIComponent(listSearch)}`);
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data)) {
          setReceiptsList(json.data);
        }
      } catch (err) {
        console.error('Error fetching express receipts:', err);
      } finally {
        if (isMounted) setIsLoadingList(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [listSearch]);

  const reloadReceipts = async () => {
    setIsLoadingList(true);
    try {
      const res = await fetch(`/api/purchasing/express?q=${encodeURIComponent(listSearch)}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setReceiptsList(json.data);
      }
    } catch (err) {
      console.error('Error fetching express receipts:', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  // Fetch Suppliers for dropdown
  useEffect(() => {
    let isMounted = true;
    async function loadSuppliers() {
      try {
        const res = await fetch('/api/suppliers?onlyActive=true&all=true');
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data)) {
          setSuppliersList(json.data);
          if (json.data.length > 0) {
            setSelectedSupplierId(json.data[0].id);
            setSelectedSupplierName(json.data[0].supplierName);
          }
        }
      } catch (err) {
        console.error('Error fetching suppliers:', err);
      }
    }
    loadSuppliers();
    return () => { isMounted = false; };
  }, []);

  // Live product search for Barcode / SKU input in create mode
  useEffect(() => {
    let isMounted = true;
    if (!productSearch.trim()) {
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingProduct(true);
      try {
        const res = await fetch(`/api/inventory?q=${encodeURIComponent(productSearch)}`);
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data)) {
          setSearchResults(json.data.slice(0, 8));
        }
      } catch (err) {
        console.error('Error searching products:', err);
      } finally {
        if (isMounted) setIsSearchingProduct(false);
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [productSearch]);

  // Add Product to Receipt Line Items
  const handleAddProductToItems = (prod: ERPProduct) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.inventoryId === prod.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].qty += 1;
        return updated;
      }
      return [
        ...prev,
        {
          inventoryId: prod.id,
          barcode: prod.barcode || '',
          inventoryNo: prod.inventoryNo || '',
          inventoryName: prod.inventoryName,
          uomName: prod.uomName || 'PCS',
          qty: 1,
          description: '',
        },
      ];
    });
    setProductSearch('');
    setSearchResults([]);
    addToast(`"${prod.inventoryName}" ditambahkan`, 'info');
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPrintModalOpen(false);
      } else if (e.key === '/' && viewMode === 'create') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.altKey && e.key.toLowerCase() === 'n' && viewMode === 'list') {
        e.preventDefault();
        setViewMode('create');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode]);

  // Handle Submit Receipt Transaction
  const handleSubmitReceipt = async () => {
    if (items.length === 0) {
      return addToast('Wajib menginput minimal 1 item barang yang diterima', 'warning');
    }
    setIsSubmitting(true);
    try {
      const payload = {
        mrNo,
        supplierId: selectedSupplierId,
        supplierName: selectedSupplierName,
        doNo,
        driverName,
        vehicleNo,
        whName,
        description: headerDesc,
        items,
      };

      const res = await fetch('/api/purchasing/express', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        addToast(json.message, 'success');
        
        // Prepare print preview modal data
        setPrintData({
          header: {
            id: json.id,
            mrNo: json.mrNo,
            mrDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
            supplierId: selectedSupplierId,
            supplierName: selectedSupplierName,
            doNo,
            driverName,
            vehicleNo,
            whName,
            description: headerDesc,
            isExpress: true,
            isVoid: false,
          },
          items,
        });

        // Reset form & return to list mode
        setMrNo('MR-EXP-' + Math.floor(100000 + Math.random() * 900000));
        setDoNo('');
        setDriverName('');
        setVehicleNo('');
        setHeaderDesc('');
        setItems([]);
        setIsPrintModalOpen(true);
        setViewMode('list');
        reloadReceipts();
      } else {
        addToast(`Gagal menyimpan: ${json.error}`, 'error');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(`Error: ${message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none relative">
      {/* 🔔 FLOATING TOAST NOTIFICATIONS */}
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-xl border text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-top-4 fade-in duration-200 ${
              t.type === 'success'
                ? isDark ? 'bg-emerald-950/90 border-emerald-800 text-emerald-300' : 'bg-emerald-800 text-white border-emerald-900'
                : t.type === 'error'
                ? isDark ? 'bg-rose-950/90 border-rose-800 text-rose-300' : 'bg-rose-800 text-white border-rose-900'
                : t.type === 'warning'
                ? isDark ? 'bg-amber-950/90 border-amber-800 text-amber-300' : 'bg-amber-800 text-white border-amber-900'
                : isDark ? 'bg-indigo-950/90 border-indigo-800 text-indigo-300' : 'bg-indigo-800 text-white border-indigo-900'
            }`}
          >
            {t.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-300 shrink-0" />}
            {t.type === 'error' && <XCircle className="w-4 h-4 text-rose-300 shrink-0" />}
            {t.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />}
            {t.type === 'info' && <Zap className="w-4 h-4 text-indigo-300 shrink-0" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      {/* 📊 METRICS HEADER & MAIN TOOLBAR */}
      <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-4 shadow-sm ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h2 className={`text-base font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Penerimaan Barang Ekspress
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              Modul Purchasing Goods Receipt Fisik Gudang tanpa Kunci Harga Modal
            </p>
          </div>
        </div>

        {/* View Switcher & Action Buttons */}
        <div className="flex items-center gap-2">
          {viewMode === 'create' ? (
            <button
              onClick={() => setViewMode('list')}
              className={`px-3.5 py-2 rounded-xl border text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Daftar Transaksi</span>
            </button>
          ) : (
            <button
              onClick={() => setViewMode('create')}
              className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-slate-950 font-black text-xs flex items-center gap-2 transition-all shadow-lg cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Input Penerimaan Baru (Alt+N)</span>
            </button>
          )}
        </div>
      </div>

      {/* 🟢 MODE 1: DAFTAR TRANSAKSI PENERIMAAN EKSPRESS (LIST VIEW) */}
      {viewMode === 'list' && (
        <div className="flex-1 overflow-hidden flex flex-col p-4 gap-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="p-2.5 rounded-xl bg-orange-500/20 text-orange-400">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-400">Total Transaksi</div>
                <div className={`text-lg font-black ${isDark ? 'text-orange-300' : 'text-orange-950'}`}>
                  {receiptsList.length} Nota MR
                </div>
              </div>
            </div>

            <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-400">Supplier Terhubung</div>
                <div className={`text-lg font-black ${isDark ? 'text-blue-300' : 'text-blue-950'}`}>
                  {suppliersList.length} Pemasok
                </div>
              </div>
            </div>

            <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-400">Penerimaan Selesai</div>
                <div className={`text-lg font-black ${isDark ? 'text-emerald-300' : 'text-emerald-950'}`}>
                  {receiptsList.filter((r) => !r.isVoid).length} Sukses
                </div>
              </div>
            </div>

            <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-400">Gudang Utama</div>
                <div className={`text-sm font-black ${isDark ? 'text-purple-300' : 'text-purple-950'}`}>
                  Gudang Dapur
                </div>
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 shadow-sm ${
            isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari No MR / Supplier / Surat Jalan / Sopir..."
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                className={`w-full border rounded-xl pl-10 pr-4 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            <button
              onClick={reloadReceipts}
              className={`p-2 rounded-xl border hover:bg-slate-800 text-slate-400 cursor-pointer ${
                isDark ? 'border-slate-800' : 'border-slate-300'
              }`}
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingList ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Main Table Grid of Receipts WORKBENCH */}
          <div className={`flex-1 min-h-0 overflow-auto rounded-2xl border-2 shadow-lg relative ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <table className="w-full text-left border-separate border-spacing-0 text-xs">
              <thead className="sticky top-0 z-20">
                <tr className={`font-black uppercase tracking-wider text-[11px] border-b-2 ${
                  isDark ? 'bg-slate-800 text-slate-100 border-slate-700' : 'bg-slate-200 text-slate-900 border-slate-300'
                }`}>
                  <th className="py-3.5 px-4 text-center">No MR</th>
                  <th className="py-3.5 px-4">Tanggal MR</th>
                  <th className="py-3.5 px-4">Supplier Pemasok</th>
                  <th className="py-3.5 px-4">No. Surat Jalan (DO)</th>
                  <th className="py-3.5 px-4">Sopir / Vehicle</th>
                  <th className="py-3.5 px-4 text-center">Total Qty Item</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                {isLoadingList ? (
                  <tr>
                    <td colSpan={8} className="py-24">
                      <div className="flex flex-col items-center justify-center animate-pulse">
                        <div className="w-12 h-12 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin mb-4 shadow-lg shadow-amber-500/20"></div>
                        <h3 className="text-lg font-black text-amber-400 tracking-wider uppercase">Sedang Mengambil Data...</h3>
                        <p className="text-xs text-slate-400 mt-2 font-semibold">Memuat daftar transaksi penerimaan ekspress dari Database</p>
                      </div>
                    </td>
                  </tr>
                ) : receiptsList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400 font-bold">
                      Belum ada transaksi penerimaan barang ekspress. Klik tombol <strong>&quot;+ Input Penerimaan Baru&quot;</strong> di atas.
                    </td>
                  </tr>
                ) : (
                  receiptsList.map((row: any) => {
                    const mrNo = row.mrNo || row.mr_no || '-';
                    const mrDate = row.mrDate || row.mr_date || '-';
                    const supplier = row.supplierName || row.supplier_name || 'Supplier General';
                    const poNo = row.poNo || row.po_no || '-';
                    const driver = row.driverName ? `${row.driverName} (${row.vehicleNo || '-'})` : '-';
                    const qty = row.totalQty ?? row.total_qty ?? (row.items ? row.items.length : 0);

                    return (
                      <tr key={row.id} className={isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}>
                        <td className="py-3.5 px-4 text-center font-mono font-black text-amber-400">{mrNo}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-300">{mrDate}</td>
                        <td className="py-3.5 px-4 font-black text-slate-900 dark:text-white">{supplier}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-300">{poNo}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-400">{driver}</td>
                        <td className="py-3.5 px-4 text-center font-black text-emerald-400">{qty} Items</td>
                        <td className="py-3.5 px-4 text-center">
                          {row.isVoid ? (
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              VOID
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              SELESAI
                            </span>
                          )}
                        </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/purchasing/express/${row.id}`);
                                const json = await res.json();
                                if (json.success) {
                                  setPrintData(json.data);
                                  setIsPrintModalOpen(true);
                                }
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                            className="p-1.5 rounded-lg hover:bg-amber-500/20 text-amber-400 cursor-pointer"
                            title="Lihat & Cetak Bukti"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 🟠 MODE 2: FORM INPUT TRANSAKSI PENERIMAAN EKSPRESS BARU (CREATE VIEW) */}
      {viewMode === 'create' && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Form Header */}
          <div className={`p-5 border-b shadow-sm ${
            isDark ? 'bg-slate-800/90 border-slate-700' : 'bg-slate-50 border-slate-300'
          }`}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-bold">
              <div>
                <label className="block mb-1 text-amber-400 font-black">No. Bukti MR (Ekspress) *</label>
                <input
                  type="text"
                  readOnly
                  value={mrNo}
                  className={`w-full p-2.5 rounded-xl border font-mono font-black text-amber-400 focus:outline-none ${
                    isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'
                  }`}
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-400">Supplier Pemasok *</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedSupplierId(id);
                    const found = suppliersList.find((s) => s.id === id);
                    if (found) setSelectedSupplierName(found.supplierName);
                  }}
                  className={`w-full p-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  {suppliersList.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.supplierName} ({sup.supplierNo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 text-slate-400">No. Surat Jalan / DO *</label>
                <input
                  type="text"
                  placeholder="DO-8899221"
                  value={doNo}
                  onChange={(e) => setDoNo(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-400">Gudang Tujuan</label>
                <input
                  type="text"
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-400">Nama Sopir / Driver</label>
                <input
                  type="text"
                  placeholder="Bpk. Joko"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-400">No. Polisi Kendaraan</label>
                <input
                  type="text"
                  placeholder="L 9872 AB"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="col-span-2">
                <label className="block mb-1 text-slate-400">Catatan Penerimaan</label>
                <input
                  type="text"
                  placeholder="Catatan pemeriksaan kondisi dus / fisik barang..."
                  value={headerDesc}
                  onChange={(e) => setHeaderDesc(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Barcode Scanner Toolbar */}
          <div className={`px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3 shadow-sm ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-300'
          }`}>
            <div className="relative flex-1 min-w-[320px] max-w-xl group">
              <ScanLine className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${
                isDark ? 'text-amber-400' : 'text-slate-950'
              }`} />
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Scan Barcode / Cari Barang (SKU/Nama)... [/]"
                value={productSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setProductSearch(val);
                  if (!val.trim()) setSearchResults([]);
                }}
                className={`w-full border-2 rounded-xl pl-10 pr-10 py-2 text-xs font-black focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-400 focus:border-amber-400'
                    : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-500 focus:border-slate-700'
                }`}
              />
              {isSearchingProduct && (
                <RefreshCw className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-amber-400" />
              )}

              {/* Search Dropdown Results */}
              {searchResults.length > 0 && (
                <div className={`absolute left-0 right-0 top-full mt-1.5 z-40 rounded-2xl border shadow-2xl overflow-hidden max-h-64 overflow-y-auto ${
                  isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                }`}>
                  {searchResults.map((prod) => (
                    <div
                      key={prod.id}
                      onClick={() => handleAddProductToItems(prod)}
                      className={`p-3 border-b text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        isDark ? 'hover:bg-slate-800 border-slate-800' : 'hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <div>
                        <div className="font-black text-amber-400">{prod.inventoryName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">SKU: {prod.inventoryNo} | Barcode: {prod.barcode || '-'}</div>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-black text-[10px]">
                          + Tambah Item
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3.5 py-2 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-200 hover:bg-slate-300 text-slate-900 border-slate-300'
                }`}
              >
                Batal
              </button>

              <button
                onClick={handleSubmitReceipt}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-slate-950 font-black text-xs flex items-center gap-2 transition-all shadow-lg cursor-pointer disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4 stroke-[3]" />
                <span>{isSubmitting ? 'Menyimpan...' : 'Simpan & Update Stok'}</span>
              </button>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="flex-1 overflow-auto p-4">
            <div className={`rounded-2xl border overflow-hidden shadow-lg ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <table className="w-full text-left border-collapse text-xs">
                <thead className={`font-black uppercase tracking-wider ${
                  isDark ? 'bg-slate-800/90 text-amber-400' : 'bg-slate-200 text-slate-950'
                }`}>
                  <tr>
                    <th className="py-3 px-3.5 text-center w-12">No</th>
                    <th className="py-3 px-4">Barcode</th>
                    <th className="py-3 px-4">Kode Barang</th>
                    <th className="py-3 px-4">Nama Barang</th>
                    <th className="py-3 px-3 text-center">Satuan</th>
                    <th className="py-3 px-4 text-center w-32">Qty Masuk *</th>
                    <th className="py-3 px-4">Catatan Item</th>
                    <th className="py-3 px-3 text-center w-16">Aksi</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-slate-400 font-bold">
                        <ScanLine className="w-8 h-8 mx-auto mb-2 text-slate-500 animate-pulse" />
                        Belum ada barang diinput. Gunakan pencarian barcode di atas untuk menambah barang yang diterima.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => (
                      <tr key={idx} className={isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}>
                        <td className="py-3 px-3.5 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-4 font-mono font-bold text-amber-400">{item.barcode || '-'}</td>
                        <td className="py-3 px-4 font-mono font-bold">{item.inventoryNo || '-'}</td>
                        <td className="py-3 px-4 font-black">{item.inventoryName}</td>
                        <td className="py-3 px-3 text-center font-bold">{item.uomName}</td>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="number"
                            min={1}
                            value={item.qty}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, qty: val } : it)));
                            }}
                            className={`w-20 p-1.5 rounded-lg border font-mono font-black text-center focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                              isDark ? 'bg-slate-800 border-slate-700 text-emerald-400' : 'bg-slate-100 border-slate-300 text-emerald-700'
                            }`}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            placeholder="Keterangan fisik item..."
                            value={item.description}
                            onChange={(e) => {
                              const val = e.target.value;
                              setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, description: val } : it)));
                            }}
                            className={`w-full p-1.5 rounded-lg border font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                              isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                            }`}
                          />
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                            className="p-1 rounded-lg hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                            title="Hapus item"
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
          </div>
        </div>
      )}

      {/* 🖨️ PRINTABLE RECEIPT VOUCHER MODAL */}
      {isPrintModalOpen && printData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-3xl bg-white text-slate-900 rounded-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Action Header */}
            <div className="flex items-center justify-between pb-6 border-b border-slate-300 print:hidden">
              <div className="font-black text-slate-800 text-sm flex items-center gap-2">
                <Printer className="w-4 h-4 text-amber-500" />
                <span>Bukti Penerimaan Barang Ekspress (Gudang)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>Cetak Surat Jalan Masuk</span>
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-200 text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Voucher Content */}
            <div className="printable-express-voucher pt-6 space-y-6 text-xs">
              <style>{`
                @media print {
                  body {
                    background: white !important;
                    color: black !important;
                  }
                  body * {
                    visibility: hidden !important;
                  }
                  .printable-express-voucher, .printable-express-voucher * {
                    visibility: visible !important;
                    color: black !important;
                  }
                  .printable-express-voucher {
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    padding: 20px !important;
                    background: white !important;
                    box-shadow: none !important;
                    border: none !important;
                  }
                  .no-print, .print\\:hidden, button {
                    display: none !important;
                  }
                }
              `}</style>
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-black tracking-tight text-slate-900">HARMONY KITCHEN ERP</h2>
                  <p className="text-[11px] text-slate-600">Surat Jalan / Bukti Penerimaan Barang Ekspress Gudang</p>
                </div>
                <div className="text-right font-mono">
                  <div className="text-base font-black text-amber-600">{printData.header.mrNo}</div>
                  <div className="text-[11px] text-slate-500">{printData.header.mrDate}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-100 rounded-2xl">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500">Supplier / Pemasok:</div>
                  <div className="font-black text-slate-900 text-sm">{printData.header.supplierName}</div>
                  <div className="text-slate-600">No. Surat Jalan: {printData.header.doNo || '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500">Pengiriman & Gudang:</div>
                  <div className="font-bold text-slate-800">Sopir: {printData.header.driverName || '-'} ({printData.header.vehicleNo || '-'})</div>
                  <div className="font-bold text-slate-800">Tujuan: {printData.header.whName}</div>
                </div>
              </div>

              {/* Line Items Table */}
              <table className="w-full text-left border-collapse text-xs border border-slate-300">
                <thead className="bg-slate-200 font-bold uppercase text-[10px] text-slate-800 border-b border-slate-300">
                  <tr>
                    <th className="p-2 text-center border-r border-slate-300">No</th>
                    <th className="p-2 border-r border-slate-300">Barcode</th>
                    <th className="p-2 border-r border-slate-300">Kode Barang</th>
                    <th className="p-2 border-r border-slate-300">Nama Barang Diterima</th>
                    <th className="p-2 text-center border-r border-slate-300">Satuan</th>
                    <th className="p-2 text-center">Qty Masuk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 font-medium">
                  {printData.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-2 text-center border-r border-slate-300 font-mono">{idx + 1}</td>
                      <td className="p-2 font-mono border-r border-slate-300">{it.barcode || '-'}</td>
                      <td className="p-2 font-mono border-r border-slate-300">{it.inventoryNo || '-'}</td>
                      <td className="p-2 font-bold border-r border-slate-300">{it.inventoryName}</td>
                      <td className="p-2 text-center border-r border-slate-300">{it.uomName}</td>
                      <td className="p-2 text-center font-black text-amber-600">{it.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Signatures Footer */}
              <div className="grid grid-cols-3 gap-4 pt-12 text-center font-bold text-[11px] text-slate-700">
                <div>
                  <div className="mb-12">Petugas Gudang</div>
                  <div className="border-t border-slate-400 pt-1 font-normal">( ........................ )</div>
                </div>
                <div>
                  <div className="mb-12">Sopir / Driver</div>
                  <div className="border-t border-slate-400 pt-1 font-normal">( ........................ )</div>
                </div>
                <div>
                  <div className="mb-12">Kepala Gudang</div>
                  <div className="border-t border-slate-400 pt-1 font-normal">( ........................ )</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

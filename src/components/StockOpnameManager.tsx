'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  PackageCheck,
  Plus,
  RefreshCw,
  Save,
  CheckCircle,
  XCircle,
  Search,
  History,
  Store,
  Barcode as BarcodeIcon,
  Trash2,
  Layers,
  Sparkles,
  Minus,
  AlertTriangle,
  Check,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Package,
} from 'lucide-react';

export interface OpnameEntry {
  id?: number;
  inventoryId: number;
  inventoryNo: string;
  barcode: string;
  inventoryName: string;
  qty: number;
  systemQty?: number;
  price: number;
  description: string;
}

export interface OpnameHistoryHeader {
  id: number;
  noTransaction: string;
  opnameDate: string;
  warehouse: string;
  totalItems: number;
  totalQty: number;
  remarks: string;
  createdBy: string;
}

export interface InventoryLookupItem {
  id: number;
  inventoryNo: string;
  barcode: string;
  inventoryName: string;
  price: number;
  uomName?: string;
  brandName?: string;
  categoryName?: string;
  stokUpdate?: number;
  stokAkhir?: number;
  stock?: number;
}

interface StockOpnameManagerProps {
  isDark: boolean;
}

export default function StockOpnameManager({ isDark }: StockOpnameManagerProps) {
  // Master & Lookup States
  const [inventoryList, setInventoryList] = useState<InventoryLookupItem[]>([]);
  const [historyList, setHistoryList] = useState<OpnameHistoryHeader[]>([]);
  const [selectedHistoryTx, setSelectedHistoryTx] = useState<string>('');

  // Form States
  const [noTransaction, setNoTransaction] = useState<string>('');
  const [warehouse, setWarehouse] = useState<string>('Gudang Utama Harmoni');
  const [opnameItems, setOpnameItems] = useState<OpnameEntry[]>([]);

  // Input Form Fields
  const [selectedInvId, setSelectedInvId] = useState<number | ''>('');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [qtyInput, setQtyInput] = useState<number | ''>(1);
  const [descInput, setDescInput] = useState<string>('');

  // Table Filter & Search States
  const [tableSearch, setTableSearch] = useState<string>('');
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'variance' | 'matched'>('all');

  // Status States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Generate New Transaction No
  const generateNewTxNo = useCallback(() => {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const rnd = Math.floor(1000 + Math.random() * 9000);
    return `OPN/${yyyy}/${mm}/${rnd}`;
  }, []);

  // Fetch Inventory Lookups & Opname History
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Inventory Items for Opname Input
      const invRes = await fetch('/api/inventory?limit=2000');
      const invJson = await invRes.json();
      const itemsArray = invJson.data?.items || invJson.data || [];
      if (invJson.success && Array.isArray(itemsArray)) {
        setInventoryList(itemsArray);
      }

      // 2. Fetch Opname History
      const histRes = await fetch('/api/inventory/opname');
      const histJson = await histRes.json();
      if (histJson.success && Array.isArray(histJson.data) && histJson.data.length > 0) {
        setHistoryList(histJson.data);

        // Auto-select latest opname transaction so page is not empty on initial open
        const latestTx = histJson.data[0].noTransaction || histJson.data[0].opname_no;
        if (latestTx) {
          setSelectedHistoryTx(latestTx);
          setNoTransaction(latestTx);

          const detailRes = await fetch(`/api/inventory/opname?noTx=${encodeURIComponent(latestTx)}`);
          const detailJson = await detailRes.json();
          const detailItems = detailJson.data?.items || detailJson.data || [];
          if (detailJson.success && Array.isArray(detailItems)) {
            setOpnameItems(
              detailItems.map((d: any) => ({
                inventoryId: d.inventoryId || d.id,
                inventoryNo: d.inventoryNo || d.inventory_no,
                barcode: d.barcode,
                inventoryName: d.inventoryName || d.inventory_name,
                qty: d.qty !== undefined ? d.qty : (d.physical_qty || d.physicalQty || 0),
                systemQty: d.systemQty !== undefined ? d.systemQty : (d.system_qty || 0),
                price: d.price || 0,
                description: d.description || '',
              }))
            );
          }
        }
      }
    } catch (err) {
      console.error('Failed to load opname data:', err);
      showToast('Gagal memuat data master opname', 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Handle New Opname Button
  const handleNewOpname = () => {
    setNoTransaction(generateNewTxNo());
    setSelectedHistoryTx('');
    setOpnameItems([]);
    setSelectedInvId('');
    setBarcodeInput('');
    setQtyInput(1);
    setDescInput('');
    showToast('Form Stok Opname Baru Siap Diisi', 'info');
  };

  // Handle Populate All Products for Bulk Opname
  const handlePopulateAll = () => {
    if (inventoryList.length === 0) {
      showToast('Daftar barang inventori belum dimuat', 'info');
      return;
    }
    const allItems = inventoryList.map((item) => {
      const sysQty = item.stokAkhir !== undefined ? item.stokAkhir : (item.stock || 0);
      return {
        inventoryId: item.id,
        inventoryNo: item.inventoryNo,
        barcode: item.barcode || item.inventoryNo,
        inventoryName: item.inventoryName,
        qty: sysQty,
        systemQty: sysQty,
        price: item.price || 0,
        description: 'Auto-Populate Opname Massal',
      };
    });
    setOpnameItems(allItems);
    showToast(`Semua ${allItems.length} barang berhasil dimuat ke tabel opname!`, 'success');
  };

  // Handle Barcode Auto-Fill
  const handleBarcodeChange = (val: string) => {
    setBarcodeInput(val);
    const found = inventoryList.find((item) => item.barcode === val || item.inventoryNo === val);
    if (found) {
      setSelectedInvId(found.id);
    }
  };

  // Handle Inventory Selection Change
  const handleInventorySelect = (idNum: number) => {
    setSelectedInvId(idNum);
    const found = inventoryList.find((item) => item.id === idNum);
    if (found) {
      setBarcodeInput(found.barcode || found.inventoryNo);
    }
  };

  // Add Item to Pending Opname List
  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!selectedInvId) {
      showToast('Pilih barang terlebih dahulu!', 'error');
      return;
    }

    const found = inventoryList.find((i) => i.id === selectedInvId);
    if (!found) return;

    const qty = typeof qtyInput === 'number' ? qtyInput : 0;
    if (qty < 0) {
      showToast('Qty opname tidak boleh negatif', 'error');
      return;
    }

    const sysQty = found.stokAkhir !== undefined ? found.stokAkhir : (found.stock || 0);

    const existingIdx = opnameItems.findIndex((i) => i.inventoryId === found.id);
    if (existingIdx >= 0) {
      const updated = [...opnameItems];
      updated[existingIdx].qty = qty;
      updated[existingIdx].description = descInput || 'Penyesuaian Opname';
      setOpnameItems(updated);
      showToast(`Qty "${found.inventoryName}" diperbarui menjadi ${qty}`, 'info');
    } else {
      setOpnameItems((prev) => [
        ...prev,
        {
          inventoryId: found.id,
          inventoryNo: found.inventoryNo,
          barcode: found.barcode || found.inventoryNo,
          inventoryName: found.inventoryName,
          qty,
          systemQty: sysQty,
          price: found.price || 0,
          description: descInput || 'Stok Fisik Opname',
        },
      ]);
      showToast(`"${found.inventoryName}" berhasil ditambahkan ke daftar`, 'success');
    }

    // Reset input fields
    setSelectedInvId('');
    setBarcodeInput('');
    setQtyInput(1);
    setDescInput('');
  };

  // Inline Qty Update Handler
  const handleInlineQtyChange = (invId: number, newQty: number) => {
    const validQty = Math.max(0, newQty);
    setOpnameItems((prev) =>
      prev.map((item) => (item.inventoryId === invId ? { ...item, qty: validQty } : item))
    );
  };

  // Remove item from list
  const handleRemoveItem = (invId: number) => {
    setOpnameItems((prev) => prev.filter((i) => i.inventoryId !== invId));
  };

  // Select History Transaction from Dropdown
  const handleSelectHistory = async (txNo: string) => {
    setSelectedHistoryTx(txNo);
    if (!txNo) {
      handleNewOpname();
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/inventory/opname?noTx=${encodeURIComponent(txNo)}`);
      const json = await res.json();
      const detailItems = json.data?.items || json.data || [];
      if (json.success && Array.isArray(detailItems)) {
        setNoTransaction(txNo);
        setOpnameItems(
          detailItems.map((d: any) => ({
            inventoryId: d.inventoryId || d.id,
            inventoryNo: d.inventoryNo || d.inventory_no,
            barcode: d.barcode,
            inventoryName: d.inventoryName || d.inventory_name,
            qty: d.qty !== undefined ? d.qty : (d.physical_qty || d.physicalQty || 0),
            systemQty: d.systemQty !== undefined ? d.systemQty : (d.system_qty || 0),
            price: d.price || 0,
            description: d.description || '',
          }))
        );
        showToast(`Memuat Transaksi Opname ${txNo}`, 'info');
      }
    } catch (err) {
      console.error('Failed to load opname detail:', err);
      showToast('Gagal memuat detail transaksi opname', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Opname Transaction to Server
  const handleSubmitOpname = async () => {
    if (opnameItems.length === 0) {
      showToast('Tidak ada item opname yang dimasukkan!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/inventory/opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noTransaction,
          warehouse,
          items: opnameItems,
          createdBy: 'SA',
          remarks: `Stok Opname ${noTransaction}`,
        }),
      });

      const json = await res.json();
      if (json.success) {
        showToast(json.message || 'Transaksi Stok Opname berhasil disimpan!', 'success');
        loadInitialData();
        handleNewOpname();
      } else {
        showToast(json.error || 'Gagal menyimpan stok opname', 'error');
      }
    } catch (err) {
      console.error('Submit opname error:', err);
      showToast('Terjadi kesalahan saat menyimpan opname', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Statistics Calculations
  const stats = useMemo(() => {
    const totalItems = opnameItems.length;
    const totalPhysicalQty = opnameItems.reduce((acc, curr) => acc + curr.qty, 0);

    let matchedCount = 0;
    let varianceCount = 0;
    let totalValue = 0;

    opnameItems.forEach((item) => {
      const sys = item.systemQty !== undefined ? item.systemQty : item.qty;
      const diff = item.qty - sys;
      if (diff === 0) {
        matchedCount++;
      } else {
        varianceCount++;
      }
      totalValue += item.qty * (item.price || 0);
    });

    return { totalItems, totalPhysicalQty, matchedCount, varianceCount, totalValue };
  }, [opnameItems]);

  // Filtered Table Items
  const filteredTableItems = useMemo(() => {
    return opnameItems.filter((item) => {
      // Search Query Filter
      const matchQuery =
        !tableSearch ||
        item.inventoryName.toLowerCase().includes(tableSearch.toLowerCase()) ||
        item.inventoryNo.toLowerCase().includes(tableSearch.toLowerCase()) ||
        item.barcode.toLowerCase().includes(tableSearch.toLowerCase());

      if (!matchQuery) return false;

      // Variance Tab Filter
      const sys = item.systemQty !== undefined ? item.systemQty : item.qty;
      const diff = item.qty - sys;

      if (activeFilterTab === 'variance') return diff !== 0;
      if (activeFilterTab === 'matched') return diff === 0;
      return true;
    });
  }, [opnameItems, tableSearch, activeFilterTab]);

  return (
    <div className={`flex flex-col h-full w-full overflow-hidden select-none ${isDark ? 'bg-slate-950' : 'bg-slate-100/60'}`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-2xl border text-xs font-bold flex items-center gap-3 transition-all animate-in fade-in slide-in-from-top-4 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/30'
              : toastMessage.type === 'error'
              ? 'bg-rose-600 text-white border-rose-500 shadow-rose-600/30'
              : 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-600/30'
          }`}
        >
          {toastMessage.type === 'success' && <CheckCircle className="w-5 h-5 text-white shrink-0" />}
          {toastMessage.type === 'error' && <XCircle className="w-5 h-5 text-white shrink-0" />}
          {toastMessage.type === 'info' && <Sparkles className="w-5 h-5 text-amber-300 shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* 👑 TOP COMPACT WORKBENCH TOOLBAR */}
      <div
        className={`px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3 shadow-sm shrink-0 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        {/* Title & Transaction Selector */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900 dark:text-white tracking-tight leading-none">
                Stok Opname
              </h1>
              <span className="text-[10px] font-bold text-amber-500 font-mono">
                {noTransaction || 'OPN/NEW'}
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-300 dark:bg-slate-800 hidden sm:block" />

          {/* Riwayat Dropdown */}
          <div className="flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <select
              value={selectedHistoryTx}
              onChange={(e) => handleSelectHistory(e.target.value)}
              className={`p-1.5 rounded-lg border text-xs font-bold focus:outline-none cursor-pointer max-w-[220px] ${
                isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-100 text-slate-900 border-slate-300'
              }`}
            >
              <option value="">-- Lihat Transaksi Opname --</option>
              {historyList.map((h) => (
                <option key={h.id} value={h.noTransaction}>
                  {h.noTransaction} ({new Date(h.opnameDate).toLocaleDateString('id-ID')})
                </option>
              ))}
            </select>
          </div>

          {/* Gudang Dropdown */}
          <div className="flex items-center gap-2">
            <Store className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <select
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
              className={`p-1.5 rounded-lg border text-xs font-bold focus:outline-none cursor-pointer ${
                isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-100 text-slate-900 border-slate-300'
              }`}
            >
              <option value="Gudang Utama Harmoni">Gudang Utama Harmoni</option>
              <option value="Gudang Display Showroom">Gudang Display Showroom</option>
              <option value="Bar Kopi Rungkut">Bar Kopi Rungkut</option>
              <option value="Gudang Pastry">Gudang Pastry</option>
              <option value="Gudang Elektronik">Gudang Elektronik</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleNewOpname}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Opname Baru</span>
          </button>

          <button
            onClick={handlePopulateAll}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 active:scale-95 font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
            title="Muat seluruh barang master inventori ke tabel opname"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Load Master Barang ({inventoryList.length})</span>
          </button>

          <button
            onClick={loadInitialData}
            className={`p-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 active:scale-95 cursor-pointer transition-all ${
              isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-300'
            }`}
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleSubmitOpname}
            disabled={isSubmitting || opnameItems.length === 0}
            className={`px-4 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer ${
              opnameItems.length === 0
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Opname'}</span>
          </button>
        </div>
      </div>

      {/* 📊 SUMMARY METRICS CARDS (1:1 with SyncStock) */}
      <div className={`px-5 py-3.5 border-b grid grid-cols-2 md:grid-cols-4 gap-3.5 shadow-sm shrink-0 ${
        isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">Total Item Opname</div>
            <div className={`text-lg font-black ${isDark ? 'text-amber-300' : 'text-amber-950'}`}>
              {stats.totalItems} Barang
            </div>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">Barang Klop (Sesuai)</div>
            <div className={`text-lg font-black ${isDark ? 'text-emerald-300' : 'text-emerald-950'}`}>
              {stats.matchedCount} Item
            </div>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">Barang Ada Selisih</div>
            <div className={`text-lg font-black ${isDark ? 'text-rose-300' : 'text-rose-950'}`}>
              {stats.varianceCount} Item
            </div>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">Total Nilai Fisik</div>
            <div className={`text-sm font-black font-mono ${isDark ? 'text-amber-300' : 'text-amber-950'}`}>
              Rp {stats.totalValue.toLocaleString('id-ID')}
            </div>
          </div>
        </div>
      </div>

      {/* 📥 INLINE FAST SCAN ENTRY ROW (Height: 48px) */}
      <form
        onSubmit={handleAddItem}
        className={`px-5 py-2.5 border-b flex flex-wrap items-center gap-3 shrink-0 ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-amber-50/50 border-amber-200/60'
        }`}
      >
        <div className="flex items-center gap-1.5 text-xs font-black uppercase text-amber-500 shrink-0">
          <BarcodeIcon className="w-4 h-4" />
          <span>Quick Scan / Tambah:</span>
        </div>

        {/* Scan Barcode / SKU */}
        <div className="w-44">
          <input
            type="text"
            value={barcodeInput}
            onChange={(e) => handleBarcodeChange(e.target.value)}
            placeholder="Scan Barcode / SKU..."
            className={`w-full px-3 py-1.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
              isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-900 border-slate-300'
            }`}
          />
        </div>

        {/* Select Barang */}
        <div className="flex-1 min-w-[220px]">
          <select
            value={selectedInvId}
            onChange={(e) => handleInventorySelect(Number(e.target.value))}
            className={`w-full px-3 py-1.5 rounded-xl border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer ${
              isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-900 border-slate-300'
            }`}
          >
            <option value="">-- Pilih Barang Catalog --</option>
            {inventoryList.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.inventoryName} ({inv.inventoryNo})
              </option>
            ))}
          </select>
        </div>

        {/* Qty Counted */}
        <div className="w-24 flex items-center gap-1">
          <span className="text-xs font-bold text-slate-400">Qty:</span>
          <input
            type="number"
            min="0"
            value={qtyInput}
            onChange={(e) => setQtyInput(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
            className={`w-full py-1 text-center font-black text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
              isDark ? 'bg-slate-950 text-amber-400 border-slate-700' : 'bg-white text-amber-900 border-slate-300'
            }`}
          />
        </div>

        {/* Catatan */}
        <div className="w-44">
          <input
            type="text"
            value={descInput}
            onChange={(e) => setDescInput(e.target.value)}
            placeholder="Catatan Opname..."
            className={`w-full px-3 py-1.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
              isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-900 border-slate-300'
            }`}
          />
        </div>

        <button
          type="submit"
          className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs cursor-pointer shadow transition-all shrink-0 flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah</span>
        </button>
      </form>

      {/* 📊 FULL-HEIGHT TABLE WORKBENCH VIEWPORT (1:1 with SyncStock) */}
      <div className="flex-1 min-h-0 p-4 flex flex-col">
        <div className={`flex-1 min-h-0 overflow-auto rounded-2xl border-2 shadow-lg relative ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          {/* Table Toolbar (Tabs & Search) */}
          <div className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 sticky top-0 z-30 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveFilterTab('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeFilterTab === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-700 hover:bg-slate-200'
              }`}
            >
              Semua ({opnameItems.length})
            </button>

            <button
              onClick={() => setActiveFilterTab('variance')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeFilterTab === 'variance'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : isDark ? 'bg-slate-800 text-rose-400 hover:bg-slate-700' : 'bg-white text-rose-600 hover:bg-slate-200'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Selisih ({stats.varianceCount})</span>
            </button>

            <button
              onClick={() => setActiveFilterTab('matched')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeFilterTab === 'matched'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : isDark ? 'bg-slate-800 text-emerald-400 hover:bg-slate-700' : 'bg-white text-emerald-600 hover:bg-slate-200'
              }`}
            >
              <Check className="w-3 h-3" />
              <span>Klop ({stats.matchedCount})</span>
            </button>
          </div>

          {/* Table Live Search */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter tabel opname..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className={`w-full pl-8 pr-3 py-1 rounded-lg border text-xs font-semibold focus:outline-none ${
                isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-900 border-slate-300'
              }`}
            />
          </div>
        </div>

        {/* FULL-HEIGHT AUTO-EXPANDING TABLE */}
        <table className="w-full text-left border-separate border-spacing-0">
            <thead className="sticky top-0 z-20">
              <tr
                className={`text-[11px] font-black uppercase tracking-wider border-b-2 ${
                  isDark ? 'bg-slate-800 text-slate-100 border-slate-700' : 'bg-slate-200 text-slate-900 border-slate-300'
                }`}
              >
                <th className="py-2.5 px-4 w-12 text-center">#No</th>
                <th className="py-2.5 px-4">SKU / Barcode</th>
                <th className="py-2.5 px-4">Nama Barang</th>
                <th className="py-2.5 px-4 text-center">Stok Sistem</th>
                <th className="py-2.5 px-4 text-center min-w-[150px]">Qty Fisik Counted</th>
                <th className="py-2.5 px-4 text-center">Status Selisih</th>
                <th className="py-2.5 px-4">Keterangan</th>
                <th className="py-2.5 px-4 text-center w-16">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30 text-xs">
              {filteredTableItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center text-slate-400 font-medium">
                    {opnameItems.length === 0
                      ? 'Belum ada item opname. Gunakan form Quick Scan di atas atau klik "Populasi Semua".'
                      : 'Tidak ada item yang sesuai dengan filter.'}
                  </td>
                </tr>
              ) : (
                filteredTableItems.map((item, idx) => {
                  const sysQty = item.systemQty !== undefined ? item.systemQty : item.qty;
                  const diff = item.qty - sysQty;

                  return (
                    <tr
                      key={item.inventoryId}
                      className={`transition-colors ${
                        isDark ? 'hover:bg-slate-800/60 text-slate-200' : 'hover:bg-amber-50/50 text-slate-800'
                      }`}
                    >
                      <td className="py-2.5 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-4 font-mono">
                        <span className="font-bold text-amber-500 block">{item.inventoryNo}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{item.barcode}</span>
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">
                        {item.inventoryName}
                      </td>

                      {/* System Stock */}
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-400 text-sm">
                        {sysQty}
                      </td>

                      {/* Physical Stock - INLINE STEPPER EDIT */}
                      <td className="py-2.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleInlineQtyChange(item.inventoryId, item.qty - 1)}
                            className={`p-1 rounded-lg border transition-all active:scale-90 cursor-pointer ${
                              isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                            }`}
                            title="Kurangi 1"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={item.qty}
                            onChange={(e) => handleInlineQtyChange(item.inventoryId, parseInt(e.target.value) || 0)}
                            className={`w-16 py-1 text-center font-black text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                              isDark ? 'bg-slate-950 text-amber-400 border-slate-700' : 'bg-amber-50 text-amber-900 border-amber-300'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => handleInlineQtyChange(item.inventoryId, item.qty + 1)}
                            className={`p-1 rounded-lg border transition-all active:scale-90 cursor-pointer ${
                              isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                            }`}
                            title="Tambah 1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* REALTIME VARIANCE BADGE */}
                      <td className="py-2.5 px-4 text-center">
                        {diff === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <Check className="w-3 h-3" /> Klop (0)
                          </span>
                        ) : diff > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            <ArrowUpRight className="w-3 h-3" /> +{diff} (Surplus)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                            <ArrowDownRight className="w-3 h-3" /> {diff} (Defisit)
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-slate-400 italic">{item.description}</td>

                      <td className="py-2.5 px-4 text-center">
                        <button
                          onClick={() => handleRemoveItem(item.inventoryId)}
                          className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                          title="Hapus Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

        {/* COMPACT WORKBENCH FOOTER STATS BAR */}
        <div className={`px-5 py-2.5 border-t flex flex-wrap items-center justify-between gap-3 shrink-0 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
        }`}>
          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="text-slate-400">
              Total Barang: <strong className="text-slate-900 dark:text-white">{stats.totalItems} SKU</strong>
            </span>
            <span className="text-slate-400">
              Total Qty Fisik: <strong className="text-amber-500">{stats.totalPhysicalQty} Unit</strong>
            </span>
            <span className="text-emerald-500">
              Klop: <strong>{stats.matchedCount}</strong>
            </span>
            <span className="text-rose-500">
              Selisih: <strong>{stats.varianceCount}</strong>
            </span>
          </div>

          <div className="text-xs font-bold text-slate-400">
            Total Nilai Fisik: <strong className="text-emerald-400 font-mono text-sm">Rp {stats.totalValue.toLocaleString('id-ID')}</strong>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  PackageCheck,
  Plus,
  RefreshCw,
  Printer,
  Save,
  CheckCircle,
  XCircle,
  Search,
  History,
  Store,
  Barcode as BarcodeIcon,
  Trash2,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export interface OpnameEntry {
  id?: number;
  inventoryId: number;
  inventoryNo: string;
  barcode: string;
  inventoryName: string;
  qty: number;
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
      // 1. Fetch Inventory Items
      const invRes = await fetch('/api/inventory/lookups');
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
        const latestTx = histJson.data[0].noTransaction;
        setSelectedHistoryTx(latestTx);
        setNoTransaction(latestTx);

        const detailRes = await fetch(`/api/inventory/opname?noTx=${encodeURIComponent(latestTx)}`);
        const detailJson = await detailRes.json();
        if (detailJson.success && Array.isArray(detailJson.data)) {
          setOpnameItems(
            detailJson.data.map((d: any) => ({
              inventoryId: d.inventoryId,
              inventoryNo: d.inventoryNo,
              barcode: d.barcode,
              inventoryName: d.inventoryName,
              qty: d.qty,
              price: d.price,
              description: d.description,
            }))
          );
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
    showToast('Form Stok Opname Baru Siap Diiisi', 'info');
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

    // Check if item already in current opname list
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
      if (json.success && Array.isArray(json.data)) {
        setNoTransaction(txNo);
        setOpnameItems(
          json.data.map((d: any) => ({
            inventoryId: d.inventoryId,
            inventoryNo: d.inventoryNo,
            barcode: d.barcode,
            inventoryName: d.inventoryName,
            qty: d.qty,
            price: d.price,
            description: d.description,
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
        showToast(json.data.message || 'Transaksi Stok Opname berhasil disimpan!', 'success');
        loadInitialData();
        // Clear & prepare new opname
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

  const selectedInventoryObject = inventoryList.find((i) => i.id === selectedInvId);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2.5 transition-all animate-bounce ${
            toastMessage.type === 'success'
              ? 'bg-emerald-500 text-white border-emerald-400'
              : toastMessage.type === 'error'
              ? 'bg-red-500 text-white border-red-400'
              : 'bg-amber-500 text-slate-950 border-amber-400'
          }`}
        >
          {toastMessage.type === 'success' && <CheckCircle className="w-4 h-4" />}
          {toastMessage.type === 'error' && <XCircle className="w-4 h-4" />}
          {toastMessage.type === 'info' && <Sparkles className="w-4 h-4" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* 📦 PAGE HEADER */}
      <div
        className={`p-6 rounded-3xl border shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
          isDark
            ? 'bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900 border-slate-800'
            : 'bg-gradient-to-r from-amber-50/70 via-white to-amber-50/40 border-amber-200'
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20">
            <PackageCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Input Stok Opname
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-500 border border-amber-500/30">
                1:1 Module Manager (Mod_Opname)
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Pencatatan & Penyesuaian Fisik Stok Opname Persediaan Barang
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleNewOpname}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs flex items-center gap-2 shadow-md cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Opname Baru</span>
          </button>

          <button
            onClick={loadInitialData}
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 active:scale-95 cursor-pointer transition-all ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 🛠️ TRANSACTION HEADER CONTROLS (Gudang, No Tx, History Opname) */}
      <div
        className={`p-5 rounded-2xl border shadow-md space-y-4 ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Riwayat Transaksi Opname (SLE_OpnameHistory 1:1) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-amber-500" />
              <span>Riwayat Transaksi Opname :</span>
            </label>
            <select
              value={selectedHistoryTx}
              onChange={(e) => handleSelectHistory(e.target.value)}
              className={`w-full p-2.5 rounded-xl border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer ${
                isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-900 border-slate-300'
              }`}
            >
              <option value="">-- Lihat Transaksi Opname yang Pernah Dibuat --</option>
              {historyList.map((h) => (
                <option key={h.id} value={h.noTransaction}>
                  {h.noTransaction} ({new Date(h.opnameDate).toLocaleDateString('id-ID')}) - {h.totalItems} Items
                </option>
              ))}
            </select>
          </div>

          {/* 2. No. Transaksi */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-500" />
              <span>No. Transaksi Opname :</span>
            </label>
            <input
              type="text"
              readOnly
              value={noTransaction}
              className={`w-full p-2.5 rounded-xl border text-xs font-mono font-black focus:outline-none ${
                isDark
                  ? 'bg-slate-950 text-amber-400 border-slate-800'
                  : 'bg-amber-50/60 text-amber-900 border-amber-200'
              }`}
            />
          </div>

          {/* 3. Gudang Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-amber-500" />
              <span>Gudang :</span>
            </label>
            <select
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
              className={`w-full p-2.5 rounded-xl border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer ${
                isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-900 border-slate-300'
              }`}
            >
              <option value="Gudang Utama Harmoni">Gudang Utama Harmoni</option>
              <option value="Gudang Bahan Baku">Gudang Bahan Baku</option>
              <option value="Gudang Peralatan Dapur">Gudang Peralatan Dapur</option>
            </select>
          </div>
        </div>
      </div>

      {/* 📥 INPUT FORM ITEM STOK OPNAME */}
      <form
        onSubmit={handleAddItem}
        className={`p-5 rounded-2xl border shadow-md space-y-4 ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/40">
          <h3 className="text-xs font-black uppercase tracking-wider text-amber-500 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" />
            Form Input Item Opname
          </h3>
          {selectedInventoryObject && (
            <div className="text-[11px] font-bold text-slate-400 flex items-center gap-3">
              <span>Brand: <strong className="text-amber-400">{selectedInventoryObject.brandName || '-'}</strong></span>
              <span>Kategori: <strong className="text-amber-400">{selectedInventoryObject.categoryName || '-'}</strong></span>
              <span>Satuan: <strong className="text-amber-400">{selectedInventoryObject.uomName || 'Pcs'}</strong></span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Barcode Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <BarcodeIcon className="w-3.5 h-3.5 text-amber-500" />
              <span>Barcode / Kode :</span>
            </label>
            <input
              type="text"
              value={barcodeInput}
              onChange={(e) => handleBarcodeChange(e.target.value)}
              placeholder="Scan barcode..."
              className={`w-full p-2.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-900 border-slate-300'
              }`}
            />
          </div>

          {/* Nama Barang Selector */}
          <div className="space-y-1.5 md:col-span-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-amber-500" />
              <span>Nama Barang :</span>
            </label>
            <select
              value={selectedInvId}
              onChange={(e) => handleInventorySelect(Number(e.target.value))}
              className={`w-full p-2.5 rounded-xl border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer ${
                isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-900 border-slate-300'
              }`}
            >
              <option value="">-- Pilih Barang --</option>
              {inventoryList.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.inventoryName} ({inv.inventoryNo})
                </option>
              ))}
            </select>
          </div>

          {/* Qty Fisik */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Qty Stok Fisik :
            </label>
            <input
              type="number"
              min="0"
              value={qtyInput}
              onChange={(e) => setQtyInput(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
              className={`w-full p-2.5 rounded-xl border text-xs font-black text-center focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                isDark ? 'bg-slate-800 text-amber-400 border-slate-700' : 'bg-slate-50 text-amber-900 border-slate-300'
              }`}
            />
          </div>

          {/* Keterangan & Button */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Keterangan / Catatan :
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                placeholder="Deskripsi opname..."
                className={`flex-1 p-2.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-900 border-slate-300'
                }`}
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs cursor-pointer shadow transition-all shrink-0"
              >
                + Tambah
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* 📊 TABLE GRID ITEM OPNAME (GV_Detail 1:1) */}
      <div
        className={`rounded-2xl border shadow-lg overflow-hidden transition-all ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-black text-xs uppercase tracking-wider text-amber-500">
              .:: Detail Item Opname ::.
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
              Total: {opnameItems.length} Jenis Barang | {opnameItems.reduce((a, b) => a + b.qty, 0)} Total Qty
            </span>
          </div>

          {opnameItems.length > 0 && (
            <button
              onClick={handleSubmitOpname}
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg cursor-pointer transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Transaksi Opname'}</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr
                className={`text-[11px] font-black uppercase tracking-wider border-b ${
                  isDark ? 'bg-slate-800/60 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                <th className="py-3 px-4 w-12 text-center">#No</th>
                <th className="py-3 px-4">No. Transaksi</th>
                <th className="py-3 px-4">Barcode / Kode</th>
                <th className="py-3 px-4">Nama Barang</th>
                <th className="py-3 px-4 text-center">Qty Fisik</th>
                <th className="py-3 px-4 text-right">Harga Satuan</th>
                <th className="py-3 px-4">Keterangan</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-xs">
              {opnameItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    Belum ada item opname yang dimasukkan. Gunakan form di atas untuk menambah item.
                  </td>
                </tr>
              ) : (
                opnameItems.map((item, idx) => (
                  <tr
                    key={item.inventoryId}
                    className={`transition-colors ${
                      isDark ? 'hover:bg-slate-800/50 text-slate-200' : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <td className="py-3 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4 font-mono font-bold text-amber-500">{noTransaction}</td>
                    <td className="py-3 px-4 font-mono font-semibold">{item.barcode}</td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {item.inventoryName}
                      <span className="block text-[10px] text-slate-400 font-normal">{item.inventoryNo}</span>
                    </td>
                    <td className="py-3 px-4 text-center font-black text-amber-500 text-sm">
                      {item.qty}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      Rp {(item.price || 0).toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 text-slate-400 italic">{item.description}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleRemoveItem(item.inventoryId)}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                        title="Hapus Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
  );
}

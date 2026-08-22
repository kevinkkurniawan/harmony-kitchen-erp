'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw,
  Package,
  CheckCircle,
  XCircle,
  X,
  AlertTriangle,
  Zap,
  History,
  Search,
  ArrowRightLeft,
  Store,
  Layers,
} from 'lucide-react';

export interface SyncStockItem {
  id: string;
  inventoryNo: string;
  barcode: string;
  inventoryName: string;
  uomName: string;
  stokGudang: number;
  qtyTransaksi: number;
  stokSetelahSync: number;
  isChecked: boolean;
}

export interface SyncLogHeader {
  id: string;
  syncNo: string;
  syncDate: string;
  totalItems: number;
  totalQty: number;
  status: string;
  createdBy: string;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

interface SyncStockManagerProps {
  isDark: boolean;
}

// ⚡ MEMOIZED TABLE ROW COMPONENT to prevent unnecessary re-renders of off-screen or unchanged rows
const SyncStockRow = React.memo(function SyncStockRow({
  row,
  isDark,
  onToggle,
}: {
  row: SyncStockItem;
  isDark: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <tr
      onClick={() => onToggle(row.id)}
      className={`cursor-pointer transition-colors ${
        row.isChecked
          ? isDark ? 'bg-indigo-950/40 hover:bg-indigo-900/50' : 'bg-indigo-50/80 hover:bg-indigo-100/80'
          : isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
      }`}
    >
      <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={row.isChecked}
          onChange={() => onToggle(row.id)}
          className="w-4 h-4 accent-indigo-500 cursor-pointer rounded"
        />
      </td>
      <td className="py-3.5 px-4 font-mono font-black text-indigo-400">{row.inventoryNo}</td>
      <td className="py-3.5 px-4 font-black">{row.inventoryName}</td>
      <td className="py-3.5 px-3 text-center font-bold">{row.uomName}</td>
      <td className="py-3.5 px-4 text-center font-mono font-bold">{row.stokGudang}</td>
      <td className="py-3.5 px-4 text-center font-mono font-black text-rose-400">
        - {row.qtyTransaksi}
      </td>
      <td className="py-3.5 px-4 text-center font-mono font-black text-emerald-400">
        {row.stokSetelahSync}
      </td>
      <td className="py-3.5 px-4 text-center">
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
          row.isChecked
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
        }`}>
          {row.isChecked ? 'SIAP SYNC' : 'LEWATI'}
        </span>
      </td>
    </tr>
  );
});

export default function SyncStockManager({ isDark }: SyncStockManagerProps) {
  const [items, setItems] = useState<SyncStockItem[]>([]);
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // History Modal
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [historyLogs, setHistoryLogs] = useState<SyncLogHeader[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);

  // Debounce search input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchInput);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const addToast = useCallback((text: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // Fetch Pending Sync Items when debounced query changes
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/sales/sync?q=${encodeURIComponent(debouncedQuery)}&all=true`);
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data)) {
          setItems(json.data.map((item: SyncStockItem, idx: number) => ({ ...item, isChecked: idx < pageSize })));
          setCurrentPage(1);
        }
      } catch (err) {
        console.error('Error fetching sync items:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [debouncedQuery, pageSize]);

  const reloadSyncItems = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/sales/sync?q=${encodeURIComponent(debouncedQuery)}&all=true`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setItems(json.data.map((item: SyncStockItem, idx: number) => ({ ...item, isChecked: idx < pageSize })));
      }
    } catch (err) {
      console.error('Error fetching sync items:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch History Logs
  const fetchHistoryLogs = async () => {
    setIsHistoryLoading(true);
    try {
      const res = await fetch('/api/sales/sync?mode=history');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setHistoryLogs(json.data);
      }
    } catch (err) {
      console.error('Error fetching history logs:', err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  // Toggle Checkbox for Individual Item
  const toggleItemCheck = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isChecked: !item.isChecked } : item))
    );
  }, []);

  // Select All / Deselect All Across Entire Dataset
  const toggleSelectAll = useCallback((checked: boolean) => {
    setItems((prev) => prev.map((item) => ({ ...item, isChecked: checked })));
  }, []);

  // 📄 PAGINATED SLICE (Only render active page in DOM)
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  // Select / Deselect ONLY Currently Rendered Page Items
  const isPageSelected = useMemo(
    () => paginatedItems.length > 0 && paginatedItems.every((i) => i.isChecked),
    [paginatedItems]
  );

  const togglePageSelect = useCallback((checked: boolean) => {
    const currentIds = new Set(paginatedItems.map((i) => i.id));
    setItems((prev) =>
      prev.map((item) => (currentIds.has(item.id) ? { ...item, isChecked: checked } : item))
    );
  }, [paginatedItems]);

  // Execute Batch Sync
  const handleExecuteSync = async () => {
    const selectedItems = items.filter((i) => i.isChecked);
    if (selectedItems.length === 0) {
      return addToast('Pilih minimal 1 item barang yang akan di-sinkronisasi', 'warning');
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/sales/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: selectedItems }),
      });

      const json = await res.json();
      if (json.success) {
        addToast(json.message, 'success');
        reloadSyncItems();
      } else {
        addToast(`Gagal sync: ${json.error}`, 'error');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(`Error: ${message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ⚡ MEMOIZED CALCULATIONS
  const selectedCount = useMemo(() => items.filter((i) => i.isChecked).length, [items]);
  const totalPendingQty = useMemo(
    () => items.reduce((acc, i) => acc + (i.isChecked ? i.qtyTransaksi : 0), 0),
    [items]
  );
  const isAllSelected = useMemo(
    () => items.length > 0 && items.every((i) => i.isChecked),
    [items]
  );

  const totalPages = Math.ceil(items.length / pageSize) || 1;

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

      {/* 📊 SUMMARY METRICS HEADER */}
      <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-4 shadow-sm ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <ArrowRightLeft className="w-6 h-6" />
          </div>
          <div>
            <h2 className={`text-base font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Sync Stock (Sales & Gudang ERP)
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              Sinkronisasi Penjualan Kasir POS dengan Stok Fisik Inventoris Gudang Dapur
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchHistoryLogs();
              setIsHistoryOpen(true);
            }}
            className={`px-3.5 py-2 rounded-xl border text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300'
            }`}
          >
            <History className="w-4 h-4 text-purple-400" />
            <span>Riwayat Sync Log</span>
          </button>

          <button
            onClick={handleExecuteSync}
            disabled={isSubmitting || selectedCount === 0}
            className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white font-black text-xs flex items-center gap-2 transition-all shadow-lg cursor-pointer disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4 stroke-[3]" />
            <span>{isSubmitting ? 'Proses Syncing...' : `Proses Sync Stok (${selectedCount})`}</span>
          </button>
        </div>
      </div>

      {/* 📊 SUMMARY METRICS CARDS */}
      <div className={`p-4 border-b grid grid-cols-2 md:grid-cols-4 gap-3.5 shadow-sm ${
        isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">Pending Qty Penjualan POS</div>
            <div className={`text-lg font-black ${isDark ? 'text-indigo-300' : 'text-indigo-950'}`}>
              {totalPendingQty} Items
            </div>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">Barang Siap Di-sync</div>
            <div className={`text-lg font-black ${isDark ? 'text-emerald-300' : 'text-emerald-950'}`}>
              {selectedCount} dari {items.length} Item
            </div>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">Terminal POS Active</div>
            <div className={`text-sm font-black ${isDark ? 'text-blue-300' : 'text-blue-950'}`}>
              Kasir Utama POS ONLINE
            </div>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">Status Sinkronisasi</div>
            <div className={`text-sm font-black ${isDark ? 'text-amber-300' : 'text-amber-950'}`}>
              REALTIME READY
            </div>
          </div>
        </div>
      </div>

      {/* 🔍 SEARCH & CHECKBOX SELECTION TOOLBAR */}
      <div className={`p-3 border-b flex flex-wrap items-center justify-between gap-3 shadow-sm ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari Kode Barang / Nama Barang / SKU..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={`w-full border rounded-xl pl-10 pr-4 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={reloadSyncItems}
            className={`p-2 rounded-xl border hover:bg-slate-800 text-slate-400 cursor-pointer ${
              isDark ? 'border-slate-800' : 'border-slate-300'
            }`}
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 📄 MAIN TABLE GRID OF SYNC ITEMS */}
      <div className="flex-1 overflow-auto p-4">
        <div className={`rounded-2xl border overflow-hidden shadow-lg flex flex-col h-full ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className={`font-black uppercase tracking-wider sticky top-0 z-10 ${
                isDark ? 'bg-slate-800/90 text-indigo-300' : 'bg-slate-200 text-slate-950'
              }`}>
                <tr>
                  <th className="py-3.5 px-3 text-center w-12">
                    <input
                      type="checkbox"
                      checked={isPageSelected}
                      onChange={(e) => togglePageSelect(e.target.checked)}
                      className="w-4 h-4 accent-indigo-500 cursor-pointer rounded"
                      title="Pilih Semua Barang di Halaman Ini"
                    />
                  </th>
                  <th className="py-3.5 px-4">Kode Barang</th>
                  <th className="py-3.5 px-4">Nama Barang Dapur</th>
                  <th className="py-3.5 px-3 text-center">Satuan</th>
                  <th className="py-3.5 px-4 text-center">Stok Gudang ERP</th>
                  <th className="py-3.5 px-4 text-center">Qty Penjualan POS</th>
                  <th className="py-3.5 px-4 text-center">Stok Hasil Sync</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400 font-bold">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                      Memuat daftar barang yang perlu disinkronkan...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400 font-bold">
                      Seluruh barang gudang ERP dan transaksi kasir POS sudah dalam posisi 100% sinkron.
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((row) => (
                    <SyncStockRow
                      key={row.id}
                      row={row}
                      isDark={isDark}
                      onToggle={toggleItemCheck}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 📄 PAGINATION FOOTER */}
          {!isLoading && items.length > 0 && (
            <div className={`px-4 py-2.5 border-t flex items-center justify-between text-xs font-black shrink-0 ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
            }`}>
              <div className="flex items-center gap-3">
                <span>
                  Menampilkan {paginatedItems.length} dari total {items.length} barang
                </span>
                <div className="flex items-center gap-1.5">
                  <span>Rows:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(parseInt(e.target.value, 10));
                      setCurrentPage(1);
                    }}
                    className={`border rounded-lg px-2 py-1 text-xs cursor-pointer focus:outline-none font-black ${
                      isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                    <option value={500}>500</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className={`px-3 py-1 rounded-lg border font-black disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all ${
                    isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-200' : 'border-slate-300 hover:bg-slate-100 text-slate-900'
                  }`}
                >
                  Sebelumnya
                </button>
                <span className={`font-black ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  Halaman {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className={`px-3 py-1 rounded-lg border font-black disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all ${
                    isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-200' : 'border-slate-300 hover:bg-slate-100 text-slate-900'
                  }`}
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 📄 HISTORY LOGS MODAL */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-4xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ${
            isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
          }`}>
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
              isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-300'
            }`}>
              <div className="flex items-center gap-2 font-black text-sm text-indigo-400">
                <History className="w-4 h-4" />
                <span>Riwayat Audit Log Sinkronisasi Stok (POS - Gudang ERP)</span>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Table */}
            <div className="p-6 overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead className={`font-black uppercase tracking-wider ${
                  isDark ? 'bg-slate-800 text-indigo-300' : 'bg-slate-200 text-slate-950'
                }`}>
                  <tr>
                    <th className="py-3 px-4 text-center">No Sync</th>
                    <th className="py-3 px-4">Waktu Sync</th>
                    <th className="py-3 px-4 text-center">Jumlah Barang</th>
                    <th className="py-3 px-4 text-center">Total Qty Sync</th>
                    <th className="py-3 px-4">Operator</th>
                    <th className="py-3 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                  {isHistoryLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-indigo-400" />
                        Memuat riwayat log sync...
                      </td>
                    </tr>
                  ) : historyLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                        Belum ada riwayat audit log sinkronisasi stok.
                      </td>
                    </tr>
                  ) : (
                    historyLogs.map((log) => (
                      <tr key={log.id} className={isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}>
                        <td className="py-3 px-4 text-center font-mono font-black text-indigo-400">{log.syncNo}</td>
                        <td className="py-3 px-4 font-mono">{log.syncDate}</td>
                        <td className="py-3 px-4 text-center font-bold">{log.totalItems} Items</td>
                        <td className="py-3 px-4 text-center font-mono font-black text-emerald-400">{log.totalQty} Qty</td>
                        <td className="py-3 px-4 font-bold">{log.createdBy}</td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2.5 py-1 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            {log.status}
                          </span>
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
    </div>
  );
}

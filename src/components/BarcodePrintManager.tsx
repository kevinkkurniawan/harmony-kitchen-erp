'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Printer,
  Search,
  Plus,
  Trash2,
  RefreshCw,
  Tag,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  Sliders,
  Eye,
  ArrowLeft,
} from 'lucide-react';
import { ERPProduct } from '@/types/erp';
import { useDebounce } from '@/hooks/useDebounce';

interface BarcodeQueueItem {
  product: ERPProduct;
  printQty: number;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

interface BarcodePrintManagerProps {
  isDark: boolean;
  onBack?: () => void;
}

export default function BarcodePrintManager({ isDark, onBack }: BarcodePrintManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState<ERPProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Queue of labels to print
  const [queue, setQueue] = useState<BarcodeQueueItem[]>([]);

  // Print settings
  const [includePrice, setIncludePrice] = useState<boolean>(true);
  const [includeStoreName, setIncludeStoreName] = useState<boolean>(true);
  const [storeName, setStoreName] = useState<string>('HARMONY KITCHEN');
  const [labelSize] = useState<string>('108x18-3col');

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const addToast = useCallback((text: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = Date.now().toString() + '-' + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // Fetch search products
  useEffect(() => {
    let isMounted = true;
    if (!debouncedSearch.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    async function search() {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/inventory?q=${encodeURIComponent(debouncedSearch)}&limit=20&status=active`);
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data)) {
          setSearchResults(json.data);
        }
      } catch (err) {
        console.error('Error searching products:', err);
      } finally {
        if (isMounted) setIsSearching(false);
      }
    }
    search();
    return () => { isMounted = false; };
  }, [debouncedSearch]);

  const handleAddToQueue = (product: ERPProduct, qty = 1) => {
    setQueue((prev) => {
      const idx = prev.findIndex((item) => item.product.id === product.id);
      if (idx > -1) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], printQty: updated[idx].printQty + qty };
        return updated;
      }
      return [...prev, { product, printQty: qty }];
    });
    addToast(`"${product.inventoryName}" ditambahkan ke antrian cetak (${qty} pcs)`, 'info');
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchResults.length > 0) {
      e.preventDefault();
      const q = searchQuery.trim().toLowerCase();
      const exactMatch = searchResults.find(
        (p) => (p.barcode || '').toLowerCase() === q || (p.inventoryNo || '').toLowerCase() === q
      );
      const chosen = exactMatch || searchResults[0];
      handleAddToQueue(chosen, 1);
      setSearchQuery('');
      setSearchResults([]);
    } else if (e.key === 'Escape') {
      setSearchResults([]);
    }
  };

  const handleUpdateQty = (productId: string, newQty: number) => {
    const clampedQty = Math.max(1, Math.min(999, isNaN(newQty) ? 1 : newQty));
    setQueue((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, printQty: clampedQty } : item))
    );
  };

  const handleRemoveFromQueue = (productId: string) => {
    setQueue((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const totalLabels = queue.reduce((sum, item) => sum + item.printQty, 0);

  const handlePrint = async () => {
    if (queue.length === 0) {
      addToast('Antrian cetak kosong. Tambahkan barang terlebih dahulu.', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/barcode/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: queue,
          totalLabels,
          labelSize,
          includePrice,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        addToast(json.error?.message || json.error || 'Izin cetak barcode ditolak.', 'error');
        return;
      }
    } catch (e: any) {
      console.error('Error logging barcode print audit:', e);
    }

    window.print();
  };

  // Generate flattened array of individual labels for print rendering
  const flattenedLabels: ERPProduct[] = [];
  queue.forEach((item) => {
    for (let i = 0; i < item.printQty; i++) {
      flattenedLabels.push(item.product);
    }
  });

  // Group flattened labels into 3-column rows (AcrossThenDown: Col 1 -> Col 2 -> Col 3)
  // Matches legacy Rpt_LabelBarcodePrice (PageWidth=1080 [108mm], ColumnCount=3, ColumnWidth=360 [36mm], Height=182 [18.2mm])
  const labelRows: (ERPProduct | null)[][] = [];
  for (let i = 0; i < flattenedLabels.length; i += 3) {
    labelRows.push([
      flattenedLabels[i] || null,
      flattenedLabels[i + 1] || null,
      flattenedLabels[i + 2] || null,
    ]);
  }

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden select-none relative ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-950'}`}>
      {/* 🔔 FLOATING TOASTS */}
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-xl border text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-top-4 fade-in duration-200 ${
              toast.type === 'success'
                ? isDark ? 'bg-emerald-950/90 border-emerald-800 text-emerald-300' : 'bg-emerald-800 text-white border-emerald-900'
                : toast.type === 'error'
                ? isDark ? 'bg-rose-950/90 border-rose-800 text-rose-300' : 'bg-rose-800 text-white border-rose-900'
                : toast.type === 'warning'
                ? isDark ? 'bg-amber-950/90 border-amber-800 text-amber-300' : 'bg-amber-800 text-white border-amber-900'
                : isDark ? 'bg-indigo-950/90 border-indigo-800 text-indigo-300' : 'bg-indigo-800 text-white border-indigo-900'
            }`}
          >
            {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-300 shrink-0" />}
            {toast.type === 'error' && <XCircle className="w-4 h-4 text-rose-300 shrink-0" />}
            {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />}
            {toast.type === 'info' && <Zap className="w-4 h-4 text-indigo-300 shrink-0" />}
            <span>{toast.text}</span>
          </div>
        ))}
      </div>

      {/* 🖨️ PRINT CSS STYLES FOR 3-COLUMN THERMAL ROLL (108mm width = 3 x 36mm columns, 18.2mm row height) */}
      <style>{`
        @media print {
          @page {
            size: 108mm 18.2mm;
            margin: 0;
          }
          body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden !important;
          }
          #print-label-area, #print-label-area * {
            visibility: visible !important;
          }
          #print-label-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 108mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .barcode-label-row {
            width: 108mm !important;
            height: 18.2mm !important;
            max-height: 18.2mm !important;
            page-break-after: always !important;
            box-sizing: border-box !important;
            display: grid !important;
            grid-template-columns: repeat(3, 36mm) !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .barcode-label-cell {
            width: 36mm !important;
            height: 18.2mm !important;
            max-height: 18.2mm !important;
            box-sizing: border-box !important;
            padding: 1mm 1.5mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            align-items: center !important;
            text-align: center !important;
            font-family: monospace, sans-serif !important;
            overflow: hidden !important;
          }
        }
      `}</style>

      {/* HEADER TOOLBAR */}
      <div className={`px-5 py-3 border-b flex items-center justify-between gap-3 shadow-sm print:hidden ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
      }`}>
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded-xl border border-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-500" />
            <div>
              <h2 className="font-black text-sm">Generator & Cetak Barcode Label (3 Kolom / Baris)</h2>
              <p className="text-[10px] text-slate-500 font-semibold">
                Roll 108mm • 3 Label per Baris (@ 33×15mm / 36×18.2mm) • Urutan Kiri ke Kanan (Kolom 1 ➔ 2 ➔ 3)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={includePrice}
              onChange={(e) => setIncludePrice(e.target.checked)}
              className="accent-indigo-500 rounded cursor-pointer"
            />
            <span>Sertakan Harga</span>
          </label>

          <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={includeStoreName}
              onChange={(e) => setIncludeStoreName(e.target.checked)}
              className="accent-indigo-500 rounded cursor-pointer"
            />
            <span>Header Toko</span>
          </label>

          <button
            onClick={() => setQueue([])}
            disabled={queue.length === 0}
            className="px-3 py-1.5 rounded-xl border border-rose-400 text-rose-600 text-xs font-black hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-40 cursor-pointer transition-all"
          >
            Kosongkan Antrian
          </button>

          <button
            onClick={handlePrint}
            disabled={queue.length === 0}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak {totalLabels} Label ({labelRows.length} Baris)</span>
          </button>
        </div>
      </div>

      {/* WORKSPACE LAYOUT: LEFT SEARCH & QUEUE, RIGHT PREVIEW */}
      <div className="flex-1 flex min-h-0 overflow-hidden print:hidden">
        {/* LEFT COLUMN: SEARCH PRODUCTS & PRINT QUEUE */}
        <div className={`w-1/2 flex flex-col border-r min-w-0 ${isDark ? 'border-slate-800' : 'border-slate-300'}`}>
          {/* SEARCH BAR */}
          <div className="p-3.5 border-b border-slate-300 dark:border-slate-800 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Cari barang untuk dicetak barcode (SKU / Barcode / Nama)..."
                className={`w-full border-2 rounded-xl pl-9 pr-9 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
              {isSearching && (
                <RefreshCw className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500 animate-spin" />
              )}
            </div>

            {/* Search Dropdown Results */}
            {searchResults.length > 0 ? (
              <div className={`max-h-48 overflow-y-auto rounded-xl border-2 shadow-lg divide-y ${
                isDark ? 'bg-slate-900 border-slate-700 divide-slate-800' : 'bg-white border-slate-300 divide-slate-200'
              }`}>
                {searchResults.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      handleAddToQueue(p, 1);
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="p-2.5 flex items-center justify-between hover:bg-indigo-50 dark:hover:bg-slate-800 cursor-pointer text-xs"
                  >
                    <div>
                      <div className="font-black text-slate-900 dark:text-white">{p.inventoryName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        SKU: {p.inventoryNo} | Barcode: {p.barcode}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-indigo-600 dark:text-indigo-400">
                        Rp {(p.price || 0).toLocaleString('id-ID')}
                      </span>
                      <button type="button" className="p-1 rounded-lg bg-indigo-600 text-white">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              debouncedSearch.trim() && !isSearching && (
                <div className={`p-3 rounded-xl border text-center text-xs font-bold text-slate-400 ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}>
                  Barang tidak ditemukan untuk kata kunci &ldquo;{debouncedSearch}&rdquo;.
                </div>
              )
            )}
          </div>

          {/* QUEUE TABLE */}
          <div className="flex-1 overflow-auto p-3.5 flex flex-col">
            <div className="text-xs font-black mb-2 flex items-center justify-between">
              <span>Antrian Cetak ({queue.length} Jenis Barang - Total {totalLabels} Label / {labelRows.length} Baris)</span>
            </div>

            <div className={`flex-1 overflow-auto rounded-xl border-2 shadow-sm ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
            }`}>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white font-black text-[11px] border-b border-slate-700">
                    <th className="p-2.5">Barang</th>
                    <th className="p-2.5 text-right">Harga Retail</th>
                    <th className="p-2.5 text-center w-36">Jumlah Cetak</th>
                    <th className="p-2.5 text-center w-12">Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-bold">
                  {queue.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400">
                        Belum ada barang di antrian cetak. Cari barang di atas untuk menambahkan.
                      </td>
                    </tr>
                  ) : (
                    queue.map((item) => (
                      <tr key={item.product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="p-2.5">
                          <div className="font-black text-slate-900 dark:text-white">{item.product.inventoryName}</div>
                          <div className="text-[10px] font-mono text-slate-500">
                            {item.product.inventoryNo} | {item.product.barcode}
                          </div>
                        </td>
                        <td className="p-2.5 text-right font-black text-indigo-600 dark:text-indigo-400">
                          Rp {(item.product.price || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="p-2.5 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(item.product.id, item.printQty - 1)}
                              disabled={item.printQty <= 1}
                              className="w-6 h-6 rounded border border-slate-300 dark:border-slate-700 font-black text-xs disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-800"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={999}
                              value={item.printQty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val)) {
                                  handleUpdateQty(item.product.id, val);
                                }
                              }}
                              className={`w-14 border-2 rounded-lg px-1.5 py-1 text-center font-black outline-none ${
                                isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(item.product.id, item.printQty + 1)}
                              className="w-6 h-6 rounded border border-slate-300 dark:border-slate-700 font-black text-xs hover:bg-slate-200 dark:hover:bg-slate-800"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveFromQueue(item.product.id)}
                            title="Hapus dari antrian"
                            className="p-1.5 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
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

        {/* RIGHT COLUMN: LIVE BROWSER PREVIEW OF 3-COLUMN ROLL (108mm x 18.2mm per row) */}
        <div className={`w-1/2 flex flex-col p-4 overflow-y-auto ${isDark ? 'bg-slate-900/50' : 'bg-slate-200/60'}`}>
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-300 dark:border-slate-800">
            <div>
              <span className="font-black text-xs uppercase tracking-wider block">
                Live Print Preview — 3 Barcode / Baris (Roll 108mm × 18.2mm)
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">
                1 label = Kolom 1 • 2 label = Kolom 1 &amp; 2 • 3 label = Kolom 1, 2, &amp; 3
              </span>
            </div>
            <span className="text-[11px] text-indigo-500 font-black">
              {flattenedLabels.length} Label ({labelRows.length} Baris)
            </span>
          </div>

          <div className="flex flex-col gap-3 items-center">
            {labelRows.length === 0 ? (
              <div className="py-20 text-center text-slate-400 text-xs font-bold">
                Preview label barcode (3 kolom per baris) akan muncul di sini setelah barang ditambahkan ke antrian.
              </div>
            ) : (
              labelRows.map((rowSlots, rowIdx) => (
                <div
                  key={rowIdx}
                  data-testid={`barcode-preview-row-${rowIdx}`}
                  className={`w-full max-w-[540px] p-2.5 rounded-xl border ${
                    isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/80 border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <span>Baris {rowIdx + 1}</span>
                    <span>Roll 108mm (3 × 36mm)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {rowSlots.map((prod, colIdx) =>
                      prod ? (
                        <div
                          key={colIdx}
                          data-testid={`barcode-preview-cell-${rowIdx}-${colIdx}`}
                          data-filled="true"
                          className="bg-white text-black p-1.5 border-2 border-dashed border-slate-400 rounded shadow-sm flex flex-col justify-between items-center text-center font-mono select-none min-h-[88px]"
                        >
                          <div className="w-full flex items-center justify-between text-[7px] text-slate-400 font-sans font-bold">
                            <span>KOLOM {colIdx + 1}</span>
                            {includeStoreName && (
                              <span className="text-black font-black uppercase truncate max-w-[90px]">
                                {storeName}
                              </span>
                            )}
                          </div>

                          <div className="text-[8.5px] font-black leading-tight line-clamp-1 px-0.5 w-full">
                            {prod.inventoryName}
                          </div>

                          {/* Simulated standard barcode visual */}
                          <div className="flex flex-col items-center w-full px-1 my-0.5">
                            <div className="h-5 w-full flex items-center justify-center gap-[1px] overflow-hidden">
                              {Array.from({ length: 24 }).map((_, i) => (
                                <div
                                  key={i}
                                  className="bg-black h-full"
                                  style={{
                                    width: (i % 3 === 0 || i % 7 === 0) ? '2px' : '1px',
                                    opacity: (i % 5 === 0) ? 0.75 : 1,
                                  }}
                                />
                              ))}
                            </div>
                            <div className="text-[8px] font-black tracking-wider mt-0.5 truncate max-w-full">
                              {prod.barcode || prod.inventoryNo}
                            </div>
                          </div>

                          {includePrice && (
                            <div className="text-[9px] font-black tracking-tight">
                              Rp {(prod.price || 0).toLocaleString('id-ID')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          key={colIdx}
                          data-testid={`barcode-preview-cell-${rowIdx}-${colIdx}`}
                          data-filled="false"
                          className={`p-1.5 border-2 border-dashed rounded flex flex-col items-center justify-center text-center min-h-[88px] ${
                            isDark ? 'border-slate-800 text-slate-700 bg-slate-950/40' : 'border-slate-300 text-slate-400 bg-slate-100/60'
                          }`}
                        >
                          <span className="text-[9px] font-bold uppercase">Kolom {colIdx + 1}</span>
                          <span className="text-[8px]">Kosong</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 🖨️ HIDDEN PRINT TARGET CONTAINER (Visible only in print media: 3 columns per row on 108mm roll) */}
      <div id="print-label-area" className="hidden print:block">
        {labelRows.map((rowSlots, rowIdx) => (
          <div key={rowIdx} className="barcode-label-row bg-white text-black">
            {rowSlots.map((prod, colIdx) => (
              <div key={colIdx} className="barcode-label-cell bg-white text-black">
                {prod ? (
                  <>
                    {includeStoreName && (
                      <div style={{ fontSize: '5.5pt', fontWeight: 'bold', textTransform: 'uppercase', lineHeight: 1 }}>
                        {storeName}
                      </div>
                    )}

                    <div style={{ fontSize: '6.5pt', fontWeight: 'bold', lineHeight: '1.05', maxHeight: '14px', overflow: 'hidden', width: '100%' }}>
                      {prod.inventoryNo} - {prod.inventoryName}
                    </div>

                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0.5mm 0' }}>
                      <div style={{ height: '5.5mm', width: '92%', display: 'flex', justifyContent: 'center', gap: '1px' }}>
                        {Array.from({ length: 26 }).map((_, i) => (
                          <div
                            key={i}
                            style={{
                              backgroundColor: 'black',
                              height: '100%',
                              width: (i % 3 === 0 || i % 7 === 0) ? '2px' : '1px',
                            }}
                          />
                        ))}
                      </div>
                      <div style={{ fontSize: '6pt', fontWeight: 'bold', letterSpacing: '0.5px', lineHeight: 1 }}>
                        {prod.barcode || prod.inventoryNo}
                      </div>
                    </div>

                    {includePrice && (
                      <div style={{ fontSize: '7pt', fontWeight: 'bold', lineHeight: 1 }}>
                        Rp {(prod.price || 0).toLocaleString('id-ID')}
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

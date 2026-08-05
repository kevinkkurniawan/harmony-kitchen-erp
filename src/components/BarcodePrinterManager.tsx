'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Barcode,
  Printer,
  Plus,
  Search,
  RefreshCw,
  Trash2,
  Settings,
  Check,
  Zap,
  Eye,
  Sliders,
  Layers,
  Sparkles,
  ShoppingBag,
  Tag,
  CheckSquare,
  Square,
  RotateCcw,
} from 'lucide-react';
import { ERPProduct } from '@/types/erp';

export interface BarcodePrintQueueItem {
  id: string | number;
  inventoryNo: string;
  inventoryName: string;
  barcode: string;
  price: number;
  uomName: string;
  printQty: number;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

interface BarcodePrinterManagerProps {
  isDark: boolean;
}

export default function BarcodePrinterManager({ isDark }: BarcodePrinterManagerProps) {
  // Queue list
  const [printQueue, setPrintQueue] = useState<BarcodePrintQueueItem[]>([]);

  // Search products
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<ERPProduct[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Print Configuration Options
  const [paperPreset, setPaperPreset] = useState<'50x30' | '40x20' | 'A4_3x10'>('50x30');
  const [showStoreName, setShowStoreName] = useState<boolean>(true);
  const [showProductName, setShowProductName] = useState<boolean>(true);
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [showSKU, setShowSKU] = useState<boolean>(true);
  const [storeTitle, setStoreTitle] = useState<string>('HARMONY KITCHEN');

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((text: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Fetch initial sample items to populate queue
  useEffect(() => {
    const fetchSampleItems = async () => {
      try {
        const res = await fetch('/api/inventory?limit=5');
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const sampleQueue: BarcodePrintQueueItem[] = json.data.slice(0, 3).map((prod: ERPProduct) => ({
            id: prod.id,
            inventoryNo: prod.inventoryNo || (prod as any).inventory_no || `INV-${prod.id}`,
            inventoryName: prod.inventoryName || (prod as any).inventory_name || 'Item',
            barcode: prod.barcode || `899${1000 + Number(prod.id)}`,
            price: Number(prod.price || prod.hpp || 50000),
            uomName: prod.uomName || (prod as any).uom_name || 'PCS',
            printQty: 4,
          }));
          setPrintQueue(sampleQueue);
        }
      } catch (err) {
        console.error('Error fetching sample products:', err);
      }
    };
    fetchSampleItems();
  }, []);

  // Search Products for adding to Queue
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/inventory?q=${encodeURIComponent(searchQuery)}&limit=8`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setSearchResults(json.data);
        }
      } catch (err) {
        console.error('Product search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleAddToQueue = (prod: ERPProduct) => {
    const name = prod.inventoryName || (prod as any).inventory_name || 'Item';
    const no = prod.inventoryNo || (prod as any).inventory_no || `INV-${prod.id}`;
    const code = prod.barcode || `899${1000 + Number(prod.id)}`;
    const price = Number(prod.price || prod.hpp || 50000);
    const uom = prod.uomName || (prod as any).uom_name || 'PCS';

    const existingIdx = printQueue.findIndex((q) => q.id === prod.id);
    if (existingIdx >= 0) {
      const updated = [...printQueue];
      updated[existingIdx].printQty += 2;
      setPrintQueue(updated);
    } else {
      setPrintQueue([
        ...printQueue,
        {
          id: prod.id,
          inventoryNo: no,
          inventoryName: name,
          barcode: code,
          price,
          uomName: uom,
          printQty: 4,
        },
      ]);
    }

    setSearchQuery('');
    setSearchResults([]);
    addToast(`Item ${name} ditambahkan ke antrean cetak`, 'info');
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    const qty = Math.max(1, newQty);
    const updated = [...printQueue];
    updated[index].printQty = qty;
    setPrintQueue(updated);
  };

  const handleRemoveFromQueue = (index: number) => {
    setPrintQueue(printQueue.filter((_, i) => i !== index));
  };

  const handleClearQueue = () => {
    setPrintQueue([]);
    addToast('Antrean cetak barcode dibersihkan', 'warning');
  };

  const totalLabelsToPrint = printQueue.reduce((acc, q) => acc + q.printQty, 0);

  // Code128 Mock SVG Barcode generator for live preview & crisp printing
  const renderCode128Svg = (code: string) => {
    const cleanCode = code || '12345678';
    const bars: boolean[] = [];
    for (let i = 0; i < cleanCode.length; i++) {
      const charCode = cleanCode.charCodeAt(i);
      bars.push(charCode % 2 === 0, true, charCode % 3 !== 0, false, charCode % 5 === 0);
    }
    // ensure minimum bars
    while (bars.length < 45) {
      bars.push(true, false, true, true, false);
    }

    return (
      <div className="flex flex-col items-center justify-center w-full my-1">
        <div className="flex items-center h-8 sm:h-10 w-full justify-center bg-black px-1 py-0.5 rounded">
          {bars.slice(0, 48).map((isBlack, idx) => (
            <div
              key={idx}
              className={`h-full ${isBlack ? 'bg-white' : 'bg-transparent'}`}
              style={{ width: `${(idx % 3) + 1.5}px`, marginRight: '1px' }}
            />
          ))}
        </div>
        <span className="font-mono text-[10px] sm:text-xs font-bold tracking-widest text-slate-800 mt-0.5">
          *{cleanCode}*
        </span>
      </div>
    );
  };

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
            {t.type === 'info' && <Zap className="w-4 h-4" />}
            {t.type === 'warning' && <RotateCcw className="w-4 h-4" />}
            {t.type === 'success' && <Check className="w-4 h-4" />}
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
            <Barcode className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight flex items-center gap-2">
              Cetak Label Barcode Produk (Barcode Print)
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-500 border border-purple-500/20">
                MD_BARCODE 1:1
              </span>
            </h1>
            <p className="text-xs text-slate-400">Generator & Cetak Massal Label Barcode Thermal / Sticker Paper</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            disabled={printQueue.length === 0}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-purple-500/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            Cetak Barcode ({totalLabelsToPrint} Label)
          </button>
        </div>
      </header>

      {/* MAIN CONTENT SPLIT */}
      <div className="flex-1 p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: QUEUE & PRODUCT SEARCH (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Product Search & Add to Queue Card */}
          <div
            className={`p-6 rounded-2xl border flex flex-col gap-4 relative ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-purple-400 flex items-center gap-2">
              <Search className="w-4 h-4" /> Cari Produk untuk Dicetak
            </h2>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Ketik Nama Produk, Barcode, atau No. Inventory..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border outline-none transition-colors ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-purple-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-purple-500'
                }`}
              />

              {/* Popup Search Dropdown */}
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
                        onClick={() => handleAddToQueue(product)}
                        className={`p-3 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                          isDark ? 'hover:bg-slate-800' : 'hover:bg-purple-50'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-purple-400">
                            {product.inventoryName || (product as any).inventory_name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {product.inventoryNo || (product as any).inventory_no} | Barcode: {product.barcode || '-'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-emerald-400">
                            Rp {Number(product.price || product.hpp || 0).toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Queue List Table */}
          <div
            className={`p-6 rounded-2xl border flex flex-col gap-4 flex-1 ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                <Layers className="w-4 h-4" /> Antrean Cetak Label ({printQueue.length} Item)
              </h2>

              {printQueue.length > 0 && (
                <button
                  onClick={handleClearQueue}
                  className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Kosongkan Antrean
                </button>
              )}
            </div>

            <div className="overflow-x-auto border rounded-xl border-slate-800">
              <table className="w-full text-left text-xs">
                <thead
                  className={`uppercase font-bold border-b tracking-wider ${
                    isDark ? 'bg-slate-800/50 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  <tr>
                    <th className="px-4 py-3">Nama Produk</th>
                    <th className="px-4 py-3">Kode Barcode</th>
                    <th className="px-4 py-3 text-right">Harga Retail (Rp)</th>
                    <th className="px-4 py-3 text-center w-32">Jumlah Cetak</th>
                    <th className="px-4 py-3 text-center w-16">Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {printQueue.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                        Antrean cetak kosong. Tambahkan produk melalui kolom pencarian di atas.
                      </td>
                    </tr>
                  ) : (
                    printQueue.map((item, idx) => (
                      <tr key={idx} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                        <td className="px-4 py-3">
                          <div className="font-bold text-white">{item.inventoryName}</div>
                          <div className="text-[10px] text-slate-400">{item.inventoryNo}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-purple-400 font-semibold">{item.barcode}</td>
                        <td className="px-4 py-3 text-right font-extrabold text-emerald-400">
                          Rp {item.price.toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.printQty}
                            onChange={(e) => handleUpdateQty(idx, parseInt(e.target.value) || 1)}
                            className={`w-20 px-2 py-1 text-center font-extrabold rounded-lg border outline-none ${
                              isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleRemoveFromQueue(idx)}
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
          </div>
        </div>

        {/* RIGHT COLUMN: PRINT CONFIG & LIVE PREVIEW (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Configuration Card */}
          <div
            className={`p-6 rounded-2xl border flex flex-col gap-4 ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-purple-400 flex items-center gap-2">
              <Sliders className="w-4 h-4" /> Pengaturan Label Barcode
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">Ukuran Label / Kertas Thermal</label>
                <select
                  value={paperPreset}
                  onChange={(e: any) => setPaperPreset(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none cursor-pointer ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="50x30">Thermal Roll 50 x 30 mm (Standar Resto/Retail)</option>
                  <option value="40x20">Thermal Roll 40 x 20 mm (Ukuran Kecil / Mini)</option>
                  <option value="A4_3x10">Sticker Sheet A4 (Grid 3 x 10 Label)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">Nama Resto / Toko</label>
                <input
                  type="text"
                  value={storeTitle}
                  onChange={(e) => setStoreTitle(e.target.value)}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStoreName(!showStoreName)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all ${
                    showStoreName
                      ? 'bg-purple-500/10 border-purple-500/40 text-purple-400'
                      : isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-400'
                      : 'bg-slate-100 border-slate-300 text-slate-600'
                  }`}
                >
                  {showStoreName ? <CheckSquare className="w-4 h-4 text-purple-400" /> : <Square className="w-4 h-4" />}
                  Header Resto
                </button>

                <button
                  type="button"
                  onClick={() => setShowProductName(!showProductName)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all ${
                    showProductName
                      ? 'bg-purple-500/10 border-purple-500/40 text-purple-400'
                      : isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-400'
                      : 'bg-slate-100 border-slate-300 text-slate-600'
                  }`}
                >
                  {showProductName ? <CheckSquare className="w-4 h-4 text-purple-400" /> : <Square className="w-4 h-4" />}
                  Nama Barang
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrice(!showPrice)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all ${
                    showPrice
                      ? 'bg-purple-500/10 border-purple-500/40 text-purple-400'
                      : isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-400'
                      : 'bg-slate-100 border-slate-300 text-slate-600'
                  }`}
                >
                  {showPrice ? <CheckSquare className="w-4 h-4 text-purple-400" /> : <Square className="w-4 h-4" />}
                  Harga Jual (Rp)
                </button>

                <button
                  type="button"
                  onClick={() => setShowSKU(!showSKU)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all ${
                    showSKU
                      ? 'bg-purple-500/10 border-purple-500/40 text-purple-400'
                      : isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-400'
                      : 'bg-slate-100 border-slate-300 text-slate-600'
                  }`}
                >
                  {showSKU ? <CheckSquare className="w-4 h-4 text-purple-400" /> : <Square className="w-4 h-4" />}
                  SKU Inventory
                </button>
              </div>
            </div>
          </div>

          {/* Live Preview Card */}
          <div
            className={`p-6 rounded-2xl border flex flex-col gap-4 flex-1 ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-purple-400 flex items-center gap-2">
              <Eye className="w-4 h-4" /> Live Preview Label Barcode
            </h2>

            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-950/60 rounded-xl border border-slate-800 overflow-hidden">
              {printQueue.length === 0 ? (
                <div className="text-center text-slate-500 text-xs">
                  <Barcode className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <span>Tambahkan barang ke antrean untuk melihat preview label</span>
                </div>
              ) : (
                <div className="flex flex-col gap-4 items-center w-full max-w-xs">
                  {/* Single Label Render Sample */}
                  <div className="w-full bg-white text-slate-900 p-4 rounded-xl shadow-xl border-2 border-slate-300 flex flex-col items-center text-center">
                    {showStoreName && (
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 border-b border-slate-300 pb-1 mb-1.5 w-full">
                        {storeTitle}
                      </p>
                    )}

                    {showProductName && (
                      <p className="text-xs font-black text-slate-900 leading-tight mb-1 line-clamp-2">
                        {printQueue[0].inventoryName}
                      </p>
                    )}

                    {/* Barcode Render */}
                    {renderCode128Svg(printQueue[0].barcode)}

                    <div className="flex justify-between items-center w-full pt-1.5 border-t border-slate-300 text-[11px] font-extrabold mt-1">
                      {showSKU ? <span className="text-slate-500 font-mono text-[10px]">{printQueue[0].inventoryNo}</span> : <div />}
                      {showPrice && <span className="text-emerald-700 font-black">Rp {printQueue[0].price.toLocaleString('id-ID')}</span>}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 text-center font-medium">
                    Sampel pratinjau label pertama dari {totalLabelsToPrint} total label yang akan dicetak.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

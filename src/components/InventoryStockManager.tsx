'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Package,
  AlertTriangle,
  Archive,
  BarChart3,
  RefreshCw,
  Store,
  FileSpreadsheet,
  Printer,
  ChevronDown,
  ChevronUp,
  History,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  CheckCircle,
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface StockMetrics {
  totalItems: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
}

interface InventoryItem {
  id: string;
  barcode: string;
  inventoryNo: string;
  inventoryName: string;
  categoryName: string;
  stokAkhir: number;
  minStock: number;
  hpp: number;
  stokEtalase?: number;
  stokGudang?: number;
}

interface Warehouse {
  id: number;
  whCode: number;
  location: string;
}

interface MovementLedger {
  id: number;
  date: string;
  transactionNo: string;
  type: string;
  qtyIn: number;
  qtyOut: number;
  price: number;
  balance: number;
}

interface InventoryStockManagerProps {
  canViewPrice?: boolean;
  isDark: boolean;
}

export default function InventoryStockManager({ isDark }: InventoryStockManagerProps) {
  // State
  const [metrics, setMetrics] = useState<StockMetrics | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [warehouseId, setWarehouseId] = useState('ALL');
  const [minusStockOnly, setMinusStockOnly] = useState(false);

  // Drill-down State
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [ledgerData, setLedgerData] = useState<MovementLedger[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

  // Fetch Metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch(`/api/inventory/stock-metrics?warehouseId=${warehouseId}&q=${encodeURIComponent(debouncedSearchQuery)}`);
      const json = await res.json();
      if (json.success) setMetrics(json.data);
    } catch (e) {
      console.error('Failed to fetch metrics', e);
    }
  }, [warehouseId, debouncedSearchQuery]);

  // Fetch Items
  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = `/api/inventory?q=${encodeURIComponent(debouncedSearchQuery)}&limit=100`;
      if (minusStockOnly) url += '&minusStock=true';
      if (warehouseId !== 'ALL') url += `&warehouseId=${warehouseId}`;
      
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setItems(json.data);
      }
    } catch (e) {
      console.error('Failed to fetch inventory items', e);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearchQuery, warehouseId, minusStockOnly]);

  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory/lookups');
      const json = await res.json();
      if (json.success && json.data.warehouses) {
        setWarehouses(json.data.warehouses);
      }
    } catch (e) {
      console.error('Failed to fetch warehouses', e);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    fetchItems();
    fetchWarehouses();
  }, [fetchMetrics, fetchItems, fetchWarehouses]);

  // Handle Drill-down
  const toggleRowExpand = async (inventoryId: string) => {
    if (expandedRow === inventoryId) {
      setExpandedRow(null);
      return;
    }
    
    setExpandedRow(inventoryId);
    setIsLoadingLedger(true);
    setLedgerData([]);
    
    try {
      const res = await fetch(`/api/inventory/${inventoryId}/movement`);
      const json = await res.json();
      if (json.success) {
        setLedgerData(json.data);
      }
    } catch (e) {
      console.error('Failed to fetch ledger', e);
    } finally {
      setIsLoadingLedger(false);
    }
  };

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* 📊 KPI CARDS OVERVIEW (Phase 2 Requirement) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 shrink-0">
        <div className={`p-4 rounded-2xl border flex items-center gap-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total SKU Aktif</p>
            <h3 className="text-2xl font-black">{metrics ? metrics.totalItems.toLocaleString() : '...'}</h3>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border flex items-center gap-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Nilai Persediaan</p>
            <h3 className="text-xl font-black text-emerald-500">Rp {metrics ? metrics.totalValue.toLocaleString('id-ID') : '...'}</h3>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border flex items-center gap-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Peringatan Stok Tipis</p>
            <h3 className="text-2xl font-black text-amber-500">{metrics ? metrics.lowStockCount.toLocaleString() : '...'}</h3>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border flex items-center gap-4 shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="p-3 bg-rose-500/10 text-rose-500 rounded-xl">
            <Archive className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Stok Kosong / Minus</p>
            <h3 className="text-2xl font-black text-rose-500">{metrics ? metrics.outOfStockCount.toLocaleString() : '...'}</h3>
          </div>
        </div>
      </div>

      {/* 🎛️ FILTERS & ACTIONS BAR */}
      <div className={`px-5 py-3 border-y flex flex-wrap items-center justify-between gap-4 shrink-0 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-wrap items-center gap-3">
          {/* Gudang Selector */}
          <div className="flex items-center gap-2">
            <Store className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className={`text-xs font-bold p-2 rounded-lg border outline-none ${
                isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              <option value="ALL">Semua Gudang & Lokasi</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.whCode}>{w.location}</option>
              ))}
            </select>
          </div>
          
          <div className="w-px h-6 bg-slate-700/30"></div>

          {/* Search */}
          <div className="relative">
            <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="text"
              placeholder="Cari SKU atau Nama..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-64 pl-9 pr-3 py-1.5 rounded-lg border text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none ${
                isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={minusStockOnly}
              onChange={(e) => setMinusStockOnly(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-500"
            />
            <span className={minusStockOnly ? 'text-rose-500' : ''}>Tampilkan Stok Minus</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-2 transition-all ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-300 hover:bg-slate-50'}`}>
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Excel
          </button>
          <button className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-2 transition-all ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-300 hover:bg-slate-50'}`}>
            <Printer className="w-4 h-4 text-indigo-500" /> Cetak
          </button>
          <button onClick={fetchItems} className={`p-2 rounded-xl border transition-all ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-300 hover:bg-slate-50'}`}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 📋 DATA GRID */}
      <div className="flex-1 min-h-0 overflow-auto p-5">
        <div className={`rounded-2xl border shadow-sm overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <table className="w-full text-left border-collapse">
            <thead className={`sticky top-0 z-10 text-[11px] font-black uppercase tracking-wider ${isDark ? 'bg-slate-950 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              <tr>
                <th className="px-4 py-3 w-16 text-center">Kode Barang</th>
                <th className="px-4 py-3">Nama Barang</th>
                <th className="px-4 py-3 text-right">Stok Gudang</th>
                <th className="px-4 py-3 text-right">Stok Etalase</th>
                <th className="px-4 py-3 text-right">Stok Akhir</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className={`divide-y text-xs ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center animate-pulse">
                    <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-indigo-500" />
                    <p className="font-bold text-slate-500">Memuat Kartu Stok...</p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <Archive className="w-12 h-12 mx-auto mb-3 text-slate-500 opacity-50" />
                    <p className="font-bold text-slate-500">Tidak ada barang yang cocok dengan filter.</p>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const onHand = Number(item.stokAkhir || 0);
                  const stokEtalase = Number(item.stokEtalase || 0);
                  const stokGudang = Number(item.stokGudang || 0);
                  const isExpanded = expandedRow === item.id;

                  return (
                    <React.Fragment key={item.id}>
                      <tr className={`transition-colors group ${isExpanded ? (isDark ? 'bg-indigo-500/10' : 'bg-indigo-50') : (isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50')}`}>
                        <td className="px-4 py-3 text-center font-mono font-bold text-amber-500">{item.inventoryNo}</td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-sm text-slate-900 dark:text-white">{item.inventoryName}</div>
                          <div className="text-[10px] text-slate-500">{item.barcode} • {item.categoryName}</div>
                        </td>
                        
                        <td className="px-4 py-3 text-right font-mono font-bold text-sm">{stokGudang.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-400">{stokEtalase.toLocaleString()}</td>
                        <td className={`px-4 py-3 text-right font-mono font-black text-sm ${onHand <= 0 ? 'text-rose-500' : onHand <= item.minStock ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {onHand.toLocaleString()}
                        </td>
                        
                        <td className="px-4 py-3 text-center">
                          {onHand <= 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/10 text-rose-500 border border-rose-500/20">KOSONG</span>
                          ) : onHand <= item.minStock ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/10 text-amber-500 border border-amber-500/20">TIPIS</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">TERSEDIA</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => toggleRowExpand(item.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 mx-auto ${
                              isExpanded 
                                ? 'bg-indigo-500 text-white shadow-md' 
                                : isDark ? 'bg-slate-800 hover:bg-slate-700 text-indigo-400' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600'
                            }`}
                          >
                            <History className="w-3.5 h-3.5" />
                            Kartu Stok
                          </button>
                        </td>
                      </tr>

                      {/* 📖 KARTU STOK DRILL-DOWN LEDGER (Phase 2 Requirement) */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="p-0 border-b-2 border-indigo-500/30">
                            <div className={`p-4 ${isDark ? 'bg-slate-950 shadow-inner' : 'bg-slate-100 shadow-inner'}`}>
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-black flex items-center gap-2">
                                  <History className="w-4 h-4 text-indigo-500" />
                                  Buku Besar Kartu Stok - <span className="text-amber-500">{item.inventoryName}</span>
                                </h4>
                                <button className="px-3 py-1 rounded border text-[10px] font-bold border-indigo-500/30 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all">
                                  Lihat Kartu Lengkap
                                </button>
                              </div>

                              <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}>
                                <table className="w-full text-left">
                                  <thead className={`text-[10px] font-bold uppercase ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                                    <tr>
                                      <th className="px-4 py-2">Tanggal</th>
                                      <th className="px-4 py-2">No. Dokumen</th>
                                      <th className="px-4 py-2">Keterangan Transaksi</th>
                                      <th className="px-4 py-2 text-right">Masuk (In)</th>
                                      <th className="px-4 py-2 text-right">Keluar (Out)</th>
                                      <th className="px-4 py-2 text-right">Saldo Akhir</th>
                                    </tr>
                                  </thead>
                                  <tbody className={`divide-y text-xs font-medium ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                                    {isLoadingLedger ? (
                                      <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center animate-pulse text-indigo-500">
                                          Memuat mutasi...
                                        </td>
                                      </tr>
                                    ) : ledgerData.length === 0 ? (
                                      <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500 italic">
                                          Belum ada riwayat mutasi / pergerakan stok untuk barang ini.
                                        </td>
                                      </tr>
                                    ) : (
                                      ledgerData.map((movement, idx) => (
                                        <tr key={movement.id || idx} className={`hover:bg-slate-500/5 transition-colors ${movement.qtyIn > 0 ? (isDark ? 'bg-emerald-500/5' : 'bg-emerald-50') : movement.qtyOut > 0 ? (isDark ? 'bg-rose-500/5' : 'bg-rose-50') : ''}`}>
                                          <td className="px-4 py-2 text-[11px] whitespace-nowrap">
                                            {new Date(movement.date).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                          </td>
                                          <td className="px-4 py-2 font-mono text-indigo-400">{movement.transactionNo}</td>
                                          <td className="px-4 py-2">{movement.type}</td>
                                          <td className="px-4 py-2 text-right font-mono font-bold text-emerald-500">
                                            {movement.qtyIn > 0 ? `+${movement.qtyIn.toLocaleString()}` : '-'}
                                          </td>
                                          <td className="px-4 py-2 text-right font-mono font-bold text-rose-500">
                                            {movement.qtyOut > 0 ? `-${movement.qtyOut.toLocaleString()}` : '-'}
                                          </td>
                                          <td className="px-4 py-2 text-right font-mono font-black">
                                            {movement.balance.toLocaleString()}
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

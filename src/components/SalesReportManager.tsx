'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileSpreadsheet,
  Calendar,
  CreditCard,
  Printer,
  RefreshCw,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Package,
  CheckCircle,
  Sparkles,
  PieChart,
  BarChart3,
  Filter,
} from 'lucide-react';

interface DailyReportRow {
  date: string;
  totalOrders: number;
  totalItems: number;
  grossSales: string;
  totalDiscount: string;
  netSales: string;
  cashSales: string;
  qrisSales: string;
  transferSales: string;
  cardSales: string;
}

interface MonthlyReportRow {
  month: string;
  totalOrders: number;
  totalItems: number;
  grossSales: string;
  totalDiscount: string;
  netSales: string;
  cashSales: string;
  qrisSales: string;
  transferSales: string;
  cardSales: string;
}

interface ItemReportRow {
  barcode: string;
  inventoryName: string;
  totalQtySold: number;
  avgUnitPrice: string;
  totalRevenue: string;
  totalCost: string;
  profit: string;
}

interface SummaryReportData {
  totalOrders: number;
  totalItemsSold: number;
  grossSales: string;
  totalDiscount: string;
  netSales: string;
  cashSales: string;
  qrisSales: string;
  transferSales: string;
  cardSales: string;
  totalCost: number;
  profit: number;
  profitMarginPct: number;
}

interface SalesReportManagerProps {
  isDark: boolean;
}

export default function SalesReportManager({ isDark }: SalesReportManagerProps) {
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'items' | 'summary'>('daily');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('All');
  
  // Report Datasets
  const [dailyData, setDailyData] = useState<DailyReportRow[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyReportRow[]>([]);
  const [itemData, setItemData] = useState<ItemReportRow[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryReportData | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch Report Data
  const loadReportData = useCallback(async () => {
    setIsLoading(true);
    try {
      const pmQuery = paymentMethodFilter !== 'All' ? `&paymentMethod=${paymentMethodFilter}` : '';

      // 1. Fetch Daily Report
      const dailyRes = await fetch(`/api/reports/sales?type=daily${pmQuery}`);
      const dailyJson = await dailyRes.json();
      if (dailyJson.success) setDailyData(dailyJson.data || []);

      // 2. Fetch Monthly Report
      const monthlyRes = await fetch(`/api/reports/sales?type=monthly${pmQuery}`);
      const monthlyJson = await monthlyRes.json();
      if (monthlyJson.success) setMonthlyData(monthlyJson.data || []);

      // 3. Fetch Item Sales Report
      const itemRes = await fetch(`/api/reports/sales?type=items${pmQuery}`);
      const itemJson = await itemRes.json();
      if (itemJson.success) setItemData(itemJson.data || []);

      // 4. Fetch Summary Report
      const summaryRes = await fetch(`/api/reports/sales?type=summary${pmQuery}`);
      const summaryJson = await summaryRes.json();
      if (summaryJson.success) setSummaryData(summaryJson.data || null);
    } catch (err) {
      console.error('Failed to load sales report data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [paymentMethodFilter]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  // Format IDR Currency
  const formatIDR = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return `Rp ${(num || 0).toLocaleString('id-ID')}`;
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* 📊 PAGE HEADER */}
      <div
        className={`p-6 rounded-3xl border shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
          isDark
            ? 'bg-gradient-to-r from-slate-900 via-purple-950/20 to-slate-900 border-slate-800'
            : 'bg-gradient-to-r from-purple-50/70 via-white to-purple-50/40 border-purple-200'
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-purple-500 text-white font-black shadow-lg shadow-purple-500/20">
            <FileSpreadsheet className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Laporan Penjualan ERP
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-400 border border-purple-500/30">
                1:1 Module Manager (Admin.Frm_Report)
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Rekapitulasi Penjualan Harian, Bulanan, Per Barang, dan Profit Analysis
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-black text-xs flex items-center gap-2 shadow-md cursor-pointer transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / Print Report</span>
          </button>

          <button
            onClick={loadReportData}
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 active:scale-98 cursor-pointer transition-all ${
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

      {/* 📈 KPI STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Omset Bersih */}
        <div
          className={`p-4 rounded-2xl border shadow-md flex items-center gap-4 ${
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 font-bold">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total Omset Bersih
            </span>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
              {formatIDR(summaryData?.netSales || 0)}
            </div>
            <span className="text-[10px] text-emerald-500 font-semibold">
              Bruto: {formatIDR(summaryData?.grossSales || 0)}
            </span>
          </div>
        </div>

        {/* Total Transaksi */}
        <div
          className={`p-4 rounded-2xl border shadow-md flex items-center gap-4 ${
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500 font-bold">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total Transaksi
            </span>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
              {summaryData?.totalOrders || 0} Orders
            </div>
            <span className="text-[10px] text-amber-500 font-semibold">
              {summaryData?.totalItemsSold || 0} Total Qty Item Terjual
            </span>
          </div>
        </div>

        {/* Total Profit Margin */}
        <div
          className={`p-4 rounded-2xl border shadow-md flex items-center gap-4 ${
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500 font-bold">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Profit / Margin Keuntungan
            </span>
            <div className="text-lg font-black text-purple-400 mt-0.5">
              {formatIDR(summaryData?.profit || 0)}
            </div>
            <span className="text-[10px] text-purple-400 font-semibold">
              Margin: {summaryData?.profitMarginPct || 0}%
            </span>
          </div>
        </div>

        {/* Payment Breakdown (QRIS & Cash) */}
        <div
          className={`p-4 rounded-2xl border shadow-md flex items-center gap-4 ${
            isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500 font-bold">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Metode Pembayaran Utama
            </span>
            <div className="text-xs font-black text-slate-900 dark:text-white mt-1 space-y-0.5">
              <div>Cash: <strong className="text-emerald-400">{formatIDR(summaryData?.cashSales || 0)}</strong></div>
              <div>QRIS: <strong className="text-blue-400">{formatIDR(summaryData?.qrisSales || 0)}</strong></div>
            </div>
          </div>
        </div>
      </div>

      {/* 🔍 FILTER & TAB NAVIGATION CONTROLS */}
      <div
        className={`p-4 rounded-2xl border shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        {/* 4 Report Tabs (1:1 Admin.Frm_Report) */}
        <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <button
            onClick={() => setActiveTab('daily')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'daily'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Laporan Harian (Rpt_Daily)</span>
          </button>

          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'monthly'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Laporan Bulanan (Rpt_Monthly)</span>
          </button>

          <button
            onClick={() => setActiveTab('items')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'items'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Per Barang (Rpt_InventorySales)</span>
          </button>

          <button
            onClick={() => setActiveTab('summary')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'summary'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Summary & Profit (Rpt_Summary)</span>
          </button>
        </div>

        {/* Payment Filter Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-purple-400" />
            <span>Metode Bayar:</span>
          </label>
          <select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
            className={`p-2 rounded-xl border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer ${
              isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-900 border-slate-300'
            }`}
          >
            <option value="All">Semua Metode Pembayaran</option>
            <option value="Cash">Tunai (Cash)</option>
            <option value="QRIS">QRIS</option>
            <option value="Transfer">Bank Transfer</option>
            <option value="Card">Kartu Debit/Kredit</option>
          </select>
        </div>
      </div>

      {/* 📄 DATA TABLE CONTENT */}
      <div
        className={`rounded-2xl border shadow-lg overflow-hidden transition-all ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        {/* TAB 1: DAILY SALES REPORT */}
        {activeTab === 'daily' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr
                  className={`text-[11px] font-black uppercase tracking-wider border-b ${
                    isDark ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-slate-200 text-slate-900 border-slate-300'
                  }`}
                >
                  <th className="py-3.5 px-4 text-center">Tanggal</th>
                  <th className="py-3.5 px-4 text-center">Total Transaksi</th>
                  <th className="py-3.5 px-4 text-center">Total Qty Item</th>
                  <th className="py-3.5 px-4 text-right">Omset Bruto</th>
                  <th className="py-3.5 px-4 text-right">Diskon</th>
                  <th className="py-3.5 px-4 text-right">Omset Bersih</th>
                  <th className="py-3.5 px-4 text-right">Cash</th>
                  <th className="py-3.5 px-4 text-right">QRIS</th>
                  <th className="py-3.5 px-4 text-right">Transfer / Card</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-xs">
                {dailyData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                      Belum ada data transaksi harian.
                    </td>
                  </tr>
                ) : (
                  dailyData.map((row) => (
                    <tr
                      key={row.date}
                      className={`transition-colors ${
                        isDark ? 'hover:bg-slate-800/50 text-slate-200' : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center font-mono font-black text-purple-400">
                        {row.date}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold">{row.totalOrders} Order</td>
                      <td className="py-3.5 px-4 text-center font-semibold">{row.totalItems} Pcs</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                        {formatIDR(row.grossSales)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-red-400">
                        {formatIDR(row.totalDiscount)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-400">
                        {formatIDR(row.netSales)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                        {formatIDR(row.cashSales)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-blue-400">
                        {formatIDR(row.qrisSales)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-purple-300">
                        {formatIDR(parseFloat(row.transferSales) + parseFloat(row.cardSales))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: MONTHLY SALES REPORT */}
        {activeTab === 'monthly' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr
                  className={`text-[11px] font-black uppercase tracking-wider border-b ${
                    isDark ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-slate-200 text-slate-900 border-slate-300'
                  }`}
                >
                  <th className="py-3.5 px-4 text-center">Periode Bulan</th>
                  <th className="py-3.5 px-4 text-center">Jumlah Transaksi</th>
                  <th className="py-3.5 px-4 text-center">Total Item Terjual</th>
                  <th className="py-3.5 px-4 text-right">Omset Bruto</th>
                  <th className="py-3.5 px-4 text-right">Total Diskon</th>
                  <th className="py-3.5 px-4 text-right">Omset Bersih</th>
                  <th className="py-3.5 px-4 text-right">Perincian Cash & QRIS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-xs">
                {monthlyData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                      Belum ada data transaksi bulanan.
                    </td>
                  </tr>
                ) : (
                  monthlyData.map((row) => (
                    <tr
                      key={row.month}
                      className={`transition-colors ${
                        isDark ? 'hover:bg-slate-800/50 text-slate-200' : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center font-mono font-black text-purple-400">
                        {row.month}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold">{row.totalOrders} Transaksi</td>
                      <td className="py-3.5 px-4 text-center font-semibold">{row.totalItems} Items</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                        {formatIDR(row.grossSales)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-red-400">
                        {formatIDR(row.totalDiscount)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-400">
                        {formatIDR(row.netSales)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs">
                        <span className="text-emerald-400 font-bold">Cash: {formatIDR(row.cashSales)}</span> |{' '}
                        <span className="text-blue-400 font-bold">QRIS: {formatIDR(row.qrisSales)}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: ITEM SALES REPORT */}
        {activeTab === 'items' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr
                  className={`text-[11px] font-black uppercase tracking-wider border-b ${
                    isDark ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-slate-200 text-slate-900 border-slate-300'
                  }`}
                >
                  <th className="py-3.5 px-4">Barcode / Kode</th>
                  <th className="py-3.5 px-4">Nama Barang Persediaan</th>
                  <th className="py-3.5 px-4 text-center">Total Qty Terjual</th>
                  <th className="py-3.5 px-4 text-right">Harga Jual Rata-rata</th>
                  <th className="py-3.5 px-4 text-right">Total Subtotal Revenue</th>
                  <th className="py-3.5 px-4 text-right">Estimasi Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-xs">
                {itemData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                      Belum ada data penjualan per barang.
                    </td>
                  </tr>
                ) : (
                  itemData.map((row, idx) => (
                    <tr
                      key={idx}
                      className={`transition-colors ${
                        isDark ? 'hover:bg-slate-800/50 text-slate-200' : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-semibold text-purple-400">
                        {row.barcode}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        {row.inventoryName}
                      </td>
                      <td className="py-3.5 px-4 text-center font-black text-amber-500">
                        {row.totalQtySold} Pcs
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                        {formatIDR(row.avgUnitPrice)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-400">
                        {formatIDR(row.totalRevenue)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-purple-400">
                        {formatIDR(row.profit)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: SUMMARY & PROFIT REPORT */}
        {activeTab === 'summary' && summaryData && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Gross vs Net Revenue */}
              <div
                className={`p-5 rounded-2xl border ${
                  isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <h3 className="text-xs font-black uppercase tracking-wider text-purple-400 mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Ringkasan Penjualan & Diskon
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-800/40">
                    <span className="text-slate-400">Total Transaksi POS:</span>
                    <strong className="text-slate-200">{summaryData.totalOrders} Order</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800/40">
                    <span className="text-slate-400">Total Qty Item Terjual:</span>
                    <strong className="text-slate-200">{summaryData.totalItemsSold} Pcs</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800/40">
                    <span className="text-slate-400">Total Penjualan Kotor (Gross):</span>
                    <strong className="font-mono text-slate-200">{formatIDR(summaryData.grossSales)}</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800/40">
                    <span className="text-slate-400">Total Potongan / Diskon Promo:</span>
                    <strong className="font-mono text-red-400">-{formatIDR(summaryData.totalDiscount)}</strong>
                  </div>
                  <div className="flex justify-between py-2 text-sm font-black">
                    <span className="text-emerald-400">Total Omset Bersih (Net Revenue):</span>
                    <strong className="font-mono text-emerald-400">{formatIDR(summaryData.netSales)}</strong>
                  </div>
                </div>
              </div>

              {/* Profit & Margin Breakdown */}
              <div
                className={`p-5 rounded-2xl border ${
                  isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Estimasi Margin & Keuntungan
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-800/40">
                    <span className="text-slate-400">Total Omset Bersih:</span>
                    <strong className="font-mono text-emerald-400">{formatIDR(summaryData.netSales)}</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800/40">
                    <span className="text-slate-400">Total Harga Pokok Penjualan (HPP):</span>
                    <strong className="font-mono text-red-400">-{formatIDR(summaryData.totalCost)}</strong>
                  </div>
                  <div className="flex justify-between py-2 text-sm font-black">
                    <span className="text-purple-400">Laba Bersih (Estimasi Net Profit):</span>
                    <strong className="font-mono text-purple-400">{formatIDR(summaryData.profit)}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 flex justify-between items-center text-xs font-bold text-purple-300">
                    <span>Persentase Margin Profit:</span>
                    <span className="text-base font-black">{summaryData.profitMarginPct}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

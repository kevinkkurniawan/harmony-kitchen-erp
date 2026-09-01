'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Search,
  DollarSign,
  Receipt,
  Printer,
  Calendar,
  CreditCard,
  QrCode,
  Building2,
  Clock,
  Eye,
  Trash2,
  CheckCircle,
  XCircle,
  X,
  AlertTriangle,
  Zap,
  TrendingUp,
  User,
} from 'lucide-react';

export interface PosItemDetail {
  id: string;
  inventoryNo: string;
  inventoryName: string;
  uomName: string;
  qty: number;
  price: number;
  subtotal: number;
}

export interface PosHeader {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  cashierName: string;
  customerName: string;
  paymentType: string;
  bankName: string;
  subtotal: number;
  discValue: number;
  taxValue: number;
  grandTotal: number;
  paymentAmount: number;
  changeAmount: number;
  isVoid: boolean;
  description: string;
  itemCount?: number;
  totalQty?: number;
}

export interface SalesSummary {
  grossSales: number;
  totalCount: number;
  avgBasket: number;
  paymentBreakdown: {
    CASH: number;
    QRIS: number;
    TRANSFER: number;
    DEBIT: number;
    TEMPO: number;
  };
}

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

interface SalesMonitoringManagerProps {
  isDark: boolean;
}

export default function SalesMonitoringManager({ isDark }: SalesMonitoringManagerProps) {
  const [transactions, setTransactions] = useState<PosHeader[]>([]);
  const [summary, setSummary] = useState<SalesSummary>({
    grossSales: 0,
    totalCount: 0,
    avgBasket: 0,
    paymentBreakdown: { CASH: 0, QRIS: 0, TRANSFER: 0, DEBIT: 0, TEMPO: 0 },
  });

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [activeDateFilter, setActiveDateFilter] = useState<'all' | 'today' | '7days' | 'month'>('all');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Print Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printData, setPrintData] = useState<{ header: PosHeader; items: PosItemDetail[] } | null>(null);

  const addToast = useCallback((text: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // Load Transactions & KPI Metrics
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      try {
        const url = `/api/sales/monitoring?q=${encodeURIComponent(searchQuery)}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
        const res = await fetch(url);
        const json = await res.json();
        if (isMounted && (json.success || Array.isArray(json.data))) {
          setTransactions(json.data || []);
          if (json.summary) setSummary(json.summary);
        }
      } catch (err) {
        console.error('Error fetching sales monitoring data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [searchQuery, dateFrom, dateTo]);

  const reloadData = async () => {
    setIsLoading(true);
    try {
      const url = `/api/sales/monitoring?q=${encodeURIComponent(searchQuery)}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success || Array.isArray(json.data)) {
        setTransactions(json.data || []);
        if (json.summary) setSummary(json.summary);
      }
    } catch (err) {
      console.error('Error fetching sales monitoring data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Date Filter Handlers
  const handleQuickDateFilter = (filterType: 'all' | 'today' | '7days' | 'month') => {
    setActiveDateFilter(filterType);
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().slice(0, 10);

    if (filterType === 'today') {
      setDateFrom(formatDate(today));
      setDateTo(formatDate(today));
    } else if (filterType === '7days') {
      const past7 = new Date(today.getTime() - 7 * 86400000);
      setDateFrom(formatDate(past7));
      setDateTo(formatDate(today));
    } else if (filterType === 'month') {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateFrom(formatDate(monthStart));
      setDateTo(formatDate(today));
    } else {
      setDateFrom('');
      setDateTo('');
    }
  };

  // View Single POS Invoice Detail
  const handleViewReceipt = async (id: string) => {
    try {
      const res = await fetch(`/api/sales/monitoring/${id}`);
      const json = await res.json();
      if (json.success) {
        setPrintData(json.data);
        setIsPrintModalOpen(true);
      } else {
        addToast(`Gagal memuat detail nota: ${json.error}`, 'error');
      }
    } catch (err) {
      console.error('Error fetching receipt detail:', err);
    }
  };

  // Void Transaction
  const handleVoidTransaction = async (id: string, invoiceNo: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin membatalkan (VOID) nota transaksi ${invoiceNo}?`)) return;

    try {
      const res = await fetch(`/api/sales/monitoring/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        addToast(json.message, 'success');
        reloadData();
      } else {
        addToast(`Gagal void: ${json.error}`, 'error');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(`Error: ${message}`, 'error');
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
          <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h2 className={`text-base font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Sales Monitoring Real-time
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              Pemantauan Omset Penjualan POS Kasir Dapur, Metode Pembayaran & Rincian Struk Nota
            </p>
          </div>
        </div>

        <button
          onClick={reloadData}
          className={`px-3.5 py-2 rounded-xl border text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300'
          }`}
        >
          <RefreshCw className={`w-4 h-4 text-indigo-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Live Sales</span>
        </button>
      </div>

      {/* 📊 KPI SUMMARY METRIC CARDS */}
      <div className={`p-4 border-b grid grid-cols-2 md:grid-cols-4 gap-3.5 shadow-sm ${
        isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">Total Omset Penjualan</div>
            <div className={`text-lg font-black ${isDark ? 'text-emerald-300' : 'text-emerald-950'}`}>
              Rp {(summary?.grossSales ?? 0).toLocaleString('id-ID')}
            </div>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">Total Struk Transaksi</div>
            <div className={`text-lg font-black ${isDark ? 'text-blue-300' : 'text-blue-950'}`}>
              {summary?.totalCount ?? 0} Nota Lunas
            </div>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">Rata-Rata Struk (Basket)</div>
            <div className={`text-lg font-black ${isDark ? 'text-purple-300' : 'text-purple-950'}`}>
              Rp {(summary?.avgBasket ?? 0).toLocaleString('id-ID')}
            </div>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">Paling Dominan</div>
            <div className={`text-sm font-black ${isDark ? 'text-amber-300' : 'text-amber-950'}`}>
              QRIS & CASH POS
            </div>
          </div>
        </div>
      </div>

      {/* 💳 PAYMENT METHOD BREAKDOWN CARDS */}
      <div className={`px-4 py-3 border-b grid grid-cols-2 md:grid-cols-5 gap-3 text-xs ${
        isDark ? 'bg-slate-900/30 border-slate-800' : 'bg-slate-100/70 border-slate-200'
      }`}>
        <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-slate-400">CASH / Tunai:</span>
          </div>
          <span className="font-mono font-black text-emerald-400">
            Rp {(summary.paymentBreakdown?.CASH || 0).toLocaleString('id-ID')}
          </span>
        </div>

        <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-blue-400" />
            <span className="font-bold text-slate-400">QRIS Instant:</span>
          </div>
          <span className="font-mono font-black text-blue-400">
            Rp {(summary.paymentBreakdown?.QRIS || 0).toLocaleString('id-ID')}
          </span>
        </div>

        <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-400" />
            <span className="font-bold text-slate-400">Bank Transfer:</span>
          </div>
          <span className="font-mono font-black text-indigo-400">
            Rp {(summary.paymentBreakdown?.TRANSFER || 0).toLocaleString('id-ID')}
          </span>
        </div>

        <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-purple-400" />
            <span className="font-bold text-slate-400">EDC Debit/Credit:</span>
          </div>
          <span className="font-mono font-black text-purple-400">
            Rp {(summary.paymentBreakdown?.DEBIT || 0).toLocaleString('id-ID')}
          </span>
        </div>

        <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-slate-400">Tempo / Corporate:</span>
          </div>
          <span className="font-mono font-black text-amber-400">
            Rp {(summary.paymentBreakdown?.TEMPO || 0).toLocaleString('id-ID')}
          </span>
        </div>
      </div>

      {/* 🔍 FILTER & SEARCH BAR */}
      <div className={`p-3 border-b flex flex-wrap items-center justify-between gap-3 shadow-sm ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center gap-3 flex-1 flex-wrap min-w-[300px]">
          {/* Live Search Input */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari No Struk / Kasir / Customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full border rounded-xl pl-10 pr-4 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

          {/* Date From & Date To */}
          <div className="flex items-center gap-2 text-xs font-bold">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setActiveDateFilter('all');
              }}
              className={`p-1.5 rounded-xl border text-xs font-bold focus:outline-none ${
                isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setActiveDateFilter('all');
              }}
              className={`p-1.5 rounded-xl border text-xs font-bold focus:outline-none ${
                isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>
        </div>

        {/* Quick Date Range Buttons */}
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <button
            onClick={() => handleQuickDateFilter('all')}
            className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
              activeDateFilter === 'all'
                ? 'bg-indigo-500 text-white border-indigo-600'
                : isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-900'
            }`}
          >
            Semua Tanggal
          </button>
          <button
            onClick={() => handleQuickDateFilter('today')}
            className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
              activeDateFilter === 'today'
                ? 'bg-indigo-500 text-white border-indigo-600'
                : isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-900'
            }`}
          >
            Hari Ini
          </button>
          <button
            onClick={() => handleQuickDateFilter('7days')}
            className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
              activeDateFilter === '7days'
                ? 'bg-indigo-500 text-white border-indigo-600'
                : isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-900'
            }`}
          >
            7 Hari Terakhir
          </button>
          <button
            onClick={() => handleQuickDateFilter('month')}
            className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
              activeDateFilter === 'month'
                ? 'bg-indigo-500 text-white border-indigo-600'
                : isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-900'
            }`}
          >
            Bulan Ini
          </button>
        </div>
      </div>

      {/* 📄 MAIN TRANSACTION TABLE WORKBENCH */}
      <div className="flex-1 min-h-0 p-4 flex flex-col">
        <div className={`flex-1 min-h-0 overflow-auto rounded-2xl border-2 shadow-lg relative ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <table className="w-full text-left border-separate border-spacing-0 text-xs">
            <thead className="sticky top-0 z-20">
              <tr className={`font-black uppercase tracking-wider text-[11px] border-b-2 ${
                isDark ? 'bg-slate-800 text-slate-100 border-slate-700' : 'bg-slate-200 text-slate-900 border-slate-300'
              }`}>
                <th className="py-3.5 px-4 text-center">No. Struk</th>
                <th className="py-3.5 px-4">Tanggal & Jam</th>
                <th className="py-3.5 px-4">Kasir / Officer</th>
                <th className="py-3.5 px-4">Customer / Meja</th>
                <th className="py-3.5 px-4">Tipe Pembayaran</th>
                <th className="py-3.5 px-4 text-right">Subtotal</th>
                <th className="py-3.5 px-4 text-right">Diskon Promo</th>
                <th className="py-3.5 px-4 text-right">Grand Total (Rp)</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center w-28">Aksi</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-400 font-bold">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    Memuat daftar transaksi sales monitoring POS...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-400 font-bold">
                    Belum ada data transaksi penjualan POS untuk filter yang dipilih.
                  </td>
                </tr>
              ) : (
                transactions.map((row: any) => {
                  const invoice = row.invoiceNo || row.salesPOSNo || row.sales_pos_no || '-';
                  const txDate = row.invoiceDate || row.transactionDate || row.salesPOSDate || row.sales_pos_date || '-';
                  const cashier = row.cashierName || row.cashier_name || 'Kasir Utama';
                  const customer = row.customerName || row.customer_name || 'Pelanggan Umum';
                  const payType = row.paymentType || row.paymentMethod || 'CASH';
                  const subtotal = row.subtotal ?? row.totalAmount ?? row.total_amount ?? 0;
                  const disc = row.discValue ?? row.discount ?? row.discountAmount ?? row.discount_amount ?? 0;
                  const grandTotal = row.grandTotal ?? row.grand_total ?? 0;

                  return (
                    <tr key={row.id} className={isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}>
                      <td className="py-3.5 px-4 text-center font-mono font-black text-indigo-400">{invoice}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">{txDate}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{cashier}</span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-300">{customer}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                          payType === 'CASH'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : payType === 'QRIS'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {payType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-300">Rp {Number(subtotal).toLocaleString('id-ID')}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-rose-400">
                        {disc > 0 ? `- Rp ${Number(disc).toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-400">
                        Rp {Number(grandTotal).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          LUNAS
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleViewReceipt(row.id)}
                            className="p-1.5 rounded-lg hover:bg-indigo-500/20 text-indigo-400 cursor-pointer"
                            title="Lihat & Cetak Struk"
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

      {/* 🖨️ PRINTABLE POS RECEIPT STRUK MODAL */}
      {isPrintModalOpen && printData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white text-slate-900 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Action Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-300 print:hidden">
              <div className="font-black text-slate-800 text-xs flex items-center gap-2">
                <Printer className="w-4 h-4 text-indigo-500" />
                <span>Struk Thermal POS Penjualan</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  <span>Cetak Struk</span>
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Thermal Printable Content */}
            <div className="pt-6 space-y-4 text-xs font-mono">
              <div className="text-center space-y-1">
                <h2 className="text-base font-black tracking-tight text-slate-900 uppercase">HARMONY KITCHEN & RESTO</h2>
                <p className="text-[10px] text-slate-600">Jl. Raya Dapur No. 88, Surabaya</p>
                <p className="text-[10px] text-slate-600">Telp: (031) 8899-7766</p>
                <div className="border-b border-dashed border-slate-400 my-2" />
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">No. Struk:</span>
                  <span className="font-black">{printData.header.invoiceNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tanggal:</span>
                  <span>{printData.header.invoiceDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Kasir:</span>
                  <span>{printData.header.cashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pelanggan/Meja:</span>
                  <span className="font-bold">{printData.header.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pembayaran:</span>
                  <span className="font-bold">{printData.header.paymentType} ({printData.header.bankName || '-'})</span>
                </div>
              </div>

              <div className="border-b border-dashed border-slate-400 my-2" />

              {/* Itemized Detail Table */}
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className="py-1">Item</th>
                    <th className="py-1 text-center">Qty</th>
                    <th className="py-1 text-right">Harga</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {printData.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-1.5 font-bold">{it.inventoryName}</td>
                      <td className="py-1.5 text-center font-bold">{it.qty}</td>
                      <td className="py-1.5 text-right">{it.price.toLocaleString('id-ID')}</td>
                      <td className="py-1.5 text-right font-black">{it.subtotal.toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-b border-dashed border-slate-400 my-2" />

              {/* Financial Calculation */}
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>Rp {printData.header.subtotal.toLocaleString('id-ID')}</span>
                </div>
                {printData.header.discValue > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Diskon Promo:</span>
                    <span>- Rp {printData.header.discValue.toLocaleString('id-ID')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Pajak (PB1 10%):</span>
                  <span>+ Rp {printData.header.taxValue.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-black text-sm pt-2 border-t border-slate-400 text-slate-900">
                  <span>GRAND TOTAL:</span>
                  <span className="text-emerald-600">Rp {printData.header.grandTotal.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span>Bayar:</span>
                  <span>Rp {printData.header.paymentAmount.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Kembali:</span>
                  <span>Rp {printData.header.changeAmount.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div className="border-b border-dashed border-slate-400 my-4" />

              <div className="text-center space-y-1 text-[10px] text-slate-600 font-sans">
                <p className="font-bold">Terima Kasih Atas Kunjungan Anda!</p>
                <p>Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.</p>
                <p className="pt-2 font-mono">www.harmonykitchen.id</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

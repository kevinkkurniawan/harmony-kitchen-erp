'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { getTodayBangkok } from '@/lib/date-utils';
import {
  RefreshCw,
  Search,
  Printer,
  CreditCard,
  Eye,
  CheckCircle,
  XCircle,
  X,
  AlertTriangle,
  Zap,
  ChevronUp,
  ChevronDown,
  Edit3,
  RotateCcw,
  Ban,
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

/** One row of the legacy Bill Opname grid, as returned by GET /api/sales/monitoring. */
export interface MonitoringRow {
  id: number;
  invoiceNo: string;
  paymentType: string;
  bankName: string;
  transactionValue: number;
  finalDiscount: number;
  paymentValue: number;
  changeValue: number;
  remarks: string;
  tunai: number;
  debit: number;
  qris: number;
  creditCard: number;
  other: number;
  cashierName: string;
  isVoid: boolean;
  isUnpaid: boolean;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

interface SalesMonitoringManagerProps {
  canViewPrice?: boolean;
  isDark: boolean;
}

type Column = { key: keyof MonitoringRow; label: string; numeric?: boolean; total?: boolean };

// Same columns and order as the legacy Bill Opname grid; numeric ones with a footer total get summed.
// "Lain-lain" is not in the old grid: transfer / marketplace payments need a column or the totals don't add up.
const COLUMNS: Column[] = [
  { key: 'invoiceNo', label: 'No. Nota' },
  { key: 'paymentType', label: 'Jenis Bayar' },
  { key: 'bankName', label: 'Bank' },
  { key: 'transactionValue', label: 'Nom. Transaksi', numeric: true, total: true },
  { key: 'finalDiscount', label: 'Diskon Akhir', numeric: true, total: true },
  { key: 'paymentValue', label: 'Nom. Bayar', numeric: true },
  { key: 'changeValue', label: 'Kembalian', numeric: true },
  { key: 'remarks', label: 'Keterangan' },
  { key: 'tunai', label: 'Tunai', numeric: true, total: true },
  { key: 'debit', label: 'Debit', numeric: true, total: true },
  { key: 'qris', label: 'Qris', numeric: true, total: true },
  { key: 'creditCard', label: 'CC', numeric: true, total: true },
  { key: 'other', label: 'Lain-lain', numeric: true, total: true },
  { key: 'cashierName', label: 'User' },
];

const fmt = (n: number) => Number(n || 0).toLocaleString('id-ID');

export default function SalesMonitoringManager({ isDark }: SalesMonitoringManagerProps) {
  const [sortField, setSortField] = useState<keyof MonitoringRow | ''>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [transactions, setTransactions] = useState<MonitoringRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // Legacy Bill Opname shows one day at a time, opening on today
  const [selectedDate, setSelectedDate] = useState<string>(getTodayBangkok());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Print Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [receiptLoadingId, setReceiptLoadingId] = useState<number | null>(null);
  // Right-click menu like the legacy Bill Opname grid: Reprint / Void / Unvoid
  const [rowMenu, setRowMenu] = useState<{ x: number; y: number; row: MonitoringRow } | null>(null);
  const [printData, setPrintData] = useState<{ header: PosHeader; items: PosItemDetail[] } | null>(null);

  // Payment Correction Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedTxForPayment, setSelectedTxForPayment] = useState<any>(null);
  const [newPaymentType, setNewPaymentType] = useState('CASH');
  const [paymentCorrectionReason, setPaymentCorrectionReason] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Void / Unvoid Modal
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [voidActionType, setVoidActionType] = useState<'VOID' | 'UNVOID'>('VOID');
  const [selectedTxForVoid, setSelectedTxForVoid] = useState<any>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isSubmittingVoid, setIsSubmittingVoid] = useState(false);

  const handleSort = (field: keyof MonitoringRow) => {
    if (sortField !== field) {
      setSortField(field);
      setSortOrder('asc');
    } else if (sortOrder === 'asc') {
      setSortOrder('desc');
    } else {
      setSortField('');
      setSortOrder('asc');
    }
  };

  const addToast = useCallback((text: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // Load every sale of the selected day (all=true: the footer totals must cover the whole day)
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      try {
        const url = `/api/sales/monitoring?all=true&q=${encodeURIComponent(debouncedSearchQuery)}&dateFrom=${selectedDate}&dateTo=${selectedDate}`;
        const res = await fetch(url);
        const json = await res.json();
        if (isMounted && Array.isArray(json.data)) {
          setTransactions(json.data);
          setTotalCount(json.pagination?.total ?? json.data.length);
        }
      } catch (err) {
        console.error('Error fetching sales monitoring data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [debouncedSearchQuery, selectedDate, reloadKey]);

  const reloadData = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    if (!rowMenu) return;
    const close = () => setRowMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [rowMenu]);

  const sortedRows = useMemo(() => {
    if (!sortField) return transactions;
    return [...transactions].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [transactions, sortField, sortOrder]);

  // Footer totals, like the legacy grid footer; void and unpaid notes are not money received
  const totals = useMemo(() => {
    const sums: Partial<Record<keyof MonitoringRow, number>> = {};
    for (const row of transactions) {
      if (row.isVoid || row.isUnpaid) continue;
      for (const col of COLUMNS) {
        if (col.total) sums[col.key] = (sums[col.key] || 0) + Number(row[col.key] || 0);
      }
    }
    return sums;
  }, [transactions]);

  // View Single POS Invoice Detail
  // The receipt is fetched on demand; receiptLoadingId shows feedback and blocks repeat clicks meanwhile
  const handleViewReceipt = async (id: number) => {
    if (receiptLoadingId !== null) return;
    setReceiptLoadingId(id);
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
      addToast('Gagal memuat detail nota', 'error');
    } finally {
      setReceiptLoadingId(null);
    }
  };

  // Payment Correction Handlers
  const handleOpenPaymentCorrection = (tx: any) => {
    setSelectedTxForPayment(tx);
    setNewPaymentType(tx.paymentType || 'CASH');
    setPaymentCorrectionReason('');
    setIsPaymentModalOpen(true);
  };

  const handleSubmitPaymentCorrection = async () => {
    if (!selectedTxForPayment) return;
    if (!paymentCorrectionReason.trim()) {
      addToast('Alasan koreksi metode pembayaran wajib diisi!', 'warning');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const res = await fetch(`/api/sales/monitoring/${selectedTxForPayment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CORRECT_PAYMENT',
          paymentType: newPaymentType,
          reason: paymentCorrectionReason.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        addToast(json.data?.message || 'Metode pembayaran berhasil diubah.', 'success');
        setIsPaymentModalOpen(false);
        reloadData();
      } else {
        addToast(`Gagal mengubah metode pembayaran: ${json.error}`, 'error');
      }
    } catch (err: any) {
      addToast(`Error: ${err.message || err}`, 'error');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Void / Unvoid Handlers
  const handleOpenVoidModal = (tx: any, action: 'VOID' | 'UNVOID') => {
    setSelectedTxForVoid(tx);
    setVoidActionType(action);
    setVoidReason('');
    setIsVoidModalOpen(true);
  };

  const handleSubmitVoidAction = async () => {
    if (!selectedTxForVoid) return;
    if (!voidReason.trim()) {
      addToast(`Alasan ${voidActionType === 'VOID' ? 'pembatalan (void)' : 'pengaktifan (unvoid)'} wajib diisi!`, 'warning');
      return;
    }

    setIsSubmittingVoid(true);
    try {
      const res = await fetch(`/api/sales/monitoring/${selectedTxForVoid.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: voidActionType,
          reason: voidReason.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        addToast(json.data?.message || `Transaksi berhasil di-${voidActionType}.`, 'success');
        setIsVoidModalOpen(false);
        reloadData();
      } else {
        addToast(`Gagal memproses ${voidActionType}: ${json.error}`, 'error');
      }
    } catch (err: any) {
      addToast(`Error: ${err.message || err}`, 'error');
    } finally {
      setIsSubmittingVoid(false);
    }
  };

  // Print with Audit Trail Marker
  const handlePrintReceipt = async () => {
    if (printData?.header?.id) {
      try {
        await fetch(`/api/sales/monitoring/${printData.header.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'REPRINT', reason: 'Cetak ulang struk nota kasir' }),
        });
      } catch (err) {
        console.error('Error logging reprint:', err);
      }
    }
    window.print();
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

      {/* TOOLBAR: Hari Ini | Tanggal | Refresh, as in the legacy Bill Opname form */}
      <div className={`px-4 py-3 border-b flex flex-wrap items-center gap-3 ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-300'
      }`}>
        <button
          onClick={() => setSelectedDate(getTodayBangkok())}
          className={`px-3.5 py-1.5 rounded-xl border text-xs font-black cursor-pointer ${
            isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300'
          }`}
        >
          Hari Ini
        </button>
        <label className={`flex items-center gap-2 text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
          <span>Tanggal :</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className={`p-1.5 rounded-xl border text-xs font-bold focus:outline-none ${
              isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
            }`}
          />
        </label>
        <button
          onClick={reloadData}
          className={`px-3.5 py-1.5 rounded-xl border text-xs font-black flex items-center gap-2 cursor-pointer ${
            isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300'
          }`}
        >
          <RefreshCw className={`w-4 h-4 text-indigo-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
          <input
            type="text"
            placeholder="Cari No. Nota / User..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full border rounded-xl pl-9 pr-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900'
            }`}
          />
        </div>
      </div>

      {totalCount > transactions.length && (
        <div className="px-4 py-1.5 text-[11px] font-bold bg-amber-500/15 text-amber-600">
          Menampilkan {transactions.length} dari {totalCount} nota; total di bawah hanya untuk nota yang tampil.
        </div>
      )}

      {/* GRID: legacy Bill Opname columns, footer totals in place of summary cards */}
      <div className="flex-1 min-h-0 p-4 flex flex-col">
        <div className={`flex-1 min-h-0 overflow-auto rounded-xl border ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
        }`}>
          <table className="w-full text-left border-separate border-spacing-0 text-xs">
            <thead className="sticky top-0 z-20">
              <tr className={`h-9 whitespace-nowrap text-[11px] font-black ${isDark ? 'bg-slate-800 text-slate-100' : 'bg-slate-200 text-slate-900'}`}>
                <th className="py-1.5 px-2 text-center w-10" title="Void">.::.</th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="py-1.5 px-2 cursor-pointer hover:text-amber-500"
                  >
                    <div className={`flex items-center gap-1 ${col.numeric ? 'justify-end' : ''}`}>
                      <span>{col.label}</span>
                      {sortField === col.key && (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-500" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-500" />)}
                    </div>
                  </th>
                ))}
                <th className="py-1.5 px-2 text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={COLUMNS.length + 2} className={`py-16 text-center font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Memuat data...
                  </td>
                </tr>
              ) : sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 2} className={`py-16 text-center font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Tidak ada nota pada tanggal ini.
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    onDoubleClick={() => handleViewReceipt(row.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      // Keep the menu on screen near the right / bottom edge
                      setRowMenu({ x: Math.min(e.clientX, window.innerWidth - 180), y: Math.min(e.clientY, window.innerHeight - 120), row });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleViewReceipt(row.id);
                      }
                    }}
                    className={`whitespace-nowrap cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                      row.isVoid
                        ? isDark ? 'bg-rose-950/30 text-slate-500 line-through' : 'bg-rose-50 text-slate-400 line-through'
                        : isDark ? 'even:bg-slate-800/40 hover:bg-slate-700 text-slate-100' : 'even:bg-slate-50 hover:bg-slate-100 text-slate-800'
                    }`}
                    title="Double-click atau tekan Enter untuk melihat detail nota"
                  >
                    <td className={`py-1.5 px-2 text-center border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                      <input type="checkbox" checked={row.isVoid} readOnly tabIndex={-1} aria-label={row.isVoid ? 'VOID' : 'Tidak void'} className="pointer-events-none" />
                    </td>
                    {COLUMNS.map((col) => (
                      <td
                        key={col.key}
                        className={`py-1.5 px-2 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'} ${col.numeric ? 'text-right font-mono' : ''} ${col.key === 'invoiceNo' ? 'font-mono font-bold' : ''}`}
                      >
                        {col.numeric ? fmt(Number(row[col.key])) : String(row[col.key] ?? '')}
                      </td>
                    ))}
                    <td className={`py-1 px-2 text-center border-b no-underline ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewReceipt(row.id);
                          }}
                          className="p-1 rounded-lg hover:bg-indigo-500/20 text-indigo-400 cursor-pointer"
                          title="Lihat & Cetak Struk"
                        >
                          {receiptLoadingId === row.id
                            ? <RefreshCw className="w-4 h-4 animate-spin" />
                            : <Eye className="w-4 h-4" />}
                        </button>
                        {/* An unpaid sale has no payment to correct */}
                        {!row.isUnpaid && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPaymentCorrection(row);
                            }}
                            className="p-1 rounded-lg hover:bg-amber-500/20 text-amber-500 cursor-pointer"
                            title="Ubah Metode Pembayaran"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        {row.isVoid ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenVoidModal(row, 'UNVOID');
                            }}
                            className="p-1 rounded-lg hover:bg-emerald-500/20 text-emerald-500 cursor-pointer"
                            title="Pulihkan Transaksi (UNVOID)"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenVoidModal(row, 'VOID');
                            }}
                            className="p-1 rounded-lg hover:bg-rose-500/20 text-rose-500 cursor-pointer"
                            title="Batalkan Transaksi (VOID)"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="sticky bottom-0 z-10">
              <tr className={`h-9 whitespace-nowrap font-black ${isDark ? 'bg-slate-800 text-slate-100' : 'bg-slate-200 text-slate-900'}`}>
                <td className="py-1.5 px-2" />
                {COLUMNS.map((col) => (
                  <td key={col.key} className={`py-1.5 px-2 ${col.numeric ? 'text-right font-mono' : ''}`}>
                    {col.total ? fmt(totals[col.key] || 0) : ''}
                  </td>
                ))}
                <td className="py-1.5 px-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {rowMenu && (
        <div
          style={{ top: rowMenu.y, left: rowMenu.x }}
          onClick={(e) => e.stopPropagation()}
          className={`fixed z-50 w-44 rounded-xl border shadow-2xl py-1 text-xs font-bold ${
            isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
          }`}
        >
          <button
            onClick={() => { const r = rowMenu.row; setRowMenu(null); handleViewReceipt(r.id); }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-indigo-500 hover:text-white cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /><span>Reprint</span>
          </button>
          <button
            onClick={() => {
              const r = rowMenu.row; setRowMenu(null);
              if (r.isVoid) addToast('Transaksi Sudah dalam kondisi Void atau batal', 'info');
              else handleOpenVoidModal(r, 'VOID');
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-rose-500 hover:text-white cursor-pointer"
          >
            <Ban className="w-3.5 h-3.5" /><span>Void</span>
          </button>
          <button
            onClick={() => {
              const r = rowMenu.row; setRowMenu(null);
              if (!r.isVoid) addToast('Transaksi Sudah dalam kondisi Unvoid atau Aktif', 'info');
              else handleOpenVoidModal(r, 'UNVOID');
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-emerald-500 hover:text-white cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /><span>Unvoid</span>
          </button>
        </div>
      )}

      {/* Feedback while a receipt loads */}
      {receiptLoadingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 pointer-events-none">
          <div className={`px-4 py-3 rounded-xl shadow-xl border text-xs font-bold flex items-center gap-2 ${
            isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
          }`}>
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
            <span>Memuat struk...</span>
          </div>
        </div>
      )}

      {/* 🖨️ PRINTABLE POS RECEIPT STRUK MODAL */}
      {isPrintModalOpen && printData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md ${isDark ? "bg-slate-900 text-slate-100 border-2 border-slate-700" : "bg-white text-slate-900"} rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto`}>
            {/* Modal Action Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-300 print:hidden">
              <div className="font-black text-slate-800 text-xs flex items-center gap-2">
                <Printer className="w-4 h-4 text-indigo-500" />
                <span>Struk Thermal POS Penjualan</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintReceipt}
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
            <div className="printable-pos-receipt pt-6 space-y-4 text-xs font-mono">
              <style>{`
                @media print {
                  body {
                    background: white !important;
                    color: black !important;
                  }
                  body * {
                    visibility: hidden !important;
                  }
                  .printable-pos-receipt, .printable-pos-receipt * {
                    visibility: visible !important;
                    color: black !important;
                  }
                  .printable-pos-receipt {
                    position: absolute !important;
                    left: 50% !important;
                    top: 0 !important;
                    transform: translateX(-50%) !important;
                    width: 80mm !important;
                    padding: 10px !important;
                    background: white !important;
                    box-shadow: none !important;
                    border: none !important;
                  }
                  .no-print, .print\\:hidden, button {
                    display: none !important;
                  }
                }
              `}</style>
              <div className="text-center space-y-1">
                <h2 className="text-base font-black tracking-tight text-slate-900 uppercase">HARMONY KITCHEN & RESTO</h2>
                <p className="text-[10px] text-slate-600">Jl. Raya Dapur No. 88, Surabaya</p>
                <p className="text-[10px] text-slate-600">Telp: (031) 8899-7766</p>
                {printData.header.isVoid && (
                  <div className="my-1 py-1 px-2 border-2 border-rose-600 text-rose-600 font-black text-center text-xs tracking-widest uppercase">
                    *** TRANSAKSI DIBATALKAN (VOID) ***
                  </div>
                )}
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
                  <span>Rp {(printData.header.subtotal || 0).toLocaleString('id-ID')}</span>
                </div>
                {(printData.header.discValue || 0) > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Diskon Promo:</span>
                    <span>- Rp {(printData.header.discValue || 0).toLocaleString('id-ID')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Pajak (PB1 10%):</span>
                  <span>+ Rp {(printData.header.taxValue || 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-black text-sm pt-2 border-t border-slate-400 text-slate-900">
                  <span>GRAND TOTAL:</span>
                  <span className="text-emerald-600">Rp {(printData.header.grandTotal || 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span>Bayar:</span>
                  <span>Rp {(printData.header.paymentAmount || 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Kembali:</span>
                  <span>Rp {(printData.header.changeAmount || 0).toLocaleString('id-ID')}</span>
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

      {/* 💳 MODAL KOREKSI TIPE PEMBAYARAN */}
      {isPaymentModalOpen && selectedTxForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md ${isDark ? "bg-slate-900 text-slate-100 border border-slate-700" : "bg-white text-slate-900"} rounded-3xl p-6 shadow-2xl space-y-4`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-500" />
                <h3 className="font-black text-sm">Koreksi Metode Pembayaran</h3>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 flex justify-between items-center font-bold">
                <span className="text-slate-500">No. Transaksi:</span>
                <span className="font-mono text-indigo-400 font-black">{selectedTxForPayment.invoiceNo}</span>
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slate-600 dark:text-slate-400">Pilih Metode Pembayaran Baru *</label>
                <select
                  value={newPaymentType}
                  onChange={(e) => setNewPaymentType(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border font-black focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="CASH">CASH / Tunai</option>
                  <option value="QRIS">QRIS Instant</option>
                  <option value="TRANSFER">Bank Transfer</option>
                  <option value="DEBIT">EDC Debit / Credit</option>
                  <option value="CREDIT CARD">Credit Card</option>
                  <option value="TEMPO">Tempo / Corporate Account</option>
                </select>
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slate-600 dark:text-slate-400">Alasan Koreksi (Wajib untuk Audit Trail) *</label>
                <textarea
                  rows={3}
                  value={paymentCorrectionReason}
                  onChange={(e) => setPaymentCorrectionReason(e.target.value)}
                  placeholder="Contoh: Salah pilih tombol bayar, customer bayar via QRIS BCA..."
                  className={`w-full p-2.5 rounded-xl border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSubmitPaymentCorrection}
                disabled={isSubmittingPayment}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-black transition-all shadow-lg shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingPayment ? 'Menyimpan...' : 'Simpan Koreksi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🚫 MODAL VOID / UNVOID TRANSAKSI */}
      {isVoidModalOpen && selectedTxForVoid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md ${isDark ? "bg-slate-900 text-slate-100 border border-slate-700" : "bg-white text-slate-900"} rounded-3xl p-6 shadow-2xl space-y-4`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                {voidActionType === 'VOID' ? (
                  <Ban className="w-5 h-5 text-rose-500" />
                ) : (
                  <RotateCcw className="w-5 h-5 text-emerald-500" />
                )}
                <h3 className="font-black text-sm">
                  {voidActionType === 'VOID' ? 'Batalkan Transaksi (VOID)' : 'Pulihkan Transaksi (UNVOID)'}
                </h3>
              </div>
              <button
                onClick={() => setIsVoidModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className={`p-3 rounded-xl border flex items-center gap-3 ${
                voidActionType === 'VOID'
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}>
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p className="font-medium text-[11px]">
                  {voidActionType === 'VOID'
                    ? 'Transaksi akan dibatalkan, omset dikurangi, dan stok barang akan otomatis dikembalikan ke gudang/dapur.'
                    : 'Transaksi akan dipulihkan kembali ke status selesai, dan stok barang akan otomatis dipotong kembali.'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 flex justify-between items-center font-bold">
                <span className="text-slate-500">No. Nota:</span>
                <span className="font-mono text-indigo-400 font-black">{selectedTxForVoid.invoiceNo}</span>
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slate-600 dark:text-slate-400">
                  Alasan {voidActionType === 'VOID' ? 'Pembatalan (VOID)' : 'Pemulihan (UNVOID)'} *
                </label>
                <textarea
                  rows={3}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder={voidActionType === 'VOID' ? 'Contoh: Pelanggan salah pesan, transaksi duplikat input...' : 'Contoh: Pembatalan salah klik, customer jadi bayar...'}
                  className={`w-full p-2.5 rounded-xl border text-xs font-medium focus:outline-none focus:ring-2 ${
                    voidActionType === 'VOID' ? 'focus:ring-rose-500' : 'focus:ring-emerald-500'
                  } ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900'}`}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setIsVoidModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSubmitVoidAction}
                disabled={isSubmittingVoid}
                className={`px-5 py-2 rounded-xl text-white text-xs font-black transition-all shadow-lg active:scale-95 cursor-pointer disabled:opacity-50 ${
                  voidActionType === 'VOID'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                }`}
              >
                {isSubmittingVoid ? 'Memproses...' : voidActionType === 'VOID' ? 'Konfirmasi VOID' : 'Konfirmasi UNVOID'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

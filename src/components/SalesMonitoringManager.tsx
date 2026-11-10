'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { getTodayBangkok } from '@/lib/date-utils';
import { LegacyWindow, LegacyButton, LegacyGrid, LegacyInput, FieldRow, ContextMenu, menuAt, type LegacyColumn, type ContextMenuState } from '@/components/legacy';
import { BillOpnameReport } from '@/components/SalesReportManager';
import {
  RefreshCw,
  Printer,
  CreditCard,
  Eye,
  CheckCircle,
  XCircle,
  X,
  AlertTriangle,
  Zap,
  Edit3,
  RotateCcw,
  Ban,
  FileText,
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
  salesposdate?: string;
  createdAt?: string;
}

// Receipt date / time like the POS receipt: the sale day, and the time it was created
const receiptDate = (h: PosHeader) =>
  new Date(h.salesposdate || h.createdAt || Date.now()).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' });
const receiptTime = (h: PosHeader) =>
  h.createdAt ? new Date(h.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) : '';

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
  // Admin Bill Opname report buttons (old Rpt_Monthly): month or day of the selected date
  const [billReport, setBillReport] = useState<'monthly' | 'daily' | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Print Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [receiptLoadingId, setReceiptLoadingId] = useState<number | null>(null);
  // Right-click menu like the legacy Bill Opname grid: Reprint / Void / Unvoid
  const [rowMenu, setRowMenu] = useState<ContextMenuState<MonitoringRow> | null>(null);
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
        if (!isMounted) return;
        if (Array.isArray(json.data)) {
          setTransactions(json.data);
          setTotalCount(json.pagination?.total ?? json.data.length);
        } else {
          // Never leave another day's notes under the new date
          setTransactions([]);
          setTotalCount(0);
          addToast(`Gagal memuat data penjualan: ${json.error?.message || json.error || res.status}`, 'error');
        }
      } catch (err) {
        console.error('Error fetching sales monitoring data:', err);
        if (isMounted) {
          setTransactions([]);
          setTotalCount(0);
          addToast('Gagal memuat data penjualan', 'error');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [debouncedSearchQuery, selectedDate, reloadKey, addToast]);

  const reloadData = () => setReloadKey((k) => k + 1);

  const closeRowMenu = useCallback(() => setRowMenu(null), []);

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

  // Grid columns of the legacy Bill Opname form; actions column replaces its Void / Unvoid / Reprint menu buttons
  const gridColumns: LegacyColumn<MonitoringRow>[] = [
    {
      key: 'isVoid', caption: '.::.', align: 'center', width: 36,
      render: (row) => <input type="checkbox" checked={row.isVoid} readOnly tabIndex={-1} aria-label={row.isVoid ? 'VOID' : 'Tidak void'} className="pointer-events-none" />,
    },
    ...COLUMNS.map((col): LegacyColumn<MonitoringRow> => ({
      key: col.key,
      caption: col.label,
      format: col.numeric ? 'n0' : 'text',
      sortKey: col.key,
      footer: col.total ? fmt(totals[col.key] || 0) : undefined,
    })),
    {
      key: 'actions', caption: 'Aksi', align: 'center',
      render: (row) => (
        <div className="flex items-center justify-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); handleViewReceipt(row.id); }} className="p-0.5 rounded hover:bg-blue-500/20 text-blue-600 cursor-pointer" title="Lihat & Cetak Struk">
            {receiptLoadingId === row.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          </button>
          {/* An unpaid sale has no payment to correct */}
          {!row.isUnpaid && (
            <button onClick={(e) => { e.stopPropagation(); handleOpenPaymentCorrection(row); }} className="p-0.5 rounded hover:bg-amber-500/20 text-amber-600 cursor-pointer" title="Ubah Metode Pembayaran">
              <Edit3 className="w-4 h-4" />
            </button>
          )}
          {row.isVoid ? (
            <button onClick={(e) => { e.stopPropagation(); handleOpenVoidModal(row, 'UNVOID'); }} className="p-0.5 rounded hover:bg-emerald-500/20 text-emerald-600 cursor-pointer" title="Pulihkan Transaksi (UNVOID)">
              <RotateCcw className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); handleOpenVoidModal(row, 'VOID'); }} className="p-0.5 rounded hover:bg-rose-500/20 text-rose-600 cursor-pointer" title="Batalkan Transaksi (VOID)">
              <Ban className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <LegacyWindow
      title="Bill Opname"
      isDark={isDark}
      toolbar={
        <>
          <LegacyButton isDark={isDark} onClick={() => setSelectedDate(getTodayBangkok())}>Hari Ini</LegacyButton>
          <div className="w-56">
            <FieldRow label="Tanggal :" isDark={isDark} labelWidth="w-auto">
              <LegacyInput isDark={isDark} type="date" value={selectedDate} onChange={(e) => e.target.value && setSelectedDate(e.target.value)} />
            </FieldRow>
          </div>
          <LegacyButton isDark={isDark} onClick={reloadData} icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}>Refresh</LegacyButton>
          {/* Old Admin Bill Opname: an empty gap after Refresh, then the two report buttons */}
          <LegacyButton isDark={isDark} className="ml-6" onClick={() => setBillReport('monthly')} icon={<FileText className="w-3.5 h-3.5" />}>Laporan Bulanan</LegacyButton>
          <LegacyButton isDark={isDark} onClick={() => setBillReport('daily')} icon={<FileText className="w-3.5 h-3.5" />}>Laporan Harian</LegacyButton>
          <div className="ml-auto w-64">
            <LegacyInput isDark={isDark} placeholder="Cari No. Nota / User..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </>
      }
    >
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

      {totalCount > transactions.length && (
        <div className="px-2 py-1 rounded bg-amber-500/15 text-amber-700 font-semibold">
          Menampilkan {transactions.length} dari {totalCount} nota; total di bawah hanya untuk nota yang tampil.
        </div>
      )}

      <LegacyGrid
        isDark={isDark}
        columns={gridColumns}
        rows={sortedRows}
        rowKey={(row) => row.id}
        loading={isLoading}
        emptyText="Tidak ada nota pada tanggal ini."
        sort={sortField ? { key: sortField, order: sortOrder } : null}
        onSort={(key) => handleSort(key as keyof MonitoringRow)}
        onRowDoubleClick={(row) => handleViewReceipt(row.id)}
        onRowContextMenu={(row, e) => setRowMenu(menuAt(e, row))}
        rowClassName={(row) => (row.isVoid ? (isDark ? 'bg-rose-950/30 text-slate-500 line-through' : 'bg-rose-50 text-slate-400 line-through') : '')}
        showFooter
      />

      {billReport && (
        <BillOpnameReport isDark={isDark} mode={billReport} date={selectedDate} onClose={() => setBillReport(null)} />
      )}

      {rowMenu && (
        <ContextMenu
          isDark={isDark}
          x={rowMenu.x}
          y={rowMenu.y}
          onClose={closeRowMenu}
          items={[
            { label: 'Reprint', icon: <Printer className="w-3.5 h-3.5" />, onClick: () => handleViewReceipt(rowMenu.row.id) },
            {
              label: 'Void', icon: <Ban className="w-3.5 h-3.5" />, danger: true,
              onClick: () => (rowMenu.row.isVoid ? addToast('Transaksi Sudah dalam kondisi Void atau batal', 'info') : handleOpenVoidModal(rowMenu.row, 'VOID')),
            },
            {
              label: 'Unvoid', icon: <RotateCcw className="w-3.5 h-3.5" />,
              onClick: () => (!rowMenu.row.isVoid ? addToast('Transaksi Sudah dalam kondisi Unvoid atau Aktif', 'info') : handleOpenVoidModal(rowMenu.row, 'UNVOID')),
            },
          ]}
        />
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
            <div className="printable-pos-receipt pt-6">
              {/* Same layout and texts as the POS receipt (harmony-kitchen-pos ReceiptModal), which the client reviewed */}
              {/* receipt-paper: the POS receipt print rules (Arial, solid black, thermal margins) in globals.css */}
              <div className="receipt-paper bg-white px-4 py-3 max-w-[300px] mx-auto text-[#1e40af] text-[13px] leading-snug">
                <div className="text-center pb-1.5 border-b-2 border-[#1e40af]">
                  <h2 className="font-bold text-[15px] tracking-wide uppercase">HARMONY KITCHENWARE</h2>
                  <p className="mt-0.5">Jalan Panglima Sudirman 65</p>
                  <p>WA : 0851 7238 4707</p>
                </div>
                {printData.header.isVoid && (
                  <div className="my-1 py-1 px-2 border-2 border-rose-600 text-rose-600 font-black text-center text-xs tracking-widest uppercase">
                    *** TRANSAKSI DIBATALKAN (VOID) ***
                  </div>
                )}
                <div className="pt-2 text-left">No : {printData.header.invoiceNo}</div>
                <div className="flex justify-between gap-2">
                  <span>{receiptDate(printData.header)}</span>
                  <span>{receiptTime(printData.header)}</span>
                  <span>Ksr : {printData.header.cashierName}</span>
                </div>
                <div className="pt-2 pb-1 font-bold flex">
                  <span className="w-6 text-left shrink-0">#</span>
                  <span className="flex-1 text-left">Barang</span>
                  <span className="text-right shrink-0">Sub Total</span>
                </div>
                <div className="space-y-1.5">
                  {printData.items.map((it, idx) => (
                    <div key={idx} className="flex flex-col">
                      <div className="flex items-start font-medium">
                        <span className="w-6 text-left shrink-0">{it.qty}</span>
                        <span className="flex-1 pr-3 break-words text-left">{it.inventoryName}</span>
                        <span className="whitespace-nowrap font-bold text-right shrink-0">{Math.round(it.subtotal).toLocaleString('en-US')}</span>
                      </div>
                      {it.qty > 1 && <div className="pl-6 text-[12px]">@ {Math.round(it.price).toLocaleString('en-US')}</div>}
                    </div>
                  ))}
                </div>
                <div className="mt-2.5 pt-2 border-t-2 border-[#1e40af] space-y-1">
                  <div className="flex justify-between items-center">
                    <span>{printData.items.length} Jenis</span>
                    <div className="flex justify-between w-48">
                      <span className="flex-1 text-right pr-2">Total :</span>
                      <span className="font-bold text-right shrink-0 min-w-[70px]">{Math.round(printData.header.grandTotal || 0).toLocaleString('en-US')}</span>
                    </div>
                  </div>
                  {(printData.header.discValue || 0) > 0 && (
                    <div className="flex justify-end">
                      <div className="flex justify-between w-48 text-rose-600 font-bold">
                        <span className="flex-1 text-right pr-2">Diskon :</span>
                        <span className="text-right shrink-0 min-w-[70px]">- {Math.round(printData.header.discValue || 0).toLocaleString('en-US')}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <div className="flex justify-between w-48">
                      <span className="flex-1 text-right pr-2">Jumlah Bayar :</span>
                      <span className="font-bold text-right shrink-0 min-w-[70px]">{Math.round(printData.header.paymentAmount || 0).toLocaleString('en-US')}</span>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="flex justify-between w-48">
                      <span className="flex-1 text-right pr-2">Kembali :</span>
                      <span className="font-bold text-right shrink-0 min-w-[70px]">{Math.round(printData.header.changeAmount || 0).toLocaleString('en-US')}</span>
                    </div>
                  </div>
                </div>
                <div className="pt-2.5 text-center space-y-1">
                  <p className="font-bold uppercase leading-tight text-[12px]">BARANG YANG SUDAH DIBELI<br />TIDAK DAPAT DIKEMBALIKAN / DITUKARKAN</p>
                  <p className="pt-0.5 font-bold uppercase text-[12px]">TERIMA KASIH ATAS KUNJUNGAN ANDA</p>
                  <p className="text-[11px]">linktr.ee/harmonykitchenware</p>
                </div>
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
    </LegacyWindow>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  RefreshCw,
  Printer,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
  DollarSign,
  Package,
  Trash2,
  Eye,
  ArrowLeft,
  AlertTriangle,
  X,
  Zap,
  Users,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Building,
} from 'lucide-react';
import { Supplier } from '@/types/erp';

export interface UnpaidInvoice {
  invoice_no: string;
  invoice_date: string;
  do_no: string;
  invoice_amount: number;
  paid_previously: number;
  remaining_balance: number;
  payment_amount: number;
  selected?: boolean;
  notes?: string;
}

export interface APBalanceRow {
  supplier_id: string | number;
  supplier_name: string;
  phone1: string;
  total_invoices: number;
  total_receive_amount: number;
  total_paid_amount: number;
  ap_balance: number;
}

export interface PaymentHeader {
  id: string | number;
  payment_no: string;
  payment_date: string;
  supplier_id: string | number;
  supplier_name: string;
  payment_method: string;
  bank_name: string;
  account_no: string;
  reference_no: string;
  total_amount: number;
  discount_amount: number;
  grand_total: number;
  status: 'Draft' | 'Paid' | 'Cancelled' | string;
  notes: string;
  item_count?: number;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

interface PurchasePaymentManagerProps {
  isDark: boolean;
}

export default function PurchasePaymentManager({ isDark }: PurchasePaymentManagerProps) {
  // Mode View: 'list' | 'ap_balances' | 'create'
  const [activeTab, setActiveTab] = useState<'ap_balances' | 'history'>('ap_balances');
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');

  // AP Balances & History States
  const [apBalancesList, setApBalancesList] = useState<APBalanceRow[]>([]);
  const [paymentsHistoryList, setPaymentsHistoryList] = useState<PaymentHeader[]>([]);
  const [listSearch, setListSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Form Header States
  const [paymentNo, setPaymentNo] = useState<string>(
    () => 'PAY-' + new Date().toISOString().slice(2, 7).replace('-', '') + '-' + Math.floor(1000 + Math.random() * 9000)
  );
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedSupplierName, setSelectedSupplierName] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Transfer Bank BCA');
  const [bankName, setBankName] = useState<string>('Bank BCA');
  const [accountNo, setAccountNo] = useState<string>('882-901-2231');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  // Unpaid Invoices Allocation
  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState<boolean>(false);

  // Detail / Voucher Modal
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [selectedPayment, setSelectedPayment] = useState<{ header: PaymentHeader; items: UnpaidInvoice[] } | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  // Toast
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((text: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Fetch Suppliers
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await fetch('/api/suppliers');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setSuppliersList(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch suppliers:', err);
      }
    };
    fetchSuppliers();
  }, []);

  // Fetch AP Balances List
  const fetchApBalances = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/purchasing/payments?mode=ap_balances');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setApBalancesList(json.data);
      }
    } catch (err) {
      console.error('Error fetching AP balances:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch Payment History
  const fetchPaymentsHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = `/api/purchasing/payments?q=${encodeURIComponent(listSearch)}`;
      if (statusFilter !== 'ALL') {
        url += `&status=${encodeURIComponent(statusFilter)}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setPaymentsHistoryList(json.data);
      }
    } catch (err) {
      console.error('Error fetching payment history:', err);
    } finally {
      setIsLoading(false);
    }
  }, [listSearch, statusFilter]);

  useEffect(() => {
    if (activeTab === 'ap_balances') {
      fetchApBalances();
    } else {
      fetchPaymentsHistory();
    }
  }, [activeTab, fetchApBalances, fetchPaymentsHistory]);

  // Fetch Unpaid Invoices when Supplier changes in Form
  const fetchUnpaidInvoices = async (supId: string) => {
    if (!supId) {
      setUnpaidInvoices([]);
      return;
    }
    setIsLoadingInvoices(true);
    try {
      const res = await fetch(`/api/purchasing/payments?mode=unpaid_invoices&supplierId=${supId}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setUnpaidInvoices(
          json.data.map((inv: any) => ({
            ...inv,
            selected: true,
            notes: '',
          }))
        );
      }
    } catch (err) {
      console.error('Failed to fetch unpaid invoices:', err);
      addToast('Gagal memuat daftar tagihan supplier', 'error');
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  const handleSupplierChange = (supId: string) => {
    setSelectedSupplierId(supId);
    const sup = suppliersList.find((s) => String(s.id) === supId);
    if (sup) {
      setSelectedSupplierName(sup.supplierName || (sup as any).supplier_name || '');
    }
    fetchUnpaidInvoices(supId);
  };

  const handleCreatePaymentForSupplier = (supId: string | number, supName: string) => {
    setSelectedSupplierId(String(supId));
    setSelectedSupplierName(supName);
    fetchUnpaidInvoices(String(supId));
    setPaymentNo('PAY-' + new Date().toISOString().slice(2, 7).replace('-', '') + '-' + Math.floor(1000 + Math.random() * 9000));
    setViewMode('create');
  };

  // Calculations
  const selectedInvoices = unpaidInvoices.filter((i) => i.selected);
  const totalAllocationAmount = selectedInvoices.reduce((acc, inv) => acc + Number(inv.payment_amount || 0), 0);
  const calculatedGrandTotal = Math.max(0, totalAllocationAmount - discountAmount);

  // Save Payment
  const handleSavePayment = async (status: 'Paid' | 'Draft') => {
    if (!selectedSupplierName) {
      addToast('Pilih Supplier terlebih dahulu!', 'warning');
      return;
    }
    if (selectedInvoices.length === 0) {
      addToast('Pilih minimal 1 tagihan/faktur untuk dilunasi!', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        payment_no: paymentNo,
        payment_date: paymentDate,
        supplier_id: selectedSupplierId,
        supplier_name: selectedSupplierName,
        payment_method: paymentMethod,
        bank_name: bankName,
        account_no: accountNo,
        reference_no: referenceNo,
        discount_amount: discountAmount,
        status,
        notes,
        invoices: selectedInvoices,
      };

      const res = await fetch('/api/purchasing/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        addToast(`Pembayaran ${paymentNo} berhasil disimpan (${status})!`, 'success');
        setViewMode('list');
        setActiveTab('history');
        fetchPaymentsHistory();
        fetchApBalances();
      } else {
        addToast(json.error || 'Gagal menyimpan pembayaran', 'error');
      }
    } catch (err: any) {
      console.error('Save Payment error:', err);
      addToast('Terjadi kesalahan koneksi saat menyimpan pembayaran', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // View Details Modal
  const handleOpenDetailModal = async (payId: string | number) => {
    setIsLoadingDetail(true);
    setIsDetailModalOpen(true);
    try {
      const res = await fetch(`/api/purchasing/payments?id=${payId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setSelectedPayment({
          header: json.data.header,
          items: json.data.items.map((i: any) => ({
            invoice_no: i.invoice_no,
            invoice_date: i.invoice_date,
            do_no: i.do_no || '',
            invoice_amount: Number(i.invoice_amount),
            paid_previously: Number(i.paid_previously),
            remaining_balance: Number(i.remaining_balance),
            payment_amount: Number(i.payment_amount),
            notes: i.notes || '',
          })),
        });
      }
    } catch (err) {
      console.error('Error loading payment detail:', err);
      addToast('Gagal memuat detail pembayaran', 'error');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const totalAPBalance = apBalancesList.reduce((acc, b) => acc + b.ap_balance, 0);
  const totalPaidHistory = paymentsHistoryList.reduce((acc, p) => acc + Number(p.grand_total || 0), 0);

  return (
    <div
      className={`h-full w-full flex flex-col font-sans transition-colors duration-200 ${
        isDark ? 'bg-[#0b0f19] text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Toast Container */}
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
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
            {t.type === 'error' && <XCircle className="w-4 h-4" />}
            {t.type === 'warning' && <AlertTriangle className="w-4 h-4" />}
            {t.type === 'info' && <Zap className="w-4 h-4" />}
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight flex items-center gap-2">
              Pembayaran Supplier & Hutang Usaha (Accounts Payable)
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                PUR_PAY 1:1
              </span>
            </h1>
            <p className="text-xs text-slate-400">Pelunasan faktur pembelian & pemantauan saldo hutang supplier</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {viewMode === 'create' ? (
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 active:scale-95 transition-all cursor-pointer ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Daftar
            </button>
          ) : (
            <button
              onClick={() => {
                setPaymentNo('PAY-' + new Date().toISOString().slice(2, 7).replace('-', '') + '-' + Math.floor(1000 + Math.random() * 9000));
                setViewMode('create');
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Input Pembayaran Supplier
            </button>
          )}
        </div>
      </header>

      {/* CONTENT AREA */}
      {viewMode === 'list' ? (
        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div
              className={`p-4 rounded-2xl border flex items-center gap-4 ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold">
                <Building className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold">Total Saldo Hutang Usaha</p>
                <p className="text-lg font-extrabold text-rose-500">Rp {totalAPBalance.toLocaleString('id-ID')}</p>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border flex items-center gap-4 ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold">Total Pelunasan Terbayar</p>
                <p className="text-lg font-extrabold text-emerald-400">Rp {totalPaidHistory.toLocaleString('id-ID')}</p>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border flex items-center gap-4 ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold">Supplier Terhutang</p>
                <p className="text-xl font-extrabold text-blue-400">
                  {apBalancesList.filter((b) => b.ap_balance > 0).length} Supplier
                </p>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border flex items-center gap-4 ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold">Total Transaksi Pembayaran</p>
                <p className="text-xl font-extrabold text-purple-400">{paymentsHistoryList.length} Transaksi</p>
              </div>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <button
              onClick={() => setActiveTab('ap_balances')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'ap_balances'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : isDark
                  ? 'text-slate-400 hover:bg-slate-800'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Building className="w-4 h-4" />
              Saldo Hutang Supplier (AP Balances)
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : isDark
                  ? 'text-slate-400 hover:bg-slate-800'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Riwayat Transaksi Pembayaran
            </button>
          </div>

          {/* TAB 1: SALDO HUTANG SUPPLIER (AP BALANCES) */}
          {activeTab === 'ap_balances' ? (
            <div
              className={`rounded-2xl border overflow-hidden ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead
                    className={`uppercase font-bold border-b tracking-wider ${
                      isDark ? 'bg-slate-800/50 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}
                  >
                    <tr>
                      <th className="px-4 py-3.5">Supplier</th>
                      <th className="px-4 py-3.5">Telepon</th>
                      <th className="px-4 py-3.5 text-center">Faktur Terima</th>
                      <th className="px-4 py-3.5 text-right">Total Pembelian (Rp)</th>
                      <th className="px-4 py-3.5 text-right">Total Dibayar (Rp)</th>
                      <th className="px-4 py-3.5 text-right">Sisa Hutang (Rp)</th>
                      <th className="px-4 py-3.5 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                          <span>Memuat saldo hutang supplier...</span>
                        </td>
                      </tr>
                    ) : apBalancesList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                          Tidak ada data saldo supplier.
                        </td>
                      </tr>
                    ) : (
                      apBalancesList.map((row) => (
                        <tr key={row.supplier_id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                          <td className="px-4 py-3 font-bold text-white">{row.supplier_name}</td>
                          <td className="px-4 py-3 text-slate-400">{row.phone1 || '-'}</td>
                          <td className="px-4 py-3 text-center font-semibold">{row.total_invoices} Faktur</td>
                          <td className="px-4 py-3 text-right text-slate-300">
                            Rp {row.total_receive_amount.toLocaleString('id-ID')}
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-400">
                            Rp {row.total_paid_amount.toLocaleString('id-ID')}
                          </td>
                          <td className="px-4 py-3 text-right font-extrabold text-rose-500">
                            Rp {row.ap_balance.toLocaleString('id-ID')}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.ap_balance > 0 ? (
                              <button
                                onClick={() => handleCreatePaymentForSupplier(row.supplier_id, row.supplier_name)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold text-xs flex items-center gap-1.5 mx-auto active:scale-95 transition-all"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                Bayar Hutang
                              </button>
                            ) : (
                              <span className="text-[11px] font-bold text-emerald-500">LUNAS</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* TAB 2: RIWAYAT TRANSAKSI PEMBAYARAN */
            <div
              className={`rounded-2xl border overflow-hidden ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead
                    className={`uppercase font-bold border-b tracking-wider ${
                      isDark ? 'bg-slate-800/50 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}
                  >
                    <tr>
                      <th className="px-4 py-3.5">No. Pembayaran</th>
                      <th className="px-4 py-3.5">Tanggal</th>
                      <th className="px-4 py-3.5">Supplier</th>
                      <th className="px-4 py-3.5">Metode Bayar</th>
                      <th className="px-4 py-3.5">No. Referensi / Trf</th>
                      <th className="px-4 py-3.5 text-right">Total Bayar (Rp)</th>
                      <th className="px-4 py-3.5 text-center">Status</th>
                      <th className="px-4 py-3.5 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {isLoading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                          <span>Memuat riwayat pembayaran...</span>
                        </td>
                      </tr>
                    ) : paymentsHistoryList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                          Belum ada transaksi pembayaran.
                        </td>
                      </tr>
                    ) : (
                      paymentsHistoryList.map((pay) => (
                        <tr key={pay.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                          <td className="px-4 py-3 font-bold text-emerald-400">{pay.payment_no}</td>
                          <td className="px-4 py-3 text-slate-300">
                            {new Date(pay.payment_date).toLocaleDateString('id-ID')}
                          </td>
                          <td className="px-4 py-3 font-semibold text-white">{pay.supplier_name}</td>
                          <td className="px-4 py-3 text-slate-300">{pay.payment_method}</td>
                          <td className="px-4 py-3 text-slate-400 font-mono">{pay.reference_no || '-'}</td>
                          <td className="px-4 py-3 text-right font-extrabold text-emerald-400">
                            Rp {Number(pay.grand_total || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                pay.status === 'Paid'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : pay.status === 'Cancelled'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              }`}
                            >
                              {pay.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleOpenDetailModal(pay.id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold text-xs flex items-center gap-1.5 mx-auto active:scale-95 transition-all"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Detail / Kwitansi
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* FORM CREATE PEMBAYARAN SUPPLIER */
        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
          {/* Header Card */}
          <div
            className={`p-6 rounded-2xl border flex flex-col gap-5 ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-emerald-500 flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Header Pembayaran Supplier
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">No. Bukti Pembayaran</label>
                <input
                  type="text"
                  value={paymentNo}
                  onChange={(e) => setPaymentNo(e.target.value)}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border font-mono font-bold outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-emerald-400' : 'bg-slate-100 border-slate-300 text-emerald-600'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">Supplier *</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => handleSupplierChange(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none cursor-pointer ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">-- Pilih Supplier --</option>
                  {suppliersList.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.supplierName || (sup as any).supplier_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">Tanggal Pembayaran</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">Metode Pembayaran</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none cursor-pointer ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="Transfer Bank BCA">Transfer Bank BCA</option>
                  <option value="Transfer Bank Mandiri">Transfer Bank Mandiri</option>
                  <option value="Transfer Bank BRI">Transfer Bank BRI</option>
                  <option value="Cash / Kasir Dapur">Cash / Tunai Kasir Dapur</option>
                  <option value="Cheque / Bilyet Giro">Cheque / Bilyet Giro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">No. Rekening / Transfer</label>
                <input
                  type="text"
                  value={accountNo}
                  onChange={(e) => setAccountNo(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-400">No. Referensi Transfer / Trx</label>
                <input
                  type="text"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="Contoh: TRF-BCA-988123"
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 text-slate-400">Catatan Pembayaran</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan transfer, pelunasan sebagian, diskon potongan harga, dll."
                className={`w-full px-3.5 py-2 text-xs rounded-xl border outline-none ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
            </div>
          </div>

          {/* Allocation of Unpaid Invoices */}
          <div
            className={`p-6 rounded-2xl border flex flex-col gap-4 ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-emerald-500 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" /> Alokasi Pembayaran Faktur / Receiving
            </h2>

            <div className="overflow-x-auto border rounded-xl border-slate-800">
              <table className="w-full text-left text-xs">
                <thead
                  className={`uppercase font-bold border-b tracking-wider ${
                    isDark ? 'bg-slate-800/50 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  <tr>
                    <th className="px-4 py-3 text-center w-12">Bayar?</th>
                    <th className="px-4 py-3">No. Faktur / MR</th>
                    <th className="px-4 py-3">Tgl Faktur</th>
                    <th className="px-4 py-3 text-right">Total Faktur (Rp)</th>
                    <th className="px-4 py-3 text-right">Terbayar Lalu (Rp)</th>
                    <th className="px-4 py-3 text-right">Sisa Hutang (Rp)</th>
                    <th className="px-4 py-3 text-right w-40">Jumlah Bayar Ini (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {isLoadingInvoices ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                        <span>Memuat tagihan supplier...</span>
                      </td>
                    </tr>
                  ) : unpaidInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        {selectedSupplierName
                          ? 'Tidak ada tagihan tertunggak untuk supplier ini (LUNAS).'
                          : 'Pilih Supplier di atas untuk menampilkan tagihan.'}
                      </td>
                    </tr>
                  ) : (
                    unpaidInvoices.map((inv, idx) => (
                      <tr key={idx} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => {
                              const updated = [...unpaidInvoices];
                              updated[idx].selected = !updated[idx].selected;
                              setUnpaidInvoices(updated);
                            }}
                            className="text-emerald-500"
                          >
                            {inv.selected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-slate-500" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-bold text-white">{inv.invoice_no}</td>
                        <td className="px-4 py-3 text-slate-400">
                          {new Date(inv.invoice_date).toLocaleDateString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-300">
                          Rp {inv.invoice_amount.toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400">
                          Rp {inv.paid_previously.toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-rose-400">
                          Rp {inv.remaining_balance.toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min="0"
                            disabled={!inv.selected}
                            value={inv.payment_amount}
                            onChange={(e) => {
                              const updated = [...unpaidInvoices];
                              updated[idx].payment_amount = Math.max(0, parseFloat(e.target.value) || 0);
                              setUnpaidInvoices(updated);
                            }}
                            className={`w-36 px-2 py-1 text-right font-bold rounded-lg border outline-none ${
                              isDark ? 'bg-slate-800 border-slate-700 text-emerald-400' : 'bg-white border-slate-300 text-emerald-600'
                            }`}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Calculations Box */}
            <div className="flex flex-col sm:flex-row justify-end gap-6 pt-4 border-t border-slate-800">
              <div className="w-full sm:w-80 flex flex-col gap-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Total Alokasi Pembayaran:</span>
                  <span className="font-bold text-white">Rp {totalAllocationAmount.toLocaleString('id-ID')}</span>
                </div>

                <div className="flex justify-between items-center text-slate-400">
                  <span>Diskon / Potongan (Rp):</span>
                  <input
                    type="number"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className={`w-32 px-2 py-1 text-right font-bold rounded-lg border outline-none ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div className="flex justify-between pt-3 border-t border-slate-800 text-sm font-extrabold">
                  <span className="text-emerald-500">Grand Total Terbayar:</span>
                  <span className="text-emerald-400">Rp {calculatedGrandTotal.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => handleSavePayment('Draft')}
                disabled={isSubmitting}
                className={`px-5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 active:scale-95 transition-all ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-amber-500/30'
                    : 'bg-white hover:bg-amber-50 text-amber-600 border-amber-300'
                }`}
              >
                <Clock className="w-4 h-4" />
                Simpan Draft Pembayaran
              </button>

              <button
                onClick={() => handleSavePayment('Paid')}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Proses & Lunasi Pembayaran
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL / VOUCHER MODAL */}
      {isDetailModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div
            className={`w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-500" />
                <h3 className="font-extrabold text-sm">Kwitansi Pembayaran #{selectedPayment?.header.payment_no}</h3>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 font-sans">
              {isLoadingDetail ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                  <span>Memuat rincian kwitansi pembayaran...</span>
                </div>
              ) : selectedPayment ? (
                <div className="bg-white text-slate-900 p-8 rounded-xl border border-slate-300 shadow-inner">
                  {/* Header */}
                  <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-6">
                    <div>
                      <h2 className="text-xl font-black tracking-tight text-emerald-600 uppercase">
                        HARMONY KITCHEN & RESTO
                      </h2>
                      <p className="text-xs text-slate-600">Bukti / Kwitansi Pelunasan Pembayaran Supplier</p>
                    </div>
                    <div className="text-right">
                      <h3 className="text-lg font-extrabold uppercase tracking-wide text-slate-800">
                        KWITANSI PEMBAYARAN
                      </h3>
                      <p className="text-xs font-mono font-bold text-emerald-600">{selectedPayment.header.payment_no}</p>
                      <p className="text-xs text-slate-500">
                        Tgl: {new Date(selectedPayment.header.payment_date).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                  </div>

                  {/* Payment Meta */}
                  <div className="grid grid-cols-2 gap-6 text-xs mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <p className="font-extrabold text-slate-500 uppercase text-[10px] mb-1">Dibayarkan Kepada:</p>
                      <p className="font-bold text-sm text-slate-800">{selectedPayment.header.supplier_name}</p>
                      <p className="text-slate-600">Metode: {selectedPayment.header.payment_method}</p>
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-500 uppercase text-[10px] mb-1">Detail Transfer / Bank:</p>
                      <p className="font-bold text-slate-800">{selectedPayment.header.bank_name}</p>
                      <p className="text-slate-600">No. Ref: {selectedPayment.header.reference_no || '-'}</p>
                    </div>
                  </div>

                  {/* Table */}
                  <table className="w-full text-left text-xs mb-6 border border-slate-300">
                    <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-300">
                      <tr>
                        <th className="p-2 border-r border-slate-300">No.</th>
                        <th className="p-2 border-r border-slate-300">No. Faktur / Invoice</th>
                        <th className="p-2 border-r border-slate-300 text-right">Nilai Faktur</th>
                        <th className="p-2 border-r border-slate-300 text-right">Terbayar Sebelumnya</th>
                        <th className="p-2 text-right">Jumlah Dibayar Ini</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {selectedPayment.items.map((it, i) => (
                        <tr key={i}>
                          <td className="p-2 border-r border-slate-200 text-center">{i + 1}</td>
                          <td className="p-2 border-r border-slate-200 font-semibold text-slate-800">{it.invoice_no}</td>
                          <td className="p-2 border-r border-slate-200 text-right">Rp {it.invoice_amount.toLocaleString('id-ID')}</td>
                          <td className="p-2 border-r border-slate-200 text-right">Rp {it.paid_previously.toLocaleString('id-ID')}</td>
                          <td className="p-2 text-right font-extrabold text-emerald-700">Rp {it.payment_amount.toLocaleString('id-ID')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex justify-end text-xs mb-8">
                    <div className="w-64 space-y-1">
                      <div className="flex justify-between text-slate-600">
                        <span>Total Pembayaran:</span>
                        <span className="font-bold">Rp {Number(selectedPayment.header.total_amount || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Potongan / Diskon:</span>
                        <span className="font-bold">Rp {Number(selectedPayment.header.discount_amount || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t-2 border-slate-800 text-sm font-extrabold text-slate-900">
                        <span>Grand Total Dibayar:</span>
                        <span className="text-emerald-600">Rp {Number(selectedPayment.header.grand_total || 0).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="grid grid-cols-2 gap-4 text-center text-[11px] text-slate-600 pt-8 border-t border-slate-200">
                    <div>
                      <p>Dibuat Oleh (Finance / AP),</p>
                      <div className="h-16"></div>
                      <p className="font-bold text-slate-800">( Staf Keuangan Resto )</p>
                    </div>
                    <div>
                      <p>Diterima Oleh (Supplier),</p>
                      <div className="h-16"></div>
                      <p className="font-bold text-slate-800">( {selectedPayment.header.supplier_name} )</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div />
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-500/20"
              >
                <Printer className="w-4 h-4" /> Cetak Kwitansi Pembayaran
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RefreshCw, Trash2, CheckCircle, XCircle, AlertTriangle, Zap, Printer, X, Plus } from 'lucide-react';
import { ERPProduct, Supplier } from '@/types/erp';
import { useDebounce } from '@/hooks/useDebounce';
import { searchInventory, lookupInventoryByScan } from '@/lib/inventory-lookup';
import { getTodayBangkok } from '@/lib/date-utils';
import { receiptLineAmounts, receiptHeaderAmounts, dueDateFromTerm } from '@/lib/receipt-totals';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import IntegerCellInput from '@/components/IntegerCellInput';
import { InputSupplierDialog, DailyReportDialog, CashPaymentDialog, StockDialog, PaidToggle } from '@/components/PenerimaanBarangDialogs';
import {
  LegacyWindow,
  LegacyButton,
  LegacyGrid,
  LegacyPager,
  LegacyInput,
  LegacySelect,
  GroupBox,
  FieldRow,
  ContextMenu,
  menuAt,
  fmtN0,
  fmtDate,
  lx,
  type LegacyColumn,
  type ContextMenuState,
} from '@/components/legacy';

export interface PricedReceiptItem {
  /** Row key: inventory id for a new line, detail id for a saved one */
  inventoryId: string;
  /** m_inventory id (also set on saved lines, for "Lihat Stok") */
  stockId: string;
  barcode: string;
  inventoryNo: string;
  inventoryName: string;
  uomName: string;
  qty: number;
  // null when the server masks purchase prices (non-admin viewing a saved receipt)
  price: number | null;
  discPercentage: number;
  disc2: number;
  disc3: number;
  // null when masked (non-admin viewing a saved receipt)
  discRp: number | null;
  subtotal: number | null;
  description: string;
}

/** One row of GET /api/purchasing/priced (only the fields this page shows). */
export interface PricedReceiptHeader {
  id: number;
  mrNo: string;
  mrDate: string;
  supplierId: string;
  supplierName: string;
  description: string;
  paymentType: string;
  dueDate: string;
  grandTotal: number | null;
}

/** A saved receipt shown in the detail view (lines read-only, header editable via "Apply  Changes"). */
interface ViewedReceipt {
  id: number;
  mrNo: string;
  mrDate: string;
  supplierId: string;
  supplierName: string;
  whId: string;
  description: string;
  paymentType: string;
  longTerm: number;
  dueDate: string;
  discPercentage: number;
  isMultiDisc: boolean;
  disc2: number;
  disc3: number;
  discValue: number | null;
  ppnPercentage: number;
  ppnValue: number | null;
  grandTotal: number | null;
  /** null for non-admins (masked by the API) */
  downPayment: number | null;
  isPaid: boolean;
  /** Settled by "Cash Payment": the header can no longer change */
  hasPayment: boolean;
  items: PricedReceiptItem[];
}

/** Header fields of the receipt in the detail view (a new one, or a saved one being changed). */
interface HeaderForm {
  mrDate: string;
  whId: string;
  supplierId: string;
  description: string;
  paymentType: string;
  longTerm: number;
  discPercentage: number;
  isMultiDisc: boolean;
  disc2: number;
  disc3: number;
  ppnPercentage: number;
  downPayment: number;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

interface PenerimaanBarangHargaManagerProps {
  isDark: boolean;
  canViewPrice?: boolean;
}

const PAGE_SIZE_DEFAULT = 100;
const MASK = '••••••';
// Credit terms default to 30 days (the ERP's previous default due date)
const DEFAULT_TERM_DAYS = 30;
const newMrNo = () => 'MR-RCV-' + Math.floor(100000 + Math.random() * 900000);
const pctText = (v: number) => v.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Default list range: the last 30 days up to today (Bangkok time)
function daysAgoBangkok(days: number): string {
  const d = new Date(`${getTodayBangkok()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

const emptyHeader = (mrDate: string, whId: string, supplierId: string): HeaderForm => ({
  mrDate,
  whId,
  supplierId,
  description: '',
  paymentType: 'TEMPO',
  longTerm: DEFAULT_TERM_DAYS,
  discPercentage: 0,
  isMultiDisc: false,
  disc2: 0,
  disc3: 0,
  ppnPercentage: 11,
  downPayment: 0,
});

const headerOf = (v: ViewedReceipt): HeaderForm => ({
  mrDate: v.mrDate,
  whId: v.whId,
  supplierId: v.supplierId,
  description: v.description,
  paymentType: v.paymentType,
  longTerm: v.longTerm,
  discPercentage: v.discPercentage,
  isMultiDisc: v.isMultiDisc,
  disc2: v.disc2,
  disc3: v.disc3,
  ppnPercentage: v.ppnPercentage,
  downPayment: v.downPayment ?? 0,
});

const lineSubtotal = (it: PricedReceiptItem) =>
  receiptLineAmounts({ qty: it.qty, price: it.price ?? 0, disc1: it.discPercentage, disc2: it.disc2, disc3: it.disc3, discRp: it.discRp ?? 0 }).subtotal;

/** Legacy Mod_Purchasing.Frm_PurchaseReceivement: list view, and the detail view in the same window ("Back"). */
export default function PenerimaanBarangHargaManager({ isDark, canViewPrice = false }: PenerimaanBarangHargaManagerProps) {
  const c = lx(isDark);
  const { confirmDialog, dialog: confirmDialogEl } = useConfirmDialog(isDark);
  // Saved purchase prices become HPP, so non-admins see them masked
  const money = (value: number | null | undefined) => (canViewPrice && value != null ? fmtN0(value) : MASK);

  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  // List view
  const [receiptsList, setReceiptsList] = useState<PricedReceiptHeader[]>([]);
  const [dateStart, setDateStartRaw] = useState<string>(() => daysAgoBangkok(30));
  const [dateEnd, setDateEndRaw] = useState<string>(() => getTodayBangkok());
  // Old ToggleSwitch1: off = "Belum Terbayar", on = "Terbayar" (t_materialreceiveheader.ispaid)
  const [showPaid, setShowPaidRaw] = useState(false);
  const [listSearch, setListSearchRaw] = useState<string>('');
  const debouncedListSearch = useDebounce(listSearch, 500);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(PAGE_SIZE_DEFAULT);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  // Filters change the result set, so paging restarts at page 1
  const withPageReset = <T,>(set: (v: T) => void) => (v: T) => { setPage(1); set(v); };
  const setDateStart = withPageReset(setDateStartRaw);
  const setDateEnd = withPageReset(setDateEndRaw);
  const setListSearch = withPageReset(setListSearchRaw);
  const setPageSize = withPageReset(setPageSizeRaw);
  const setShowPaid = withPageReset(setShowPaidRaw);
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Detail view: a saved receipt or a new one being entered
  const [viewed, setViewed] = useState<ViewedReceipt | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  // "Cetak": print voucher of the saved receipt; "Lunas" (old CE_Print next to it) stamps it LUNAS
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printLunas, setPrintLunas] = useState(false);
  const [isDailyReportOpen, setIsDailyReportOpen] = useState(false);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isCashPaymentOpen, setIsCashPaymentOpen] = useState(false);
  const [stockIds, setStockIds] = useState<string[] | null>(null);

  // Lookups
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [supplierReloadKey, setSupplierReloadKey] = useState(0);
  const [warehouses, setWarehouses] = useState<{ id: number; whCode: string; location: string }[]>([]);
  const defaultSupplierId = suppliersList.length > 0 ? String(suppliersList[0].id) : '';
  const defaultWhId = warehouses.length > 0 ? String(warehouses[0].id) : '';

  // Header of the receipt in the detail view
  const [mrNo, setMrNo] = useState<string>(newMrNo);
  const [formState, setForm] = useState<HeaderForm>(() => emptyHeader(getTodayBangkok(), '', ''));
  // A new receipt opened before the lookups arrived uses the first supplier / warehouse
  const form = viewed ? formState : { ...formState, supplierId: formState.supplierId || defaultSupplierId, whId: formState.whId || defaultWhId };
  const setField = <K extends keyof HeaderForm>(key: K, value: HeaderForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  // Item entry: "#" qty + barcode / name search
  const [items, setItems] = useState<PricedReceiptItem[]>([]);
  const [entryQty, setEntryQty] = useState<number>(1);
  const [productSearch, setProductSearch] = useState<string>('');
  const debouncedProductSearch = useDebounce(productSearch, 500);
  const [searchResults, setSearchResults] = useState<ERPProduct[]>([]);
  const [isSearchingProduct, setIsSearchingProduct] = useState<boolean>(false);
  const [itemMenu, setItemMenu] = useState<ContextMenuState<PricedReceiptItem> | null>(null);
  const closeItemMenu = useCallback(() => setItemMenu(null), []);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const addToast = useCallback((text: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const supplierById = useMemo(() => new Map(suppliersList.map((s) => [String(s.id), s])), [suppliersList]);

  // Fetch the receipt list for the date range (server-side mrdate range filter), paid toggle and search text
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoadingList(true);
      try {
        const params = new URLSearchParams({ q: debouncedListSearch, page: String(page), limit: String(pageSize), paid: String(showPaid) });
        if (dateStart) params.set('start_mrdate', dateStart);
        if (dateEnd) params.set('end_mrdate', dateEnd);
        const res = await fetch(`/api/purchasing/priced?${params}`);
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data)) {
          setReceiptsList(json.data);
          setTotalRows(json.pagination?.total ?? json.data.length);
          setTotalPages(json.pagination?.totalPages ?? 1);
        } else if (isMounted && !json.success) {
          addToast(typeof json.error === 'string' ? json.error : json.error?.message || 'Gagal memuat daftar penerimaan', 'error');
        }
      } catch (err) {
        console.error('Error fetching priced receipts:', err);
      } finally {
        if (isMounted) setIsLoadingList(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [debouncedListSearch, dateStart, dateEnd, page, pageSize, reloadKey, showPaid, addToast]);

  const reloadReceipts = () => setReloadKey((k) => k + 1);

  // Suppliers; "Refresh Supplier" reloads them (the chosen supplier stays chosen)
  useEffect(() => {
    let isMounted = true;
    fetch('/api/suppliers?onlyActive=true&all=true')
      .then((res) => res.json())
      .then((supJson) => {
        if (isMounted && supJson.success && Array.isArray(supJson.data)) setSuppliersList(supJson.data);
      })
      .catch((err) => console.error('Error fetching suppliers:', err));
    return () => { isMounted = false; };
  }, [supplierReloadKey]);

  // Warehouses
  useEffect(() => {
    let isMounted = true;
    fetch('/api/inventory/lookups')
      .then((res) => res.json())
      .then((lookupJson) => {
        if (isMounted && lookupJson.success && lookupJson.data?.warehouses) setWarehouses(lookupJson.data.warehouses);
      })
      .catch((err) => console.error('Error fetching warehouses:', err));
    return () => { isMounted = false; };
  }, []);

  // Live product search for the barcode / name input (request-id guard drops out-of-order responses)
  const productSearchReqIdRef = useRef(0);
  useEffect(() => {
    const reqId = ++productSearchReqIdRef.current;
    if (!debouncedProductSearch.trim()) {
      setSearchResults([]);
      setIsSearchingProduct(false);
      return;
    }
    const runSearch = async () => {
      setIsSearchingProduct(true);
      const { items, error } = await searchInventory(debouncedProductSearch, 8);
      if (reqId !== productSearchReqIdRef.current) return;
      setSearchResults(items);
      setIsSearchingProduct(false);
      if (error) addToast(error, 'error');
    };
    runSearch();
  }, [debouncedProductSearch, addToast]);

  // Add a product with the "#" qty; scanning the same item again adds to its qty
  const handleAddProductToItems = (prod: ERPProduct, keepSearch = false) => {
    const addQty = Math.max(1, Math.floor(entryQty) || 1);
    // Non-admins don't get the last buy price, so they type it from the supplier invoice
    const initialPrice = canViewPrice ? (prod.priceBuy > 0 ? prod.priceBuy : (prod.hpp > 0 ? prod.hpp : 10000)) : 0;
    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => String(i.inventoryId) === String(prod.id));
      if (existingIndex >= 0) {
        const updated = [...prev];
        const line = { ...updated[existingIndex], qty: updated[existingIndex].qty + addQty };
        updated[existingIndex] = { ...line, subtotal: lineSubtotal(line) };
        return updated;
      }
      const line: PricedReceiptItem = {
        inventoryId: String(prod.id),
        stockId: String(prod.id),
        barcode: prod.barcode || '',
        inventoryNo: prod.inventoryNo || '',
        inventoryName: prod.inventoryName,
        uomName: prod.uomName || 'PCS',
        qty: addQty,
        price: initialPrice,
        discPercentage: 0,
        disc2: 0,
        disc3: 0,
        discRp: 0,
        subtotal: 0,
        description: '',
      };
      return [...prev, { ...line, subtotal: lineSubtotal(line) }];
    });
    setEntryQty(1);
    if (!keepSearch) {
      setProductSearch('');
      setSearchResults([]);
    }
    addToast(`"${prod.inventoryName}" ditambahkan`, 'info');
  };

  // Enter / barcode scan: look up the current input directly instead of waiting for the debounced dropdown
  const handleProductSearchEnter = async () => {
    const raw = productSearch.trim();
    if (!raw) return;
    // Clear right away so a fast follow-up scan types into an empty input instead of appending
    productSearchReqIdRef.current++;
    setProductSearch('');
    setSearchResults([]);
    setIsSearchingProduct(true);
    const { item, error } = await lookupInventoryByScan(raw);
    setIsSearchingProduct(false);
    if (error) {
      addToast(error, 'error');
    } else if (item) {
      handleAddProductToItems(item, true);
    } else {
      addToast(`Barang tidak ditemukan: ${raw}`, 'warning');
    }
  };

  // Edit one line of the new receipt; subtotal follows qty / price / discounts (old detail SP formula)
  const updateLine = (inventoryId: string, patch: Partial<PricedReceiptItem>) => {
    setItems((prev) => prev.map((it) => {
      if (it.inventoryId !== inventoryId) return it;
      const next = { ...it, ...patch };
      return { ...next, subtotal: lineSubtotal(next) };
    }));
  };

  // A new receipt; "Recreate Invoice" keeps the date of the receipt just finished (old SB_CreateNew_Click)
  const startNewReceipt = (date: string) => {
    setMrNo(newMrNo());
    setForm(emptyHeader(date, defaultWhId, defaultSupplierId));
    setItems([]);
    setEntryQty(1);
    setProductSearch('');
    setSearchResults([]);
    setViewed(null);
    setIsPrintModalOpen(false);
    setViewMode('detail');
    setTimeout(() => barcodeInputRef.current?.focus(), 0);
  };

  // "New": open an empty detail view
  const handleNew = () => startNewReceipt(getTodayBangkok());

  const handleRecreateInvoice = () => startNewReceipt(viewed?.mrDate && viewed.mrDate !== '-' ? viewed.mrDate : form.mrDate);

  const isViewing = viewed !== null;
  const canEditHeader = !viewed || !viewed.hasPayment;
  const isDirty = viewed !== null && JSON.stringify(headerOf(viewed)) !== JSON.stringify(form);

  // "Back": return to the list; unsaved input asks first
  const handleBack = async () => {
    if ((!viewed && items.length > 0) || isDirty) {
      const ok = await confirmDialog(
        isDirty ? 'Perubahan belum disimpan (Apply  Changes). Kembali ke daftar?' : 'Barang yang sudah diinput belum disimpan. Kembali ke daftar?',
        { title: 'Penerimaan Barang', confirmText: 'Kembali' },
      );
      if (!ok) return;
    }
    setIsPrintModalOpen(false);
    setViewMode('list');
  };

  // Show a saved receipt in the detail view; resolves true when it loaded
  const loadReceipt = async (id: number): Promise<boolean> => {
    setIsLoadingDetail(true);
    try {
      const res = await fetch(`/api/purchasing/priced/${id}`);
      const json = await res.json();
      if (json.success) {
        const d = json.data;
        const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));
        const receipt: ViewedReceipt = {
          id: Number(d.id),
          mrNo: d.mr_no || '-',
          mrDate: d.mr_date && d.mr_date !== '-' ? d.mr_date : getTodayBangkok(),
          supplierId: d.supplier_id != null ? String(d.supplier_id) : '',
          supplierName: d.supplier_name || '-',
          whId: d.wh_id != null ? String(d.wh_id) : '',
          description: d.description && d.description !== '-' ? d.description : '',
          paymentType: d.payment_type || 'TEMPO',
          longTerm: Number(d.long_term || 0),
          dueDate: d.due_date && d.due_date !== '-' ? d.due_date : '',
          discPercentage: Number(d.disc_percentage || 0),
          isMultiDisc: Boolean(d.is_multi_disc),
          disc2: Number(d.disc2 || 0),
          disc3: Number(d.disc3 || 0),
          discValue: numOrNull(d.disc_value),
          ppnPercentage: Number(d.ppn_percentage || 0),
          ppnValue: numOrNull(d.tax),
          grandTotal: numOrNull(d.grand_total),
          downPayment: numOrNull(d.down_payment),
          isPaid: Boolean(d.is_paid),
          hasPayment: Boolean(d.has_payment),
          items: (d.items || []).map((it: any) => ({
            inventoryId: String(it.id),
            stockId: String(it.inventory_id ?? ''),
            inventoryNo: it.inventory_no || '',
            inventoryName: it.inventory_name || '-',
            uomName: it.uom_name || 'PCS',
            qty: Number(it.qty) || 0,
            price: numOrNull(it.price),
            discPercentage: Number(it.disc_percentage || 0),
            disc2: Number(it.disc2 || 0),
            disc3: Number(it.disc3 || 0),
            discRp: numOrNull(it.disc_rp),
            subtotal: numOrNull(it.subtotal),
            barcode: it.barcode || '',
            description: it.description || '',
          })),
        };
        setViewed(receipt);
        setForm(headerOf(receipt));
        setPrintLunas(receipt.isPaid);
        setViewMode('detail');
        return true;
      }
      addToast(json.error?.message || 'Gagal memuat detail penerimaan', 'error');
    } catch (err) {
      console.error('Error fetching priced receipt detail:', err);
      addToast('Gagal memuat detail penerimaan', 'error');
    } finally {
      setIsLoadingDetail(false);
    }
    return false;
  };

  // Keyboard shortcuts: Alt+N = New (list view), "/" = focus the barcode input (new receipt)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName);
      if (e.key === 'Escape') {
        setIsPrintModalOpen(false);
      } else if (e.key === '/' && viewMode === 'detail' && !viewed && !isInputFocused) {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.altKey && e.key.toLowerCase() === 'n' && viewMode === 'list') {
        e.preventDefault();
        handleNew();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const headerPayload = () => ({
    mrDate: form.mrDate,
    supplierId: form.supplierId,
    supplierName: supplierById.get(form.supplierId)?.supplierName || '',
    whId: form.whId,
    paymentType: form.paymentType,
    longTerm: form.paymentType === 'CASH' ? 0 : form.longTerm,
    downPayment: form.downPayment,
    discPercentage: form.discPercentage,
    isMultiDisc: form.isMultiDisc,
    disc2: form.isMultiDisc ? form.disc2 : 0,
    disc3: form.isMultiDisc ? form.disc3 : 0,
    ppnPercentage: form.ppnPercentage,
    description: form.description,
  });

  // "Submit Header": save the receipt (adds stock, updates buy price / HPP), then show it
  const handleSubmitReceipt = async () => {
    if (items.length === 0) {
      return addToast('Wajib menginput minimal 1 item barang yang diterima', 'warning');
    }
    // A zero price would overwrite the item's HPP with 0
    if (items.some((it) => !((it.price ?? 0) > 0))) {
      return addToast('Harga beli setiap barang wajib diisi (lebih dari 0)', 'warning');
    }
    if (items.some((it) => (it.subtotal ?? 0) < 0)) {
      return addToast('Diskon barang melebihi harga', 'warning');
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/purchasing/priced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mrNo, ...headerPayload(), items: items.map((it) => ({ ...it, inventoryId: it.stockId })) }),
      });

      const json = await res.json();
      if (json.success) {
        addToast(json.message, 'success');
        setItems([]);
        reloadReceipts();
        // Like before: the print voucher opens right after a successful save
        if (json.id && (await loadReceipt(Number(json.id)))) setIsPrintModalOpen(true);
      } else {
        addToast(`Gagal menyimpan: ${json.error}`, 'error');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(`Error: ${message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // "Apply  Changes": save the header of the shown receipt (lines, stock and HPP stay as saved)
  const handleApplyChanges = async () => {
    if (!viewed) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/purchasing/priced/${viewed.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(headerPayload()),
      });
      const json = await res.json();
      if (json.success) {
        addToast(json.message || 'Perubahan berhasil disimpan', 'success');
        reloadReceipts();
        await loadReceipt(viewed.id);
      } else {
        addToast(`Gagal menyimpan: ${json.error?.message || json.error}`, 'error');
      }
    } catch (err: unknown) {
      addToast(`Error: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // After "Proses": old MsgBox — continue with a new receipt ("Recreate Invoice") or go back to the list
  const handleCashPaid = async (message: string) => {
    setIsCashPaymentOpen(false);
    addToast(message, 'success');
    reloadReceipts();
    if (viewed) await loadReceipt(viewed.id);
    const next = await confirmDialog('Transaksi telah berhasil dilunasi, apakah anda ingin melanjutkan transaksi penerimaan', {
      title: 'Transaksi Berhasil',
      confirmText: 'Ya',
    });
    if (next) handleRecreateInvoice();
    else setViewMode('list');
  };

  // Old rows may have no stored supplier name; fall back to the supplier master by id
  const supplierLabel = useCallback(
    (row: { supplierName: string; supplierId: string }) =>
      row.supplierName && row.supplierName !== '-' ? row.supplierName : supplierById.get(String(row.supplierId))?.supplierName || '-',
    [supplierById],
  );

  // Local sort of the current page (header click)
  const sortedReceipts = useMemo(() => {
    if (!sortField) return receiptsList;
    const val = (r: PricedReceiptHeader): string | number =>
      sortField === 'grandTotal' ? Number(r.grandTotal ?? 0) : (sortField === 'supplier' ? supplierLabel(r) : String((r as any)[sortField] ?? '')).toLowerCase();
    return [...receiptsList].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [receiptsList, sortField, sortOrder, supplierLabel]);

  const handleSort = (field: string) => {
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

  const pageGrandTotal = receiptsList.reduce((sum, r) => sum + Number(r.grandTotal ?? 0), 0);

  // Legacy GV_Header columns; GrandTotal footer sums the rows shown
  const listColumns: LegacyColumn<PricedReceiptHeader>[] = [
    { key: 'mrNo', caption: 'MR No', sortKey: 'mrNo' },
    { key: 'mrDate', caption: 'MR Date', format: 'date', sortKey: 'mrDate' },
    { key: 'supplier', caption: 'Supplier', sortKey: 'supplier', render: supplierLabel },
    { key: 'description', caption: 'Keterangan', render: (r) => (r.description === '-' ? '' : r.description) },
    { key: 'dueDate', caption: 'Jatuh Tempo', sortKey: 'dueDate', render: (r) => (r.paymentType !== 'CASH' && r.dueDate && r.dueDate !== '-' ? fmtDate(r.dueDate) : '') },
    { key: 'grandTotal', caption: 'GrandTotal', align: 'right', sortKey: 'grandTotal', render: (r) => money(r.grandTotal), footer: money(pageGrandTotal) },
  ];

  const detailItems = viewed ? viewed.items : items;
  const numInput = `px-1.5 py-0.5 rounded border text-right tabular-nums outline-none focus:ring-1 focus:ring-blue-500 ${c.input}`;
  const pctCell = (it: PricedReceiptItem, key: 'discPercentage' | 'disc2' | 'disc3', label: string) =>
    isViewing ? pctText(it[key]) : (
      <input type="number" min={0} max={100} step="0.01" value={it[key]} aria-label={`${label} ${it.inventoryName}`}
        onChange={(e) => updateLine(it.inventoryId, { [key]: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
        className={`w-16 ${numInput}`} />
    );

  // Legacy GV_Detail columns: Barang | Qty | Harga | Disc 1(%) | Disc 2(%) | Disc 3(%) | Disc (Rp) | Subtotal | Description
  const detailColumns: LegacyColumn<PricedReceiptItem>[] = [
    {
      key: 'inventoryName', caption: 'Barang',
      render: (it) => <span title={`${it.inventoryNo}${it.barcode ? ` | ${it.barcode}` : ''}`}>{it.inventoryName}</span>,
    },
    {
      key: 'qty', caption: 'Qty', align: 'right', width: 80,
      render: (it) => isViewing ? fmtN0(it.qty) : (
        <IntegerCellInput value={it.qty} min={1} label={`Qty ${it.inventoryName}`}
          onChange={(qty) => updateLine(it.inventoryId, { qty })}
          className={`w-16 ${numInput}`} />
      ),
    },
    {
      key: 'price', caption: 'Harga', align: 'right', width: 120,
      render: (it) => isViewing ? money(it.price) : (
        <input type="number" min={0} value={it.price ?? 0} aria-label={`Harga ${it.inventoryName}`}
          onChange={(e) => updateLine(it.inventoryId, { price: parseFloat(e.target.value) || 0 })}
          className={`w-24 ${numInput}`} />
      ),
    },
    { key: 'discPercentage', caption: 'Disc 1(%)', align: 'right', width: 80, render: (it) => pctCell(it, 'discPercentage', 'Disc 1') },
    { key: 'disc2', caption: 'Disc 2(%)', align: 'right', width: 80, render: (it) => pctCell(it, 'disc2', 'Disc 2') },
    { key: 'disc3', caption: 'Disc 3(%)', align: 'right', width: 80, render: (it) => pctCell(it, 'disc3', 'Disc 3') },
    {
      key: 'discRp', caption: 'Disc (Rp)', align: 'right', width: 100,
      render: (it) => isViewing ? money(it.discRp) : (
        <input type="number" min={0} value={it.discRp ?? 0} aria-label={`Disc (Rp) ${it.inventoryName}`}
          onChange={(e) => updateLine(it.inventoryId, { discRp: Math.max(0, parseFloat(e.target.value) || 0) })}
          className={`w-20 ${numInput}`} />
      ),
    },
    {
      key: 'subtotal', caption: 'Subtotal', align: 'right',
      // New lines show what the user typed; saved lines follow the server's masking
      render: (it) => (isViewing ? money(it.subtotal) : fmtN0(it.subtotal ?? 0)),
    },
    {
      key: 'description', caption: 'Description',
      render: (it) => isViewing ? it.description : (
        <input type="text" value={it.description} aria-label={`Description ${it.inventoryName}`}
          onChange={(e) => updateLine(it.inventoryId, { description: e.target.value })}
          className={`w-full min-w-32 px-1.5 py-0.5 rounded border outline-none focus:ring-1 focus:ring-blue-500 ${c.input}`} />
      ),
    },
  ];

  const detailSupplier = supplierById.get(form.supplierId);
  const viewedWarehouse = viewed ? warehouses.find((w) => String(w.id) === viewed.whId)?.location || '-' : '';
  const isCredit = form.paymentType !== 'CASH';
  const dueDate = dueDateFromTerm(form.mrDate, form.longTerm);

  // Totals: a saved receipt shows its stored amounts until its header is changed; then the preview of "Apply  Changes"
  const lineSubtotals = detailItems.map((it) => it.subtotal);
  const subtotal = lineSubtotals.some((v) => v == null) ? null : lineSubtotals.reduce<number>((s, v) => s + (v as number), 0);
  const computed = subtotal == null ? null : receiptHeaderAmounts({
    subtotal, disc1: form.discPercentage, isMultiDisc: form.isMultiDisc, disc2: form.disc2, disc3: form.disc3,
    ppnPercentage: form.ppnPercentage, downPayment: form.downPayment,
  });
  const totals = viewed && !isDirty
    ? {
        discValue: viewed.discValue,
        ppnValue: viewed.ppnValue,
        grandTotal: viewed.grandTotal,
        balance: viewed.grandTotal == null ? null : viewed.grandTotal - (viewed.downPayment ?? 0),
      }
    : computed ?? { discValue: null, ppnValue: null, grandTotal: null, balance: null };
  // New lines are typed by the user, so they always see their own amounts
  const shown = (v: number | null | undefined) => (viewed ? money(v) : fmtN0(v ?? 0));
  const canCashPay = viewed !== null && !viewed.isPaid && !viewed.hasPayment && !isDirty && (viewed.grandTotal == null || viewed.grandTotal - (viewed.downPayment ?? 0) > 0);

  const toastStack = (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto px-4 py-3 rounded shadow-xl border text-xs font-bold flex items-center gap-2.5 ${
            t.type === 'success'
              ? 'bg-emerald-700 text-white border-emerald-800'
              : t.type === 'error'
              ? 'bg-rose-700 text-white border-rose-800'
              : t.type === 'warning'
              ? 'bg-amber-700 text-white border-amber-800'
              : 'bg-indigo-700 text-white border-indigo-800'
          }`}
        >
          {t.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0" />}
          {t.type === 'error' && <XCircle className="w-4 h-4 shrink-0" />}
          {t.type === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0" />}
          {t.type === 'info' && <Zap className="w-4 h-4 shrink-0" />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );

  // The old report always printed today's receipts (its constructor ignored the date passed in)
  const dailyReport = isDailyReportOpen && (
    <DailyReportDialog isDark={isDark} date={getTodayBangkok()} variant="summary" onClose={() => setIsDailyReportOpen(false)} />
  );

  // ---- List view ----
  if (viewMode === 'list') {
    return (
      <LegacyWindow
        title="Penerimaan Barang"
        isDark={isDark}
        toolbar={
          <>
            <div className="w-52">
              <FieldRow label="Date Start" isDark={isDark} labelWidth="w-auto">
                <LegacyInput isDark={isDark} type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
              </FieldRow>
            </div>
            <div className="w-52">
              <FieldRow label="Date End" isDark={isDark} labelWidth="w-auto">
                <LegacyInput isDark={isDark} type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
              </FieldRow>
            </div>
            <PaidToggle isDark={isDark} checked={showPaid} onChange={setShowPaid} />
            <LegacyButton isDark={isDark} onClick={() => setIsDailyReportOpen(true)}>Daily Report</LegacyButton>
            <div className="w-64">
              <LegacyInput isDark={isDark} placeholder="Search No. MR / Supplier..." value={listSearch} onChange={(e) => setListSearch(e.target.value)} />
            </div>
            <LegacyButton isDark={isDark} onClick={reloadReceipts} icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />}>
              Refresh
            </LegacyButton>
            <LegacyButton isDark={isDark} variant="primary" onClick={handleNew}>New</LegacyButton>
          </>
        }
      >
        {toastStack}
        <LegacyGrid
          isDark={isDark}
          columns={listColumns}
          rows={sortedReceipts}
          rowKey={(r) => r.id}
          loading={isLoadingList || isLoadingDetail}
          emptyText="Tidak ada penerimaan pada rentang tanggal ini."
          focusedKey={focusedId}
          onRowClick={(r) => setFocusedId(r.id)}
          onRowDoubleClick={(r) => loadReceipt(r.id)}
          sort={sortField ? { key: sortField, order: sortOrder } : null}
          onSort={handleSort}
          showFooter
        />
        <LegacyPager
          isDark={isDark}
          page={page}
          totalPages={totalPages}
          total={totalRows}
          shown={receiptsList.length}
          onPage={setPage}
          pageSize={pageSize}
          onPageSize={setPageSize}
          unit="nota"
        />
        {dailyReport}
        {confirmDialogEl}
      </LegacyWindow>
    );
  }

  // Supplier / warehouse of a saved receipt may be inactive (not in the lookups); keep it selectable
  const supplierOptions = viewed && viewed.supplierId && !supplierById.has(viewed.supplierId)
    ? [{ id: viewed.supplierId, label: viewed.supplierName }, ...suppliersList.map((s) => ({ id: String(s.id), label: `${s.supplierName} (${s.supplierNo})` }))]
    : suppliersList.map((s) => ({ id: String(s.id), label: `${s.supplierName} (${s.supplierNo})` }));
  const warehouseOptions = viewed && viewed.whId && !warehouses.some((w) => String(w.id) === viewed.whId)
    ? [{ id: viewed.whId, label: viewedWarehouse }, ...warehouses.map((w) => ({ id: String(w.id), label: w.location }))]
    : warehouses.map((w) => ({ id: String(w.id), label: w.location }));
  const ro = !canEditHeader;

  // ---- Detail view (same window) ----
  return (
    <LegacyWindow title="Penerimaan Barang" isDark={isDark}>
      {toastStack}
      <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-auto">
        {/* Header fields */}
        <div className={`px-2 py-2 border rounded grid grid-cols-1 lg:grid-cols-3 gap-x-6 gap-y-2 ${c.panel}`}>
          <div className="flex flex-col gap-2">
            <FieldRow label="No. Order :" isDark={isDark} labelWidth="w-24">
              <LegacyInput isDark={isDark} readOnly value={viewed ? viewed.mrNo : mrNo} className="font-mono" />
            </FieldRow>
            <FieldRow label="Tanggal :" isDark={isDark} labelWidth="w-24">
              <LegacyInput isDark={isDark} type="date" readOnly={ro} value={form.mrDate} onChange={(e) => e.target.value && setField('mrDate', e.target.value)} />
            </FieldRow>
            <FieldRow label="Keterangan :" isDark={isDark} labelWidth="w-24">
              <LegacyInput isDark={isDark} readOnly={ro} value={form.description} onChange={(e) => setField('description', e.target.value)} />
            </FieldRow>
          </div>
          <div className="flex flex-col gap-2">
            <FieldRow label="Gudang :" isDark={isDark} labelWidth="w-24">
              <LegacySelect isDark={isDark} disabled={ro} value={form.whId} onChange={(e) => setField('whId', e.target.value)}>
                <option value="" disabled>-- Pilih Tujuan Gudang --</option>
                {warehouseOptions.map((w) => (
                  <option key={w.id} value={w.id}>{w.label}</option>
                ))}
              </LegacySelect>
            </FieldRow>
          </div>
          <div className="flex flex-col gap-2">
            <FieldRow label="Supplier :" isDark={isDark} labelWidth="w-24">
              <LegacySelect isDark={isDark} disabled={ro} value={form.supplierId} onChange={(e) => setField('supplierId', e.target.value)}>
                {supplierOptions.map((sup) => (
                  <option key={sup.id} value={sup.id}>{sup.label}</option>
                ))}
              </LegacySelect>
              {/* Old supplier lookup "add new" button opened Frm_InputSupplier */}
              <LegacyButton isDark={isDark} onClick={() => setIsAddSupplierOpen(true)} disabled={ro} title="Tambah Supplier" aria-label="Tambah Supplier"
                icon={<Plus className="w-3.5 h-3.5" />} className="px-1.5" />
            </FieldRow>
            <FieldRow label="Alamat Supp. :" isDark={isDark} labelWidth="w-24">
              <LegacyInput isDark={isDark} readOnly value={detailSupplier?.address || ''} />
            </FieldRow>
            <FieldRow label="Kota Supp. :" isDark={isDark} labelWidth="w-24">
              <LegacyInput isDark={isDark} readOnly value={detailSupplier?.city || ''} />
            </FieldRow>
          </div>
        </div>

        {/* Old button row: Back | # qty + barcode | Refresh Supplier | Recreate Invoice | Submit Header ... Apply  Changes */}
        <div className="flex flex-wrap items-center gap-2">
          <LegacyButton isDark={isDark} onClick={handleBack}>Back</LegacyButton>
          {!isViewing && (
            <>
              <span className={`shrink-0 ${c.muted}`}>#</span>
              <LegacyInput isDark={isDark} type="number" min={1} value={entryQty} aria-label="Qty"
                onChange={(e) => setEntryQty(parseInt(e.target.value) || 1)} className="w-16 flex-none text-right" />
              <div className="relative flex-1 min-w-48">
                <LegacyInput
                  ref={barcodeInputRef}
                  isDark={isDark}
                  placeholder="Scan Barcode / Cari Barang (SKU/Nama)... [/]"
                  value={productSearch}
                  onChange={(e) => {
                    const val = e.target.value;
                    setProductSearch(val);
                    if (!val.trim()) setSearchResults([]);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleProductSearchEnter();
                    } else if (e.key === 'Escape') {
                      setSearchResults([]);
                    }
                  }}
                  className="pr-7"
                />
                {isSearchingProduct && (
                  <RefreshCw className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-blue-500" />
                )}
                {searchResults.length > 0 && (
                  <div className={`absolute left-0 right-0 top-full mt-1 z-40 rounded border shadow-xl max-h-64 overflow-y-auto ${c.panel}`}>
                    {searchResults.map((prod) => (
                      <div key={prod.id} onClick={() => handleAddProductToItems(prod)}
                        className={`px-3 py-1.5 border-b last:border-b-0 cursor-pointer ${c.border} ${c.rowHover}`}>
                        <div className="font-semibold">{prod.inventoryName}</div>
                        <div className={`text-[11px] font-mono ${c.muted}`}>
                          SKU: {prod.inventoryNo}{canViewPrice ? ` | Harga Beli: ${fmtN0(prod.priceBuy || prod.hpp || 0)}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
          <LegacyButton isDark={isDark} onClick={() => setSupplierReloadKey((k) => k + 1)} title="Refresh Supplier" aria-label="Refresh Supplier"
            icon={<RefreshCw className="w-3.5 h-3.5" />} className="px-1.5" />
          {isViewing && <LegacyButton isDark={isDark} onClick={handleRecreateInvoice}>Recreate Invoice</LegacyButton>}
          {!isViewing && (
            <LegacyButton isDark={isDark} variant="primary" onClick={handleSubmitReceipt} disabled={isSubmitting}>
              {isSubmitting ? 'Menyimpan...' : 'Submit Header'}
            </LegacyButton>
          )}
          {isViewing && (
            <LegacyButton isDark={isDark} variant="primary" className="ml-auto whitespace-pre" onClick={handleApplyChanges}
              disabled={isSubmitting || !isDirty || !canEditHeader}
              title={canEditHeader ? undefined : 'Nota sudah dibayar (Cash Payment), tidak bisa diubah'}>
              {isSubmitting ? 'Menyimpan...' : 'Apply  Changes'}
            </LegacyButton>
          )}
        </div>

        <div className="flex-1 min-h-[360px] flex flex-col lg:flex-row gap-2">
          {/* Items */}
          <div className="flex-1 min-w-0 min-h-[320px] flex flex-col gap-2">
            <LegacyGrid
              isDark={isDark}
              columns={detailColumns}
              rows={detailItems}
              rowKey={(it) => it.inventoryId}
              loading={isLoadingDetail}
              emptyText={isViewing ? 'Tidak ada barang.' : 'Belum ada barang diinput. Scan barcode atau cari barang di atas.'}
              onRowContextMenu={isViewing ? undefined : (it, e) => setItemMenu(menuAt(e, it, 1))}
            />
            <span className="font-semibold">{detailItems.length} Jenis</span>
          </div>

          {/* Right column: payment / discount / PPn group, Cash Payment, totals group ".::." */}
          <div className="lg:w-[22rem] shrink-0 flex flex-col gap-2">
            <div className={`px-2 py-2 border rounded flex flex-col gap-2 ${c.panel}`}>
              <FieldRow label="Pembayaran :" isDark={isDark} labelWidth="w-24">
                <LegacySelect isDark={isDark} disabled={ro} value={form.paymentType} onChange={(e) => setField('paymentType', e.target.value)}>
                  <option value="CASH">Cash</option>
                  <option value="TEMPO">Credit</option>
                </LegacySelect>
              </FieldRow>
              {/* Old LCItem_LongTerm / "Hari" / due date: shown for Credit only */}
              {isCredit && (
                <FieldRow label="Lama Termin :" isDark={isDark} labelWidth="w-24">
                  <IntegerCellInput value={form.longTerm} min={0} label="Lama Termin" disabled={ro}
                    onChange={(v) => setField('longTerm', v)} className={`w-16 flex-none ${numInput}`} />
                  <span className="shrink-0">Hari</span>
                  <LegacyInput isDark={isDark} readOnly aria-label="Jatuh Tempo" value={fmtDate(dueDate)} />
                </FieldRow>
              )}
              <div className="flex items-center gap-2">
                <label className="w-24 shrink-0 flex items-center justify-end gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={form.isMultiDisc} disabled={ro} onChange={(e) => setField('isMultiDisc', e.target.checked)} />
                  <span>Multi Disc</span>
                </label>
                <LegacyInput isDark={isDark} readOnly aria-label="Diskon (Rp)" className="text-right tabular-nums" value={shown(totals.discValue)} />
                <span className={`shrink-0 ${c.muted}`}>PPn :</span>
                <LegacyInput isDark={isDark} type="number" min={0} max={100} readOnly={ro} aria-label="PPn (%)" className="w-14 flex-none text-right"
                  value={form.ppnPercentage} onChange={(e) => setField('ppnPercentage', Math.max(0, parseFloat(e.target.value) || 0))} />
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-24 shrink-0 text-right ${c.muted}`}>Diskon :</span>
                <LegacyInput isDark={isDark} type="number" min={0} max={100} readOnly={ro} aria-label="Diskon (%)" className="w-14 flex-none text-right"
                  value={form.discPercentage} onChange={(e) => setField('discPercentage', Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))} />
                {/* Disc 2 / Disc 3 count only with Multi Disc */}
                <LegacyInput isDark={isDark} type="number" min={0} max={100} disabled={ro || !form.isMultiDisc} aria-label="Diskon 2 (%)" className="w-14 flex-none text-right"
                  value={form.disc2} onChange={(e) => setField('disc2', Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))} />
                <LegacyInput isDark={isDark} type="number" min={0} max={100} disabled={ro || !form.isMultiDisc} aria-label="Diskon 3 (%)" className="w-14 flex-none text-right"
                  value={form.disc3} onChange={(e) => setField('disc3', Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))} />
                <LegacyInput isDark={isDark} readOnly aria-label="PPn (Rp)" className="text-right tabular-nums" value={shown(totals.ppnValue)} />
              </div>
            </div>

            {isViewing && (
              <LegacyButton isDark={isDark} className="w-full justify-center" onClick={() => setIsCashPaymentOpen(true)} disabled={!canCashPay}
                title={viewed?.isPaid ? 'Nota sudah lunas' : undefined}>
                Cash Payment
              </LegacyButton>
            )}

            <GroupBox caption=".::." isDark={isDark}>
              <div className="p-2 flex flex-col gap-2">
                <FieldRow label="Sub Total :" isDark={isDark} labelWidth="w-32">
                  <LegacyInput isDark={isDark} readOnly className="text-right tabular-nums" value={shown(subtotal)} />
                </FieldRow>
                <FieldRow label="Diskon :" isDark={isDark} labelWidth="w-32">
                  <LegacyInput isDark={isDark} readOnly className="text-right tabular-nums" value={shown(totals.discValue)} />
                </FieldRow>
                <FieldRow label="Total Keseluruhan :" isDark={isDark} labelWidth="w-32">
                  <LegacyInput isDark={isDark} readOnly className="text-right tabular-nums font-bold" value={shown(totals.grandTotal)} />
                </FieldRow>
                <FieldRow label="Uang Muka :" isDark={isDark} labelWidth="w-32">
                  {viewed && !canViewPrice ? (
                    <LegacyInput isDark={isDark} readOnly aria-label="Uang Muka" className="text-right tabular-nums" value={MASK} />
                  ) : (
                    <LegacyInput isDark={isDark} type="number" min={0} readOnly={ro} aria-label="Uang Muka" className="text-right tabular-nums"
                      value={form.downPayment} onChange={(e) => setField('downPayment', Math.max(0, parseFloat(e.target.value) || 0))} />
                  )}
                </FieldRow>
                <FieldRow label="Saldo Terhutang :" isDark={isDark} labelWidth="w-32">
                  <LegacyInput isDark={isDark} readOnly className="text-right tabular-nums font-bold" value={shown(totals.balance)} />
                </FieldRow>
              </div>
            </GroupBox>
          </div>
        </div>

        {/* Old bottom row: Lihat Stok (left) ... Lunas + Cetak (right) */}
        <div className="flex flex-wrap items-center gap-2">
          <LegacyButton isDark={isDark} className="flex-1 max-w-xl justify-center" disabled={detailItems.length === 0}
            onClick={() => setStockIds(Array.from(new Set(detailItems.map((it) => it.stockId).filter(Boolean))))}>
            Lihat Stok
          </LegacyButton>
          {isViewing && (
            <div className="ml-auto flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={printLunas} onChange={(e) => setPrintLunas(e.target.checked)} />
                <span>Lunas</span>
              </label>
              <LegacyButton isDark={isDark} onClick={() => setIsPrintModalOpen(true)} icon={<Printer className="w-3.5 h-3.5" />}>Cetak</LegacyButton>
            </div>
          )}
        </div>
      </div>

      {itemMenu && (
        <ContextMenu
          isDark={isDark}
          x={itemMenu.x}
          y={itemMenu.y}
          onClose={closeItemMenu}
          items={[
            {
              label: 'Hapus',
              icon: <Trash2 className="w-3.5 h-3.5" />,
              danger: true,
              onClick: () => setItems((prev) => prev.filter((it) => it.inventoryId !== itemMenu.row.inventoryId)),
            },
          ]}
        />
      )}
      {/* Print voucher of the saved receipt (prices masked for non-admins, as the server sends them) */}
      {isPrintModalOpen && viewed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded border shadow-2xl ${c.panel}`}>
            <div className={`px-4 py-2 border-b flex items-center justify-between gap-2 print:hidden ${c.bar}`}>
              <span className="font-bold text-sm">Nota Bukti Penerimaan Barang & HPP Update</span>
              <div className="flex items-center gap-2">
                <LegacyButton isDark={isDark} variant="primary" onClick={() => window.print()} icon={<Printer className="w-3.5 h-3.5" />}>
                  Cetak Nota Official
                </LegacyButton>
                <LegacyButton isDark={isDark} onClick={() => setIsPrintModalOpen(false)} aria-label="Tutup" icon={<X className="w-3.5 h-3.5" />} />
              </div>
            </div>

            <div className="printable-priced-voucher relative p-6 flex flex-col gap-5 text-xs bg-white text-slate-900">
              <style>{`
                @media print {
                  body {
                    background: white !important;
                    color: black !important;
                  }
                  body * {
                    visibility: hidden !important;
                  }
                  .printable-priced-voucher, .printable-priced-voucher * {
                    visibility: visible !important;
                    color: black !important;
                  }
                  .printable-priced-voucher {
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    padding: 20px !important;
                    background: white !important;
                    box-shadow: none !important;
                    border: none !important;
                  }
                  .no-print, .print\\:hidden, button {
                    display: none !important;
                  }
                }
              `}</style>
              {printLunas && (
                <div className="absolute right-8 top-20 rotate-[-12deg] border-4 border-emerald-700 text-emerald-700 px-4 py-1 text-2xl font-black tracking-widest opacity-80">
                  LUNAS
                </div>
              )}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-base font-bold">HARMONY KITCHEN ERP</h2>
                  <p className="text-[11px] text-slate-600">FAKTUR PENERIMAAN BARANG DENGAN HARGA (PURCHASING)</p>
                </div>
                <div className="text-right font-mono">
                  <div className="text-sm font-bold">{viewed.mrNo}</div>
                  <div className="text-[11px] text-slate-600">{fmtDate(viewed.mrDate)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-3 border border-slate-300 rounded">
                <div>
                  <div className="text-[10px] font-bold text-slate-500">Supplier :</div>
                  <div className="font-bold text-sm">{supplierById.get(viewed.supplierId)?.supplierName || viewed.supplierName}</div>
                </div>
                <div>
                  <div className="font-semibold">
                    Pembayaran : {viewed.paymentType === 'CASH' ? 'Cash' : 'Credit'}
                    {viewed.paymentType !== 'CASH' && viewed.dueDate ? ` | Jatuh Tempo : ${fmtDate(viewed.dueDate)}` : ''}
                  </div>
                  <div className="font-semibold">Gudang : {viewedWarehouse}</div>
                </div>
              </div>

              <table className="w-full border-collapse border border-slate-300">
                <thead className="bg-slate-100 font-bold text-[10px]">
                  <tr>
                    <th className="p-1.5 text-center border border-slate-300">No</th>
                    <th className="p-1.5 text-left border border-slate-300">Kode</th>
                    <th className="p-1.5 text-left border border-slate-300">Barang</th>
                    <th className="p-1.5 text-center border border-slate-300">Satuan</th>
                    <th className="p-1.5 text-right border border-slate-300">Qty</th>
                    <th className="p-1.5 text-right border border-slate-300">Harga</th>
                    <th className="p-1.5 text-right border border-slate-300">Disc 1(%)</th>
                    <th className="p-1.5 text-right border border-slate-300">Disc 2(%)</th>
                    <th className="p-1.5 text-right border border-slate-300">Disc 3(%)</th>
                    <th className="p-1.5 text-right border border-slate-300">Disc (Rp)</th>
                    <th className="p-1.5 text-right border border-slate-300">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {viewed.items.map((it, idx) => (
                    <tr key={it.inventoryId}>
                      <td className="p-1.5 text-center border border-slate-300 font-mono">{idx + 1}</td>
                      <td className="p-1.5 border border-slate-300 font-mono">{it.inventoryNo || '-'}</td>
                      <td className="p-1.5 border border-slate-300 font-semibold">{it.inventoryName}</td>
                      <td className="p-1.5 text-center border border-slate-300">{it.uomName}</td>
                      <td className="p-1.5 text-right border border-slate-300 tabular-nums">{fmtN0(it.qty)}</td>
                      <td className="p-1.5 text-right border border-slate-300 tabular-nums">{money(it.price)}</td>
                      <td className="p-1.5 text-right border border-slate-300 tabular-nums">{it.discPercentage ? `${it.discPercentage}%` : '-'}</td>
                      <td className="p-1.5 text-right border border-slate-300 tabular-nums">{it.disc2 ? `${it.disc2}%` : '-'}</td>
                      <td className="p-1.5 text-right border border-slate-300 tabular-nums">{it.disc3 ? `${it.disc3}%` : '-'}</td>
                      <td className="p-1.5 text-right border border-slate-300 tabular-nums">{it.discRp === 0 ? '-' : money(it.discRp)}</td>
                      <td className="p-1.5 text-right border border-slate-300 tabular-nums font-semibold">{money(it.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end">
                <div className="w-64 flex flex-col gap-1 border border-slate-300 rounded p-3 font-semibold">
                  <div className="flex justify-between"><span>Diskon :</span><span>{money(viewed.discValue)}</span></div>
                  <div className="flex justify-between"><span>PPn ({viewed.ppnPercentage}%) :</span><span>{money(viewed.ppnValue)}</span></div>
                  <div className="flex justify-between pt-1 border-t border-slate-300 text-sm font-bold">
                    <span>Total Keseluruhan :</span><span>{money(viewed.grandTotal)}</span>
                  </div>
                  <div className="flex justify-between"><span>Uang Muka :</span><span>{money(viewed.downPayment)}</span></div>
                  <div className="flex justify-between font-bold">
                    <span>Saldo Terhutang :</span><span>{money(viewed.grandTotal == null ? null : viewed.grandTotal - (viewed.downPayment ?? 0))}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-10 text-center font-bold text-[11px] text-slate-700">
                <div>
                  <div className="mb-12">Dibuat Oleh (Purchasing)</div>
                  <div className="border-t border-slate-400 pt-1 font-normal">( ........................ )</div>
                </div>
                <div>
                  <div className="mb-12">Disetujui (Manager)</div>
                  <div className="border-t border-slate-400 pt-1 font-normal">( ........................ )</div>
                </div>
                <div>
                  <div className="mb-12">Pemasok / Supplier</div>
                  <div className="border-t border-slate-400 pt-1 font-normal">( ........................ )</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {isAddSupplierOpen && (
        <InputSupplierDialog
          isDark={isDark}
          onClose={() => setIsAddSupplierOpen(false)}
          onError={(msg) => addToast(msg, 'error')}
          onSaved={(sup) => {
            setIsAddSupplierOpen(false);
            addToast('Success On Save Supplier', 'success');
            setField('supplierId', String(sup.id));
            setSupplierReloadKey((k) => k + 1);
          }}
        />
      )}
      {isCashPaymentOpen && viewed && (
        <CashPaymentDialog
          isDark={isDark}
          receiptId={viewed.id}
          mrNo={viewed.mrNo}
          mrDate={fmtDate(viewed.mrDate)}
          supplierName={supplierById.get(viewed.supplierId)?.supplierName || viewed.supplierName}
          balance={canViewPrice && viewed.grandTotal != null ? viewed.grandTotal - (viewed.downPayment ?? 0) : null}
          onClose={() => setIsCashPaymentOpen(false)}
          onPaid={handleCashPaid}
          onError={(msg) => addToast(msg, 'error')}
        />
      )}
      {stockIds && <StockDialog isDark={isDark} inventoryIds={stockIds} onClose={() => setStockIds(null)} />}
      {confirmDialogEl}
    </LegacyWindow>
  );
}

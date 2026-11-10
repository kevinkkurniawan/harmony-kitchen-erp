'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RefreshCw, Trash2, CheckCircle, XCircle, AlertTriangle, Zap } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { searchInventory, lookupInventoryByScan } from '@/lib/inventory-lookup';
import { getTodayBangkok } from '@/lib/date-utils';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import IntegerCellInput from '@/components/IntegerCellInput';
import { InputSupplierDialog, DailyReportDialog, PaidToggle } from '@/components/PenerimaanBarangDialogs';
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
  fmtDate,
  lx,
  type LegacyColumn,
  type ContextMenuState,
} from '@/components/legacy';
import { ERPProduct, Supplier } from '@/types/erp';

export interface ExpressReceiptItem {
  inventoryId: string;
  barcode: string;
  inventoryNo: string;
  inventoryName: string;
  uomName: string;
  qty: number;
  description: string;
}

/** One row of GET /api/purchasing/express (only the fields this page shows). */
export interface ExpressReceiptHeader {
  id: number;
  mrNo: string;
  mrDate: string;
  supplierId: string;
  supplierName: string;
  description: string;
}

/** A saved receipt shown read-only in the detail group. */
interface ViewedReceipt {
  id: number;
  mrNo: string;
  mrDate: string;
  supplierId: string;
  supplierName: string;
  whId: string;
  description: string;
  items: ExpressReceiptItem[];
}

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

interface PenerimaanBarangEkspressManagerProps {
  canViewPrice?: boolean;
  isDark: boolean;
}

const PAGE_SIZE_DEFAULT = 100;

// Default list range: the last 30 days up to today (Bangkok time)
function daysAgoBangkok(days: number): string {
  const d = new Date(`${getTodayBangkok()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Legacy Mod_Purchasing.Frm_PurchaseReceivementNoPrice: receipt list and detail side by side in one window. */
export default function PenerimaanBarangEkspressManager({ isDark }: PenerimaanBarangEkspressManagerProps) {
  const c = lx(isDark);
  const { confirmDialog, dialog: confirmDialogEl } = useConfirmDialog(isDark);

  // List group ("No. Nota Penerimaan")
  const [receiptsList, setReceiptsList] = useState<ExpressReceiptHeader[]>([]);
  const [dateStart, setDateStartRaw] = useState<string>(() => daysAgoBangkok(30));
  const [dateEnd, setDateEndRaw] = useState<string>(() => getTodayBangkok());
  const [listSearch, setListSearchRaw] = useState<string>('');
  const debouncedListSearch = useDebounce(listSearch, 500);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(PAGE_SIZE_DEFAULT);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showPaid, setShowPaidRaw] = useState(false);
  // Filters change the result set, so paging restarts at page 1
  const withPageReset = <T,>(set: (v: T) => void) => (v: T) => { setPage(1); set(v); };
  const setDateStart = withPageReset(setDateStartRaw);
  const setDateEnd = withPageReset(setDateEndRaw);
  const setListSearch = withPageReset(setListSearchRaw);
  const setPageSize = withPageReset(setPageSizeRaw);
  const setShowPaid = withPageReset(setShowPaidRaw);
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);
  const [sortField, setSortField] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  // Old ToggleSwitch1: off = "Belum Terbayar", on = "Terbayar" (t_materialreceiveheader.ispaid)
  const [isDailyReportOpen, setIsDailyReportOpen] = useState(false);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [supplierReloadKey, setSupplierReloadKey] = useState(0);

  // Detail group: a new receipt being entered, or a saved one shown read-only
  const [viewed, setViewed] = useState<ViewedReceipt | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // New receipt header
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [warehouses, setWarehouses] = useState<{ id: number; whCode: string; location: string }[]>([]);
  const [whId, setWhId] = useState<string>('');
  const [mrDate, setMrDate] = useState<string>(() => getTodayBangkok());
  const [headerDesc, setHeaderDesc] = useState<string>('');

  // Item entry: "#" qty + barcode / name search
  const [items, setItems] = useState<ExpressReceiptItem[]>([]);
  const [entryQty, setEntryQty] = useState<number>(1);
  const [productSearch, setProductSearch] = useState<string>('');
  const debouncedProductSearch = useDebounce(productSearch, 500);
  const [searchResults, setSearchResults] = useState<ERPProduct[]>([]);
  const [isSearchingProduct, setIsSearchingProduct] = useState<boolean>(false);
  const [itemMenu, setItemMenu] = useState<ContextMenuState<ExpressReceiptItem> | null>(null);
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

  // Fetch the receipt list for the date range (server-side mrdate range filter) and search text
  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoadingList(true);
      try {
        const params = new URLSearchParams({ q: debouncedListSearch, page: String(page), limit: String(pageSize), paid: String(showPaid) });
        if (dateStart) params.set('start_mrdate', dateStart);
        if (dateEnd) params.set('end_mrdate', dateEnd);
        const res = await fetch(`/api/purchasing/express?${params}`);
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data)) {
          setReceiptsList(json.data);
          setTotalRows(json.pagination?.total ?? json.data.length);
          setTotalPages(json.pagination?.totalPages ?? 1);
        } else if (isMounted && !json.success) {
          addToast(typeof json.error === 'string' ? json.error : json.error?.message || 'Gagal memuat daftar penerimaan', 'error');
        }
      } catch (err) {
        console.error('Error fetching express receipts:', err);
      } finally {
        if (isMounted) setIsLoadingList(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [debouncedListSearch, dateStart, dateEnd, page, pageSize, reloadKey, showPaid, addToast]);

  const reloadReceipts = () => setReloadKey((k) => k + 1);

  // Suppliers for the detail group; "Refresh Supplier" reloads them and keeps the chosen one when it still exists
  useEffect(() => {
    let isMounted = true;
    fetch('/api/suppliers?onlyActive=true&all=true')
      .then((res) => res.json())
      .then((supJson) => {
        if (!isMounted || !supJson.success || !Array.isArray(supJson.data)) return;
        const list: Supplier[] = supJson.data;
        setSuppliersList(list);
        setSelectedSupplierId((prev) => (list.some((s) => String(s.id) === prev) ? prev : list.length > 0 ? String(list[0].id) : ''));
      })
      .catch((err) => console.error('Error fetching suppliers:', err));
    return () => { isMounted = false; };
  }, [supplierReloadKey]);

  // Warehouses for the detail group
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const lookupRes = await fetch('/api/inventory/lookups');
        const lookupJson = await lookupRes.json();

        if (isMounted) {
          if (lookupJson.success && lookupJson.data?.warehouses) {
            setWarehouses(lookupJson.data.warehouses);
            if (lookupJson.data.warehouses.length > 0) {
              setWhId(lookupJson.data.warehouses[0].id.toString());
            }
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    }
    loadData();
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
    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => String(i.inventoryId) === String(prod.id));
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], qty: updated[existingIndex].qty + addQty };
        return updated;
      }
      return [
        ...prev,
        {
          inventoryId: String(prod.id),
          barcode: prod.barcode || '',
          inventoryNo: prod.inventoryNo || '',
          inventoryName: prod.inventoryName,
          uomName: prod.uomName || 'PCS',
          qty: addQty,
          description: '',
        },
      ];
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

  // Leaving an unsaved new receipt asks first, so typed lines are not lost by a stray click
  const confirmDiscardNew = async () => {
    if (viewed || items.length === 0) return true;
    return confirmDialog('Barang yang sudah diinput belum disimpan. Buang input ini?', { title: 'Penerimaan Barang', confirmText: 'Buang' });
  };

  // "New": empty detail group ready for input
  const handleNew = async () => {
    if (!(await confirmDiscardNew())) return;
    setViewed(null);
    setItems([]);
    setHeaderDesc('');
    setMrDate(getTodayBangkok());
    setEntryQty(1);
    setProductSearch('');
    setSearchResults([]);
    setTimeout(() => barcodeInputRef.current?.focus(), 0);
  };

  // "Recreate Invoice": close the shown receipt and start the next one on the same date (old SB_CreateNew_Click)
  const handleRecreateInvoice = () => {
    const date = viewed?.mrDate && viewed.mrDate !== '-' ? viewed.mrDate : getTodayBangkok();
    setViewed(null);
    setItems([]);
    setHeaderDesc('');
    setMrDate(date);
    setEntryQty(1);
    setProductSearch('');
    setSearchResults([]);
    setTimeout(() => barcodeInputRef.current?.focus(), 0);
  };

  // Show a saved receipt read-only in the detail group
  const loadReceipt = async (id: number) => {
    setIsLoadingDetail(true);
    try {
      const res = await fetch(`/api/purchasing/express/${id}`);
      const json = await res.json();
      if (json.success) {
        const d = json.data;
        setViewed({
          id: Number(d.id),
          mrNo: d.mr_no || '-',
          mrDate: d.mr_date || '',
          supplierId: d.supplier_id != null ? String(d.supplier_id) : '',
          supplierName: d.supplier_name || '-',
          whId: d.wh_id != null ? String(d.wh_id) : '',
          description: d.description && d.description !== '-' ? d.description : '',
          items: (d.items || []).map((it: any) => ({
            inventoryId: String(it.id),
            inventoryNo: it.inventory_no || '',
            inventoryName: it.inventory_name || '-',
            uomName: it.uom_name || 'PCS',
            qty: Number(it.qty) || 0,
            barcode: it.barcode || '',
            description: it.description || '',
          })),
        });
      } else {
        addToast(json.error?.message || 'Gagal memuat detail penerimaan', 'error');
      }
    } catch (err) {
      console.error('Error viewing receipt detail:', err);
      addToast('Gagal memuat detail penerimaan', 'error');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleOpenReceipt = async (row: ExpressReceiptHeader) => {
    if (viewed?.id === row.id) return;
    if (!(await confirmDiscardNew())) return;
    loadReceipt(row.id);
  };

  // Keyboard shortcuts: Alt+N = New, "/" = focus the barcode input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName);
      if (e.key === '/' && !viewed && !isInputFocused) {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNew();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // "Input Nota": save the receipt (adds stock), then show it read-only
  const handleSubmitReceipt = async () => {
    if (items.length === 0) {
      return addToast('Wajib menginput minimal 1 item barang yang diterima', 'warning');
    }
    setIsSubmitting(true);
    try {
      const payload = {
        mr_no: '',
        mr_date: mrDate,
        supplier_id: selectedSupplierId,
        supplier_name: supplierById.get(selectedSupplierId)?.supplierName || '',
        wh_id: whId,
        description: headerDesc,
        items,
      };

      const res = await fetch('/api/purchasing/express', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        addToast(json.message, 'success');
        setItems([]);
        setHeaderDesc('');
        reloadReceipts();
        if (json.id) await loadReceipt(Number(json.id));
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

  // Old rows may have no stored supplier name; fall back to the supplier master by id
  const supplierLabel = useCallback(
    (row: ExpressReceiptHeader) =>
      row.supplierName && row.supplierName !== '-' ? row.supplierName : supplierById.get(String(row.supplierId))?.supplierName || '-',
    [supplierById],
  );

  // Local sort of the current page (header click)
  const sortedReceipts = useMemo(() => {
    if (!sortField) return receiptsList;
    const val = (r: ExpressReceiptHeader) => (sortField === 'supplier' ? supplierLabel(r) : String((r as any)[sortField] ?? '')).toLowerCase();
    return [...receiptsList].sort((a, b) => {
      const cmp = val(a).localeCompare(val(b));
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

  // Legacy GV_Header columns
  const listColumns: LegacyColumn<ExpressReceiptHeader>[] = [
    { key: 'mrNo', caption: 'MR No', sortKey: 'mrNo' },
    { key: 'mrDate', caption: 'MR Date', format: 'date', sortKey: 'mrDate' },
    { key: 'supplier', caption: 'Supplier', sortKey: 'supplier', render: supplierLabel },
    { key: 'description', caption: 'Keterangan', render: (r) => (r.description === '-' ? '' : r.description) },
  ];

  const isViewing = viewed !== null;
  const detailItems = viewed ? viewed.items : items;

  // Legacy GV_Detail columns (Harga is hidden on this no-price form)
  const detailColumns: LegacyColumn<ExpressReceiptItem>[] = [
    {
      key: 'inventoryName', caption: 'Barang',
      render: (it) => (
        <span title={`${it.inventoryNo}${it.barcode ? ` | ${it.barcode}` : ''}`}>{it.inventoryName}</span>
      ),
    },
    {
      key: 'qty', caption: 'Qty', align: 'right', width: 100,
      render: (it) =>
        isViewing ? (
          it.qty.toLocaleString('id-ID')
        ) : (
          <IntegerCellInput
            value={it.qty}
            min={1}
            label={`Qty ${it.inventoryName}`}
            onChange={(val) => {
              setItems((prev) => prev.map((row) => (row.inventoryId === it.inventoryId ? { ...row, qty: val } : row)));
            }}
            className={`w-20 px-1.5 py-0.5 rounded border text-right tabular-nums outline-none focus:ring-1 focus:ring-blue-500 ${c.input}`}
          />
        ),
    },
    {
      key: 'description', caption: 'Description',
      render: (it) =>
        isViewing ? (
          it.description
        ) : (
          <input
            type="text"
            value={it.description}
            aria-label={`Description ${it.inventoryName}`}
            onChange={(e) => {
              const val = e.target.value;
              setItems((prev) => prev.map((row) => (row.inventoryId === it.inventoryId ? { ...row, description: val } : row)));
            }}
            className={`w-full min-w-40 px-1.5 py-0.5 rounded border outline-none focus:ring-1 focus:ring-blue-500 ${c.input}`}
          />
        ),
    },
  ];

  const detailSupplier = viewed ? supplierById.get(viewed.supplierId) : supplierById.get(selectedSupplierId);
  const viewedWarehouse = viewed ? warehouses.find((w) => String(w.id) === viewed.whId)?.location || '-' : '';

  return (
    <LegacyWindow title="Penerimaan Barang" isDark={isDark}>
      {/* Toasts */}
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

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2 overflow-auto lg:overflow-hidden">
        {/* Left group: receipt list */}
        <GroupBox caption="No. Nota Penerimaan" isDark={isDark} className="lg:w-[42%] min-h-[420px] lg:min-h-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <FieldRow label="Tgl. Awal :" isDark={isDark} labelWidth="w-20">
              <LegacyInput isDark={isDark} type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
            </FieldRow>
            <FieldRow label="Tgl. Akhir :" isDark={isDark} labelWidth="w-20">
              <LegacyInput isDark={isDark} type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
            </FieldRow>
          </div>
          {/* Old row order: New ... Daily Report, then Search : + paid toggle + Refresh */}
          <div className="flex items-center justify-between gap-2">
            <LegacyButton isDark={isDark} variant="primary" onClick={handleNew}>New</LegacyButton>
            <LegacyButton isDark={isDark} onClick={() => setIsDailyReportOpen(true)}>Daily Report</LegacyButton>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-48">
              <FieldRow label="Search :" isDark={isDark} labelWidth="w-20">
                <LegacyInput isDark={isDark} placeholder="No. MR / Supplier..." value={listSearch} onChange={(e) => setListSearch(e.target.value)} />
              </FieldRow>
            </div>
            <PaidToggle isDark={isDark} checked={showPaid} onChange={setShowPaid} />
            <LegacyButton isDark={isDark} onClick={reloadReceipts} icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />}>
              Refresh
            </LegacyButton>
          </div>
          <LegacyGrid
            isDark={isDark}
            columns={listColumns}
            rows={sortedReceipts}
            rowKey={(r) => r.id}
            loading={isLoadingList}
            emptyText="Tidak ada penerimaan pada rentang tanggal ini."
            focusedKey={viewed?.id ?? null}
            onRowClick={handleOpenReceipt}
            sort={sortField ? { key: sortField, order: sortOrder } : null}
            onSort={handleSort}
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
        </GroupBox>

        {/* Right group: detail of the new or selected receipt */}
        <GroupBox
          caption=">> Detail Nota Penerimaan"
          isDark={isDark}
          className="flex-1 min-h-[480px] lg:min-h-0"
          actions={isLoadingDetail ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : undefined}
        >
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-6 gap-y-2">
            <div className="flex flex-col gap-2">
              <FieldRow label="No. Order :" isDark={isDark} labelWidth="w-24">
                <LegacyInput isDark={isDark} readOnly value={viewed ? viewed.mrNo : ''} placeholder="AUTO" className="font-mono" />
              </FieldRow>
              <FieldRow label="Tanggal :" isDark={isDark} labelWidth="w-24">
                {viewed ? (
                  <LegacyInput isDark={isDark} readOnly value={fmtDate(viewed.mrDate)} />
                ) : (
                  <LegacyInput isDark={isDark} type="date" value={mrDate} onChange={(e) => e.target.value && setMrDate(e.target.value)} />
                )}
              </FieldRow>
              <FieldRow label="Gudang :" isDark={isDark} labelWidth="w-24">
                {viewed ? (
                  <LegacyInput isDark={isDark} readOnly value={viewedWarehouse} />
                ) : (
                  <LegacySelect isDark={isDark} value={whId} onChange={(e) => setWhId(e.target.value)}>
                    <option value="" disabled>-- Pilih Tujuan Gudang --</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.location}</option>
                    ))}
                  </LegacySelect>
                )}
              </FieldRow>
              <FieldRow label="Keterangan :" isDark={isDark} labelWidth="w-24">
                <LegacyInput
                  isDark={isDark}
                  readOnly={isViewing}
                  value={viewed ? viewed.description : headerDesc}
                  onChange={(e) => setHeaderDesc(e.target.value)}
                />
              </FieldRow>
            </div>
            <div className="flex flex-col gap-2">
              <FieldRow label="Supplier :" isDark={isDark} labelWidth="w-24">
                {viewed ? (
                  <LegacyInput isDark={isDark} readOnly value={detailSupplier?.supplierName || viewed.supplierName} />
                ) : (
                  <LegacySelect isDark={isDark} value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)}>
                    {suppliersList.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.supplierName} ({sup.supplierNo})
                      </option>
                    ))}
                  </LegacySelect>
                )}
              </FieldRow>
              <FieldRow label="Alamat Supp. :" isDark={isDark} labelWidth="w-24">
                <LegacyInput isDark={isDark} readOnly value={detailSupplier?.address || ''} />
              </FieldRow>
              <FieldRow label="Kota Supp. :" isDark={isDark} labelWidth="w-24">
                <LegacyInput isDark={isDark} readOnly value={detailSupplier?.city || ''} />
              </FieldRow>
              {/* Old SB_SupRefresh ("Refresh Supplier") and SB_AddSupplier ("Tambah Supplier", only while entering a new receipt) */}
              <div className="flex flex-wrap items-center justify-end gap-2">
                <LegacyButton isDark={isDark} className="whitespace-nowrap" onClick={() => setSupplierReloadKey((k) => k + 1)} icon={<RefreshCw className="w-3.5 h-3.5" />}>
                  Refresh Supplier
                </LegacyButton>
                <LegacyButton isDark={isDark} className="whitespace-nowrap" onClick={() => setIsAddSupplierOpen(true)} disabled={isViewing}>Tambah Supplier</LegacyButton>
              </div>
            </div>
          </div>

          {/* Item entry: "#" qty, then scan a barcode (Enter) or pick from the search list */}
          {!isViewing && (
            <div className="flex items-center gap-2">
              <span className={`w-24 shrink-0 text-right ${c.muted}`}>#</span>
              <LegacyInput
                isDark={isDark}
                type="number"
                min={1}
                value={entryQty}
                onChange={(e) => setEntryQty(parseInt(e.target.value) || 1)}
                aria-label="Qty"
                className="w-20 flex-none text-right"
              />
              <div className="relative flex-1 min-w-0">
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
                      <div
                        key={prod.id}
                        onClick={() => handleAddProductToItems(prod)}
                        className={`px-3 py-1.5 border-b last:border-b-0 cursor-pointer ${c.border} ${c.rowHover}`}
                      >
                        <div className="font-semibold">{prod.inventoryName}</div>
                        <div className={`text-[11px] font-mono ${c.muted}`}>SKU: {prod.inventoryNo} | Barcode: {prod.barcode || '-'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <LegacyButton isDark={isDark} variant="primary" onClick={handleSubmitReceipt} disabled={isSubmitting}>
                {isSubmitting ? 'Menyimpan...' : 'Input Nota'}
              </LegacyButton>
            </div>
          )}

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
          {/* Old SB_CreateNew: full-width bar under the grid, shown once the receipt is saved */}
          {isViewing && (
            <LegacyButton isDark={isDark} onClick={handleRecreateInvoice} className="w-full justify-center">Recreate Invoice</LegacyButton>
          )}
        </GroupBox>
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

      {isDailyReportOpen && (
        // The old report always printed today's receipts (its constructor ignored the date passed in)
        <DailyReportDialog isDark={isDark} date={getTodayBangkok()} variant="cashier" onClose={() => setIsDailyReportOpen(false)} />
      )}
      {isAddSupplierOpen && (
        <InputSupplierDialog
          isDark={isDark}
          onClose={() => setIsAddSupplierOpen(false)}
          onError={(msg) => addToast(msg, 'error')}
          onSaved={(sup) => {
            setIsAddSupplierOpen(false);
            addToast('Success On Save Supplier', 'success');
            setSelectedSupplierId(String(sup.id));
            setSupplierReloadKey((k) => k + 1);
          }}
        />
      )}
      {confirmDialogEl}
    </LegacyWindow>
  );
}


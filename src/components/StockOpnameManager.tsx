'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { RefreshCw, CheckCircle, XCircle, Sparkles, Trash2 } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import IntegerCellInput from '@/components/IntegerCellInput';
import { BarcodeBars } from '@/components/BarcodePrintManager';
import {
  LegacyWindow,
  LegacyButton,
  LegacyGrid,
  LegacyInput,
  LegacySelect,
  FieldRow,
  GroupBox,
  ContextMenu,
  menuAt,
  fmtN0,
  fmtDate,
  lx,
  type LegacyColumn,
  type ContextMenuState,
} from '@/components/legacy';

export interface OpnameEntry {
  id?: number;
  inventoryId: number;
  inventoryNo: string;
  barcode: string;
  inventoryName: string;
  qty: number;
  // Undefined when the server hides it (non-admin); saving then lets the server pick the price
  price?: number;
  description: string;
}

export interface OpnameHistoryHeader {
  id: number | string;
  noTransaction: string;
  opnameNo?: string;
  opname_no?: string;
  opnameDate: string;
  status?: string;
  warehouse: string;
  whName?: string;
  wh_name?: string;
  totalItems: number;
  totalQty: number;
  remarks: string;
  createdBy: string;
}

export interface InventoryLookupItem {
  id: number;
  inventoryNo: string;
  barcode: string;
  inventoryName: string;
  price: number;
  uomName?: string;
  brandName?: string;
  categoryName?: string;
  stokUpdate?: number;
  stokAkhir?: number;
  stock?: number;
  totalValue?: number;
}

interface Warehouse {
  id: number;
  whCode: number;
  location: string;
}

interface StockOpnameManagerProps {
  isDark: boolean;
  canViewPrice?: boolean;
}

/** One label of "Print Barcode" (old Rpt_OpnameBarcode): retail price from the item, not the opname price. */
interface OpnameBarcodeLabel {
  barcode: string;
  inventoryName: string;
  price: number;
}

// Rpt_OpnameBarcode: A4, margins left 11.1 / right 9.5 / bottom 9.2 mm, a 25.4 mm top margin holding
// "No Transaksi :" (Lato 20 bold), 3 columns across then down, 32.52 mm rows; 8 rows fit a page.
const OPNAME_LABELS_PER_PAGE = 24;
const noopSubscribe = () => () => {};

function OpnameBarcodeSheet({ labels, noTransaction }: { labels: OpnameBarcodeLabel[]; noTransaction: string }) {
  const pages: OpnameBarcodeLabel[][] = [];
  for (let i = 0; i < labels.length; i += OPNAME_LABELS_PER_PAGE) pages.push(labels.slice(i, i + OPNAME_LABELS_PER_PAGE));
  const lato = 'Lato, Arial, sans-serif';
  return (
    <>
      {pages.map((page, pageIdx) => (
        <div
          key={pageIdx}
          className="opname-barcode-page"
          style={{
            width: '210mm', height: '296mm', boxSizing: 'border-box', padding: '0 9.5mm 9.2mm 11.1mm', overflow: 'hidden',
            background: '#fff', color: '#000', breakAfter: pageIdx < pages.length - 1 ? 'page' : 'auto',
          }}
        >
          <div style={{ height: '25.4mm', position: 'relative', fontFamily: lato, fontSize: '20pt', fontWeight: 'bold' }}>
            <div style={{ position: 'absolute', left: 0, top: '14.53mm', width: '60.63mm', height: '10.87mm', display: 'flex', alignItems: 'center', padding: '0 0.5mm' }}>
              No Transaksi :
            </div>
            <div style={{ position: 'absolute', left: '60.63mm', top: '14.53mm', width: '56.09mm', height: '10.87mm', display: 'flex', alignItems: 'center', padding: '0 0.5mm' }}>
              {noTransaction}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: '32.52mm' }}>
            {page.map((label, idx) => (
              <div key={idx} className="opname-barcode-label" style={{ position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: '2.42mm', top: '2.5mm', width: '58.2mm', height: '12.96mm', padding: '0 2.6mm', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <BarcodeBars value={label.barcode} height="8.8mm" />
                  <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '9pt', lineHeight: 1.2 }}>{label.barcode}</div>
                </div>
                <div style={{ position: 'absolute', left: '2.42mm', top: '15.46mm', width: '58.2mm', height: '6.35mm', padding: '0 0.5mm', boxSizing: 'border-box', display: 'flex', alignItems: 'center', overflow: 'hidden', whiteSpace: 'nowrap', fontFamily: lato, fontSize: '10pt' }}>
                  {label.inventoryName}
                </div>
                <div style={{ position: 'absolute', left: '25.49mm', top: '21.81mm', width: '35.14mm', height: '6.35mm', padding: '0 0.5mm', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontFamily: lato, fontSize: '12pt' }}>
                  {fmtN0(label.price)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

const OPNAME_BARCODE_PRINT_CSS = `
  @media print {
    @page { size: A4; margin: 0; }
    body { display: block !important; background: white !important; margin: 0 !important; padding: 0 !important; }
    body > :not(#opname-barcode-print) { display: none !important; }
    #opname-barcode-print { display: block !important; }
  }
`;

// Mode switch agreed with the client (doc items 2-4): legacy OPM adjustment vs SCO stock check
const MODES = [
  ['ADJUST', 'Penyesuaian (+/-)', 'Tambah/kurangi stok langsung, contoh 2 atau -1'],
  ['COUNT', 'Cek Stok (hitung fisik)', 'Isi jumlah hasil hitung; selisih dihitung otomatis'],
] as const;

export default function StockOpnameManager({ isDark, canViewPrice = false }: StockOpnameManagerProps) {
  const c = lx(isDark);
  const { confirmDialog, dialog: confirmDialogEl } = useConfirmDialog(isDark);
  // Opname prices can be HPP, so non-admins see them masked
  const formatMoney = (value: number) => (canViewPrice ? `Rp ${value.toLocaleString('id-ID')}` : 'Rp ••••••');
  // Master & Lookup States
  const [inventoryList, setInventoryList] = useState<InventoryLookupItem[]>([]);
  const [historyList, setHistoryList] = useState<OpnameHistoryHeader[]>([]);
  const [selectedHistoryTx, setSelectedHistoryTx] = useState<string>('');

  // Form States
  const [noTransaction, setNoTransaction] = useState<string>('');
  const [warehouse, setWarehouse] = useState<string>('');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [opnameItems, setOpnameItems] = useState<OpnameEntry[]>([]);
  // ADJUST = legacy OPM (+/- change), COUNT = legacy SCO stock check (counted qty)
  const [opnameMode, setOpnameMode] = useState<'ADJUST' | 'COUNT'>('ADJUST');
  // Lines added / edited since the last load or save, so New / history / mode switch can ask before dropping them
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Input Form Fields
  const [selectedInvId, setSelectedInvId] = useState<number | ''>('');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  // Searchable product picker (type part of the name / SKU / barcode)
  const [productQuery, setProductQuery] = useState<string>('');
  const debouncedProductQuery = useDebounce(productQuery, 300);
  const [productResults, setProductResults] = useState<InventoryLookupItem[]>([]);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState<boolean>(false);
  const [isSearchingProduct, setIsSearchingProduct] = useState<boolean>(false);
  const [productHighlight, setProductHighlight] = useState<number>(0);
  const productPickerRef = useRef<HTMLDivElement>(null);
  const [qtyInput, setQtyInput] = useState<number | ''>(1);
  const [descInput, setDescInput] = useState<string>('');

  // Grid sort (header click) and right-click menu
  const [sortField, setSortField] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [rowMenu, setRowMenu] = useState<ContextMenuState<OpnameEntry> | null>(null);
  const closeRowMenu = useCallback(() => setRowMenu(null), []);

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

  // Status States
  const [opnameStatus, setOpnameStatus] = useState<'NEW' | 'DRAFT' | 'POSTED' | 'REVERSED'>('NEW');
  const [reversedReasonText, setReversedReasonText] = useState<string>('');
  const [isReverseModalOpen, setIsReverseModalOpen] = useState<boolean>(false);
  const [reverseReasonInput, setReverseReasonInput] = useState<string>('');
  const [isReconciling, setIsReconciling] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const loadSeqRef = useRef<number>(0);

  // Old ".:: Detail ::." group: shown when a scanned barcode belongs to no item, to create it and add it here
  const EMPTY_DETAIL = { barcode: '', inventoryNo: '', inventoryName: '', qty: 1 as number | '', kodeHarga: '', description: '' };
  const [detailForm, setDetailForm] = useState<typeof EMPTY_DETAIL | null>(null);
  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const detailInvNoRef = useRef<HTMLInputElement>(null);

  // "Print Barcode" labels and which print layout the <style> block carries
  const [printMode, setPrintMode] = useState<'report' | 'barcode'>('report');
  const [barcodeLabels, setBarcodeLabels] = useState<OpnameBarcodeLabel[]>([]);
  const [isPreparingLabels, setIsPreparingLabels] = useState(false);
  const canPortal = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const isReadOnly = opnameStatus === 'POSTED' || opnameStatus === 'REVERSED';

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const extractErrorMessage = (err: unknown, fallback: string): string => {
    if (!err) return fallback;
    if (typeof err === 'string') return err;
    if (typeof err === 'object') {
      const maybeMsg = (err as { message?: unknown }).message;
      if (typeof maybeMsg === 'string' && maybeMsg.trim()) return maybeMsg;
    }
    return fallback;
  };

  // Generate New Transaction No
  // New documents have no number until the first save: the server assigns the
  // legacy-style OPM-/SCO- number (sequential per day, so two users can't collide)
  const generateNewTxNo = useCallback(() => '', []);

  // Fetch Warehouses Lookup
  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory/lookups');
      const json = await res.json();
      if (json.success && json.data.warehouses) {
        setWarehouses(json.data.warehouses);
        if (json.data.warehouses.length > 0) {
          setWarehouse((prev) => prev || json.data.warehouses[0].location);
        }
      }
    } catch (e) {
      console.error('Failed to fetch warehouses', e);
    }
  }, []);

  // Refresh Inventory & History Lookups without clobbering current form state
  const refreshLookupsAndHistory = useCallback(async () => {
    const [invRes, histRes] = await Promise.all([
      fetch('/api/inventory?limit=500&status=active'),
      fetch('/api/inventory/opname'),
    ]);
    const invJson = await invRes.json();
    const rawItems: InventoryLookupItem[] = invJson.data?.items || invJson.data || [];
    const itemsArray: InventoryLookupItem[] = Array.isArray(rawItems)
      ? rawItems.map((it) => ({ ...it, id: Number(it.id) }))
      : [];
    if (invJson.success && Array.isArray(itemsArray)) {
      setInventoryList(itemsArray);
    }

    const histJson = await histRes.json();
    const histArray = histJson.data?.items || histJson.data || [];
    if (histJson.success && Array.isArray(histArray)) {
      setHistoryList(histArray);
    }
    return itemsArray;
  }, []);

  // Fetch Inventory Lookups & Opname History on initial mount
  const loadInitialData = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setIsLoading(true);
    try {
      await fetchWarehouses();
      const itemsArray = await refreshLookupsAndHistory();

      if (seq !== loadSeqRef.current) return;

      // Start empty: posting marks every listed item as checked today, so the full
      // catalog is only loaded on purpose via "Load Data" (COUNT mode)
      void itemsArray;
      setOpnameItems([]);
      setHasUnsavedChanges(false);

      setNoTransaction(generateNewTxNo());
      setSelectedHistoryTx('');
      setOpnameStatus('NEW');
      setReversedReasonText('');
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      console.error('Failed to load opname data:', err);
      showToast('Gagal memuat data master opname', 'error');
    } finally {
      if (seq === loadSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, [generateNewTxNo, fetchWarehouses, refreshLookupsAndHistory]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const confirmDiscardUnsaved = async () => {
    if (!hasUnsavedChanges || opnameItems.length === 0) return true;
    return confirmDialog('Item opname yang sudah diinput belum disimpan. Buang input ini?', { title: 'Stok Opname', confirmText: 'Buang' });
  };

  // Refresh reloads the lookups and history only; the lines on screen stay, and an unedited saved document is re-read
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([fetchWarehouses(), refreshLookupsAndHistory()]);
      if (selectedHistoryTx && !hasUnsavedChanges) await handleSelectHistory(selectedHistoryTx);
    } catch (err) {
      console.error('Failed to refresh opname data:', err);
      showToast('Gagal memuat data master opname', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const resetToNewOpname = () => {
    ++loadSeqRef.current;
    setIsLoading(false);
    setNoTransaction(generateNewTxNo());
    setSelectedHistoryTx('');
    setOpnameStatus('NEW');
    setReversedReasonText('');
    setOpnameItems([]);
    setHasUnsavedChanges(false);
    setSelectedInvId('');
    setBarcodeInput('');
    setProductQuery('');
    setQtyInput(1);
    setDescInput('');
    setDetailForm(null);
    showToast('Form Stok Opname Baru Siap Diisi', 'info');
  };

  // Handle New Opname Button
  const handleNewOpname = async () => {
    if (!(await confirmDiscardUnsaved())) return;
    resetToNewOpname();
  };

  // Handle Populate All Products for Bulk Opname
  const handlePopulateAll = () => {
    if (inventoryList.length === 0) {
      showToast('Daftar barang inventori belum dimuat', 'info');
      return;
    }
    if (isReadOnly) {
      showToast('Transaksi yang sudah diposting/dibatalkan tidak dapat diubah. Klik "New Opname" terlebih dahulu.', 'error');
      return;
    }
    if (opnameMode === 'ADJUST') {
      showToast('Muat semua barang hanya untuk mode Cek Stok (hitung fisik).', 'info');
      return;
    }
    const allItems: OpnameEntry[] = inventoryList.map((item) => {
      const itemQty = item.stokAkhir !== undefined ? Number(item.stokAkhir) : Number(item.stock || 0);
      return {
        inventoryId: Number(item.id),
        inventoryNo: item.inventoryNo,
        barcode: item.barcode || item.inventoryNo,
        inventoryName: item.inventoryName,
        qty: itemQty,
        price: Number(item.price || 0),
        description: 'Auto-Populate Opname Massal',
      };
    });
    setOpnameItems(allItems);
    setHasUnsavedChanges(true);
    showToast(`Semua ${allItems.length} barang berhasil dimuat ke tabel opname!`, 'success');
  };

  // Handle Barcode Auto-Fill
  const handleBarcodeChange = (val: string) => {
    setBarcodeInput(val);
    const found = inventoryList.find((item) => item.barcode === val || item.inventoryNo === val);
    if (found) {
      setSelectedInvId(Number(found.id));
      setProductQuery(found.inventoryName);
    }
  };

  // Handle Inventory Selection from the searchable picker
  const handleInventorySelect = (item: InventoryLookupItem) => {
    const picked = { ...item, id: Number(item.id) };
    setInventoryList((prev) => (prev.some((p) => Number(p.id) === picked.id) ? prev : [picked, ...prev]));
    setSelectedInvId(picked.id);
    setBarcodeInput(picked.barcode || picked.inventoryNo);
    setProductQuery(picked.inventoryName);
    setIsProductDropdownOpen(false);
  };

  // Live product search over the full catalog (request-id guard drops stale responses)
  const productSearchReqIdRef = useRef(0);
  useEffect(() => {
    const reqId = ++productSearchReqIdRef.current;
    const q = debouncedProductQuery.trim();
    if (!q || !isProductDropdownOpen) return;
    const runSearch = async () => {
      setIsSearchingProduct(true);
      try {
        const res = await fetch(`/api/inventory?q=${encodeURIComponent(q)}&limit=30&status=active`);
        const json = await res.json();
        if (reqId !== productSearchReqIdRef.current) return;
        const remoteItems: InventoryLookupItem[] = json.data?.items || json.data || [];
        if (json.success && Array.isArray(remoteItems)) {
          setProductResults(remoteItems.map((it) => ({ ...it, id: Number(it.id) })));
          setProductHighlight(0);
        }
      } catch (err) {
        console.error('Product search failed:', err);
      } finally {
        if (reqId === productSearchReqIdRef.current) setIsSearchingProduct(false);
      }
    };
    runSearch();
  }, [debouncedProductQuery, isProductDropdownOpen]);

  // Typing shows instant local matches while the API search is debounced
  const handleProductQueryChange = (val: string) => {
    setProductQuery(val);
    setSelectedInvId('');
    setIsProductDropdownOpen(true);
    setProductHighlight(0);
    const q = val.trim().toLowerCase();
    setProductResults(
      q
        ? inventoryList
            .filter(
              (i) =>
                i.inventoryName.toLowerCase().includes(q) ||
                (i.inventoryNo || '').toLowerCase().includes(q) ||
                (i.barcode || '').toLowerCase().includes(q)
            )
            .slice(0, 30)
        : []
    );
  };

  // Close the product dropdown when clicking outside of it
  useEffect(() => {
    if (!isProductDropdownOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (productPickerRef.current && !productPickerRef.current.contains(e.target as Node)) {
        setIsProductDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isProductDropdownOpen]);

  // Add Item to Pending Opname List
  const handleAddItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (isReadOnly) {
      showToast('Transaksi ini bersifat baca-saja. Klik "New Opname" untuk membuat opname baru.', 'error');
      return;
    }

    let found: InventoryLookupItem | undefined = selectedInvId
      ? inventoryList.find((i) => Number(i.id) === Number(selectedInvId))
      : undefined;

    // Fallback 1: If no item selected via dropdown, lookup in local list by scanned barcode or SKU
    const rawScan = barcodeInput.trim();
    if (!found && rawScan) {
      const q = rawScan.toLowerCase();
      found = inventoryList.find(
        (i) => (i.barcode && i.barcode.toLowerCase() === q) || (i.inventoryNo && i.inventoryNo.toLowerCase() === q)
      );
    }

    // Fallback 2: If item isn't in local list yet, query API directly by barcode/SKU
    if (!found && rawScan) {
      try {
        const res = await fetch(`/api/inventory?q=${encodeURIComponent(rawScan)}&limit=20&status=active`);
        const json = await res.json();
        const remoteItems: InventoryLookupItem[] = json.data?.items || json.data || [];
        const q = rawScan.toLowerCase();
        // Exact barcode / SKU only, like the old sp_T_Opname_CheckInvBarcode; anything else opens ".:: Detail ::."
        const exactMatch = remoteItems.find(
          (i) => (i.barcode && i.barcode.toLowerCase() === q) || (i.inventoryNo && i.inventoryNo.toLowerCase() === q)
        );
        if (exactMatch) {
          found = { ...exactMatch, id: Number(exactMatch.id) };
          setInventoryList((prev) => (prev.some((p) => Number(p.id) === Number(found!.id)) ? prev : [found!, ...prev]));
        }
      } catch (err) {
        console.error('Fallback barcode lookup failed:', err);
      }
    }

    if (!found && rawScan && !selectedInvId) {
      // Unknown barcode: old Ed_Barcode_KeyPress shows the Detail group with the scanned value
      setDetailForm({ ...EMPTY_DETAIL, barcode: rawScan, qty: typeof qtyInput === 'number' ? qtyInput : 1, description: descInput });
      setTimeout(() => detailInvNoRef.current?.focus(), 50);
      return;
    }
    if (!found) {
      showToast('Pilih barang atau scan barcode yang valid terlebih dahulu!', 'error');
      return;
    }

    const qty = typeof qtyInput === 'number' ? qtyInput : 0;
    const qtyError = validateQty(qty);
    if (qtyError) {
      showToast(qtyError, 'error');
      return;
    }
    addFoundItem(found, qty, descInput);
  };

  const validateQty = (qty: number): string | null => {
    if (opnameMode === 'COUNT' && qty < 0) return 'Qty hitung fisik tidak boleh negatif';
    if (opnameMode === 'ADJUST' && qty === 0) return 'Isi penyesuaian, contoh 2 untuk tambah atau -1 untuk kurang';
    return null;
  };

  // Puts an item on the opname lines (or updates its line) and resets the entry fields
  const addFoundItem = (found: InventoryLookupItem, qty: number, noteText: string) => {
    const foundId = Number(found.id);
    let wasExisting = false;

    setOpnameItems((prev) => {
      const existingIdx = prev.findIndex((i) => Number(i.inventoryId) === foundId);
      if (existingIdx >= 0) {
        wasExisting = true;
        const updated = [...prev];
        const [itemToMove] = updated.splice(existingIdx, 1);
        const updatedItem = {
          ...itemToMove,
          // Adjustments add up (scan twice = +2); a count replaces the previous count
          qty: opnameMode === 'ADJUST' ? itemToMove.qty + qty : qty,
          description: noteText || 'Penyesuaian Opname',
        };
        updated.unshift(updatedItem);
        return updated;
      }
      return [
        {
          inventoryId: foundId,
          inventoryNo: found!.inventoryNo,
          barcode: found!.barcode || found!.inventoryNo,
          inventoryName: found!.inventoryName,
          qty,
          price: Number(found!.price || 0),
          description: noteText || 'Stok Opname',
        },
        ...prev,
      ];
    });
    setHasUnsavedChanges(true);

    if (wasExisting) {
      showToast(`Qty "${found.inventoryName}" diperbarui`, 'info');
    } else {
      showToast(`"${found.inventoryName}" berhasil ditambahkan ke daftar`, 'success');
    }

    // Reset input fields
    setSelectedInvId('');
    setBarcodeInput('');
    setProductQuery('');
    setQtyInput(1);
    setDescInput('');

    // Auto-focus back to barcode scanner for rapid entry muscle memory
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  // ".:: Detail ::." Submit: create the item (old sp_T_Opname_InsUpdInventory), then add it with the typed Qty
  const handleSubmitDetail = async () => {
    if (!detailForm || isCreatingItem || isReadOnly) return;
    const qty = typeof detailForm.qty === 'number' ? detailForm.qty : 0;
    const qtyError = validateQty(qty);
    if (qtyError) {
      showToast(qtyError, 'error');
      return;
    }
    setIsCreatingItem(true);
    try {
      const res = await fetch('/api/inventory/opname/item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: detailForm.barcode,
          inventoryNo: detailForm.inventoryNo,
          inventoryName: detailForm.inventoryName,
          kodeHarga: detailForm.kodeHarga,
          description: detailForm.description,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        showToast(extractErrorMessage(json.error, 'Gagal membuat barang baru'), 'error');
        return;
      }
      const created: InventoryLookupItem = { ...json.data, id: Number(json.data.id) };
      setInventoryList((prev) => [created, ...prev]);
      setDetailForm(null);
      addFoundItem(created, qty, detailForm.description);
    } catch (err) {
      console.error('Create item from opname scan failed:', err);
      showToast('Gagal membuat barang baru', 'error');
    } finally {
      setIsCreatingItem(false);
    }
  };

  // "Print Barcode" (old SB_PrintBarcode -> Rpt_OpnameBarcode): one label per opname line, in grid order
  const handlePrintBarcode = async () => {
    if (opnameItems.length === 0) {
      showToast('Tidak ada item opname untuk dicetak', 'error');
      return;
    }
    setIsPreparingLabels(true);
    try {
      const ids = sortedItems.map((i) => Number(i.inventoryId));
      const json = await fetch(`/api/barcode-list/labels?ids=${ids.join(',')}`).then((r) => r.json());
      if (!json.success) {
        showToast(extractErrorMessage(json.error, 'Gagal memuat data label'), 'error');
        return;
      }
      const byId = new Map<number, OpnameBarcodeLabel & { inventoryNo: string }>(
        (json.data as (OpnameBarcodeLabel & { inventoryId: number; inventoryNo: string })[]).map((l) => [l.inventoryId, l]),
      );
      const labels = sortedItems.map((line) => {
        const info = byId.get(Number(line.inventoryId));
        return {
          barcode: info?.barcode || info?.inventoryNo || line.barcode || line.inventoryNo,
          inventoryName: info?.inventoryName || line.inventoryName,
          price: info?.price ?? 0,
        };
      });
      flushSync(() => {
        setBarcodeLabels(labels);
        setPrintMode('barcode');
      });
      window.print();
    } catch (err) {
      console.error('Print barcode failed:', err);
      showToast('Gagal memuat data label', 'error');
    } finally {
      setPrintMode('report');
      setIsPreparingLabels(false);
    }
  };

  // Print Opname Report
  const handlePrintReport = () => {
    if (opnameItems.length === 0) {
      showToast('Tidak ada item opname untuk dicetak', 'error');
      return;
    }
    window.print();
  };

  // Inline Qty Update Handler
  const handleInlineQtyChange = (invId: number, newQty: number) => {
    if (isReadOnly) return;
    const validQty = opnameMode === 'COUNT' ? Math.max(0, newQty) : newQty;
    setOpnameItems((prev) =>
      prev.map((item) => (item.inventoryId === invId ? { ...item, qty: validQty } : item))
    );
    setHasUnsavedChanges(true);
  };

  // Remove item from list
  const handleRemoveItem = (invId: number) => {
    if (isReadOnly) return;
    setOpnameItems((prev) => prev.filter((i) => i.inventoryId !== invId));
    setHasUnsavedChanges(true);
  };

  // Select History Transaction from Dropdown
  const handleSelectHistory = async (txNo: string) => {
    setSelectedHistoryTx(txNo);
    if (!txNo) {
      resetToNewOpname();
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/inventory/opname?noTx=${encodeURIComponent(txNo)}`);
      const json = await res.json();
      const payload = json.data;
      const detailItems = payload?.items || json.data?.items || json.data || [];
      if (json.success) {
        setNoTransaction(txNo);
        setOpnameMode(payload?.mode === 'ADJUST' ? 'ADJUST' : 'COUNT');
        const statusVal = payload?.status || json.header?.status || 'POSTED';
        setOpnameStatus(statusVal);
        setReversedReasonText(payload?.reversedReason || '');
        if (payload?.warehouse || payload?.whName || json.header?.whName) {
          setWarehouse(payload?.warehouse || payload?.whName || json.header?.whName);
        }
        setOpnameItems(
          detailItems.map((d: any) => ({
            inventoryId: d.inventoryId || d.id,
            inventoryNo: d.inventoryNo || d.inventory_no,
            barcode: d.barcode,
            inventoryName: d.inventoryName || d.inventory_name,
            qty: d.qty !== undefined ? Number(d.qty) : Number(d.physical_qty ?? d.physicalQty ?? 0),
            price: d.price === null || d.price === undefined ? undefined : Number(d.price),
            description: d.description || d.notes || 'Stok Opname',
          }))
        );
        setHasUnsavedChanges(false);
        showToast(`Memuat Transaksi Opname ${txNo} (${statusVal})`, 'info');
      } else {
        showToast(extractErrorMessage(json.error, 'Gagal memuat detail transaksi opname'), 'error');
      }
    } catch (err) {
      console.error('Failed to load opname detail:', err);
      showToast('Gagal memuat detail transaksi opname', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Open Reconciliation Preview
  const handleOpenReconciliation = () => {
    if (opnameItems.length === 0) {
      showToast('Tidak ada item opname yang dimasukkan!', 'error');
      return;
    }
    if (isReadOnly) {
      showToast('Transaksi yang sudah diposting/dibatalkan tidak dapat disimpan ulang.', 'error');
      return;
    }
    setIsReconciling(true);
  };

  // Submit Opname Transaction (action: 'draft' | 'post')
  const handleSubmitOpname = async (action: 'draft' | 'post' = 'post') => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const targetTxNo = noTransaction;
    try {
      const res = await fetch('/api/inventory/opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_tx: targetTxNo,
          noTransaction: targetTxNo,
          opnameNo: targetTxNo,
          opnameMode,
          wh_name: warehouse,
          warehouse,
          items: opnameItems.map((it) => ({
            inventoryId: it.inventoryId,
            barcode: it.barcode,
            ...(opnameMode === 'ADJUST' ? { adjustQty: it.qty } : { qty: it.qty }),
            price: it.price,
            description: it.description,
            notes: it.description,
          })),
          // The server records the logged-in user as creator / poster
          remarks: 'Stok Opname',
          notes: 'Stok Opname',
          action,
        }),
      });

      const json = await res.json();
      if (json.success) {
        const successMsg = json.message || (action === 'post' ? 'Stok Opname berhasil diposting!' : 'Draft Opname berhasil disimpan!');
        setIsReconciling(false);
        const savedTxNo: string = json.data?.header?.notransaction || targetTxNo;
        await refreshLookupsAndHistory();
        await handleSelectHistory(savedTxNo);
        showToast(successMsg, 'success');
      } else {
        showToast(extractErrorMessage(json.error, 'Gagal menyimpan stok opname'), 'error');
      }
    } catch (err) {
      console.error('Submit opname error:', err);
      showToast('Terjadi kesalahan saat menyimpan opname', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reverse Opname Handler
  const handleReverseOpname = async () => {
    if (!reverseReasonInput.trim()) {
      showToast('Alasan pembatalan (reversal) wajib diisi!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/inventory/opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_tx: noTransaction,
          action: 'reverse',
          reason: reverseReasonInput,
        }),
      });

      const json = await res.json();
      if (json.success) {
        const successMsg = json.message || `Opname ${noTransaction} berhasil dibatalkan (reversed)!`;
        setIsReverseModalOpen(false);
        setReverseReasonInput('');
        await refreshLookupsAndHistory();
        await handleSelectHistory(noTransaction);
        showToast(successMsg, 'success');
      } else {
        showToast(extractErrorMessage(json.error, 'Gagal membatalkan opname'), 'error');
      }
    } catch (err) {
      console.error('Reverse opname error:', err);
      showToast('Terjadi kesalahan saat membatalkan opname', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Footer totals: "{n} Jenis" and "Total = {n} barang" like the legacy grid
  const stats = useMemo(() => {
    const totalItems = opnameItems.length;
    let totalQty = 0;
    let totalValue = 0;

    opnameItems.forEach((item) => {
      totalQty += item.qty;
      totalValue += item.qty * (item.price || 0);
    });

    return { totalItems, totalQty, totalValue };
  }, [opnameItems]);

  // Sorted grid rows (header click); unsorted keeps the newest scan on top
  const sortedItems = useMemo(() => {
    if (!sortField) return opnameItems;
    const key = sortField as keyof OpnameEntry;
    return [...opnameItems].sort((a, b) => {
      let aVal: any = a[key];
      let bVal: any = b[key];
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = String(bVal ?? '').toLowerCase();
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [opnameItems, sortField, sortOrder]);

  // Legacy GV_Detail columns: Barcode | No. Inventory | Nama Barang | Qty | Description | Price (Price is Admin-only)
  const gridColumns: LegacyColumn<OpnameEntry>[] = [
    { key: 'barcode', caption: 'Barcode', sortKey: 'barcode', footer: `${fmtN0(stats.totalItems)} Jenis` },
    { key: 'inventoryNo', caption: 'No. Inventory', sortKey: 'inventoryNo' },
    { key: 'inventoryName', caption: 'Nama Barang', sortKey: 'inventoryName' },
    {
      key: 'qty', caption: 'Qty', sortKey: 'qty', align: 'right', width: 110,
      footer: `Total = ${fmtN0(stats.totalQty)} barang`,
      render: (item) => (
        <>
          <IntegerCellInput
            value={item.qty}
            min={opnameMode === 'COUNT' ? 0 : undefined}
            disabled={isReadOnly}
            label={`Qty ${item.inventoryName}`}
            onChange={(qty) => handleInlineQtyChange(item.inventoryId, qty)}
            className={`w-20 px-1.5 py-0.5 rounded border text-right tabular-nums outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-70 ${c.input}`}
          />
          {/* Inputs are hidden when printing, so the printed sheet shows the qty as text */}
          <span className="print-only">{item.qty}</span>
        </>
      ),
    },
    { key: 'description', caption: 'Description', sortKey: 'description' },
    ...(canViewPrice
      ? [{ key: 'price', caption: 'Price', format: 'n0' as const, sortKey: 'price' }]
      : []),
  ];

  const statusTone =
    opnameStatus === 'POSTED'
      ? 'bg-emerald-600 text-white'
      : opnameStatus === 'REVERSED'
      ? 'bg-rose-600 text-white'
      : opnameStatus === 'DRAFT'
      ? 'bg-indigo-600 text-white'
      : 'bg-amber-500 text-slate-950';

  const modalShell = `w-full flex flex-col rounded border shadow-2xl overflow-hidden text-xs ${c.panel}`;

  return (
    <div id="printable-opname-report" className="flex-1 flex flex-col h-full min-h-0 overflow-hidden relative">
      {/* Opname print sheet: hides controls and prints the header, grid and signature boxes.
          "Print Barcode" swaps in the A4 label sheet CSS for the duration of its print. */}
      <style>{printMode === 'barcode' ? OPNAME_BARCODE_PRINT_CSS : `
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .no-print, nav, header, sidebar, button, select, input {
            display: none !important;
          }
          #printable-opname-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 20px !important;
            background: white !important;
            color: black !important;
            overflow: visible !important;
          }
          #printable-opname-report * {
            visibility: visible !important;
            color: black !important;
            border-color: #cbd5e1 !important;
          }
          #printable-opname-report .overflow-hidden, #printable-opname-report .overflow-auto {
            overflow: visible !important;
          }
          .print-header {
            display: block !important;
            margin-bottom: 20px !important;
            border-bottom: 2px solid #000 !important;
            padding-bottom: 12px !important;
          }
          .print-signatures {
            display: flex !important;
            justify-content: space-between !important;
            margin-top: 40px !important;
            padding-top: 20px !important;
          }
          .print-only {
            display: inline !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th, td {
            border: 1px solid #94a3b8 !important;
            padding: 6px 10px !important;
            font-size: 11px !important;
          }
          th {
            background-color: #f1f5f9 !important;
            font-weight: bold !important;
          }
        }
        .print-header, .print-signatures, .print-only {
          display: none;
        }
      `}</style>

      {/* Print-only header */}
      <div className="print-header">
        <div className="flex justify-between items-center pb-2">
          <div>
            <h1 className="text-xl font-black uppercase text-black">HARMONY KITCHEN ERP</h1>
            <h2 className="text-sm font-bold text-slate-700">BERITA ACARA & LAPORAN STOK OPNAME GUDANG</h2>
          </div>
          <div className="text-right text-xs">
            <div><strong>No. Transaksi:</strong> {noTransaction}</div>
            <div><strong>Gudang:</strong> {warehouse}</div>
            <div><strong>Tanggal Opname:</strong> {new Date().toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`no-print fixed top-5 right-5 z-[110] px-4 py-3 rounded shadow-xl border text-xs font-bold flex items-center gap-2.5 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-700 text-white border-emerald-800'
              : toastMessage.type === 'error'
              ? 'bg-rose-700 text-white border-rose-800'
              : 'bg-indigo-700 text-white border-indigo-800'
          }`}
        >
          {toastMessage.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0" />}
          {toastMessage.type === 'error' && <XCircle className="w-4 h-4 shrink-0" />}
          {toastMessage.type === 'info' && <Sparkles className="w-4 h-4 shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      <LegacyWindow
        title="Input Stock"
        isDark={isDark}
        toolbar={
          <>
            <LegacyButton isDark={isDark} onClick={handleNewOpname}>New Opname</LegacyButton>
            <LegacyButton
              isDark={isDark}
              onClick={handleRefresh}
              disabled={isRefreshing}
              icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading || isRefreshing ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </LegacyButton>
            <LegacyButton isDark={isDark} onClick={handlePrintReport} disabled={opnameItems.length === 0}>Print</LegacyButton>
            <LegacyButton isDark={isDark} onClick={handlePrintBarcode} disabled={opnameItems.length === 0 || isPreparingLabels}>Print Barcode</LegacyButton>
            <div className="w-80">
              <FieldRow label="Opname History :" isDark={isDark} labelWidth="w-auto">
                <LegacySelect
                  isDark={isDark}
                  value={selectedHistoryTx}
                  onChange={async (e) => {
                    const txNo = e.target.value;
                    if (await confirmDiscardUnsaved()) handleSelectHistory(txNo);
                  }}
                >
                  <option value="">-- Opname Baru --</option>
                  {historyList.map((h) => {
                    const txKey = h.noTransaction || h.opnameNo || h.opname_no || '';
                    const statusLabel = h.status ? ` [${h.status}]` : '';
                    return (
                      <option key={h.id || txKey} value={txKey}>
                        {txKey} ({fmtDate(h.opnameDate)}){statusLabel}
                      </option>
                    );
                  })}
                </LegacySelect>
              </FieldRow>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {opnameStatus === 'POSTED' && (
                <LegacyButton
                  isDark={isDark}
                  variant="danger"
                  onClick={() => setIsReverseModalOpen(true)}
                  disabled={isSubmitting}
                  title="Batalkan (Reverse) transaksi opname yang sudah diposting"
                >
                  Reverse Opname
                </LegacyButton>
              )}
              <LegacyButton
                isDark={isDark}
                variant="primary"
                onClick={handleOpenReconciliation}
                disabled={isSubmitting || opnameItems.length === 0 || isReadOnly}
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan'}
              </LegacyButton>
            </div>
          </>
        }
      >
        {/* Mode switch kept from the client doc; locked once the document has a number */}
        <div className={`no-print px-2 py-1.5 border rounded flex flex-wrap items-center gap-2 ${c.panel}`}>
          {MODES.map(([value, label, hint]) => {
            const locked = isReadOnly || !!noTransaction;
            const active = opnameMode === value;
            return (
              <button
                key={value}
                type="button"
                title={hint}
                disabled={locked && !active}
                onClick={async () => {
                  if (locked || active) return;
                  if (!(await confirmDiscardUnsaved())) return;
                  setOpnameMode(value);
                  setOpnameItems([]);
                  setHasUnsavedChanges(false);
                  setQtyInput(1);
                }}
                className={`px-3 py-1 rounded border font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  active
                    ? 'bg-blue-600 text-white border-blue-700'
                    : isDark
                    ? 'border-slate-600 hover:bg-slate-800'
                    : 'border-slate-400 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            );
          })}
          <LegacyButton
            isDark={isDark}
            onClick={handlePopulateAll}
            disabled={isReadOnly}
            title="Muat seluruh barang master inventori ke tabel opname (maks. 500)"
          >
            Load Data ({inventoryList.length})
          </LegacyButton>
          <span className={`text-[11px] ${c.muted}`}>
            {opnameMode === 'ADJUST'
              ? 'Qty = perubahan stok (+ tambah, - kurang). Stok akhir tidak boleh minus.'
              : 'Qty = jumlah hasil hitung fisik. Tanggal cek stok tercatat walau qty sudah benar.'}
          </span>
        </div>

        {/* Field rows of the legacy form: Barcode / No. Transaksi / Gudang / Nama Barang, then Qty / Desc + Input;
            the ".:: Detail ::." group sits on their right while it is shown */}
        <div className="no-print flex flex-col lg:flex-row gap-2">
        <div className={`flex-1 min-w-0 px-2 py-2 border rounded grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-2 content-start ${c.panel}`}>
          <FieldRow label="Barcode :" isDark={isDark} labelWidth="w-28">
            <LegacyInput
              ref={barcodeInputRef}
              isDark={isDark}
              value={barcodeInput}
              disabled={isReadOnly}
              onChange={(e) => handleBarcodeChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddItem();
                }
              }}
              placeholder="Scan Barcode / SKU..."
            />
          </FieldRow>
          <FieldRow label="No. Transaksi :" isDark={isDark} labelWidth="w-28">
            <LegacyInput isDark={isDark} readOnly value={noTransaction} placeholder="(Nomor otomatis)" className="font-mono" />
            <span data-testid="opname-status-badge" className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${statusTone}`}>
              {opnameStatus}
            </span>
          </FieldRow>
          <FieldRow label="Gudang :" isDark={isDark} labelWidth="w-28">
            <LegacySelect isDark={isDark} value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
              <option value="" disabled>Pilih Gudang / Lokasi</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.location}>{w.location}</option>
              ))}
            </LegacySelect>
          </FieldRow>
          <FieldRow label="Nama Barang :" isDark={isDark} labelWidth="w-28">
            {/* Searchable product picker (client doc item 9) */}
            <div ref={productPickerRef} className="relative flex-1 min-w-0">
              <LegacyInput
                isDark={isDark}
                value={productQuery}
                disabled={isReadOnly}
                onChange={(e) => handleProductQueryChange(e.target.value)}
                onFocus={(e) => {
                  e.target.select();
                  if (productQuery.trim() && !selectedInvId) setIsProductDropdownOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setIsProductDropdownOpen(true);
                    setProductHighlight((h) => Math.min(h + 1, Math.max(productResults.length - 1, 0)));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setProductHighlight((h) => Math.max(h - 1, 0));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const pick = isProductDropdownOpen ? productResults[productHighlight] : undefined;
                    if (pick) handleInventorySelect(pick);
                    else if (selectedInvId) handleAddItem();
                  } else if (e.key === 'Escape') {
                    setIsProductDropdownOpen(false);
                  }
                }}
                placeholder="Cari Barang (Nama / SKU / Barcode)..."
                className="pr-7"
              />
              {isSearchingProduct && isProductDropdownOpen && (
                <RefreshCw className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-blue-500" />
              )}

              {isProductDropdownOpen && productQuery.trim() && (
                <div className={`absolute left-0 right-0 top-full mt-1 z-40 rounded border shadow-xl max-h-72 overflow-y-auto ${c.panel}`}>
                  {productResults.length === 0 ? (
                    <div className={`px-3 py-2 italic ${c.muted}`}>
                      {isSearchingProduct ? 'Mencari barang...' : 'Barang tidak ditemukan'}
                    </div>
                  ) : (
                    productResults.map((inv, idx) => (
                      <div
                        key={inv.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleInventorySelect(inv);
                        }}
                        onMouseEnter={() => setProductHighlight(idx)}
                        className={`px-3 py-1.5 border-b last:border-b-0 cursor-pointer ${c.border} ${idx === productHighlight ? c.rowFocus : ''}`}
                      >
                        <div className="font-semibold">{inv.inventoryName}</div>
                        <div className={`text-[11px] font-mono ${c.muted}`}>
                          SKU: {inv.inventoryNo} | Barcode: {inv.barcode || '-'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </FieldRow>
          <FieldRow label="Qty :" isDark={isDark} labelWidth="w-28">
            <LegacyInput
              isDark={isDark}
              type="number"
              min={opnameMode === 'COUNT' ? 0 : undefined}
              disabled={isReadOnly}
              value={qtyInput}
              onChange={(e) => setQtyInput(e.target.value === '' || e.target.value === '-' ? '' : parseInt(e.target.value) || 0)}
              className="w-24 flex-none text-right"
            />
          </FieldRow>
          <FieldRow label="Desc :" isDark={isDark} labelWidth="w-28">
            <LegacyInput
              isDark={isDark}
              disabled={isReadOnly}
              value={descInput}
              onChange={(e) => setDescInput(e.target.value)}
              placeholder="Catatan Opname..."
            />
            <LegacyButton isDark={isDark} variant="primary" onClick={() => handleAddItem()} disabled={isReadOnly}>Input</LegacyButton>
          </FieldRow>
        </div>
        {detailForm && !isReadOnly && (
          <GroupBox caption=".:: Detail ::." isDark={isDark} className="lg:w-[340px] shrink-0">
            <form
              data-testid="opname-detail"
              className="flex flex-col gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmitDetail();
              }}
            >
              <FieldRow label="Barcode :" isDark={isDark} labelWidth="w-24">
                <LegacyInput isDark={isDark} aria-label="Detail Barcode" value={detailForm.barcode} onChange={(e) => setDetailForm({ ...detailForm, barcode: e.target.value })} />
              </FieldRow>
              <FieldRow label="Inv No. :" isDark={isDark} labelWidth="w-24">
                <LegacyInput ref={detailInvNoRef} isDark={isDark} aria-label="Inv No." value={detailForm.inventoryNo} onChange={(e) => setDetailForm({ ...detailForm, inventoryNo: e.target.value })} />
              </FieldRow>
              <FieldRow label="Inv Name :" isDark={isDark} labelWidth="w-24">
                <LegacyInput isDark={isDark} aria-label="Inv Name" value={detailForm.inventoryName} onChange={(e) => setDetailForm({ ...detailForm, inventoryName: e.target.value })} />
              </FieldRow>
              <FieldRow label="Qty :" isDark={isDark} labelWidth="w-24">
                <LegacyInput
                  isDark={isDark}
                  type="number"
                  aria-label="Detail Qty"
                  min={opnameMode === 'COUNT' ? 0 : undefined}
                  value={detailForm.qty}
                  onChange={(e) => setDetailForm({ ...detailForm, qty: e.target.value === '' || e.target.value === '-' ? '' : parseInt(e.target.value) || 0 })}
                  className="w-24 flex-none text-right"
                />
              </FieldRow>
              <FieldRow label="Kode Harga :" isDark={isDark} labelWidth="w-24">
                <LegacyInput isDark={isDark} aria-label="Kode Harga" value={detailForm.kodeHarga} onChange={(e) => setDetailForm({ ...detailForm, kodeHarga: e.target.value })} />
              </FieldRow>
              <FieldRow label="Desc :" isDark={isDark} labelWidth="w-24">
                <textarea
                  aria-label="Detail Desc"
                  rows={3}
                  value={detailForm.description}
                  onChange={(e) => setDetailForm({ ...detailForm, description: e.target.value })}
                  className={`flex-1 min-w-0 px-1.5 py-1 rounded border outline-none focus:ring-1 focus:ring-blue-500 ${c.input}`}
                />
              </FieldRow>
              <div className="flex justify-end">
                <LegacyButton isDark={isDark} variant="primary" type="submit" disabled={isCreatingItem}>
                  {isCreatingItem ? 'Menyimpan...' : 'Submit'}
                </LegacyButton>
              </div>
            </form>
          </GroupBox>
        )}
        </div>

        {/* Reversed documents stay read-only and show the reason */}
        {opnameStatus === 'REVERSED' && (
          <div className="px-2 py-1 rounded border border-rose-500/40 bg-rose-500/10 text-rose-600 font-semibold">
            Transaksi Opname ini telah dibatalkan (REVERSED).{reversedReasonText ? ` Alasan: ${reversedReasonText}` : ''}
          </div>
        )}

        <LegacyGrid
          isDark={isDark}
          columns={gridColumns}
          rows={sortedItems}
          rowKey={(item) => item.inventoryId}
          loading={isLoading}
          emptyText='Belum ada item opname. Scan barcode atau pilih Nama Barang lalu klik "Input".'
          sort={sortField ? { key: sortField, order: sortOrder } : null}
          onSort={handleSort}
          onRowContextMenu={isReadOnly ? undefined : (item, e) => setRowMenu(menuAt(e, item, 1))}
          showFooter
        />

        {rowMenu && (
          <ContextMenu
            isDark={isDark}
            x={rowMenu.x}
            y={rowMenu.y}
            onClose={closeRowMenu}
            items={[
              { label: 'Hapus', icon: <Trash2 className="w-3.5 h-3.5" />, danger: true, onClick: () => handleRemoveItem(rowMenu.row.inventoryId) },
            ]}
          />
        )}
      </LegacyWindow>

      {/* "Print Barcode" sheet: kept in the DOM, shown only by OPNAME_BARCODE_PRINT_CSS while printing */}
      {canPortal && createPortal(
        <div id="opname-barcode-print" style={{ display: 'none' }}>
          <OpnameBarcodeSheet labels={barcodeLabels} noTransaction={noTransaction} />
        </div>,
        document.body,
      )}

      {/* Print-only signature boxes */}
      <div className="print-signatures grid grid-cols-3 gap-6 text-center text-xs pt-8">
        <div>
          <div className="font-bold mb-12">Petugas Gudang:</div>
          <div className="border-b border-black w-36 mx-auto mb-1"></div>
          <div className="text-[10px] text-slate-500">Staf Opname Gudang</div>
        </div>
        <div>
          <div className="font-bold mb-12">Diperiksa Oleh:</div>
          <div className="border-b border-black w-36 mx-auto mb-1"></div>
          <div className="text-[10px] text-slate-500">Supervisor Gudang</div>
        </div>
        <div>
          <div className="font-bold mb-12">Disetujui Oleh:</div>
          <div className="border-b border-black w-36 mx-auto mb-1"></div>
          <div className="text-[10px] text-slate-500">Kepala Logistik & Gudang</div>
        </div>
      </div>

      {/* Confirm dialog before saving: draft (no stock change) or post */}
      {isReconciling && (
        <div className="no-print fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className={`${modalShell} max-w-4xl max-h-[90vh]`}>
            <div className={`px-4 py-2 border-b flex items-center justify-between ${c.bar}`}>
              <div>
                <h2 className="text-sm font-bold">Konfirmasi Simpan Stok Opname</h2>
                <p className={`text-[11px] ${c.muted}`}>Pratinjau Penyesuaian Qty Gudang ({noTransaction || '(Nomor otomatis)'})</p>
              </div>
              <span className="font-bold">{fmtN0(stats.totalQty)} Unit / {fmtN0(stats.totalItems)} Jenis</span>
            </div>

            <div className="flex-1 overflow-auto p-3 flex flex-col gap-2">
              <p className={c.muted}>
                Posting opname akan memperbarui stok akhir gudang dengan <strong>Qty</strong> yang tertera di bawah ini.
              </p>
              <table className={`w-full border-separate border-spacing-0 border rounded ${c.border}`}>
                <thead>
                  <tr className={`font-semibold ${c.head}`}>
                    <th className={`px-2 py-1 text-left border-b ${c.border}`}>No. Inventory</th>
                    <th className={`px-2 py-1 text-left border-b ${c.border}`}>Nama Barang</th>
                    <th className={`px-2 py-1 text-right border-b ${c.border}`}>Qty</th>
                    <th className={`px-2 py-1 text-right border-b ${c.border}`}>Price</th>
                    <th className={`px-2 py-1 text-right border-b ${c.border}`}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {opnameItems.map((item) => (
                    <tr key={item.inventoryId}>
                      <td className={`px-2 py-1 border-b font-mono ${c.border}`}>{item.inventoryNo}</td>
                      <td className={`px-2 py-1 border-b ${c.border}`}>{item.inventoryName}</td>
                      <td className={`px-2 py-1 border-b text-right tabular-nums ${c.border}`}>{opnameMode === 'ADJUST' && item.qty > 0 ? `+${item.qty}` : item.qty}</td>
                      <td className={`px-2 py-1 border-b text-right tabular-nums ${c.border}`}>{formatMoney(item.price || 0)}</td>
                      <td className={`px-2 py-1 border-b text-right tabular-nums ${c.border}`}>{formatMoney(item.qty * (item.price || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={`px-4 py-2 border-t flex justify-between items-center gap-2 ${c.bar}`}>
              <LegacyButton isDark={isDark} onClick={() => setIsReconciling(false)}>Batal & Cek Ulang</LegacyButton>
              <div className="flex items-center gap-2">
                <LegacyButton isDark={isDark} onClick={() => handleSubmitOpname('draft')} disabled={isSubmitting}>Simpan Draft DB</LegacyButton>
                <LegacyButton isDark={isDark} variant="primary" onClick={() => handleSubmitOpname('post')} disabled={isSubmitting}>
                  {isSubmitting ? 'Memproses...' : 'Confirm Post Adjustment'}
                </LegacyButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reverse (cancel) a posted opname; a reason is required */}
      {isReverseModalOpen && (
        <div className="no-print fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className={`${modalShell} max-w-md`}>
            <div className={`px-4 py-2 border-b ${c.bar}`}>
              <h2 className="text-sm font-bold">Batalkan (Reverse) Opname</h2>
              <p className="text-[11px] font-mono text-rose-600">{noTransaction}</p>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <p className={c.muted}>
                Pembatalan opname akan membuat jurnal pergerakan kompensasi dan mengembalikan saldo stok sebelum transaksi ini diposting.
              </p>
              <label className="flex flex-col gap-1">
                <span className="font-semibold">Alasan Pembatalan (Wajib)</span>
                <textarea
                  rows={3}
                  value={reverseReasonInput}
                  onChange={(e) => setReverseReasonInput(e.target.value)}
                  placeholder="Masukkan alasan pembatalan stok opname..."
                  className={`w-full px-2 py-1 rounded border outline-none focus:ring-1 focus:ring-rose-500 ${c.input}`}
                />
              </label>
            </div>
            <div className={`px-4 py-2 border-t flex justify-end gap-2 ${c.bar}`}>
              <LegacyButton isDark={isDark} onClick={() => setIsReverseModalOpen(false)}>Batal</LegacyButton>
              <LegacyButton isDark={isDark} variant="danger" onClick={handleReverseOpname} disabled={isSubmitting}>
                {isSubmitting ? 'Memproses...' : 'Konfirmasi Reverse'}
              </LegacyButton>
            </div>
          </div>
        </div>
      )}
      {confirmDialogEl}
    </div>
  );
}

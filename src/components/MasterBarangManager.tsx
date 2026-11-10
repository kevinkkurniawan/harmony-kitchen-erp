'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RefreshCw, Trash2, Info, Package, Printer, CheckCircle, XCircle, AlertTriangle, Zap, X } from 'lucide-react';
import { ERPProduct } from '@/types/erp';
import { columnFilterQuery } from '@/components/ColumnFilterRow';
import { useDebounce } from '@/hooks/useDebounce';
import { normalizeInventoryName } from '@/lib/inventory-name';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import {
  LegacyWindow, LegacyButton, LegacyGrid, LegacyPager, LegacyInput, LegacySelect, GroupBox, FieldRow, ContextMenu, menuAt,
  fmtN0, lx, type LegacyColumn, type ContextMenuState,
} from '@/components/legacy';
import { fetchMovement, groupMovementByMonth, movementMonthKey, type MovementRow, type MonthRow } from '@/components/InventoryStockManager';

interface LookupItem {
  id: number;
  brandName?: string;
  categoryName?: string;
  uomName?: string;
  [key: string]: unknown;
}

interface LookupsData {
  brands: LookupItem[];
  categories: LookupItem[];
  uoms: LookupItem[];
  wholesaleCategories: LookupItem[];
}

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

/** GET /api/inventory row: `barcode` falls back to the No. Barang, `rawBarcode` is the stored value. */
type ProductRow = ERPProduct & { rawBarcode?: string };

/** GET /api/inventory/[id]/hpp-history row (old GV_HPP); hpp is null for a receipt without prices. */
interface HppHistoryRow {
  id: number;
  mrNo: string;
  mrDate: string | null;
  supplierName: string;
  hpp: number | null;
}

/** Footer sums over every matching item (server side); stockValue is 0 without HPP rights. */
interface GridTotals {
  stock: number;
  stockValue: number;
  retailValue: number;
}

interface MasterBarangManagerProps {
  isDark: boolean;
  /** 'stock' = read-only stock view (minus filter on, no add / edit / delete / opname) */
  mode?: 'master' | 'stock';
  canViewPrice?: boolean;
}

const EMPTY_FORM: Partial<ERPProduct> = {
  inventoryNo: '', barcode: '', inventoryName: '', inventoryBrandId: 1, inventoryCategoryId: 1, inventoryProductId: 1,
  uoMId: 1, wholesaleCategoryId: 1, kodeHarga: '', description: '', price: 0, disc: 0, isActive: true, hpp: 0,
  priceBuy: 0, grosir1: 0, grosir2: 0, grosir3: 0, stokAwal: 0, stokAkhir: 0,
};

/** Separate window of the legacy app (Detail Barang, report preview): overlay with a title bar. */
function LegacyDialog({ title, isDark, onClose, children, className = 'max-w-3xl' }: {
  title: string;
  isDark: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const c = lx(isDark);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${className} max-h-[90vh] flex flex-col border rounded shadow-2xl text-xs ${c.panel} ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
      >
        <div className={`px-3 py-1.5 border-b flex items-center justify-between font-bold text-[13px] ${c.bar}`}>
          <span>{title}</span>
          <button type="button" onClick={onClose} title="Close" className="p-0.5 rounded hover:bg-rose-600 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 flex flex-col p-2 gap-2 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

/** Legacy Master_Data.Frm_Inventory ("Master Barang"): item grid, in-place edit form, "Show Detail" stock group. */
export default function MasterBarangManager({ isDark, mode = 'master', canViewPrice = false }: MasterBarangManagerProps) {
  const c = lx(isDark);
  const readOnly = mode === 'stock';
  const { confirmDialog, dialog: confirmDialogEl } = useConfirmDialog(isDark);

  // List, filters and server paging
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [onlyActive, setOnlyActive] = useState(true);
  const [minusStock, setMinusStock] = useState<boolean>(mode === 'stock');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const debouncedColumnFilters = useDebounce(columnFilters, 500);
  const [sort, setSort] = useState<{ key: string; order: 'asc' | 'desc' } | null>(null);
  const [pageSize, setPageSize] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [totals, setTotals] = useState<GridTotals | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [lookups, setLookups] = useState<LookupsData>({ brands: [], categories: [], uoms: [], wholesaleCategories: [] });

  const [selectedProduct, setSelectedProduct] = useState<ERPProduct | null>(null);
  const [rowMenu, setRowMenu] = useState<ContextMenuState<ERPProduct> | null>(null);
  const closeRowMenu = useCallback(() => setRowMenu(null), []);

  // In-place edit form (DevExpress edit form): 'new' or the id of the item being edited
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editOriginal, setEditOriginal] = useState<{ inventoryNo: string; rawBarcode: string } | null>(null);
  const [formData, setFormData] = useState<Partial<ERPProduct>>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  // "Show Detail" group: opname qty and the selected item's monthly stock summary
  const [showDetail, setShowDetail] = useState(false);
  const [opnameQty, setOpnameQty] = useState(0);
  const [isSubmittingOpname, setIsSubmittingOpname] = useState(false);
  const [movement, setMovement] = useState<MovementRow[]>([]);
  const [movementTotal, setMovementTotal] = useState(0);
  const [isLoadingMovement, setIsLoadingMovement] = useState(false);
  const [movementVersion, setMovementVersion] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const opnameInputRef = useRef<HTMLInputElement>(null);

  // "Detail Barang" window and "Laporan Stok" report
  const [detailBarang, setDetailBarang] = useState<{ item: ERPProduct; rows: MovementRow[]; total: number; loading: boolean } | null>(null);
  // Purchase-price grid of "Detail Barang" (Admin only, like HPP)
  const [hppHistory, setHppHistory] = useState<{ itemId: string; rows: HppHistoryRow[]; loading: boolean } | null>(null);
  const [isStockReportOpen, setIsStockReportOpen] = useState(false);
  const [reportProducts, setReportProducts] = useState<ERPProduct[] | null>(null);

  const addToast = useCallback((text: string, type: ToastMessage['type'] = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const extractErrorMessage = (json: any, fallback = 'Terjadi kesalahan'): string => {
    if (!json?.error) return fallback;
    if (typeof json.error === 'string') return json.error;
    if (typeof json.error === 'object' && typeof json.error.message === 'string') return json.error.message;
    return fallback;
  };

  // Query string of the current filters (no paging / sort): it also identifies which footer totals are on screen
  const filterQuery = useMemo(() => {
    let q = `q=${encodeURIComponent(debouncedSearchQuery)}${columnFilterQuery(debouncedColumnFilters)}&status=${onlyActive ? 'active' : 'all'}`;
    if (minusStock) q += '&minusStock=true';
    return q;
  }, [debouncedSearchQuery, debouncedColumnFilters, onlyActive, minusStock]);

  // The page belongs to one filter / sort / page size; any change starts again at page 1 (no extra fetch)
  const pageKey = JSON.stringify([filterQuery, sort, pageSize]);
  const [pageState, setPageState] = useState<{ key: string; page: number }>({ key: '', page: 1 });
  const currentPage = pageState.key === pageKey ? pageState.page : 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const inventoryUrl = useCallback((page: number, limit: number) => {
    let url = `/api/inventory?${filterQuery}&page=${page}&limit=${limit}`;
    if (sort) url += `&sort=${sort.key}&order=${sort.order}`;
    return url;
  }, [filterQuery, sort]);

  // Every matching item (Export Data and Laporan Stok), fetched in API-max batches
  const fetchAllProducts = useCallback(async (): Promise<ERPProduct[]> => {
    const BATCH = 5000;
    const all: ERPProduct[] = [];
    for (let page = 1; ; page++) {
      const json = await fetch(inventoryUrl(page, BATCH)).then((r) => r.json());
      if (!json.success || !Array.isArray(json.data)) throw new Error(json.error || 'Gagal memuat data barang');
      all.push(...json.data);
      if (json.data.length < BATCH || all.length >= (json.pagination?.total ?? 0)) return all;
    }
  }, [inventoryUrl]);

  // Page load. Footer totals are requested only when the filters differ from those of the totals on screen,
  // so paging and sorting do not re-sum the catalog; a newer request makes older responses obsolete.
  const totalsKeyRef = useRef<string | null>(null);
  const listReqIdRef = useRef(0);
  const loadProducts = useCallback(async () => {
    const reqId = ++listReqIdRef.current;
    const wantTotals = totalsKeyRef.current !== filterQuery;
    setIsLoading(true);
    try {
      const json = await fetch(`${inventoryUrl(currentPage, pageSize)}${wantTotals ? '&totals=true' : ''}`).then((r) => r.json());
      if (reqId !== listReqIdRef.current) return;
      if (json.success && Array.isArray(json.data)) {
        const total = json.pagination?.total ?? json.data.length;
        setTotalCount(total);
        if (json.totals) {
          setTotals(json.totals);
          totalsKeyRef.current = filterQuery;
        }
        // A reload (delete, Aktif toggle, opname) can shrink the list below the current page: go to the last page
        const lastPage = Math.max(1, Math.ceil(total / pageSize));
        if (currentPage > lastPage) {
          setPageState({ key: pageKey, page: lastPage });
          return;
        }
        setProducts(json.data);
        setSelectedProduct((prev) => (prev ? json.data.find((p: ERPProduct) => p.id === prev.id) || json.data[0] || null : json.data[0] || null));
      } else {
        addToast(`Gagal memuat data barang: ${extractErrorMessage(json)}`, 'error');
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
      if (reqId === listReqIdRef.current) addToast('Gagal terhubung ke database', 'error');
    } finally {
      if (reqId === listReqIdRef.current) setIsLoading(false);
    }
  }, [filterQuery, inventoryUrl, currentPage, pageSize, pageKey, addToast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // After a save / delete / opname / Refresh the totals may have changed as well
  const reloadProducts = useCallback(() => {
    totalsKeyRef.current = null;
    return loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/inventory/lookups')
      .then((r) => r.json())
      .then((json) => {
        if (isMounted && json.success && json.data) {
          setLookups({
            brands: json.data.brands || [],
            categories: json.data.categories || [],
            uoms: json.data.uoms || [],
            wholesaleCategories: json.data.wholesaleCategories || [],
          });
        }
      })
      .catch((err) => console.error('Error fetching lookups:', err));
    return () => { isMounted = false; };
  }, []);

  // Monthly stock summary of the selected item, loaded only while "Show Detail" is open
  const selectedId = selectedProduct?.id ?? null;
  useEffect(() => {
    if (!showDetail || !selectedId) return;
    let isCurrent = true;
    setIsLoadingMovement(true);
    setMovement([]);
    setMovementTotal(0);
    setSelectedMonth(null);
    fetchMovement(selectedId)
      .then((result) => { if (isCurrent) { setMovement(result.rows); setMovementTotal(result.total); } })
      .catch(() => { if (isCurrent) setMovement([]); })
      .finally(() => { if (isCurrent) setIsLoadingMovement(false); });
    return () => { isCurrent = false; };
  }, [showDetail, selectedId, movementVersion]);

  const months = useMemo(() => groupMovementByMonth(movement), [movement]);
  const monthTransactions = useMemo(
    () => (selectedMonth ? movement.filter((r) => movementMonthKey(r.date) === selectedMonth) : []),
    [movement, selectedMonth],
  );

  const handleOpenCreate = useCallback(() => {
    if (readOnly) return;
    setEditingId('new');
    setFormData({
      ...EMPTY_FORM,
      inventoryNo: `BRG-${Date.now().toString().slice(-4)}`,
      barcode: `${Math.floor(1000000000000 + Math.random() * 9000000000000)}`,
      inventoryBrandId: lookups.brands[0]?.id || 1,
      inventoryCategoryId: lookups.categories[0]?.id || 1,
      uoMId: lookups.uoms[0]?.id || 1,
      wholesaleCategoryId: lookups.wholesaleCategories[0]?.id || 1,
      kodeHarga: 'STD',
    });
  }, [lookups, readOnly]);

  const handleOpenEdit = (product: ProductRow) => {
    if (readOnly) return;
    const rawBarcode = product.rawBarcode ?? product.barcode;
    setSelectedProduct(product);
    setEditingId(product.id);
    setEditOriginal({ inventoryNo: product.inventoryNo, rawBarcode });
    setFormData({ ...product, barcode: rawBarcode });
  };

  const closeForm = () => setEditingId(null);

  // Keyboard: Escape closes forms / windows, "/" focuses the search, Alt+N opens a new item
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.key === 'Escape') {
        setEditingId(null);
        setIsStockReportOpen(false);
        setDetailBarang(null);
        setRowMenu(null);
      } else if (e.key === '/' && !editingId && !typing) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleOpenCreate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingId, handleOpenCreate]);

  const handleSort = (key: string) => {
    setSort((prev) => (prev?.key !== key ? { key, order: 'asc' } : prev.order === 'asc' ? { key, order: 'desc' } : null));
  };

  // Export Data: the grid columns of every matching item, HPP-based columns only for users who may see them
  const exportToExcel = async () => {
    let rowsToExport: ERPProduct[];
    try {
      rowsToExport = await fetchAllProducts();
    } catch {
      addToast('Gagal memuat data barang untuk export', 'error');
      return;
    }
    if (rowsToExport.length === 0) {
      addToast('Tidak ada data barang untuk diexport', 'warning');
      return;
    }
    const headers = ['No. Barang', 'Barcode', 'Nama', 'Stok', 'Aktif', 'Harga Retail', ...(canViewPrice ? ['Harga Beli', 'Total H.Stok'] : []), 'Total H.Jual'];
    const rows = rowsToExport.map((p) => {
      const stock = Number(p.stokAkhir || 0);
      return [
        p.inventoryNo || '', p.barcode || '', p.inventoryName || '', stock, p.isActive ? 'Ya' : 'Tidak', Number(p.price || 0),
        ...(canViewPrice ? [Number(p.priceBuy || 0), stock * Number(p.priceBuy || 0)] : []),
        stock * Number(p.price || 0),
      ];
    });
    try {
      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      worksheet['!cols'] = headers.map((header, index) => ({
        wch: Math.min(40, Math.max(header.length + 2, ...rows.map((row) => String(row[index] ?? '').length + 2))),
      }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Barang');
      XLSX.writeFile(workbook, `Master_Barang_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
      addToast(`Berhasil mengexport ${rowsToExport.length} data barang ke Excel`, 'success');
    } catch {
      addToast('Gagal membuat file Excel.', 'error');
    }
  };

  const openStockReport = async () => {
    setReportProducts(null);
    setIsStockReportOpen(true);
    try {
      setReportProducts(await fetchAllProducts());
    } catch {
      addToast('Gagal memuat Laporan Stok', 'error');
      setIsStockReportOpen(false);
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || !editingId) return;
    setIsSaving(true);
    try {
      const isEdit = editingId !== 'new';
      const body: Record<string, unknown> = { ...formData };
      // PUT stores an empty barcode as the No. Barang; leave both out so an item without barcode keeps none
      if (isEdit && editOriginal && !editOriginal.rawBarcode && !formData.barcode && formData.inventoryNo === editOriginal.inventoryNo) {
        delete body.barcode;
        delete body.inventoryNo;
        delete body.inventory_no;
      }
      const res = await fetch(isEdit ? `/api/inventory/${editingId}` : '/api/inventory', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        setEditingId(null);
        addToast(isEdit ? 'Data barang berhasil diperbarui!' : 'Barang baru berhasil ditambahkan!', 'success');
        reloadProducts();
      } else {
        addToast(`Gagal menyimpan: ${extractErrorMessage(json)}`, 'error');
      }
    } catch (err: unknown) {
      addToast(`Terjadi kesalahan: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async (product: ERPProduct) => {
    if (!(await confirmDialog(`Hapus barang "${product.inventoryName}"?

Jika barang sudah punya riwayat transaksi, barang hanya akan dinonaktifkan agar riwayat tetap utuh.`))) return;
    try {
      const json = await fetch(`/api/inventory/${product.id}`, { method: 'DELETE' }).then((r) => r.json());
      if (json.success) {
        addToast(json.message || `Barang "${product.inventoryName}" berhasil dihapus`, json.data?.deactivated ? 'warning' : 'info');
        reloadProducts();
      } else {
        addToast(`Gagal menghapus: ${extractErrorMessage(json)}`, 'error');
      }
    } catch (err: unknown) {
      addToast(`Error: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  // Aktif check column: sends only the flag, so the rest of the item (e.g. an empty barcode) is left as stored
  const handleToggleStatus = async (product: ERPProduct) => {
    try {
      const json = await fetch(`/api/inventory/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !product.isActive }),
      }).then((r) => r.json());
      if (json.success) {
        addToast(`Status "${product.inventoryName}" berhasil diubah`, 'success');
        reloadProducts();
      } else {
        addToast(`Gagal merubah status: ${extractErrorMessage(json)}`, 'error');
      }
    } catch (err: unknown) {
      addToast(`Error: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  // Direct opname of the selected item: 'add' adds qty to the stock, 'set' sets the stock to qty
  const handleSaveOpname = async (opnameMode: 'add' | 'set', qty: number) => {
    if (!selectedProduct || isSubmittingOpname) return;
    setIsSubmittingOpname(true);
    try {
      const json = await fetch('/api/inventory/opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'POST_DIRECT', inventoryId: selectedProduct.id, qtyOpname: qty, mode: opnameMode }),
      }).then((r) => r.json());
      if (json.success) {
        addToast(`Stok "${selectedProduct.inventoryName}" berhasil di${opnameMode === 'add' ? 'tambah' : 'set'} sejumlah ${qty}`, 'success');
        setOpnameQty(0);
        await reloadProducts();
        setMovementVersion((v) => v + 1);
      } else {
        addToast(`Gagal opname: ${extractErrorMessage(json)}`, 'error');
      }
    } catch (err: unknown) {
      addToast(`Error: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setIsSubmittingOpname(false);
    }
  };

  const handleResetStock = async () => {
    if (!selectedProduct) return;
    if (!(await confirmDialog(`Reset stok "${selectedProduct.inventoryName}" ke 0?`, { title: 'Reset Stok ke Nol', confirmText: 'Reset' }))) return;
    await handleSaveOpname('set', 0);
  };

  // Right-click "Stok Opname": like the old app, opens the Show Detail group on that item
  const openStockOpname = (product: ERPProduct) => {
    setSelectedProduct(product);
    setShowDetail(true);
    setTimeout(() => opnameInputRef.current?.focus(), 100);
  };

  const loadHppHistory = async (product: ERPProduct) => {
    setHppHistory({ itemId: product.id, rows: [], loading: true });
    try {
      const json = await fetch(`/api/inventory/${product.id}/hpp-history`).then((r) => r.json());
      if (!json.success) throw new Error(extractErrorMessage(json));
      setHppHistory((prev) => (prev?.itemId === product.id ? { ...prev, rows: json.data, loading: false } : prev));
    } catch (err: unknown) {
      addToast(`Gagal memuat histori harga beli: ${err instanceof Error ? err.message : String(err)}`, 'error');
      setHppHistory((prev) => (prev?.itemId === product.id ? { ...prev, loading: false } : prev));
    }
  };

  const openDetailBarang = async (product: ERPProduct) => {
    setSelectedProduct(product);
    setDetailBarang({ item: product, rows: [], total: 0, loading: true });
    if (canViewPrice) loadHppHistory(product);
    try {
      const { rows, total } = await fetchMovement(product.id);
      setDetailBarang((prev) => (prev?.item.id === product.id ? { ...prev, rows, total, loading: false } : prev));
    } catch {
      addToast('Gagal memuat detail barang', 'error');
      setDetailBarang((prev) => (prev?.item.id === product.id ? { ...prev, loading: false } : prev));
    }
  };

  // Right-click "Cetak Barcode": old OnDeleteRowDetail of Frm_InvList (despite its name it adds the item to the
  // saved barcode print list via sp_MDInventory_PrintBarcodeInsList), with the old confirm and alert texts
  const handleCetakBarcode = async (product: ERPProduct) => {
    if (!(await confirmDialog('Benar Barang Ini Yang Anda Maksud?', { title: 'Confirmation', confirmText: 'Yes' }))) return;
    try {
      const json = await fetch('/api/barcode-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryId: Number(product.id) }),
      }).then((r) => r.json());
      if (!json.success) throw new Error(extractErrorMessage(json));
      // The old alert shows the item's Description; fall back to the name when it is empty
      addToast(`Perintah Masukan Berhasil: ${product.description || product.inventoryName} DITAMBAHKAN`, 'success');
    } catch (err: unknown) {
      addToast(`Perintah Masukan Gagal: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  // Legacy GV_Inventory columns and order; Harga Beli / Total H.Stok are purchase prices (HPP rights only).
  // S. Etalase / S. Gudang / Grup Etalase are left out: the ERP keeps no per-location stock (client doc item 11).
  const columns: LegacyColumn<ERPProduct>[] = [
    { key: 'inventoryNo', caption: 'No. Barang', sortKey: 'inventoryNo', filterKey: 'inventoryno' },
    { key: 'barcode', caption: 'Barcode', sortKey: 'barcode', filterKey: 'barcode' },
    { key: 'inventoryName', caption: 'Nama', sortKey: 'inventoryName', filterKey: 'inventoryname' },
    {
      key: 'stokAkhir', caption: 'Stok', format: 'n0', sortKey: 'stokAkhir', footer: totals ? fmtN0(totals.stock) : '',
      render: (p) => <span className={p.stokAkhir < 0 ? 'text-rose-600 font-semibold' : ''}>{fmtN0(p.stokAkhir)}</span>,
    },
    {
      key: 'isActive', caption: '', align: 'center', width: 28,
      render: (p) => (
        <input
          type="checkbox"
          aria-label={`Aktif ${p.inventoryNo}`}
          checked={Boolean(p.isActive)}
          disabled={readOnly}
          onClick={(e) => e.stopPropagation()}
          onChange={() => handleToggleStatus(p)}
          className="w-3.5 h-3.5 cursor-pointer align-middle"
        />
      ),
    },
    { key: 'price', caption: 'Harga Retail', format: 'n0', sortKey: 'price' },
    ...(canViewPrice
      ? ([
          { key: 'priceBuy', caption: 'Harga Beli', format: 'n0' },
          {
            key: 'totalStockValue', caption: 'Total H.Stok', format: 'n0', footer: totals ? fmtN0(totals.stockValue) : '',
            render: (p) => fmtN0(Number(p.stokAkhir || 0) * Number(p.priceBuy || 0)),
          },
        ] as LegacyColumn<ERPProduct>[])
      : []),
    {
      key: 'totalRetailValue', caption: 'Total H.Jual', format: 'n0', footer: totals ? fmtN0(totals.retailValue) : '',
      render: (p) => fmtN0(Number(p.stokAkhir || 0) * Number(p.price || 0)),
    },
  ];

  const monthColumns: LegacyColumn<MonthRow>[] = [
    { key: 'monthName', caption: 'Bulan' },
    { key: 'year', caption: 'Tahun', render: (r) => String(r.year) },
    { key: 'qty', caption: 'Qty', format: 'n0' },
  ];

  const monthDetailColumns: LegacyColumn<MovementRow>[] = [
    { key: 'transactionNo', caption: 'No. Transaksi' },
    { key: 'date', caption: 'Tanggal', format: 'date' },
    { key: 'qtyIn', caption: 'In', format: 'n0' },
    { key: 'qtyOut', caption: 'Out', format: 'n0' },
  ];

  const detailBarangColumns: LegacyColumn<MovementRow>[] = [
    { key: 'type', caption: 'Mode' },
    { key: 'transactionNo', caption: 'No. Transaksi' },
    { key: 'date', caption: 'Tgl. Transaksi', format: 'date' },
    { key: 'qtyIn', caption: 'Masuk', format: 'n0' },
    { key: 'qtyOut', caption: 'Keluar', format: 'n0' },
  ];

  // Old Frm_InvListDetail GV_HPP: No. Pembelian | Tgl. Beli | Supplier | Harga Beli
  const hppHistoryColumns: LegacyColumn<HppHistoryRow>[] = [
    { key: 'mrNo', caption: 'No. Pembelian' },
    { key: 'mrDate', caption: 'Tgl. Beli', format: 'date' },
    { key: 'supplierName', caption: 'Supplier' },
    { key: 'hpp', caption: 'Harga Beli', align: 'right', render: (r) => (r.hpp === null ? '' : fmtN0(r.hpp)) },
  ];

  // Laporan Stok = legacy "Laporan Stok Akhir" report: IN HPP = HPP x Stok (HPP rights only), IN H. Jual = Stok x Harga
  const reportRows = useMemo(() => reportProducts ?? [], [reportProducts]);
  const reportSum = useMemo(() => reportRows.reduce(
    (acc, p) => {
      const stock = Number(p.stokAkhir || 0);
      acc.stock += stock;
      acc.hpp += stock * Number(p.hpp || 0);
      acc.retail += stock * Number(p.price || 0);
      return acc;
    },
    { stock: 0, hpp: 0, retail: 0 },
  ), [reportRows]);
  const reportColumns: LegacyColumn<ERPProduct>[] = [
    { key: 'inventoryNo', caption: 'PLU' },
    { key: 'barcode', caption: 'Barcode' },
    { key: 'inventoryName', caption: 'Nama Barang' },
    { key: 'price', caption: 'H. Jual', format: 'n0' },
    { key: 'stokAkhir', caption: 'Stok', format: 'n0', footer: fmtN0(reportSum.stock) },
    ...(canViewPrice
      ? ([{ key: 'inHpp', caption: 'IN HPP', format: 'n0', footer: fmtN0(reportSum.hpp), render: (p) => fmtN0(Number(p.stokAkhir || 0) * Number(p.hpp || 0)) }] as LegacyColumn<ERPProduct>[])
      : []),
    { key: 'inRetail', caption: 'IN H. Jual', format: 'n0', footer: fmtN0(reportSum.retail), render: (p) => fmtN0(Number(p.stokAkhir || 0) * Number(p.price || 0)) },
  ];

  // Keeps the item's current brand / category selectable even when the lookup list lacks it
  const withCurrent = (list: LookupItem[], id: number | undefined, label: string | undefined, field: 'brandName' | 'categoryName') =>
    id != null && !list.some((o) => Number(o.id) === Number(id)) ? [{ id, [field]: label || String(id) } as LookupItem, ...list] : list;

  const num = (v: string) => parseFloat(v) || 0;

  const renderEditForm = () => (
    <GroupBox caption={editingId === 'new' ? 'Barang Baru' : formData.inventoryName || formData.inventoryNo} isDark={isDark} className="shrink-0">
      <form onSubmit={handleSaveForm} className="flex flex-col gap-2">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-1.5">
          <FieldRow label="No. Barang :" isDark={isDark}>
            <LegacyInput isDark={isDark} required value={formData.inventoryNo || ''} onChange={(e) => setFormData({ ...formData, inventoryNo: e.target.value })} />
          </FieldRow>
          <FieldRow label="Barcode :" isDark={isDark}>
            <LegacyInput isDark={isDark} value={formData.barcode || ''} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} />
          </FieldRow>
          <FieldRow label="Kode :" isDark={isDark}>
            <LegacyInput isDark={isDark} value={formData.kodeHarga || ''} onChange={(e) => setFormData({ ...formData, kodeHarga: e.target.value })} />
          </FieldRow>
          <FieldRow label="Nama Barang :" isDark={isDark}>
            <LegacyInput
              isDark={isDark}
              required
              value={formData.inventoryName || ''}
              title="Nama akan dirapikan otomatis."
              onChange={(e) => setFormData({ ...formData, inventoryName: e.target.value })}
              onBlur={(e) => setFormData({ ...formData, inventoryName: normalizeInventoryName(e.target.value) })}
            />
          </FieldRow>
          <FieldRow label="Kategori :" isDark={isDark}>
            <LegacySelect isDark={isDark} value={formData.inventoryCategoryId ?? ''} onChange={(e) => setFormData({ ...formData, inventoryCategoryId: Number(e.target.value) })}>
              {withCurrent(lookups.categories, formData.inventoryCategoryId, formData.categoryName, 'categoryName').map((o) => (
                <option key={o.id} value={o.id}>{o.categoryName}</option>
              ))}
            </LegacySelect>
          </FieldRow>
          <FieldRow label="Merk :" isDark={isDark}>
            <LegacySelect isDark={isDark} value={formData.inventoryBrandId ?? ''} onChange={(e) => setFormData({ ...formData, inventoryBrandId: Number(e.target.value) })}>
              {withCurrent(lookups.brands, formData.inventoryBrandId, formData.brandName, 'brandName').map((o) => (
                <option key={o.id} value={o.id}>{o.brandName}</option>
              ))}
            </LegacySelect>
          </FieldRow>
          <FieldRow label="Satuan :" isDark={isDark}>
            <LegacySelect isDark={isDark} value={formData.uoMId || 1} onChange={(e) => setFormData({ ...formData, uoMId: parseInt(e.target.value) })}>
              {lookups.uoms.map((u) => <option key={u.id} value={u.id}>{u.uomName}</option>)}
            </LegacySelect>
          </FieldRow>
          <FieldRow label="Harga Retail :" isDark={isDark}>
            <LegacyInput isDark={isDark} type="number" required value={formData.price ?? 0} onChange={(e) => setFormData({ ...formData, price: num(e.target.value) })} />
          </FieldRow>
          {canViewPrice && (
            <>
              <FieldRow label="Harga Beli :" isDark={isDark}>
                <LegacyInput isDark={isDark} type="number" value={formData.priceBuy ?? 0} onChange={(e) => setFormData({ ...formData, priceBuy: num(e.target.value) })} />
              </FieldRow>
              <FieldRow label="HPP :" isDark={isDark}>
                <LegacyInput isDark={isDark} type="number" value={formData.hpp ?? 0} onChange={(e) => setFormData({ ...formData, hpp: num(e.target.value) })} />
              </FieldRow>
              <FieldRow label="Stok Awal :" isDark={isDark}>
                <LegacyInput isDark={isDark} type="number" value={formData.stokAwal ?? 0} onChange={(e) => setFormData({ ...formData, stokAwal: parseInt(e.target.value) || 0 })} />
              </FieldRow>
            </>
          )}
          <FieldRow label="Grosir 1 :" isDark={isDark}>
            <LegacyInput isDark={isDark} type="number" value={formData.grosir1 ?? 0} onChange={(e) => setFormData({ ...formData, grosir1: num(e.target.value) })} />
          </FieldRow>
          <FieldRow label="Grosir 2 :" isDark={isDark}>
            <LegacyInput isDark={isDark} type="number" value={formData.grosir2 ?? 0} onChange={(e) => setFormData({ ...formData, grosir2: num(e.target.value) })} />
          </FieldRow>
          <FieldRow label="Grosir 3 :" isDark={isDark}>
            <LegacyInput isDark={isDark} type="number" value={formData.grosir3 ?? 0} onChange={(e) => setFormData({ ...formData, grosir3: num(e.target.value) })} />
          </FieldRow>
          <div className="md:col-span-2">
            <FieldRow label="Keterangan :" isDark={isDark}>
              <LegacyInput isDark={isDark} value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </FieldRow>
          </div>
          <label className="flex items-center gap-2 md:pl-[8.5rem] cursor-pointer">
            <input type="checkbox" checked={Boolean(formData.isActive)} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="w-3.5 h-3.5" />
            <span>Barang Aktif</span>
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <LegacyButton isDark={isDark} type="submit" variant="primary" disabled={isSaving}>{isSaving ? 'Menyimpan...' : 'Update'}</LegacyButton>
          <LegacyButton isDark={isDark} onClick={closeForm}>Cancel</LegacyButton>
        </div>
      </form>
    </GroupBox>
  );

  return (
    <LegacyWindow
      title="Master Barang"
      isDark={isDark}
      toolbar={
        <>
          <div className="w-full sm:w-96">
            <FieldRow label="Cari Barang :" isDark={isDark} labelWidth="w-auto">
              <LegacyInput
                ref={searchInputRef}
                isDark={isDark}
                type="search"
                placeholder="-- Ketik di sini untuk filter pencarian"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </FieldRow>
          </div>
          <LegacyButton isDark={isDark} onClick={() => reloadProducts()} icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}>
            Refresh
          </LegacyButton>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} className="w-3.5 h-3.5" />
            <span>Tampilkan Barang Aktif Saja</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={minusStock} onChange={(e) => setMinusStock(e.target.checked)} className="w-3.5 h-3.5" />
            <span>Tampilkan Stok Minus</span>
          </label>
          <LegacyButton isDark={isDark} onClick={() => setShowDetail((v) => !v)}>{showDetail ? 'Hide Detail' : 'Show Detail'}</LegacyButton>
          <div className="flex items-center gap-2 sm:ml-auto">
            <LegacyButton isDark={isDark} onClick={openStockReport}>Laporan Stok</LegacyButton>
            <LegacyButton isDark={isDark} onClick={exportToExcel}>Export Data</LegacyButton>
          </div>
        </>
      }
    >
      {confirmDialogEl}
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

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2">
        <div className="flex-1 min-w-0 min-h-[260px] flex flex-col gap-2">
          {editingId && renderEditForm()}
          {!readOnly && !editingId && (
            // DevExpress "new item row" at the top of the grid
            <button
              type="button"
              onClick={handleOpenCreate}
              title="Alt+N"
              className={`text-left px-2 py-1 border rounded italic cursor-pointer ${c.panel} ${c.muted} ${c.rowHover}`}
            >
              Click here to add a new row
            </button>
          )}
          <LegacyGrid
            isDark={isDark}
            columns={columns}
            rows={products}
            rowKey={(p) => p.id}
            loading={isLoading}
            emptyText="Tidak ada barang ditemukan."
            focusedKey={selectedProduct?.id ?? null}
            onRowClick={setSelectedProduct}
            onRowDoubleClick={handleOpenEdit}
            onRowContextMenu={readOnly ? undefined : (p, e) => { setSelectedProduct(p); setRowMenu(menuAt(e, p, 3)); }}
            sort={sort}
            onSort={handleSort}
            filters={columnFilters}
            onFilterChange={(key, value) => setColumnFilters((prev) => ({ ...prev, [key]: value }))}
            showFooter
          />
          <LegacyPager
            isDark={isDark}
            page={currentPage}
            totalPages={totalPages}
            total={totalCount}
            shown={products.length}
            unit="barang"
            pageSize={pageSize}
            onPageSize={setPageSize}
            onPage={(p) => setPageState({ key: pageKey, page: Math.min(Math.max(1, p), totalPages) })}
          />
        </div>

        {showDetail && (
          <GroupBox caption="Show Detail" isDark={isDark} className="lg:w-[380px] shrink-0 min-h-[320px]">
            <div className="font-bold text-[13px] truncate" title={selectedProduct?.inventoryName}>{selectedProduct?.inventoryName || 'Pilih Barang'}</div>
            {!readOnly && (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="w-24 shrink-0">
                    <LegacyInput
                      ref={opnameInputRef}
                      id="input-opname"
                      isDark={isDark}
                      type="number"
                      aria-label="Qty Opname"
                      value={opnameQty}
                      disabled={!selectedProduct || isSubmittingOpname}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setOpnameQty(isNaN(val) ? 0 : val);
                      }}
                    />
                  </div>
                  <LegacyButton isDark={isDark} variant="primary" disabled={!selectedProduct || isSubmittingOpname} onClick={() => handleSaveOpname('add', opnameQty)}>
                    Tambahkan Stok Opname
                  </LegacyButton>
                </div>
                <div>
                  <LegacyButton isDark={isDark} disabled={!selectedProduct || isSubmittingOpname} onClick={handleResetStock}>Reset Stok ke Nol</LegacyButton>
                </div>
              </>
            )}
            <div className="h-44 shrink-0 flex flex-col">
              <LegacyGrid
                isDark={isDark}
                columns={monthColumns}
                rows={months}
                rowKey={(r) => r.key}
                loading={isLoadingMovement}
                emptyText={selectedProduct ? 'Belum ada transaksi.' : ''}
                focusedKey={selectedMonth}
                onRowClick={(r) => setSelectedMonth((prev) => (prev === r.key ? null : r.key))}
              />
            </div>
            {selectedMonth && (
              <div className="flex-1 min-h-[140px] flex flex-col">
                <LegacyGrid isDark={isDark} columns={monthDetailColumns} rows={monthTransactions} rowKey={(r) => r.id} />
              </div>
            )}
            {movementTotal > movement.length && (
              <div className={c.muted}>Menampilkan {fmtN0(movement.length)} dari {fmtN0(movementTotal)} mutasi terbaru.</div>
            )}
          </GroupBox>
        )}
      </div>

      {rowMenu && (
        <ContextMenu
          isDark={isDark}
          x={rowMenu.x}
          y={rowMenu.y}
          onClose={closeRowMenu}
          items={[
            { label: 'Hapus Barang', icon: <Trash2 className="w-3.5 h-3.5" />, danger: true, onClick: () => handleDeleteProduct(rowMenu.row) },
            { label: 'Detail Barang', icon: <Info className="w-3.5 h-3.5" />, onClick: () => openDetailBarang(rowMenu.row) },
            { label: 'Stok Opname', icon: <Package className="w-3.5 h-3.5" />, onClick: () => openStockOpname(rowMenu.row) },
            { label: 'Cetak Barcode', icon: <Printer className="w-3.5 h-3.5" />, onClick: () => handleCetakBarcode(rowMenu.row) },
          ]}
        />
      )}

      {detailBarang && (
        <LegacyDialog
          title="Detail Barang"
          isDark={isDark}
          onClose={() => { setDetailBarang(null); setHppHistory(null); }}
          className={canViewPrice ? 'max-w-6xl' : 'max-w-3xl'}
        >
          <div className="font-bold text-[13px]">{detailBarang.item.inventoryName}</div>
          {/* Old Frm_InvListDetail: transaction history on the left, purchase prices (GV_HPP) on the right */}
          <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-2">
            <div className="md:flex-[737] min-w-0 min-h-[300px] flex flex-col gap-1">
              <LegacyGrid
                isDark={isDark}
                columns={detailBarangColumns}
                rows={detailBarang.rows}
                rowKey={(r) => r.id}
                loading={detailBarang.loading}
                emptyText="Belum ada riwayat transaksi."
              />
              {detailBarang.total > detailBarang.rows.length && (
                <div className={c.muted}>Menampilkan {fmtN0(detailBarang.rows.length)} dari {fmtN0(detailBarang.total)} mutasi terbaru.</div>
              )}
            </div>
            {canViewPrice && (
              <div data-testid="hpp-history" className="md:flex-[557] min-w-0 min-h-[300px] flex flex-col">
                <LegacyGrid
                  isDark={isDark}
                  columns={hppHistoryColumns}
                  rows={hppHistory?.itemId === detailBarang.item.id ? hppHistory.rows : []}
                  rowKey={(r) => r.id}
                  loading={hppHistory?.loading ?? false}
                  emptyText="Belum ada riwayat pembelian."
                />
              </div>
            )}
          </div>
        </LegacyDialog>
      )}

      {isStockReportOpen && (
        <LegacyDialog title="Laporan Stok Akhir" isDark={isDark} onClose={() => setIsStockReportOpen(false)} className="max-w-5xl">
          <div className="flex-1 min-h-[300px] flex flex-col">
            <LegacyGrid
              isDark={isDark}
              columns={reportColumns}
              rows={reportRows}
              rowKey={(p) => p.id}
              loading={reportProducts === null}
              emptyText="Tidak ada data barang."
              showFooter
            />
          </div>
        </LegacyDialog>
      )}
    </LegacyWindow>
  );
}

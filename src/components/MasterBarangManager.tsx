'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  RefreshCw,
  Plus,
  BarChart3,
  Edit,
  Trash2,
  Package,
  CheckCircle,
  XCircle,
  Printer,
  X,
  AlertTriangle,
  Eye,
  EyeOff,
  Download,
  Info,
  ChevronUp,
  ChevronDown,
  Zap,
  Copy,
  Check,
} from 'lucide-react';
import { ERPProduct } from '@/types/erp';
import { useDebounce } from '@/hooks/useDebounce';
import { normalizeInventoryName } from '@/lib/inventory-name';

interface LookupItem {
  id: number;
  brandNo?: string;
  brandName?: string;
  categoryNo?: string;
  categoryName?: string;
  productNo?: string;
  productName?: string;
  uomCode?: string;
  uomName?: string;
  code?: string;
  name?: string;
  tier1_minqty?: number;
  tier2_minqty?: number;
  tier3_minqty?: number;
  [key: string]: unknown;
}

interface LookupsData {
  brands: LookupItem[];
  productTypes: LookupItem[];
  uoms: LookupItem[];
  wholesaleCategories: LookupItem[];
}

interface HppHistoryItem {
  id: string;
  mrNo: string;
  mrDate: string;
  supplierName: string;
  hpp: number;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

interface MasterBarangManagerProps {
  isDark: boolean;
  mode?: 'master' | 'stock';
  canViewPrice?: boolean;
}

export default function MasterBarangManager({ isDark, mode = 'master', canViewPrice = false }: MasterBarangManagerProps) {
  // Main Data States
  const [products, setProducts] = useState<ERPProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  
  // 3-state Filter: 'active' | 'inactive' | 'all'
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [filterMinusStock, setFilterMinusStock] = useState<boolean>(mode === 'stock');
  const [filterBrandId, setFilterBrandId] = useState<number | 'all'>('all');
  const [showDetailPane, setShowDetailPane] = useState<boolean>(true);

  // Sorting State
  const [sortField, setSortField] = useState<keyof ERPProduct | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Toast Notification State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Search input ref for keyboard shortcut
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [lookups, setLookups] = useState<LookupsData>({
    brands: [],
    productTypes: [],
    uoms: [],
    wholesaleCategories: [],
  });

  // Selected Row & Context Menu States
  const [selectedProduct, setSelectedProduct] = useState<ERPProduct | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: ERPProduct } | null>(null);

  // Inline Expand States (Single Responsive Form)
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [hppHistory, setHppHistory] = useState<HppHistoryItem[]>([]);
  const [showHppHistory, setShowHppHistory] = useState<boolean>(false);

  // Opname Quick State
  const [isSubmittingOpname, setIsSubmittingOpname] = useState(false);
  const [opnameQty, setOpnameQty] = useState<number>(0);
  useEffect(() => {
    if (selectedProduct) setOpnameQty(selectedProduct.stokAkhir || 0);
  }, [selectedProduct]);

  // Stock Report Modal State
  const [isStockReportModalOpen, setIsStockReportModalOpen] = useState(false);

  // Form Fields State (Single Unified Form)
  const [formData, setFormData] = useState<Partial<ERPProduct>>({
    inventoryNo: '',
    barcode: '',
    inventoryName: '',
    inventoryBrandId: 1,
    inventoryProductId: 1,
    uoMId: 1,
    wholesaleCategoryId: 1,
    kodeHarga: '',
    description: '',
    price: 0,
    disc: 0,
    isActive: true,
    hpp: 0,
    priceBuy: 0,
    grosir1: 0,
    grosir2: 0,
    grosir3: 0,
    stokAwal: 0,
    stokAkhir: 0,
  });

  // Toast Trigger Helper
  const addToast = useCallback((text: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // Fetch Inventory List from PostgreSQL
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = `/api/inventory?q=${encodeURIComponent(debouncedSearchQuery)}&limit=1000`;
      if (filterMinusStock) url += `&minusStock=true`;
      if (statusFilter) url += `&status=${statusFilter}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setProducts(json.data);
        if (json.data.length > 0) {
          setSelectedProduct((prev) => prev ? (json.data.find((p: ERPProduct) => p.id === prev.id) || json.data[0]) : json.data[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
      addToast('Gagal terhubung ke database', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearchQuery, filterMinusStock, statusFilter, addToast]);

  // Initial load and filter change trigger
  useEffect(() => {
    let isMounted = true;
    const runFetch = async () => {
      setIsLoading(true);
      try {
        let url = `/api/inventory?q=${encodeURIComponent(debouncedSearchQuery)}&limit=1000`;
        if (filterMinusStock) url += `&minusStock=true`;
        if (statusFilter) url += `&status=${statusFilter}`;
        const res = await fetch(url);
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data)) {
          setProducts(json.data);
          if (json.data.length > 0) {
            setSelectedProduct((prev) => prev ? (json.data.find((p: ERPProduct) => p.id === prev.id) || json.data[0]) : json.data[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching inventory:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    runFetch();
    return () => { isMounted = false; };
  }, [debouncedSearchQuery, filterMinusStock, statusFilter]);

  // Fetch Dropdown Lookups on Mount
  useEffect(() => {
    let isMounted = true;
    const runLookups = async () => {
      try {
        const res = await fetch('/api/inventory/lookups');
        const json = await res.json();
        if (isMounted && json.success && json.data) {
          setLookups({
            brands: json.data.brands || [],
            productTypes: json.data.productTypes || [],
            uoms: json.data.uoms || [],
            wholesaleCategories: json.data.wholesaleCategories || [],
          });
        }
      } catch (err) {
        console.error('Error fetching lookups:', err);
      }
    };
    runLookups();
    return () => { isMounted = false; };
  }, []);

  // Fetch HPP History when selecting a product
  const fetchHppHistory = useCallback(async (productId: string) => {
    try {
      const res = await fetch(`/api/inventory/${productId}/hpp-history`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setHppHistory(json.data);
      } else {
        setHppHistory([]);
      }
    } catch {
      setHppHistory([]);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (!selectedProduct) return;
    const runHppHistory = async () => {
      try {
        const res = await fetch(`/api/inventory/${selectedProduct.id}/hpp-history`);
        const json = await res.json();
        if (isMounted) {
          if (json.success && Array.isArray(json.data)) {
            setHppHistory(json.data);
          } else {
            setHppHistory([]);
          }
        }
      } catch {
        if (isMounted) setHppHistory([]);
      }
    };
    runHppHistory();
    return () => { isMounted = false; };
  }, [selectedProduct]);

  // Open Add Inline
  const handleOpenCreateInline = useCallback(() => {
    setIsCreatingNew(true);
    setExpandedRowId('new');
    setShowHppHistory(false);
    setFormData({
      inventoryNo: `BRG-${Date.now().toString().slice(-4)}`,
      barcode: `${Math.floor(1000000000000 + Math.random() * 9000000000000)}`,
      inventoryName: '',
      inventoryBrandId: lookups.brands[0]?.id || 1,
      inventoryProductId: lookups.productTypes[0]?.id || 1,
      uoMId: lookups.uoms[0]?.id || 1,
      wholesaleCategoryId: lookups.wholesaleCategories[0]?.id || 1,
      kodeHarga: 'STD',
      description: '',
      price: 0,
      disc: 0,
      isActive: true,
      hpp: 0,
      priceBuy: 0,
      grosir1: 0,
      grosir2: 0,
      grosir3: 0,
      stokAwal: 0,
      stokAkhir: 0,
    });
    setHppHistory([]);
  }, [lookups]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpandedRowId(null);
        setIsCreatingNew(false);
        setIsStockReportModalOpen(false);
        setContextMenu(null);
      } else if (e.key === '/' && !expandedRowId) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleOpenCreateInline();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedRowId, handleOpenCreateInline]);

  // Sort Handler
  const handleSort = (field: keyof ERPProduct) => {
    if (sortField !== field) {
      setSortField(field);
      setSortOrder('asc');
    } else if (sortOrder === 'asc') {
      setSortOrder('desc');
    } else {
      setSortField(null);
      setSortOrder('asc');
    }
  };

  // Processed & Filtered & Sorted Products
  const sortedProducts = [...products]
    .filter(p => filterBrandId === 'all' || p.inventoryBrandId === filterBrandId);

  const orderedProducts = sortField ? sortedProducts.sort((a, b) => {
      const valA = a[sortField] ?? '';
      const valB = b[sortField] ?? '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      return sortOrder === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    }) : sortedProducts;

  // Paginated Products
  const totalPages = Math.ceil(orderedProducts.length / pageSize) || 1;
  const paginatedProducts = orderedProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const exportToExcel = async () => {
    if (orderedProducts.length === 0) {
      addToast('Tidak ada data barang untuk diexport', 'warning');
      return;
    }

    const headers = [
      'ID',
      'Inventory No',
      'Barcode',
      'Nama Barang',
      'Brand',
      'Product Type',
      'Satuan (UoM)',
      'Harga Retail',
      ...(canViewPrice ? ['HPP (Modal)', 'Harga Beli'] : []),
      'Grosir 1',
      'Grosir 2',
      'Grosir 3',
      'Kategori Grosir',
      'Stok Awal',
      'Stok Akhir',
      'Status Aktif',
    ];

    const rows = orderedProducts.map((p) => [
      p.id,
      p.inventoryNo || '',
      p.barcode || '',
      p.inventoryName || '',
      p.brandName || '',
      p.productName || '',
      p.uomName || 'PCS',
      p.price || 0,
      ...(canViewPrice ? [p.hpp || 0, p.priceBuy || 0] : []),
      p.grosir1 || 0,
      p.grosir2 || 0,
      p.grosir3 || 0,
      p.wholesaleCategory?.name || p.wholesaleCategoryName || 'Standard',
      p.stokAwal || 0,
      p.stokAkhir || 0,
      p.isActive ? 'AKTIF' : 'NON-AKTIF',
    ]);

    try {
      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      worksheet['!cols'] = headers.map((header, index) => ({
        wch: Math.min(40, Math.max(header.length + 2, ...rows.map((row) => String(row[index] ?? '').length + 2))),
      }));
      worksheet['!freeze'] = { ySplit: 1 };

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Barang');
      XLSX.writeFile(workbook, `Master_Barang_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
      addToast(`Berhasil mengexport ${orderedProducts.length} data barang ke Excel`, 'success');
    } catch {
      addToast('Gagal membuat file Excel.', 'error');
    }
  };

  // Open Edit Inline
  const handleToggleExpand = (product: ERPProduct) => {
    const strId = product.id.toString();
    if (expandedRowId === strId) {
      setExpandedRowId(null);
      setIsCreatingNew(false);
      return;
    }
    setSelectedProduct(product);
    setIsCreatingNew(false);
    setExpandedRowId(strId);
    setShowHppHistory(false);
    setFormData({ ...product });
    fetchHppHistory(product.id);
  };

  // Save Form (Create / Edit)
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = !isCreatingNew && selectedProduct;
      const url = isEdit ? `/api/inventory/${selectedProduct.id}` : `/api/inventory`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (json.success) {
        setExpandedRowId(null);
        setIsCreatingNew(false);
        addToast(isEdit ? 'Data barang berhasil diperbarui!' : 'Barang baru berhasil ditambahkan!', 'success');
        fetchProducts();
      } else {
        addToast(`Gagal menyimpan: ${json.error || 'Terjadi kesalahan'}`, 'error');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(`Terjadi kesalahan: ${message}`, 'error');
    }
  };

  // Delete Item
  const handleDeleteProduct = async (product: ERPProduct) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus barang "${product.inventoryName}"?`)) return;
    try {
      const res = await fetch(`/api/inventory/${product.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        addToast(`Barang "${product.inventoryName}" berhasil dihapus`, 'info');
        fetchProducts();
      } else {
        addToast(`Gagal menghapus: ${json.error}`, 'error');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(`Error: ${message}`, 'error');
    }
  };

  // Quick Toggle Status
  const handleToggleStatus = async (product: ERPProduct) => {
    try {
      const res = await fetch(`/api/inventory/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...product, isActive: !product.isActive }),
      });
      const json = await res.json();
      if (json.success) {
        addToast(`Status "${product.inventoryName}" berhasil diubah`, 'success');
        fetchProducts();
      } else {
        addToast(`Gagal merubah status: ${json.error}`, 'error');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(`Error: ${message}`, 'error');
    }
  };

  // Submit Opname Quick Adjust
  const handleSaveOpname = async (opnameMode: 'add' | 'set') => {
    if (!selectedProduct || isSubmittingOpname) return;
    setIsSubmittingOpname(true);
    try {
      const res = await fetch(`/api/inventory/opname`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'POST_DIRECT',
          inventoryId: selectedProduct.id,
          qtyOpname: opnameQty,
          mode: opnameMode,
        }),
      });
      const json = await res.json();
      if (json.success) {
        addToast(`Stok "${selectedProduct.inventoryName}" berhasil di${opnameMode === 'add' ? 'tambah' : 'set'} sejumlah ${opnameQty}`, 'success');
        fetchProducts();
      } else {
        addToast(`Gagal opname: ${json.error}`, 'error');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(`Error: ${message}`, 'error');
    } finally {
      setIsSubmittingOpname(false);
    }
  };

  // Selected wholesale category object helper
  const currentWholesaleCategory = lookups.wholesaleCategories.find(
    (wc) => wc.id === formData.wholesaleCategoryId
  );

  // Close context menu on outside click
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Single Responsive Form Component
  const renderSingleResponsiveForm = () => (
    <div className={`w-full overflow-hidden flex flex-col p-4 border-b-4 border-amber-500 shadow-inner ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-950'}`}>
      {/* Form Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-300 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-amber-500" />
          <h3 className={`font-black text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {isCreatingNew ? 'Tambah Barang Baru' : `Edit Barang: ${formData.inventoryName || formData.inventoryNo}`}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => { setExpandedRowId(null); setIsCreatingNew(false); }}
          className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSaveForm} className="space-y-4 text-xs font-black">
        {/* Section 1: Informasi Produk (Grid) */}
        <div className="space-y-2">
          <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            1. Informasi Dasar Produk
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block mb-1 text-slate-700 dark:text-slate-300">Inventory No (SKU) *</label>
              <input
                type="text"
                required
                value={formData.inventoryNo || ''}
                onChange={(e) => setFormData({ ...formData, inventoryNo: e.target.value })}
                className={`w-full border-2 rounded-xl px-2.5 py-1.5 font-mono font-black focus:ring-2 focus:ring-amber-500 outline-none ${
                  isDark ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                }`}
                placeholder="SKU-XXXX"
              />
            </div>

            <div>
              <label className="block mb-1 text-slate-700 dark:text-slate-300">Barcode</label>
              <input
                type="text"
                value={formData.barcode || ''}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                className={`w-full border-2 rounded-xl px-2.5 py-1.5 font-mono font-black focus:ring-2 focus:ring-amber-500 outline-none ${
                  isDark ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                }`}
                placeholder="EAN / Custom Barcode"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block mb-1 text-slate-700 dark:text-slate-300">Nama Barang *</label>
              <input
                type="text"
                required
                value={formData.inventoryName || ''}
                onChange={(e) => setFormData({ ...formData, inventoryName: e.target.value })}
                onBlur={(e) => setFormData({ ...formData, inventoryName: normalizeInventoryName(e.target.value) })}
                title="Nama akan dirapikan otomatis."
                className={`w-full border-2 rounded-xl px-2.5 py-1.5 font-black focus:ring-2 focus:ring-amber-500 outline-none ${
                  isDark ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                }`}
                placeholder="Nama Barang Lengkap"
              />
            </div>

            <div>
              <label className="block mb-1 text-slate-700 dark:text-slate-300">Brand</label>
              <select
                value={formData.inventoryBrandId || 1}
                onChange={(e) => setFormData({ ...formData, inventoryBrandId: parseInt(e.target.value) })}
                className={`w-full border-2 rounded-xl px-2.5 py-1.5 font-black cursor-pointer outline-none ${
                  isDark ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                {lookups.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.brandName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1 text-slate-700 dark:text-slate-300">Product Type</label>
              <select
                value={formData.inventoryProductId || 1}
                onChange={(e) => setFormData({ ...formData, inventoryProductId: parseInt(e.target.value) })}
                className={`w-full border-2 rounded-xl px-2.5 py-1.5 font-black cursor-pointer outline-none ${
                  isDark ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                {lookups.productTypes.map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.productName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1 text-slate-700 dark:text-slate-300">Satuan (UoM)</label>
              <select
                value={formData.uoMId || 1}
                onChange={(e) => setFormData({ ...formData, uoMId: parseInt(e.target.value) })}
                className={`w-full border-2 rounded-xl px-2.5 py-1.5 font-black cursor-pointer outline-none ${
                  isDark ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                {lookups.uoms.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.uomName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1 text-slate-700 dark:text-slate-300">Status Barang</label>
              <select
                value={formData.isActive ? '1' : '0'}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.value === '1' })}
                className={`w-full border-2 rounded-xl px-2.5 py-1.5 font-black cursor-pointer outline-none ${
                  formData.isActive
                    ? isDark ? 'bg-emerald-950/40 border-emerald-700 text-emerald-300' : 'bg-emerald-50 border-emerald-400 text-emerald-900'
                    : isDark ? 'bg-rose-950/40 border-rose-700 text-rose-300' : 'bg-rose-50 border-rose-400 text-rose-900'
                }`}
              >
                <option value="1">Aktif</option>
                <option value="0">Non-Aktif</option>
              </select>
            </div>

            <div className="md:col-span-4">
              <label className="block mb-1 text-slate-700 dark:text-slate-300">Keterangan / Deskripsi</label>
              <input
                type="text"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={`w-full border-2 rounded-xl px-2.5 py-1.5 font-black focus:ring-2 focus:ring-amber-500 outline-none ${
                  isDark ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                }`}
                placeholder="Deskripsi opsional..."
              />
            </div>
          </div>
        </div>

        {/* Section 2: Skema Harga & Grosir */}
        <div className="space-y-2 pt-2 border-t border-slate-300 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              2. Harga Jual Retail & Skema Tier Grosir
            </span>
            {currentWholesaleCategory && (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                Threshold: G1 (&ge;{currentWholesaleCategory.tier1_minqty || 3} pcs), G2 (&ge;{currentWholesaleCategory.tier2_minqty || 6} pcs), G3 (&ge;{currentWholesaleCategory.tier3_minqty || 12} pcs)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="block mb-1 text-slate-700 dark:text-slate-300">Harga Retail (Jual) *</label>
              <input
                type="number"
                required
                value={formData.price ?? 0}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                className={`w-full border-2 rounded-xl px-2.5 py-1.5 font-black outline-none focus:ring-2 focus:ring-amber-500 ${
                  isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
            </div>

            <div>
              <label className="block mb-1 text-slate-700 dark:text-slate-300">Aturan Kategori Grosir</label>
              <select
                value={formData.wholesaleCategoryId || 1}
                onChange={(e) => setFormData({ ...formData, wholesaleCategoryId: parseInt(e.target.value) || null })}
                className={`w-full border-2 rounded-xl px-2.5 py-1.5 font-black cursor-pointer outline-none ${
                  isDark ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                {lookups.wholesaleCategories.map((wc) => (
                  <option key={wc.id} value={wc.id}>
                    {wc.name} ({wc.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1 text-amber-700 dark:text-amber-400">
                Grosir Tier 1 {currentWholesaleCategory ? `(≥${currentWholesaleCategory.tier1_minqty} pcs)` : ''}
              </label>
              <input
                type="number"
                value={formData.grosir1 ?? 0}
                onChange={(e) => setFormData({ ...formData, grosir1: parseFloat(e.target.value) || 0 })}
                className={`w-full border-2 rounded-xl px-2.5 py-1.5 font-black outline-none ${
                  isDark ? 'bg-slate-950 border-amber-900/50 text-amber-400' : 'bg-amber-50 border-amber-300 text-slate-950'
                }`}
              />
            </div>

            <div>
              <label className="block mb-1 text-amber-700 dark:text-amber-400">
                Grosir Tier 2 {currentWholesaleCategory ? `(≥${currentWholesaleCategory.tier2_minqty} pcs)` : ''}
              </label>
              <input
                type="number"
                value={formData.grosir2 ?? 0}
                onChange={(e) => setFormData({ ...formData, grosir2: parseFloat(e.target.value) || 0 })}
                className={`w-full border-2 rounded-xl px-2.5 py-1.5 font-black outline-none ${
                  isDark ? 'bg-slate-950 border-amber-900/50 text-amber-400' : 'bg-amber-50 border-amber-300 text-slate-950'
                }`}
              />
            </div>

            <div>
              <label className="block mb-1 text-amber-700 dark:text-amber-400">
                Grosir Tier 3 {currentWholesaleCategory ? `(≥${currentWholesaleCategory.tier3_minqty} pcs)` : ''}
              </label>
              <input
                type="number"
                value={formData.grosir3 ?? 0}
                onChange={(e) => setFormData({ ...formData, grosir3: parseFloat(e.target.value) || 0 })}
                className={`w-full border-2 rounded-xl px-2.5 py-1.5 font-black outline-none ${
                  isDark ? 'bg-slate-950 border-amber-900/50 text-amber-400' : 'bg-amber-50 border-amber-300 text-slate-950'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Cost / HPP & Purchase Price (If authorized) */}
        {canViewPrice && (
          <div className="space-y-2 pt-2 border-t border-slate-300 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                3. Harga Modal (HPP) & Pembelian
              </span>
              {!isCreatingNew && (
                <button
                  type="button"
                  onClick={() => setShowHppHistory(!showHppHistory)}
                  className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  {showHppHistory ? 'Sembunyikan Riwayat HPP Penerimaan' : `Lihat Riwayat Penerimaan (${hppHistory.length})`}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block mb-1 text-emerald-800 dark:text-emerald-400">Harga Beli Terakhir</label>
                <input
                  type="number"
                  value={formData.priceBuy ?? 0}
                  onChange={(e) => setFormData({ ...formData, priceBuy: parseFloat(e.target.value) || 0 })}
                  className={`w-full border-2 rounded-xl px-2.5 py-1.5 font-black outline-none ${
                    isDark ? 'bg-slate-950 border-slate-700 text-emerald-400' : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  }`}
                />
              </div>

              <div>
                <label className="block mb-1 text-emerald-800 dark:text-emerald-400">HPP / Cost Modal</label>
                <input
                  type="number"
                  value={formData.hpp ?? 0}
                  onChange={(e) => setFormData({ ...formData, hpp: parseFloat(e.target.value) || 0 })}
                  className={`w-full border-2 rounded-xl px-2.5 py-1.5 font-black outline-none ${
                    isDark ? 'bg-slate-950 border-slate-700 text-emerald-400' : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  }`}
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-700 dark:text-slate-300">Stok Awal</label>
                <input
                  type="number"
                  value={formData.stokAwal ?? 0}
                  onChange={(e) => setFormData({ ...formData, stokAwal: parseInt(e.target.value) || 0 })}
                  className={`w-full border-2 rounded-xl px-2.5 py-1.5 font-black outline-none ${
                    isDark ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>

            {/* Collapsible HPP History Table */}
            {showHppHistory && !isCreatingNew && (
              <div className="mt-2 rounded-xl border-2 border-slate-300 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="bg-slate-900 text-white border-b border-slate-950 font-black">
                      <th className="p-2">No Penerimaan (MR)</th>
                      <th className="p-2">Tanggal</th>
                      <th className="p-2">Supplier</th>
                      <th className="p-2 text-right">HPP Item</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 dark:divide-slate-800 font-bold">
                    {hppHistory.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-3 text-center text-slate-500">
                          Belum ada riwayat penerimaan untuk barang ini.
                        </td>
                      </tr>
                    ) : (
                      hppHistory.map((h) => (
                        <tr key={h.id}>
                          <td className="p-2 font-mono text-amber-600 dark:text-amber-400">{h.mrNo}</td>
                          <td className="p-2 text-slate-600 dark:text-slate-300">{h.mrDate}</td>
                          <td className="p-2">{h.supplierName}</td>
                          <td className="p-2 text-right font-black text-emerald-600 dark:text-emerald-400">
                            Rp {h.hpp.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Form Actions */}
        <div className="pt-3 border-t border-slate-300 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => { setExpandedRowId(null); setIsCreatingNew(false); }}
            className="px-4 py-2 rounded-xl border-2 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-black hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-slate-950 hover:bg-black active:scale-95 text-white font-black text-xs shadow-md cursor-pointer transition-all flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Simpan Barang</span>
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none relative">
      {/* 🔔 FLOATING TOAST NOTIFICATION CONTAINER */}
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-xl border text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-top-4 fade-in duration-200 ${
              toast.type === 'success'
                ? isDark ? 'bg-emerald-950/90 border-emerald-800 text-emerald-300' : 'bg-emerald-800 text-white border-emerald-900'
                : toast.type === 'error'
                ? isDark ? 'bg-rose-950/90 border-rose-800 text-rose-300' : 'bg-rose-800 text-white border-rose-900'
                : toast.type === 'warning'
                ? isDark ? 'bg-amber-950/90 border-amber-800 text-amber-300' : 'bg-amber-800 text-white border-amber-900'
                : isDark ? 'bg-indigo-950/90 border-indigo-800 text-indigo-300' : 'bg-indigo-800 text-white border-indigo-900'
            }`}
          >
            {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-300 shrink-0" />}
            {toast.type === 'error' && <XCircle className="w-4 h-4 text-rose-300 shrink-0" />}
            {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />}
            {toast.type === 'info' && <Zap className="w-4 h-4 text-indigo-300 shrink-0" />}
            <span>{toast.text}</span>
          </div>
        ))}
      </div>

      {/* 👑 MASTER BARANG HEADER TOOLBAR */}
      <div className={`px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3 shadow-sm ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
      }`}>
        {/* 🔘 TOOLBAR ACTION BUTTONS */}
        <div className="flex items-center gap-2 flex-wrap">
          {mode !== 'stock' && (
            <button
              onClick={handleOpenCreateInline}
              className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-black active:scale-95 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              title="Tambah Barang Baru (Alt+N)"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Tambah Barang</span>
            </button>
          )}

          <button
            onClick={() => setShowDetailPane(!showDetailPane)}
            className={`px-2.5 py-1.5 rounded-xl border-2 text-xs font-black flex items-center gap-2 transition-all cursor-pointer active:scale-95 ${
              showDetailPane
                ? isDark ? 'bg-amber-500/30 text-amber-200 border-amber-500/60' : 'bg-amber-200 text-amber-900 border-amber-400 shadow-sm'
                : isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-100 border-slate-600' : 'bg-white hover:bg-white text-slate-800 border-slate-300'
            }`}
          >
            {showDetailPane ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span>Detail Info</span>
            <span className={`w-2 h-2 rounded-full ${showDetailPane ? (isDark ? 'bg-amber-400' : 'bg-amber-600') : 'bg-slate-500'}`} />
          </button>

          <Link
            href="/inventory/barcode"
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
              isDark ? 'bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 border-indigo-700/60' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-300 shadow-sm'
            }`}
          >
            <Printer className="w-3.5 h-3.5 text-indigo-500" />
            <span>Cetak Barcode</span>
          </Link>

          <button
            onClick={() => setIsStockReportModalOpen(true)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-black flex items-center gap-2 transition-all cursor-pointer active:scale-95 ${
              isDark ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border-purple-500/50' : 'bg-purple-100 hover:bg-purple-200 text-purple-900 border-purple-300 shadow-sm'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-purple-400" />
            <span>Laporan Stok</span>
          </button>

          <button
            onClick={() => {
              fetchProducts();
              addToast('Data barang berhasil di-refresh', 'info');
            }}
            className={`px-2.5 py-1.5 rounded-xl border-2 text-xs font-black flex items-center gap-2 transition-all cursor-pointer active:scale-95 ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-950 border-slate-400'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={exportToExcel}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-black flex items-center gap-2 transition-all cursor-pointer active:scale-95 ${
              isDark ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border-emerald-500/50' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-emerald-300 shadow-sm'
            }`}
          >
            <Download className="w-4 h-4 text-emerald-500" />
            <span>Export Excel</span>
          </button>

          {/* 🔘 3-STATE STATUS FILTER & BRAND FILTER */}
          <div className={`flex items-center gap-2 border-l-2 pl-2 ml-1 ${isDark ? 'border-slate-800' : 'border-slate-300'}`}>
            <div className={`flex items-center rounded-xl p-0.5 border ${isDark ? 'border-slate-700 bg-slate-950' : 'border-slate-300 bg-slate-100'}`}>
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? isDark ? 'bg-slate-800 text-amber-400 shadow-sm' : 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  statusFilter === 'active'
                    ? isDark ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800 shadow-sm' : 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Aktif
              </button>
              <button
                onClick={() => setStatusFilter('inactive')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  statusFilter === 'inactive'
                    ? isDark ? 'bg-rose-950/80 text-rose-400 border border-rose-800 shadow-sm' : 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Nonaktif
              </button>
            </div>

            <select
              value={filterBrandId}
              onChange={(e) => setFilterBrandId(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className={`text-xs font-black rounded-lg px-2 py-1.5 cursor-pointer outline-none border ${
                isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800 shadow-sm'
              }`}
            >
              <option value="all">Semua Brand</option>
              {lookups.brands.map((b) => (
                <option key={b.id} value={b.id}>{b.brandName}</option>
              ))}
            </select>

            <label className={`flex items-center gap-1.5 cursor-pointer text-xs font-black transition-colors px-1 ${
              isDark ? 'text-slate-300 hover:text-white' : 'text-slate-950 hover:text-black'
            }`}>
              <input
                type="checkbox"
                checked={filterMinusStock}
                onChange={(e) => setFilterMinusStock(e.target.checked)}
                className="w-4 h-4 rounded border-slate-500 bg-white text-rose-700 focus:ring-0 cursor-pointer accent-rose-700"
              />
              <span className={filterMinusStock ? 'text-rose-600 font-black' : ''}>Minus</span>
            </label>

            {(filterBrandId !== 'all' || statusFilter !== 'active' || filterMinusStock || searchQuery) && (
              <button
                onClick={() => {
                  setFilterBrandId('all');
                  setStatusFilter('active');
                  setFilterMinusStock(false);
                  setSearchQuery('');
                  if (searchInputRef.current) searchInputRef.current.value = '';
                }}
                className={`px-2 py-1 rounded-lg text-[10px] font-black border transition-colors cursor-pointer flex items-center gap-1 ${
                  isDark ? 'bg-slate-800 border-slate-600 text-rose-400 hover:bg-slate-700' : 'bg-white border-slate-300 text-rose-700 hover:bg-slate-100'
                }`}
                title="Reset Filter"
              >
                <X className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Search Bar Input */}
        <div className="flex items-center gap-3 flex-1 min-w-[280px] w-full">
          <div className="relative flex-1 group">
            <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${
              isDark ? 'text-slate-400 group-focus-within:text-amber-400' : 'text-slate-700 group-focus-within:text-slate-950'
            }`} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Cari Barang (SKU / Barcode / Nama)... [/]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full border-2 rounded-xl pl-10 pr-16 py-2 text-xs font-black focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all ${
                isDark ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-400 focus:border-amber-400' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-500 focus:border-slate-700'
              }`}
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full transition-colors cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
                title="Bersihkan pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono font-black px-1.5 py-0.5 rounded border ${
                isDark ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-slate-200 border-slate-400 text-slate-800'
              }`}>
                /
              </kbd>
            )}
          </div>
        </div>
      </div>

      {/* 🔍 SHOW DETAIL TOP BANNER */}
      {showDetailPane && selectedProduct && (
        <div className={`border-b-2 p-4 shrink-0 transition-all shadow-sm ${
          isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
        }`}>
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-300 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h4 className="font-black text-xs uppercase tracking-wider text-slate-950 dark:text-amber-400">
                Detail Infobox: {selectedProduct.inventoryName}
              </h4>
            </div>
            <button
              onClick={() => setShowDetailPane(false)}
              className="text-xs font-black flex items-center gap-1 cursor-pointer p-1 rounded hover:bg-slate-200 text-slate-950 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <X className="w-4 h-4" /> Tutup
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs font-black">
            {/* Box 1: SKU & Barcode */}
            <div className={`p-3 rounded-xl border-2 space-y-1 ${
              isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300 shadow-sm'
            }`}>
              <div className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">SKU / Barcode</div>
              <div className="font-mono font-black text-sm text-slate-900 dark:text-amber-400">{selectedProduct.inventoryNo}</div>
              <div className="font-mono text-slate-600 dark:text-slate-300 text-xs font-bold">{selectedProduct.barcode}</div>
            </div>

            {/* Box 2: Brand & UoM */}
            <div className={`p-3 rounded-xl border-2 space-y-1 ${
              isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300 shadow-sm'
            }`}>
              <div className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Brand & Tipe</div>
              <div className="font-black text-sm text-slate-900 dark:text-white">{selectedProduct.brandName || 'General'}</div>
              <div className="text-slate-600 dark:text-slate-300 text-xs font-bold">{selectedProduct.productName || 'General'} ({selectedProduct.uomName || 'Pcs'})</div>
            </div>

            {/* Box 3: Retail Price & HPP */}
            <div className={`p-3 rounded-xl border-2 space-y-1 ${
              isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300 shadow-sm'
            }`}>
              <div className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">{canViewPrice ? 'Harga Retail & HPP' : 'Harga Retail'}</div>
              <div className="font-black text-sm text-slate-900 dark:text-white">Price: Rp {(selectedProduct.price || 0).toLocaleString('id-ID')}</div>
              {canViewPrice && (
                <div className="font-black text-xs text-emerald-700 dark:text-emerald-400">HPP Modal: Rp {(selectedProduct.hpp || 0).toLocaleString('id-ID')}</div>
              )}
            </div>

            {/* Box 4: Grosir Tiers */}
            <div className={`p-3 rounded-xl border-2 space-y-1 ${
              isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300 shadow-sm'
            }`}>
              <div className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Tier Grosir ({selectedProduct.wholesaleCategory?.name || selectedProduct.wholesaleCategoryName || 'Standard'})
              </div>
              <div className="font-black text-xs text-amber-700 dark:text-amber-400">G1: Rp {(selectedProduct.grosir1 || 0).toLocaleString('id-ID')}</div>
              <div className="font-black text-xs text-slate-700 dark:text-slate-300">
                G2: Rp {(selectedProduct.grosir2 || 0).toLocaleString('id-ID')} | G3: Rp {(selectedProduct.grosir3 || 0).toLocaleString('id-ID')}
              </div>
            </div>

            {/* Box 5: Stock Balance & Quick Opname */}
            <div className={`p-3 rounded-xl border-2 space-y-1 ${
              isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300 shadow-sm'
            }`}>
              <div className="flex justify-between items-center mb-1">
                <div className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Stok: {selectedProduct.stokAkhir}</div>
                {isSubmittingOpname && <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-500" />}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  id="input-opname"
                  type="number"
                  value={opnameQty}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setOpnameQty(isNaN(val) ? 0 : val);
                  }}
                  disabled={isSubmittingOpname}
                  className={`w-full max-w-[70px] border-2 rounded px-2 py-1 text-center font-black outline-none ${
                    isDark ? 'bg-slate-950 border-slate-700 text-emerald-400' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                  placeholder="Qty"
                />
                <button
                  onClick={() => handleSaveOpname('add')}
                  disabled={isSubmittingOpname}
                  className="p-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded transition-all active:scale-95 cursor-pointer"
                  title="Tambah Stok"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleSaveOpname('set')}
                  disabled={isSubmittingOpname}
                  className="p-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded transition-all active:scale-95 cursor-pointer"
                  title="Set Stok"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📊 MAIN BODY CONTAINER: HIGH CONTRAST DATA TABLE */}
      <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${isDark ? 'bg-slate-950' : 'bg-slate-100/60'}`}>
        <div className="flex-1 min-h-0 p-3.5 flex flex-col">
          <div className={`flex-1 min-h-0 overflow-auto rounded-2xl border-2 shadow-xl relative ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
          }`}>
            <table className="w-full text-left text-xs border-separate border-spacing-0">
              <thead className="sticky top-0 z-20">
                <tr className={`h-11 whitespace-nowrap uppercase text-[11px] font-black tracking-wider border-b-2 ${
                  isDark ? 'bg-slate-800 text-slate-100 border-slate-700' : 'bg-slate-200 text-slate-900 border-slate-300'
                }`}>
                  <th className="py-1.5 px-2 w-8 text-center"></th>
                  <th onClick={() => handleSort('inventoryNo')} className="py-1.5 px-2 cursor-pointer hover:text-amber-400 transition-colors">
                    <div className="flex items-center gap-1">
                      <span>Inventory No</span>
                      {sortField === 'inventoryNo' && (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('barcode')} className="py-1.5 px-2 cursor-pointer hover:text-amber-400 transition-colors">
                    <div className="flex items-center gap-1">
                      <span>Barcode</span>
                      {sortField === 'barcode' && (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('inventoryName')} className="py-1.5 px-2 cursor-pointer hover:text-amber-400 transition-colors">
                    <div className="flex items-center gap-1">
                      <span>Nama Barang</span>
                      {sortField === 'inventoryName' && (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('brandName')} className="py-1.5 px-2 cursor-pointer hover:text-amber-400 transition-colors">
                    <div className="flex items-center gap-1">
                      <span>Brand</span>
                      {sortField === 'brandName' && (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('productName')} className="py-1.5 px-2 cursor-pointer hover:text-amber-400 transition-colors">
                    <div className="flex items-center gap-1">
                      <span>Product</span>
                      {sortField === 'productName' && (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('uomName')} className="py-1.5 px-2 cursor-pointer hover:text-amber-400 transition-colors">
                    <div className="flex items-center gap-1">
                      <span>UoM</span>
                      {sortField === 'uomName' && (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('price')} className="py-1.5 px-2 text-right cursor-pointer hover:text-amber-400 transition-colors">
                    <div className="flex items-center justify-end gap-1">
                      <span>Price (Retail)</span>
                      {sortField === 'price' && (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />)}
                    </div>
                  </th>
                  {canViewPrice && (
                    <th onClick={() => handleSort('hpp')} className="py-1.5 px-2 text-right cursor-pointer hover:text-emerald-400 transition-colors">
                      <div className="flex items-center justify-end gap-1">
                        <span>HPP (Modal)</span>
                        {sortField === 'hpp' && (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-emerald-400" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />)}
                      </div>
                    </th>
                  )}
                  <th onClick={() => handleSort('description')} className="py-1.5 px-2 cursor-pointer hover:text-amber-400 transition-colors">
                    <div className="flex items-center gap-1">
                      <span>Keterangan</span>
                      {sortField === 'description' && (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('grosir1')} className="py-1.5 px-2 text-right cursor-pointer hover:text-amber-400 transition-colors">
                    <div className="flex items-center justify-end gap-1">
                      <span>Grosir 1</span>
                      {sortField === 'grosir1' && (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('grosir2')} className="py-1.5 px-2 text-right cursor-pointer hover:text-amber-400 transition-colors">
                    <div className="flex items-center justify-end gap-1">
                      <span>Grosir 2</span>
                      {sortField === 'grosir2' && (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('grosir3')} className="py-1.5 px-2 text-right cursor-pointer hover:text-amber-400 transition-colors">
                    <div className="flex items-center justify-end gap-1">
                      <span>Grosir 3</span>
                      {sortField === 'grosir3' && (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('stokAkhir')} className="py-1.5 px-2 text-center cursor-pointer hover:text-amber-400 transition-colors">
                    <div className="flex items-center justify-center gap-1">
                      <span>Stok Akhir</span>
                      {sortField === 'stokAkhir' && (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />)}
                    </div>
                  </th>
                  <th className="py-1.5 px-2 text-center">Status</th>
                  <th className="py-1.5 px-2 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className={`divide-y text-[11px] ${isDark ? 'divide-slate-700' : 'divide-slate-300'}`}>
                {isCreatingNew && expandedRowId === 'new' && (
                  <tr>
                    <td colSpan={canViewPrice ? 16 : 15} className="p-0">
                      {renderSingleResponsiveForm()}
                    </td>
                  </tr>
                )}
                {isLoading ? (
                  <tr>
                    <td colSpan={canViewPrice ? 16 : 15} className="py-24">
                      <div className="flex flex-col items-center justify-center animate-pulse">
                        <div className="w-12 h-12 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin mb-4 shadow-lg shadow-emerald-500/20"></div>
                        <h3 className="text-lg font-black text-emerald-400 tracking-wider uppercase">Sedang Mengambil Data...</h3>
                        <p className={`text-xs mt-2 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Memuat master data barang dari ERP Database</p>
                      </div>
                    </td>
                  </tr>
                ) : paginatedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={canViewPrice ? 16 : 15} className={`py-12 text-center font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      Tidak ada barang ditemukan.
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((item) => (
                    <React.Fragment key={item.id}>
                      <tr
                        onClick={() => setSelectedProduct(item)}
                        onDoubleClick={() => handleToggleExpand(item)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setSelectedProduct(item);
                          setContextMenu({ x: e.clientX, y: e.clientY, item });
                        }}
                        className={`transition-colors cursor-pointer ${
                          selectedProduct?.id === item.id
                            ? isDark ? 'bg-slate-700 text-amber-300 font-bold border-l-4 border-amber-500' : 'bg-amber-100 text-slate-900 font-bold border-l-4 border-amber-600'
                            : isDark ? 'hover:bg-slate-700 text-slate-100' : 'hover:bg-slate-200 odd:bg-white even:bg-white text-slate-800'
                        }`}
                      >
                        <td className="py-1 px-2 text-center w-10">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleExpand(item); }}
                            className={`p-1 rounded transition-colors cursor-pointer ${isDark ? 'hover:bg-slate-600 text-slate-300' : 'hover:bg-slate-300 text-slate-700'}`}
                          >
                            {expandedRowId === item.id.toString() ? <ChevronUp className="w-4 h-4 text-amber-500" /> : <Plus className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className={`py-1 px-2 font-mono text-[11px] font-black ${isDark ? 'text-amber-300' : 'text-slate-800'}`}>{item.inventoryNo}</td>
                        <td className={`py-1 px-2 font-mono text-[11px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{item.barcode}</td>
                        <td title={item.inventoryName} className={`py-1 px-2 font-black max-w-[280px] truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.inventoryName}</td>
                        <td className={`py-1 px-2 font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{item.brandName || '-'}</td>
                        <td className={`py-1 px-2 font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{item.productName || '-'}</td>
                        <td className={`py-1 px-2 font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{item.uomName || 'PCS'}</td>
                        <td className={`py-1 px-2 text-right font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Rp {(item.price || 0).toLocaleString('id-ID')}</td>
                        {canViewPrice && <td className={`py-1 px-2 text-right font-black ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>Rp {(item.hpp || 0).toLocaleString('id-ID')}</td>}
                        <td className={`py-1 px-2 text-[11px] font-medium max-w-[150px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`} title={item.description || '-'}>
                          {item.description || '-'}
                        </td>
                        <td className={`py-1 px-2 text-right font-bold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Rp {(item.grosir1 || 0).toLocaleString('id-ID')}</td>
                        <td className={`py-1 px-2 text-right font-bold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Rp {(item.grosir2 || 0).toLocaleString('id-ID')}</td>
                        <td className={`py-1 px-2 text-right font-bold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Rp {(item.grosir3 || 0).toLocaleString('id-ID')}</td>
                        <td className="py-1 px-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded font-black text-[11px] ${
                              item.stokAkhir <= 0
                                ? 'bg-rose-700 text-white shadow-sm'
                                : 'bg-emerald-800 text-white shadow-sm'
                            }`}
                          >
                            {item.stokAkhir}
                          </span>
                        </td>
                        <td className="py-1 px-2 text-center">
                          <span className={`px-2 py-0.5 rounded font-black text-[10px] ${
                            item.isActive
                              ? 'bg-slate-950 text-white'
                              : 'bg-slate-300 text-slate-950 border border-slate-500 font-black'
                          }`}>
                            {item.isActive ? 'AKTIF' : 'NON-AKTIF'}
                          </span>
                        </td>
                        <td className="py-1 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {mode !== 'stock' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setContextMenu(null);
                                  handleToggleExpand(item);
                                }}
                                className={`p-1 rounded transition-colors cursor-pointer ${
                                  isDark ? 'hover:bg-slate-600 text-slate-300 hover:text-amber-300' : 'hover:bg-slate-300 text-slate-700 hover:text-amber-700'
                                }`}
                                title="Edit Detail Barang"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {mode !== 'stock' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setContextMenu(null);
                                  setSelectedProduct(item);
                                  setShowDetailPane(true);
                                  setTimeout(() => document.getElementById('input-opname')?.focus(), 100);
                                }}
                                className={`p-1 rounded transition-colors cursor-pointer ${
                                  isDark ? 'hover:bg-slate-600 text-slate-300 hover:text-emerald-300' : 'hover:bg-slate-300 text-slate-700 hover:text-emerald-700'
                                }`}
                                title="Stok Adjust"
                              >
                                <Package className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {mode !== 'stock' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setContextMenu(null);
                                  handleDeleteProduct(item);
                                }}
                                className={`p-1 rounded transition-colors cursor-pointer ${
                                  isDark ? 'hover:bg-slate-600 text-slate-300 hover:text-rose-300' : 'hover:bg-slate-300 text-slate-700 hover:text-rose-700'
                                }`}
                                title="Hapus Barang"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedRowId === item.id.toString() && (
                        <tr>
                          <td colSpan={canViewPrice ? 16 : 15} className="p-0">
                            {renderSingleResponsiveForm()}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 📄 PAGINATION FOOTER */}
        <div className={`px-4 py-2 border-t-2 flex items-center justify-between text-xs font-black shrink-0 ${
          isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
        }`}>
          <div className="flex items-center gap-3">
            <span>Menampilkan {paginatedProducts.length} dari total {orderedProducts.length} barang</span>
            <div className="flex items-center gap-1.5">
              <span>Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(parseInt(e.target.value));
                  setCurrentPage(1);
                }}
                className={`border-2 rounded-lg px-2 py-1 text-xs cursor-pointer focus:outline-none font-black ${
                  isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className={`px-3 py-1 rounded-lg border-2 font-black disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all ${
                isDark ? 'border-slate-800 hover:bg-slate-800 text-slate-200' : 'border-slate-400 hover:bg-slate-100 text-slate-950'
              }`}
            >
              Sebelumnya
            </button>
            <span className={`font-black ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              Halaman {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className={`px-3 py-1 rounded-lg border-2 font-black disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all ${
                isDark ? 'border-slate-800 hover:bg-slate-800 text-slate-200' : 'border-slate-400 hover:bg-slate-100 text-slate-950'
              }`}
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>

      {/* 🖱️ DEVEXPRESS CONTEXT MENU (RIGHT CLICK) */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className={`fixed z-50 w-48 rounded-xl border-2 shadow-2xl py-1 text-xs font-black select-none animate-in fade-in zoom-in-95 duration-100 ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-500 text-slate-950'
          }`}
        >
          {mode !== 'stock' && (
            <>
              <button
                onClick={() => {
                  handleToggleExpand(contextMenu.item);
                  setContextMenu(null);
                }}
                className="w-full px-2.5 py-1.5 text-left hover:bg-amber-500 hover:text-slate-950 font-black flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Detail / Edit Barang</span>
              </button>
              
              <button
                onClick={() => {
                  const { id, inventoryNo, barcode, stokAwal, stokAkhir, ...rest } = contextMenu.item;
                  setFormData({
                    ...rest,
                    inventoryNo: '',
                    barcode: '',
                  });
                  setExpandedRowId(null);
                  setIsCreatingNew(true);
                  setContextMenu(null);
                  addToast(`Menduplikasi "${contextMenu.item.inventoryName}". Silakan isi SKU baru.`, 'info');
                }}
                className="w-full px-2.5 py-1.5 text-left hover:bg-amber-500 hover:text-slate-950 font-black flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Duplikat Barang</span>
              </button>
            </>
          )}

          {mode !== 'stock' && (
            <>
              <div className="h-px bg-slate-300 dark:bg-slate-800 my-1" />
              <button
                onClick={() => {
                  setSelectedProduct(contextMenu.item);
                  setShowDetailPane(true);
                  setContextMenu(null);
                  setTimeout(() => document.getElementById('input-opname')?.focus(), 100);
                }}
                className="w-full px-2.5 py-1.5 text-left hover:bg-emerald-600 hover:text-white font-black text-emerald-800 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Package className="w-3.5 h-3.5" />
                <span>Stok Adjust</span>
              </button>
              <div className="h-px bg-slate-300 dark:bg-slate-800 my-1" />
              <button
                onClick={() => {
                  handleDeleteProduct(contextMenu.item);
                  setContextMenu(null);
                }}
                className="w-full px-2.5 py-1.5 text-left hover:bg-rose-600 hover:text-white font-black text-rose-800 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Barang</span>
              </button>
              <div className="h-px bg-slate-300 dark:bg-slate-700 my-1" />
              <button
                onClick={() => {
                  handleToggleStatus(contextMenu.item);
                  setContextMenu(null);
                }}
                className={`w-full px-2.5 py-1.5 text-left hover:bg-slate-600 hover:text-white font-black flex items-center gap-2 cursor-pointer transition-colors ${
                  contextMenu.item.isActive ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {contextMenu.item.isActive ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                <span>Set {contextMenu.item.isActive ? 'Non-Aktif' : 'Aktif'}</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* 📊 STOCK REPORT MODAL */}
      {isStockReportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-4xl rounded-2xl border-2 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-500 text-slate-950'
          }`}>
            <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b-2 border-slate-900 text-white">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                <h3 className="font-black text-sm text-white">Laporan Mutasi & Saldo Stok Barang</h3>
              </div>
              <button onClick={() => setIsStockReportModalOpen(false)} className="p-1 rounded hover:bg-slate-800 hover:text-white cursor-pointer transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-black">
              <div className="grid grid-cols-3 gap-4">
                <div className={`p-4 rounded-xl border-2 ${
                  isDark ? 'bg-purple-950/30 border-purple-800/50' : 'bg-purple-200 border-purple-400 text-purple-950 shadow-sm'
                }`}>
                  <div className="text-[11px] font-black uppercase tracking-wider text-purple-950 dark:text-purple-300">Total Item Terdaftar</div>
                  <div className="font-black text-2xl mt-1 text-purple-950 dark:text-purple-300">{products.length} Barang</div>
                </div>

                {canViewPrice && (
                  <div className={`p-4 rounded-xl border-2 ${
                    isDark ? 'bg-emerald-950/30 border-emerald-800/50' : 'bg-emerald-200 border-emerald-400 text-emerald-950 shadow-sm'
                  }`}>
                    <div className="text-[11px] font-black uppercase tracking-wider text-emerald-950 dark:text-emerald-300">Total Nilai Persediaan (HPP)</div>
                    <div className="font-black text-xl mt-1 text-emerald-950 dark:text-emerald-300">
                      Rp {products.reduce((acc, p) => acc + (p.hpp || 0) * (p.stokAkhir || 0), 0).toLocaleString('id-ID')}
                    </div>
                  </div>
                )}

                <div className={`p-4 rounded-xl border-2 ${
                  isDark ? 'bg-amber-950/30 border-amber-800/50' : 'bg-amber-200 border-amber-400 text-amber-950 shadow-sm'
                }`}>
                  <div className="text-[11px] font-black uppercase tracking-wider text-amber-950 dark:text-amber-300">Total Nilai Retail</div>
                  <div className="font-black text-xl mt-1 text-amber-950 dark:text-amber-300">
                    Rp {products.reduce((acc, p) => acc + (p.price || 0) * (p.stokAkhir || 0), 0).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border-2 border-slate-400 dark:border-slate-800 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 border-b-2 border-slate-950 text-white uppercase text-[11px] font-black">
                      <th className="p-3">SKU</th>
                      <th className="p-3">Nama Barang</th>
                      <th className="p-3 text-center">Stok Awal</th>
                      <th className="p-3 text-center">Stok Akhir</th>
                      {canViewPrice && <><th className="p-3 text-right">HPP Unit</th><th className="p-3 text-right">Total Nilai HPP</th></>}
                    </tr>
                  </thead>
                  <tbody className={`divide-y font-black ${isDark ? 'divide-slate-800 text-slate-100' : 'divide-slate-300 text-slate-950'}`}>
                    {products.map((p) => (
                      <tr key={p.id} className={isDark ? 'hover:bg-slate-800 odd:bg-slate-900 even:bg-slate-800/50' : 'hover:bg-slate-200 odd:bg-white even:bg-slate-100'}>
                        <td className={`p-3 font-mono font-black ${isDark ? 'text-amber-400' : 'text-slate-950'}`}>{p.inventoryNo}</td>
                        <td className={`p-3 font-black ${isDark ? 'text-slate-100' : 'text-slate-950'}`}>{p.inventoryName}</td>
                        <td className={`p-3 text-center ${isDark ? 'text-slate-300' : 'text-slate-950'}`}>{p.stokAwal}</td>
                        <td className={`p-3 text-center font-black ${isDark ? 'text-emerald-400' : 'text-emerald-950'}`}>{p.stokAkhir}</td>
                        {canViewPrice && (
                          <>
                            <td className={`p-3 text-right ${isDark ? 'text-slate-300' : 'text-slate-950'}`}>Rp {(p.hpp || 0).toLocaleString('id-ID')}</td>
                            <td className={`p-3 text-right font-black ${isDark ? 'text-emerald-400' : 'text-emerald-950'}`}>
                              Rp {((p.hpp || 0) * (p.stokAkhir || 0)).toLocaleString('id-ID')}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 bg-slate-100 dark:bg-slate-950 border-t-2 border-slate-300 dark:border-slate-800">
              <button
                onClick={() => setIsStockReportModalOpen(false)}
                className="px-4 py-2 rounded-xl border-2 border-slate-400 dark:border-slate-700 text-slate-950 dark:text-slate-300 text-xs font-black hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

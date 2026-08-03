'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  RefreshCw,
  Plus,
  Tag,
  FileSpreadsheet,
  BarChart3,
  Edit,
  Trash2,
  Package,
  Layers,
  DollarSign,
  History,
  CheckCircle,
  XCircle,
  Printer,
  X,
  AlertTriangle,
  ChevronRight,
  Sliders,
  Eye,
  EyeOff,
  Download,
  Info,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Check,
  Zap,
  Filter,
  Sparkles,
} from 'lucide-react';
import { ERPProduct } from '@/types/erp';

interface LookupItem {
  id: number;
  [key: string]: any;
}

interface LookupsData {
  brands: LookupItem[];
  categories: LookupItem[];
  productTypes: LookupItem[];
  uoms: LookupItem[];
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
}

export default function MasterBarangManager({ isDark }: MasterBarangManagerProps) {
  // Main Data States
  const [products, setProducts] = useState<ERPProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Explicit Filter Checkboxes from Frm_Inventory
  const [filterOnlyActive, setFilterOnlyActive] = useState<boolean>(true);
  const [filterMinusStock, setFilterMinusStock] = useState<boolean>(false);
  const [showDetailPane, setShowDetailPane] = useState<boolean>(true);

  // Sorting State
  const [sortField, setSortField] = useState<keyof ERPProduct>('id');
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
    categories: [],
    productTypes: [],
    uoms: [],
  });

  // Selected Row & Context Menu States
  const [selectedProduct, setSelectedProduct] = useState<ERPProduct | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: ERPProduct } | null>(null);

  // Form Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [activeFormTab, setActiveFormTab] = useState<'general' | 'pricing' | 'history'>('general');
  const [hppHistory, setHppHistory] = useState<HppHistoryItem[]>([]);

  // Opname Modal State
  const [isOpnameModalOpen, setIsOpnameModalOpen] = useState(false);
  const [opnameQty, setOpnameQty] = useState<number>(0);

  // Stock Report Modal State (Laporan Stok)
  const [isStockReportModalOpen, setIsStockReportModalOpen] = useState(false);

  // Barcode Queue Modal State
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [barcodeQueue, setBarcodeQueue] = useState<{ product: ERPProduct; printQty: number }[]>([]);

  // Form Fields State
  const [formData, setFormData] = useState<Partial<ERPProduct>>({
    inventoryNo: '',
    barcode: '',
    inventoryName: '',
    inventoryBrandId: 1,
    inventoryCategoryId: 1,
    inventoryProductId: 1,
    uoMId: 1,
    minStock: 5,
    maxStock: 50,
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
  const addToast = (text: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // Fetch Inventory List from PostgreSQL
  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      let url = `/api/inventory?q=${encodeURIComponent(searchQuery)}&limit=1000`;
      if (filterMinusStock) url += `&minusStock=true`;
      if (filterOnlyActive) url += `&onlyActive=true`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setProducts(json.data);
        if (json.data.length > 0) {
          setSelectedProduct(json.data[0]);
          setSelectedIndex(0);
        }
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
      addToast('Gagal terhubung ke database', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Dropdown Lookups
  const fetchLookups = async () => {
    try {
      const res = await fetch('/api/inventory/lookups');
      const json = await res.json();
      if (json.success && json.data) {
        setLookups(json.data);
      }
    } catch (err) {
      console.error('Error fetching lookups:', err);
    }
  };

  useEffect(() => {
    fetchProducts();
    setCurrentPage(1);
  }, [searchQuery, filterMinusStock, filterOnlyActive]);

  useEffect(() => {
    fetchLookups();
  }, []);

  // Fetch HPP History when selecting a product
  const fetchHppHistory = async (productId: string) => {
    try {
      const res = await fetch(`/api/inventory/${productId}/hpp-history`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setHppHistory(json.data);
      } else {
        setHppHistory([]);
      }
    } catch (err) {
      setHppHistory([]);
    }
  };

  useEffect(() => {
    if (selectedProduct) {
      fetchHppHistory(selectedProduct.id);
    }
  }, [selectedProduct?.id]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFormModalOpen(false);
        setIsOpnameModalOpen(false);
        setIsStockReportModalOpen(false);
        setIsBarcodeModalOpen(false);
        setContextMenu(null);
      } else if (e.key === '/' && !isFormModalOpen && !isOpnameModalOpen) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleOpenCreateModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFormModalOpen, isOpnameModalOpen]);

  // Sort Handler
  const handleSort = (field: keyof ERPProduct) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Processed & Sorted Products
  const sortedProducts = [...products].sort((a, b) => {
    const valA = a[sortField] ?? '';
    const valB = b[sortField] ?? '';
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    }
    return sortOrder === 'asc'
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA));
  });

  // Paginated Products
  const totalPages = Math.ceil(sortedProducts.length / pageSize) || 1;
  const paginatedProducts = sortedProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Export CSV Functionality
  const exportToCSV = () => {
    if (products.length === 0) {
      addToast('Tidak ada data barang untuk diexport', 'warning');
      return;
    }

    const headers = [
      'ID',
      'Inventory No',
      'Barcode',
      'Nama Barang',
      'Brand',
      'Category',
      'Product Type',
      'Satuan (UoM)',
      'Harga Retail',
      'HPP (Modal)',
      'Grosir 1',
      'Grosir 2',
      'Grosir 3',
      'Min Stock',
      'Max Stock',
      'Stok Awal',
      'Stok Akhir',
      'Status Aktif',
    ];

    const csvRows = [headers.join(',')];

    sortedProducts.forEach((p) => {
      const row = [
        p.id,
        `"${p.inventoryNo || ''}"`,
        `"${p.barcode || ''}"`,
        `"${(p.inventoryName || '').replace(/"/g, '""')}"`,
        `"${p.brandName || ''}"`,
        `"${p.categoryName || ''}"`,
        `"${p.productName || ''}"`,
        `"${p.uomName || 'PCS'}"`,
        p.price || 0,
        p.hpp || 0,
        p.grosir1 || 0,
        p.grosir2 || 0,
        p.grosir3 || 0,
        p.minStock || 0,
        p.maxStock || 0,
        p.stokAwal || 0,
        p.stokAkhir || 0,
        p.isActive ? 'AKTIF' : 'NON-AKTIF',
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Master_Barang_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast(`Berhasil mengexport ${products.length} data barang ke CSV`, 'success');
  };

  // Open Add Modal
  const handleOpenCreateModal = () => {
    setModalMode('create');
    setActiveFormTab('general');
    setFormData({
      inventoryNo: `BRG-${Date.now().toString().slice(-4)}`,
      barcode: `${Math.floor(1000000000000 + Math.random() * 9000000000000)}`,
      inventoryName: '',
      inventoryBrandId: lookups.brands[0]?.id || 1,
      inventoryCategoryId: lookups.categories[0]?.id || 1,
      inventoryProductId: lookups.productTypes[0]?.id || 1,
      uoMId: lookups.uoms[0]?.id || 1,
      minStock: 5,
      maxStock: 50,
      kodeHarga: '1 Okt 2026',
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
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (product: ERPProduct) => {
    setSelectedProduct(product);
    setModalMode('edit');
    setActiveFormTab('general');
    setFormData({ ...product });
    fetchHppHistory(product.id);
    setIsFormModalOpen(true);
  };

  // Save Form (Create / Edit)
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = modalMode === 'edit' && selectedProduct;
      const url = isEdit ? `/api/inventory/${selectedProduct.id}` : `/api/inventory`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (json.success) {
        setIsFormModalOpen(false);
        addToast(isEdit ? 'Data barang berhasil diperbarui!' : 'Barang baru berhasil ditambahkan!', 'success');
        fetchProducts();
      } else {
        addToast(`Gagal menyimpan: ${json.error}`, 'error');
      }
    } catch (err: any) {
      addToast(`Terjadi kesalahan: ${err.message}`, 'error');
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
    } catch (err: any) {
      addToast(`Error: ${err.message}`, 'error');
    }
  };

  // Open Opname Modal
  const handleOpenOpname = (product: ERPProduct) => {
    setSelectedProduct(product);
    setOpnameQty(product.stokAkhir);
    setIsOpnameModalOpen(true);
  };

  // Submit Opname
  const handleSaveOpname = async () => {
    if (!selectedProduct) return;
    try {
      const res = await fetch(`/api/inventory/opname`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventoryId: selectedProduct.id,
          qtyOpname: opnameQty,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setIsOpnameModalOpen(false);
        addToast(`Stok Opname "${selectedProduct.inventoryName}" berhasil diperbarui menjadi ${opnameQty}`, 'success');
        fetchProducts();
      } else {
        addToast(`Gagal opname: ${json.error}`, 'error');
      }
    } catch (err: any) {
      addToast(`Error: ${err.message}`, 'error');
    }
  };

  // Add to Barcode Queue
  const handleAddToBarcodeQueue = (product: ERPProduct) => {
    setBarcodeQueue((prev) => {
      const exists = prev.find((b) => b.product.id === product.id);
      if (exists) {
        return prev.map((b) => (b.product.id === product.id ? { ...b, printQty: b.printQty + 1 } : b));
      }
      return [...prev, { product, printQty: 1 }];
    });
    addToast(`"${product.inventoryName}" ditambahkan ke queue barcode`, 'info');
    setIsBarcodeModalOpen(true);
  };

  // Close context menu on outside click
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

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
        isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-300'
      }`}>
        {/* Search Bar Input */}
        <div className="flex items-center gap-3 flex-1 min-w-[280px] max-w-md">
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
              className={`w-full border-2 rounded-xl pl-10 pr-16 py-2 text-xs font-black focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-400 focus:border-amber-400'
                  : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-500 focus:border-slate-700'
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

        {/* 🔘 TOOLBAR ACTION BUTTONS */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleOpenCreateModal}
            className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-black active:scale-95 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            title="Tambah Barang Baru (Alt+N)"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Tambah Barang</span>
          </button>

          <button
            onClick={() => setShowDetailPane(!showDetailPane)}
            className={`px-3 py-2 rounded-xl border-2 text-xs font-black flex items-center gap-2 transition-all cursor-pointer active:scale-95 ${
              showDetailPane
                ? isDark
                  ? 'bg-amber-500/30 text-amber-200 border-amber-500/60'
                  : 'bg-amber-200 text-amber-900 border-amber-400 shadow-sm'
                : isDark
                ? 'bg-slate-700 hover:bg-slate-600 text-slate-100 border-slate-600'
                : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
            }`}
          >
            {showDetailPane ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span>Show Detail</span>
            <span className={`w-2 h-2 rounded-full ${showDetailPane ? (isDark ? 'bg-amber-400' : 'bg-amber-600') : 'bg-slate-500'}`} />
          </button>

          <button
            onClick={() => setIsStockReportModalOpen(true)}
            className={`px-3 py-2 rounded-xl border text-xs font-black flex items-center gap-2 transition-all cursor-pointer active:scale-95 ${
              isDark
                ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border-purple-500/50'
                : 'bg-purple-100 hover:bg-purple-200 text-purple-900 border-purple-300 shadow-sm'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-purple-200" />
            <span>Laporan Stok</span>
          </button>

          <button
            onClick={() => {
              fetchProducts();
              addToast('Data barang berhasil di-refresh', 'info');
            }}
            className={`px-3 py-2 rounded-xl border-2 text-xs font-black flex items-center gap-2 transition-all cursor-pointer active:scale-95 ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-950 border-slate-400'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsBarcodeModalOpen(true)}
            className={`px-3 py-2 rounded-xl border text-xs font-black flex items-center gap-2 transition-all cursor-pointer active:scale-95 ${
              isDark
                ? 'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border-indigo-500/50'
                : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-900 border-indigo-300 shadow-sm'
            }`}
          >
            <Tag className="w-4 h-4 text-indigo-200" />
            <span>List Barcode</span>
            <span className="px-1.5 py-0.5 rounded-full font-mono text-[10px] bg-slate-950 text-white font-black">
              {barcodeQueue.reduce((a, b) => a + b.printQty, 0)}
            </span>
          </button>

          <button
            onClick={exportToCSV}
            className={`px-3 py-2 rounded-xl border text-xs font-black flex items-center gap-2 transition-all cursor-pointer active:scale-95 ${
              isDark
                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border-emerald-500/50'
                : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-emerald-300 shadow-sm'
            }`}
          >
            <Download className="w-4 h-4 text-emerald-200" />
            <span>Export Data</span>
          </button>

          {/* Filter Checkboxes */}
          <div className={`flex items-center gap-3 border-l-2 pl-3 ml-1 ${isDark ? 'border-slate-800' : 'border-slate-400'}`}>
            <label className={`flex items-center gap-1.5 cursor-pointer text-xs font-black transition-colors ${
              isDark ? 'text-slate-300 hover:text-white' : 'text-slate-950 hover:text-black'
            }`}>
              <input
                type="checkbox"
                checked={filterOnlyActive}
                onChange={(e) => setFilterOnlyActive(e.target.checked)}
                className="w-4 h-4 rounded border-slate-500 bg-white text-slate-950 focus:ring-0 cursor-pointer accent-slate-950"
              />
              <span>Barang Aktif</span>
            </label>

            <label className={`flex items-center gap-1.5 cursor-pointer text-xs font-black transition-colors ${
              isDark ? 'text-slate-300 hover:text-white' : 'text-slate-950 hover:text-black'
            }`}>
              <input
                type="checkbox"
                checked={filterMinusStock}
                onChange={(e) => setFilterMinusStock(e.target.checked)}
                className="w-4 h-4 rounded border-slate-500 bg-white text-rose-700 focus:ring-0 cursor-pointer accent-rose-700"
              />
              <span className={filterMinusStock ? 'text-rose-800 font-black' : ''}>Stok Minus</span>
            </label>
          </div>
        </div>
      </div>

      {/* 🔍 SHOW DETAIL TOP BANNER - SOLID PITCH BLACK TEXT ON CRISP WHITE CARDS */}
      {showDetailPane && selectedProduct && (
        <div className={`border-b-2 p-4 shrink-0 transition-all shadow-sm ${
          isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
        }`}>
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-400 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-800 dark:text-amber-400" />
              <h4 className="font-black text-xs uppercase tracking-wider text-slate-950 dark:text-amber-400">
                Detail Infobox: {selectedProduct.inventoryName}
              </h4>
            </div>
            <button
              onClick={() => setShowDetailPane(false)}
              className="text-xs font-black flex items-center gap-1 cursor-pointer p-1 rounded hover:bg-slate-300 text-slate-950 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <X className="w-4 h-4" /> Tutup
            </button>
          </div>

          <div className="grid grid-cols-5 gap-3 text-xs font-black">
            {/* Box 1: SKU & Barcode */}
            <div className={`p-3 rounded-xl border-2 space-y-1 ${
              isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300 shadow-sm'
            }`}>
              <div className="text-[11px] font-black text-slate-950 dark:text-slate-400 uppercase tracking-wider">SKU / Barcode</div>
              <div className="font-mono font-black text-sm text-slate-950 dark:text-amber-400">{selectedProduct.inventoryNo}</div>
              <div className="font-mono text-slate-950 dark:text-slate-300 text-xs font-bold">{selectedProduct.barcode}</div>
            </div>

            {/* Box 2: Category & Brand */}
            <div className={`p-3 rounded-xl border-2 space-y-1 ${
              isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300 shadow-sm'
            }`}>
              <div className="text-[11px] font-black text-slate-950 dark:text-slate-400 uppercase tracking-wider">Kategori / Brand</div>
              <div className="font-black text-sm text-slate-950 dark:text-white">{selectedProduct.brandName || 'Maspion'}</div>
              <div className="text-slate-950 dark:text-slate-300 text-xs font-bold">{selectedProduct.categoryName || 'Kitchenware'} ({selectedProduct.uomName || 'PCS'})</div>
            </div>

            {/* Box 3: Retail Price & HPP Modal */}
            <div className={`p-3 rounded-xl border-2 space-y-1 ${
              isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300 shadow-sm'
            }`}>
              <div className="text-[11px] font-black text-slate-950 dark:text-slate-400 uppercase tracking-wider">Harga Retail & HPP</div>
              <div className="font-black text-sm text-slate-950 dark:text-white">Price: Rp {(selectedProduct.price || 0).toLocaleString('id-ID')}</div>
              <div className="font-black text-sm text-emerald-950 dark:text-emerald-400">HPP Modal: Rp {(selectedProduct.hpp || 0).toLocaleString('id-ID')}</div>
            </div>

            {/* Box 4: Grosir Tiers */}
            <div className={`p-3 rounded-xl border-2 space-y-1 ${
              isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300 shadow-sm'
            }`}>
              <div className="text-[11px] font-black text-slate-950 dark:text-slate-400 uppercase tracking-wider">Tier Harga Grosir</div>
              <div className="font-black text-xs text-amber-950 dark:text-amber-400">G1: Rp {(selectedProduct.grosir1 || 0).toLocaleString('id-ID')}</div>
              <div className="font-black text-xs text-slate-950 dark:text-amber-300">G2: Rp {(selectedProduct.grosir2 || 0).toLocaleString('id-ID')} | G3: Rp {(selectedProduct.grosir3 || 0).toLocaleString('id-ID')}</div>
            </div>

            {/* Box 5: Stock Balance */}
            <div className={`p-3 rounded-xl border-2 space-y-1 ${
              isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300 shadow-sm'
            }`}>
              <div className="text-[11px] font-black text-slate-950 dark:text-slate-400 uppercase tracking-wider">Status Balance Stok</div>
              <div className="flex items-center gap-2">
                <span className="text-slate-950 dark:text-slate-200 text-xs font-black">Awal: {selectedProduct.stokAwal}</span>
                <span className={`px-2 py-0.5 rounded font-black text-xs ${
                  selectedProduct.stokAkhir < selectedProduct.minStock
                    ? 'bg-rose-700 text-white dark:bg-rose-500/20 dark:text-rose-300'
                    : 'bg-emerald-800 text-white dark:bg-emerald-500/20 dark:text-emerald-300'
                }`}>
                  Akhir: {selectedProduct.stokAkhir}
                </span>
              </div>
              <div className="text-slate-950 dark:text-slate-400 text-[11px] font-black">Safety: {selectedProduct.minStock} - {selectedProduct.maxStock}</div>
            </div>
          </div>
        </div>
      )}

      {/* 📊 MAIN BODY CONTAINER: HIGH CONTRAST DATA TABLE */}
      <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
        {/* DEVEXPRESS GRIDVIEW TABLE */}
        <div className="flex-1 min-h-0 overflow-auto p-3.5">
          <div className={`rounded-xl border-2 overflow-hidden shadow-md ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
          }`}>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className={`border-b-2 uppercase text-[11px] font-black tracking-wider ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-200 border-slate-300 text-slate-900'
                }`}>
                  <th onClick={() => handleSort('inventoryNo')} className="py-3 px-3 cursor-pointer hover:text-amber-400 transition-colors">
                    <div className="flex items-center gap-1">
                      <span>Inventory No</span>
                      {sortField === 'inventoryNo' && (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('barcode')} className="py-3 px-3 cursor-pointer hover:text-amber-400 transition-colors">
                    <div className="flex items-center gap-1">
                      <span>Barcode</span>
                      {sortField === 'barcode' && (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('inventoryName')} className="py-3 px-3 cursor-pointer hover:text-amber-400 transition-colors">
                    <div className="flex items-center gap-1">
                      <span>Nama Barang</span>
                      {sortField === 'inventoryName' && (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />)}
                    </div>
                  </th>
                  <th className="py-3 px-3">Brand</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Product</th>
                  <th className="py-3 px-3">UoM</th>
                  <th onClick={() => handleSort('price')} className="py-3 px-3 text-right cursor-pointer hover:text-amber-400 transition-colors">
                    <div className="flex items-center justify-end gap-1">
                      <span>Price (Retail)</span>
                      {sortField === 'price' && (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('hpp')} className="py-3 px-3 text-right cursor-pointer hover:text-emerald-400 transition-colors">
                    <div className="flex items-center justify-end gap-1">
                      <span>HPP (Modal)</span>
                      {sortField === 'hpp' && (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-emerald-400" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />)}
                    </div>
                  </th>
                  <th className="py-3 px-3 text-right">Grosir 1</th>
                  <th className="py-3 px-3 text-right">Grosir 2</th>
                  <th className="py-3 px-3 text-right">Grosir 3</th>
                  <th className="py-3 px-3 text-center">Min/Max</th>
                  <th onClick={() => handleSort('stokAkhir')} className="py-3 px-3 text-center cursor-pointer hover:text-amber-400 transition-colors">
                    <div className="flex items-center justify-center gap-1">
                      <span>Stok Akhir</span>
                      {sortField === 'stokAkhir' && (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />)}
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-300'}`}>
                {isLoading ? (
                  <tr>
                    <td colSpan={16} className={`py-12 text-center font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      <RefreshCw className="w-5 h-5 text-slate-800 animate-spin mx-auto mb-2" />
                      Memuat data barang dari PostgreSQL database...
                    </td>
                  </tr>
                ) : paginatedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={16} className={`py-12 text-center font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      Tidak ada barang ditemukan.
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((item, idx) => (
                    <tr
                      key={item.id}
                      onClick={() => {
                        setSelectedProduct(item);
                        setSelectedIndex(idx);
                      }}
                      onDoubleClick={() => handleOpenEditModal(item)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSelectedProduct(item);
                        setContextMenu({ x: e.clientX, y: e.clientY, item });
                      }}
                      className={`transition-colors cursor-pointer ${
                        selectedProduct?.id === item.id
                          ? isDark
                            ? 'bg-slate-700 text-amber-300 font-bold border-l-4 border-amber-500'
                            : 'bg-amber-100 text-slate-900 font-bold border-l-4 border-amber-600'
                          : isDark
                          ? 'hover:bg-slate-700 text-slate-100'
                          : 'hover:bg-slate-200 odd:bg-white even:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <td className={`py-2.5 px-3 font-mono text-[11px] font-black ${isDark ? 'text-amber-300' : 'text-slate-800'}`}>{item.inventoryNo}</td>
                      <td className={`py-2.5 px-3 font-mono text-[11px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{item.barcode}</td>
                      <td className={`py-2.5 px-3 font-black max-w-[200px] truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.inventoryName}</td>
                      <td className={`py-2.5 px-3 font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{item.brandName || '-'}</td>
                      <td className={`py-2.5 px-3 font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{item.categoryName || '-'}</td>
                      <td className={`py-2.5 px-3 font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{item.productName || '-'}</td>
                      <td className={`py-2.5 px-3 font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{item.uomName || 'PCS'}</td>
                      <td className={`py-2.5 px-3 text-right font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Rp {(item.price || 0).toLocaleString('id-ID')}</td>
                      <td className={`py-2.5 px-3 text-right font-black ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>Rp {(item.hpp || 0).toLocaleString('id-ID')}</td>
                      <td className={`py-2.5 px-3 text-right font-bold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Rp {(item.grosir1 || 0).toLocaleString('id-ID')}</td>
                      <td className={`py-2.5 px-3 text-right font-bold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Rp {(item.grosir2 || 0).toLocaleString('id-ID')}</td>
                      <td className={`py-2.5 px-3 text-right font-bold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Rp {(item.grosir3 || 0).toLocaleString('id-ID')}</td>
                      <td className={`py-2.5 px-3 text-center font-mono text-[11px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        {item.minStock} / {item.maxStock}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded font-black text-[11px] ${
                            item.stokAkhir < item.minStock
                              ? 'bg-rose-700 text-white shadow-sm'
                              : item.stokAkhir > item.maxStock
                              ? 'bg-indigo-700 text-white shadow-sm'
                              : 'bg-emerald-800 text-white shadow-sm'
                          }`}
                        >
                          {item.stokAkhir}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded font-black text-[10px] ${
                          item.isActive
                            ? 'bg-slate-950 text-white'
                            : 'bg-slate-300 text-slate-950 border border-slate-500 font-black'
                        }`}>
                          {item.isActive ? 'AKTIF' : 'NON-AKTIF'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(item);
                            }}
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              isDark ? 'hover:bg-slate-600 text-slate-300 hover:text-amber-300' : 'hover:bg-slate-300 text-slate-700 hover:text-amber-700'
                            }`}
                            title="Edit Detail Barang"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenOpname(item);
                            }}
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              isDark ? 'hover:bg-slate-600 text-slate-300 hover:text-emerald-300' : 'hover:bg-slate-300 text-slate-700 hover:text-emerald-700'
                            }`}
                            title="Input Stok Opname"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProduct(item);
                            }}
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              isDark ? 'hover:bg-slate-600 text-slate-300 hover:text-rose-300' : 'hover:bg-slate-300 text-slate-700 hover:text-rose-700'
                            }`}
                            title="Hapus Barang"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
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
            <span>Menampilkan {paginatedProducts.length} dari total {sortedProducts.length} barang</span>
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
          <button
            onClick={() => {
              handleOpenEditModal(contextMenu.item);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left hover:bg-amber-500 hover:text-slate-950 font-black flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>&Detail / Edit Barang</span>
          </button>
          <button
            onClick={() => {
              handleOpenOpname(contextMenu.item);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left hover:bg-amber-500 hover:text-slate-950 font-black flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>&Stok Opname</span>
          </button>
          <button
            onClick={() => {
              handleAddToBarcodeQueue(contextMenu.item);
              setContextMenu(null);
            }}
            className="w-full px-3.5 py-2 text-left hover:bg-amber-500 hover:text-slate-950 font-black flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>&Cetak Barcode</span>
          </button>
          <div className="h-px bg-slate-300 dark:bg-slate-800 my-1" />
          <button
            onClick={() => {
              handleDeleteProduct(contextMenu.item);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left hover:bg-rose-600 hover:text-white font-black text-rose-800 flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>&Hapus Barang</span>
          </button>
        </div>
      )}

      {/* 📝 MODAL 1: ADD / EDIT ITEM DIALOG */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-3xl rounded-2xl border-2 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-500 text-slate-950'
          }`}>
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b-2 flex items-center justify-between ${
              isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-900 border-slate-950 text-white'
            }`}>
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                <h3 className="font-black text-sm text-white">{modalMode === 'create' ? 'Tambah Barang Baru' : `Detail Barang: ${formData.inventoryName}`}</h3>
              </div>
              <button onClick={() => setIsFormModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 cursor-pointer transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Tabs */}
            <div className={`flex border-b-2 px-6 gap-2 pt-2 ${
              isDark ? 'border-slate-800 bg-slate-950/30' : 'border-slate-400 bg-slate-100'
            }`}>
              <button
                type="button"
                onClick={() => setActiveFormTab('general')}
                className={`px-4 py-2 text-xs font-black rounded-t-xl border-b-2 transition-all cursor-pointer ${
                  activeFormTab === 'general'
                    ? isDark ? 'border-amber-500 text-amber-400 bg-slate-900' : 'border-slate-950 text-slate-950 bg-white'
                    : 'border-transparent text-slate-700 hover:text-slate-950'
                }`}
              >
                Informasi Umum
              </button>
              <button
                type="button"
                onClick={() => setActiveFormTab('pricing')}
                className={`px-4 py-2 text-xs font-black rounded-t-xl border-b-2 transition-all cursor-pointer ${
                  activeFormTab === 'pricing'
                    ? isDark ? 'border-amber-500 text-amber-400 bg-slate-900' : 'border-slate-950 text-slate-950 bg-white'
                    : 'border-transparent text-slate-700 hover:text-slate-950'
                }`}
              >
                Harga & Grosir
              </button>
              {modalMode === 'edit' && (
                <button
                  type="button"
                  onClick={() => setActiveFormTab('history')}
                  className={`px-4 py-2 text-xs font-black rounded-t-xl border-b-2 transition-all cursor-pointer ${
                    activeFormTab === 'history'
                      ? isDark ? 'border-amber-500 text-amber-400 bg-slate-900' : 'border-slate-950 text-slate-950 bg-white'
                      : 'border-transparent text-slate-700 hover:text-slate-950'
                  }`}
                >
                  Riwayat HPP Modal
                </button>
              )}
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveForm} className="flex-1 overflow-y-auto p-6 space-y-4">
              {activeFormTab === 'general' && (
                <div className="grid grid-cols-2 gap-4 text-xs font-black text-slate-950 dark:text-slate-100">
                  <div>
                    <label className="block mb-1">Inventory No (SKU)</label>
                    <input
                      type="text"
                      required
                      value={formData.inventoryNo || ''}
                      onChange={(e) => setFormData({ ...formData, inventoryNo: e.target.value })}
                      className={`w-full border-2 rounded-xl px-3 py-2 font-mono font-black focus:ring-2 focus:ring-slate-500 outline-none ${
                        isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block mb-1">Barcode</label>
                    <input
                      type="text"
                      value={formData.barcode || ''}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      className={`w-full border-2 rounded-xl px-3 py-2 font-mono font-black focus:ring-2 focus:ring-slate-500 outline-none ${
                        isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block mb-1">Nama Barang</label>
                    <input
                      type="text"
                      required
                      value={formData.inventoryName || ''}
                      onChange={(e) => setFormData({ ...formData, inventoryName: e.target.value })}
                      className={`w-full border-2 rounded-xl px-3 py-2 font-black focus:ring-2 focus:ring-slate-500 outline-none ${
                        isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block mb-1">Brand</label>
                    <select
                      value={formData.inventoryBrandId || 1}
                      onChange={(e) => setFormData({ ...formData, inventoryBrandId: parseInt(e.target.value) })}
                      className={`w-full border-2 rounded-xl px-3 py-2 font-black cursor-pointer outline-none ${
                        isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
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
                    <label className="block mb-1">Category</label>
                    <select
                      value={formData.inventoryCategoryId || 1}
                      onChange={(e) => setFormData({ ...formData, inventoryCategoryId: parseInt(e.target.value) })}
                      className={`w-full border-2 rounded-xl px-3 py-2 font-black cursor-pointer outline-none ${
                        isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      {lookups.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.categoryName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1">Product Type</label>
                    <select
                      value={formData.inventoryProductId || 1}
                      onChange={(e) => setFormData({ ...formData, inventoryProductId: parseInt(e.target.value) })}
                      className={`w-full border-2 rounded-xl px-3 py-2 font-black cursor-pointer outline-none ${
                        isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
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
                    <label className="block mb-1">Satuan (UoM)</label>
                    <select
                      value={formData.uoMId || 1}
                      onChange={(e) => setFormData({ ...formData, uoMId: parseInt(e.target.value) })}
                      className={`w-full border-2 rounded-xl px-3 py-2 font-black cursor-pointer outline-none ${
                        isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
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
                    <label className="block mb-1">Min Stock Threshold</label>
                    <input
                      type="number"
                      value={formData.minStock ?? 0}
                      onChange={(e) => setFormData({ ...formData, minStock: parseInt(e.target.value) || 0 })}
                      className={`w-full border-2 rounded-xl px-3 py-2 font-black outline-none ${
                        isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block mb-1">Max Stock Limit</label>
                    <input
                      type="number"
                      value={formData.maxStock ?? 0}
                      onChange={(e) => setFormData({ ...formData, maxStock: parseInt(e.target.value) || 0 })}
                      className={`w-full border-2 rounded-xl px-3 py-2 font-black outline-none ${
                        isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>
              )}

              {activeFormTab === 'pricing' && (
                <div className="grid grid-cols-2 gap-4 text-xs font-black text-slate-950 dark:text-slate-100">
                  <div>
                    <label className="block mb-1">Harga Retail (Jual)</label>
                    <input
                      type="number"
                      required
                      value={formData.price ?? 0}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      className={`w-full border-2 rounded-xl px-3 py-2 font-black outline-none ${
                        isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-emerald-950 dark:text-emerald-400">HPP / Harga Modal</label>
                    <input
                      type="number"
                      value={formData.hpp ?? 0}
                      onChange={(e) => setFormData({ ...formData, hpp: parseFloat(e.target.value) || 0 })}
                      className={`w-full border-2 rounded-xl px-3 py-2 font-black outline-none ${
                        isDark ? 'bg-slate-950 border-emerald-900/50 text-emerald-400' : 'bg-emerald-100 border-emerald-400 text-emerald-950'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block mb-1">Harga Grosir Tier 1</label>
                    <input
                      type="number"
                      value={formData.grosir1 ?? 0}
                      onChange={(e) => setFormData({ ...formData, grosir1: parseFloat(e.target.value) || 0 })}
                      className={`w-full border-2 rounded-xl px-3 py-2 font-black outline-none ${
                        isDark ? 'bg-slate-950 border-amber-900/50 text-amber-400' : 'bg-amber-100 border-amber-400 text-slate-950'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block mb-1">Harga Grosir Tier 2</label>
                    <input
                      type="number"
                      value={formData.grosir2 ?? 0}
                      onChange={(e) => setFormData({ ...formData, grosir2: parseFloat(e.target.value) || 0 })}
                      className={`w-full border-2 rounded-xl px-3 py-2 font-black outline-none ${
                        isDark ? 'bg-slate-950 border-amber-900/50 text-amber-400' : 'bg-amber-100 border-amber-400 text-slate-950'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block mb-1">Harga Grosir Tier 3</label>
                    <input
                      type="number"
                      value={formData.grosir3 ?? 0}
                      onChange={(e) => setFormData({ ...formData, grosir3: parseFloat(e.target.value) || 0 })}
                      className={`w-full border-2 rounded-xl px-3 py-2 font-black outline-none ${
                        isDark ? 'bg-slate-950 border-amber-900/50 text-amber-400' : 'bg-amber-100 border-amber-400 text-slate-950'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block mb-1">Diskon Standard (%)</label>
                    <input
                      type="number"
                      value={formData.disc ?? 0}
                      onChange={(e) => setFormData({ ...formData, disc: parseFloat(e.target.value) || 0 })}
                      className={`w-full border-2 rounded-xl px-3 py-2 font-black outline-none ${
                        isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>
              )}

              {activeFormTab === 'history' && (
                <div className="space-y-3 text-xs font-black">
                  <h4 className="font-black text-slate-950 dark:text-slate-200">Riwayat HPP & Penerimaan Barang</h4>
                  <div className="rounded-xl border-2 border-slate-400 dark:border-slate-800 overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-900 text-white border-b-2 border-slate-950 font-black">
                          <th className="p-2.5">No Penerimaan (MR)</th>
                          <th className="p-2.5">Tanggal</th>
                          <th className="p-2.5">Supplier</th>
                          <th className="p-2.5 text-right">HPP Item</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-300 dark:divide-slate-800 font-black text-slate-950 dark:text-slate-100">
                        {hppHistory.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-slate-950 font-black">
                              Belum ada riwayat HPP penerimaan.
                            </td>
                          </tr>
                        ) : (
                          hppHistory.map((h) => (
                            <tr key={h.id}>
                              <td className="p-2.5 font-mono text-slate-950 dark:text-amber-400 font-black">{h.mrNo}</td>
                              <td className="p-2.5 text-slate-950 dark:text-slate-300">{h.mrDate}</td>
                              <td className="p-2.5 text-slate-950 dark:text-slate-100 font-black">{h.supplierName}</td>
                              <td className="p-2.5 text-right font-black text-emerald-950 dark:text-emerald-400">Rp {h.hpp.toLocaleString('id-ID')}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Modal Footer Buttons */}
              <div className="pt-4 border-t-2 border-slate-300 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 rounded-xl border-2 border-slate-400 text-slate-950 dark:text-slate-300 text-xs font-black hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-slate-950 hover:bg-black active:scale-95 text-white font-black text-xs shadow-md cursor-pointer transition-all">
                  Simpan Barang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📊 MODAL 2: STOK OPNAME ADJUSTMENT DIALOG */}
      {isOpnameModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border-2 shadow-2xl p-6 space-y-4 ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-500 text-slate-950'
          }`}>
            <div className="flex items-center justify-between border-b-2 border-slate-300 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-slate-950 dark:text-emerald-400" />
                <h3 className="font-black text-sm text-slate-950 dark:text-white">Input Qty Stok Opname</h3>
              </div>
              <button onClick={() => setIsOpnameModalOpen(false)} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-950 cursor-pointer transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs font-black">
              <div className="bg-slate-100 dark:bg-slate-950 p-3 rounded-xl border-2 border-slate-300 dark:border-slate-800">
                <div className="text-slate-950 dark:text-slate-400 font-mono font-black">{selectedProduct.inventoryNo}</div>
                <div className="font-black text-sm text-slate-950 dark:text-white">{selectedProduct.inventoryName}</div>
                <div className="text-slate-950 dark:text-slate-300 mt-1">Stok System Saat Ini: <span className="font-black text-emerald-950 dark:text-emerald-400">{selectedProduct.stokAkhir}</span></div>
              </div>

              <div>
                <label className="block text-slate-950 dark:text-slate-300 font-black mb-1">Stok Fisik Hasil Opname</label>
                <input
                  type="number"
                  value={opnameQty}
                  onChange={(e) => setOpnameQty(parseInt(e.target.value) || 0)}
                  className={`w-full border-2 rounded-xl px-4 py-2.5 font-black text-base focus:ring-2 focus:ring-slate-500 outline-none ${
                    isDark ? 'bg-slate-950 border-emerald-900 text-emerald-400' : 'bg-white border-slate-400 text-slate-950'
                  }`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsOpnameModalOpen(false)}
                className="px-4 py-2 rounded-xl border-2 border-slate-400 dark:border-slate-700 text-slate-950 dark:text-slate-300 text-xs font-black hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button onClick={handleSaveOpname} className="px-5 py-2 rounded-xl bg-slate-950 hover:bg-black active:scale-95 text-white font-black text-xs shadow-md cursor-pointer transition-all">
                Perbarui Stok
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📈 MODAL 3: LAPORAN MUTASI STOK DIALOG - PITCH BLACK TEXT & CRISP BORDER CARDS */}
      {isStockReportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-4xl rounded-2xl border-2 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-500 text-slate-950'
          }`}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b-2 border-slate-900 text-white">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                <h3 className="font-black text-sm text-white">Laporan Mutasi & Saldo Stok Barang</h3>
              </div>
              <button onClick={() => setIsStockReportModalOpen(false)} className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Summary Cards: Deep Colored Cards with Solid Black/Purple/Emerald Text */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-black">
              <div className="grid grid-cols-3 gap-4">
                {/* Total Item Card */}
                <div className={`p-4 rounded-xl border-2 ${
                  isDark ? 'bg-purple-950/30 border-purple-800/50' : 'bg-purple-200 border-purple-400 text-purple-950 shadow-sm'
                }`}>
                  <div className="text-[11px] font-black uppercase tracking-wider text-purple-950 dark:text-purple-300">Total Item Terdaftar</div>
                  <div className="font-black text-2xl mt-1 text-purple-950 dark:text-purple-300">{products.length} Barang</div>
                </div>

                {/* Total Nilai HPP Card */}
                <div className={`p-4 rounded-xl border-2 ${
                  isDark ? 'bg-emerald-950/30 border-emerald-800/50' : 'bg-emerald-200 border-emerald-400 text-emerald-950 shadow-sm'
                }`}>
                  <div className="text-[11px] font-black uppercase tracking-wider text-emerald-950 dark:text-emerald-300">Total Nilai Persediaan (HPP)</div>
                  <div className="font-black text-xl mt-1 text-emerald-950 dark:text-emerald-300">
                    Rp {products.reduce((acc, p) => acc + (p.hpp || 0) * (p.stokAkhir || 0), 0).toLocaleString('id-ID')}
                  </div>
                </div>

                {/* Total Nilai Retail Card */}
                <div className={`p-4 rounded-xl border-2 ${
                  isDark ? 'bg-amber-950/30 border-amber-800/50' : 'bg-amber-200 border-amber-400 text-amber-950 shadow-sm'
                }`}>
                  <div className="text-[11px] font-black uppercase tracking-wider text-amber-950 dark:text-amber-300">Total Nilai Retail</div>
                  <div className="font-black text-xl mt-1 text-amber-950 dark:text-amber-300">
                    Rp {products.reduce((acc, p) => acc + (p.price || 0) * (p.stokAkhir || 0), 0).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>

              {/* Data Table with Dark Header */}
              <div className="rounded-xl border-2 border-slate-400 dark:border-slate-800 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 border-b-2 border-slate-950 text-white uppercase text-[11px] font-black">
                      <th className="p-3">SKU</th>
                      <th className="p-3">Nama Barang</th>
                      <th className="p-3 text-center">Stok Awal</th>
                      <th className="p-3 text-center">Stok Akhir</th>
                      <th className="p-3 text-right">HPP Unit</th>
                      <th className="p-3 text-right">Total Nilai HPP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 dark:divide-slate-800 font-black text-slate-950 dark:text-slate-100">
                    {products.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-200 odd:bg-white even:bg-slate-100">
                        <td className="p-3 font-mono font-black text-slate-950 dark:text-amber-400">{p.inventoryNo}</td>
                        <td className="p-3 font-black text-slate-950 dark:text-slate-100">{p.inventoryName}</td>
                        <td className="p-3 text-center text-slate-950 dark:text-slate-300">{p.stokAwal}</td>
                        <td className="p-3 text-center font-black text-emerald-950 dark:text-emerald-400">{p.stokAkhir}</td>
                        <td className="p-3 text-right text-slate-950 dark:text-slate-300">Rp {(p.hpp || 0).toLocaleString('id-ID')}</td>
                        <td className="p-3 text-right font-black text-emerald-950 dark:text-emerald-400">
                          Rp {((p.hpp || 0) * (p.stokAkhir || 0)).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 p-4 bg-slate-100 dark:bg-slate-950 border-t-2 border-slate-300 dark:border-slate-800">
              <button
                onClick={() => setIsStockReportModalOpen(false)}
                className="px-4 py-2 rounded-xl border-2 border-slate-400 dark:border-slate-700 text-slate-950 dark:text-slate-300 text-xs font-black hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                Tutup
              </button>
              <button
                onClick={() => addToast('Mencetak laporan mutasi stok...', 'info')}
                className="px-5 py-2 rounded-xl bg-purple-900 hover:bg-purple-950 active:scale-95 text-white font-black text-xs shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🏷️ MODAL 4: BARCODE PRINT QUEUE DIALOG */}
      {isBarcodeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-xl rounded-2xl border-2 shadow-2xl p-6 space-y-4 ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-500 text-slate-950'
          }`}>
            <div className="flex items-center justify-between border-b-2 border-slate-300 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-slate-950 dark:text-indigo-400" />
                <h3 className="font-black text-sm text-slate-950 dark:text-white">Cetak Queue Barcode Label</h3>
              </div>
              <button onClick={() => setIsBarcodeModalOpen(false)} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-950 cursor-pointer transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs font-black max-h-60 overflow-y-auto">
              {barcodeQueue.length === 0 ? (
                <div className="text-center p-6 text-slate-950 font-black">Daftar cetak barcode masih kosong. Klik kanan barang lalu pilih &Cetak Barcode.</div>
              ) : (
                barcodeQueue.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl border-2 border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
                    <div>
                      <div className="font-black text-slate-950 dark:text-white">{item.product.inventoryName}</div>
                      <div className="font-mono text-slate-950 dark:text-slate-400 text-[11px] font-black">{item.product.barcode}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-slate-950 dark:text-slate-300 font-black">Jumlah Label:</label>
                      <input
                        type="number"
                        min="1"
                        value={item.printQty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setBarcodeQueue((prev) => prev.map((b, i) => (i === idx ? { ...b, printQty: val } : b)));
                        }}
                        className={`w-16 border-2 rounded-lg px-2 py-1 text-center font-black outline-none ${
                          isDark ? 'bg-slate-900 border-slate-700 text-indigo-400' : 'bg-white border-slate-400 text-slate-950'
                        }`}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-between items-center pt-2">
              <button onClick={() => setBarcodeQueue([])} className="text-rose-800 hover:underline text-xs font-black cursor-pointer transition-colors">
                Kosongkan Queue
              </button>
              <div className="flex gap-2">
                <button onClick={() => setIsBarcodeModalOpen(false)} className="px-4 py-2 rounded-xl border-2 border-slate-400 dark:border-slate-700 text-slate-950 dark:text-slate-300 text-xs font-black hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                  Tutup
                </button>
                <button
                  onClick={() => addToast(`Mengirim ${barcodeQueue.reduce((a, b) => a + b.printQty, 0)} label barcode ke printer...`, 'info')}
                  className="px-5 py-2 rounded-xl bg-slate-950 hover:bg-black active:scale-95 text-white font-black text-xs shadow-md cursor-pointer transition-all"
                >
                  Cetak Barcode Label
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

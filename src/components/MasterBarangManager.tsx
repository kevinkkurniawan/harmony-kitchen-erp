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

interface MasterBarangManagerProps {
  isDark: boolean;
}

export default function MasterBarangManager({ isDark }: MasterBarangManagerProps) {
  // Main Data States
  const [products, setProducts] = useState<ERPProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMinusStock, setFilterMinusStock] = useState(false);
  const [lookups, setLookups] = useState<LookupsData>({
    brands: [],
    categories: [],
    productTypes: [],
    uoms: [],
  });

  // Selected & Context Menu States
  const [selectedProduct, setSelectedProduct] = useState<ERPProduct | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: ERPProduct } | null>(null);

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [activeFormTab, setActiveFormTab] = useState<'general' | 'pricing' | 'history'>('general');
  const [hppHistory, setHppHistory] = useState<HppHistoryItem[]>([]);

  // Opname Modal State
  const [isOpnameModalOpen, setIsOpnameModalOpen] = useState(false);
  const [opnameQty, setOpnameQty] = useState<number>(0);

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

  // Fetch Inventory List
  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      let url = `/api/inventory?q=${encodeURIComponent(searchQuery)}`;
      if (filterMinusStock) url += `&minusStock=true`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setProducts(json.data);
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Lookups (Brands, Categories, Products, UoMs)
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
  }, [searchQuery, filterMinusStock]);

  useEffect(() => {
    fetchLookups();
  }, []);

  // Fetch HPP History for selected item
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
        fetchProducts();
      } else {
        alert(`Gagal menyimpan: ${json.error}`);
      }
    } catch (err: any) {
      alert(`Terjadi kesalahan: ${err.message}`);
    }
  };

  // Delete Item
  const handleDeleteProduct = async (product: ERPProduct) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus barang "${product.inventoryName}"?`)) return;
    try {
      const res = await fetch(`/api/inventory/${product.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        fetchProducts();
      } else {
        alert(`Gagal menghapus: ${json.error}`);
      }
    } catch (err: any) {
      alert(`Terjadi kesalahan: ${err.message}`);
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
        fetchProducts();
      } else {
        alert(`Gagal opname: ${json.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Add to Barcode Print Queue
  const handleAddToBarcodeQueue = (product: ERPProduct) => {
    setBarcodeQueue((prev) => {
      const exists = prev.find((b) => b.product.id === product.id);
      if (exists) {
        return prev.map((b) => (b.product.id === product.id ? { ...b, printQty: b.printQty + 1 } : b));
      }
      return [...prev, { product, printQty: 1 }];
    });
    setIsBarcodeModalOpen(true);
  };

  // Close context menu on outside click
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none">
      {/* 🛠️ DEVEXPRESS RIBBON TOOLBAR ACTION BAR */}
      <div className={`p-3 border-b flex flex-wrap items-center justify-between gap-3 ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'}`}>
        {/* Live Search Input */}
        <div className="flex items-center gap-3 flex-1 min-w-[280px] max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari (InventoryNo / Barcode / Nama)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full border rounded-xl pl-9 pr-4 py-2 text-xs font-medium focus:outline-none focus:border-amber-500 transition-colors ${
                isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>
        </div>

        {/* Function Toolbar Buttons Mapped from DevExpress Frm_Inventory */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* + Tambah Barang */}
          <button
            onClick={handleOpenCreateModal}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Barang</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchProducts}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {/* Cetak Barcode Queue */}
          <button
            onClick={() => setIsBarcodeModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Tag className="w-3.5 h-3.5 text-indigo-400" />
            <span>List Barcode ({barcodeQueue.reduce((a, b) => a + b.printQty, 0)})</span>
          </button>

          {/* Export Excel */}
          <button
            onClick={() => alert(`Exporting ${products.length} inventory items to Excel file...`)}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export Excel</span>
          </button>

          {/* Minus Stock Toggle Filter */}
          <div className="flex items-center gap-2 border-l border-slate-800 pl-2 ml-1">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-200">
              <input
                type="checkbox"
                checked={filterMinusStock}
                onChange={(e) => setFilterMinusStock(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0"
              />
              <span>Stok Minus / Alert</span>
            </label>
          </div>
        </div>
      </div>

      {/* 📊 DEVEXPRESS GRIDVIEW DATA TABLE */}
      <div className={`flex-1 overflow-auto p-4 ${isDark ? 'bg-[#070b14]' : 'bg-slate-100'}`}>
        <div className={`rounded-2xl border overflow-hidden shadow-lg ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'}`}>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className={`border-b uppercase text-[11px] font-bold ${isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                <th className="py-3 px-3">Inventory No</th>
                <th className="py-3 px-3">Barcode</th>
                <th className="py-3 px-3">Nama Barang</th>
                <th className="py-3 px-3">Brand</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Product</th>
                <th className="py-3 px-3">UoM</th>
                <th className="py-3 px-3 text-right">Price (Retail)</th>
                <th className="py-3 px-3 text-right text-emerald-400">HPP (Modal)</th>
                <th className="py-3 px-3 text-right text-amber-400">Grosir 1</th>
                <th className="py-3 px-3 text-right text-amber-400">Grosir 2</th>
                <th className="py-3 px-3 text-right text-amber-400">Grosir 3</th>
                <th className="py-3 px-3 text-center">Min/Max</th>
                <th className="py-3 px-3 text-center">Stok Akhir</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className={`divide-y font-medium ${isDark ? 'divide-slate-800/60' : 'divide-slate-200'}`}>
              {isLoading ? (
                <tr>
                  <td colSpan={16} className="py-12 text-center text-slate-400 font-medium">
                    <RefreshCw className="w-5 h-5 text-amber-500 animate-spin mx-auto mb-2" />
                    Memuat data barang dari PostgreSQL database...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={16} className="py-12 text-center text-slate-400 font-medium">
                    Tidak ada barang ditemukan.
                  </td>
                </tr>
              ) : (
                products.map((item) => (
                  <tr
                    key={item.id}
                    onDoubleClick={() => handleOpenEditModal(item)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ x: e.clientX, y: e.clientY, item });
                    }}
                    className={`transition-colors cursor-pointer ${
                      selectedProduct?.id === item.id
                        ? 'bg-amber-500/10 text-amber-400'
                        : isDark
                        ? 'hover:bg-slate-800/50 text-slate-200'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <td className="py-3 px-3 font-mono text-[11px] text-amber-400 font-bold">{item.inventoryNo}</td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400">{item.barcode}</td>
                    <td className="py-3 px-3 font-semibold max-w-[200px] truncate">{item.inventoryName}</td>
                    <td className="py-3 px-3 text-slate-300">{item.brandName || '-'}</td>
                    <td className="py-3 px-3 text-slate-300">{item.categoryName || '-'}</td>
                    <td className="py-3 px-3 text-slate-300">{item.productName || '-'}</td>
                    <td className="py-3 px-3 text-slate-400 font-bold">{item.uomName || 'PCS'}</td>
                    <td className="py-3 px-3 text-right font-bold text-white">Rp {(item.price || 0).toLocaleString('id-ID')}</td>
                    <td className="py-3 px-3 text-right text-emerald-400">Rp {(item.hpp || 0).toLocaleString('id-ID')}</td>
                    <td className="py-3 px-3 text-right text-amber-400">Rp {(item.grosir1 || 0).toLocaleString('id-ID')}</td>
                    <td className="py-3 px-3 text-right text-amber-400">Rp {(item.grosir2 || 0).toLocaleString('id-ID')}</td>
                    <td className="py-3 px-3 text-right text-amber-400">Rp {(item.grosir3 || 0).toLocaleString('id-ID')}</td>
                    <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-400">
                      {item.minStock} / {item.maxStock}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                          item.stokAkhir < item.minStock ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'bg-emerald-500/15 text-emerald-400'
                        }`}
                      >
                        {item.stokAkhir}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${item.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                        {item.isActive ? 'AKTIF' : 'NON-AKTIF'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditModal(item);
                          }}
                          className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-amber-400"
                          title="Edit Detail Barang"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenOpname(item);
                          }}
                          className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-emerald-400"
                          title="Input Stok Opname"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProduct(item);
                          }}
                          className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-rose-400"
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

      {/* 🖱️ DEVEXPRESS CONTEXT MENU (RIGHT CLICK) */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 w-48 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl py-1 text-xs text-slate-200 select-none animate-in fade-in zoom-in-95 duration-100"
        >
          <button
            onClick={() => {
              handleOpenEditModal(contextMenu.item);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left hover:bg-amber-500 hover:text-slate-950 font-semibold flex items-center gap-2"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>&Detail / Edit Barang</span>
          </button>
          <button
            onClick={() => {
              handleOpenOpname(contextMenu.item);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left hover:bg-amber-500 hover:text-slate-950 font-semibold flex items-center gap-2"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>&Stok Opname</span>
          </button>
          <button
            onClick={() => {
              handleAddToBarcodeQueue(contextMenu.item);
              setContextMenu(null);
            }}
            className="w-full px-3.5 py-2 text-left hover:bg-amber-500 hover:text-slate-950 font-semibold flex items-center gap-2"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>&Cetak Barcode</span>
          </button>
          <div className="h-px bg-slate-800 my-1" />
          <button
            onClick={() => {
              handleDeleteProduct(contextMenu.item);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left hover:bg-rose-600 hover:text-white font-semibold text-rose-400 flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>&Hapus Barang</span>
          </button>
        </div>
      )}

      {/* 📝 MODAL 1: ADD / EDIT ITEM DIALOG */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-sm">{modalMode === 'create' ? 'Tambah Barang Baru' : `Detail Barang: ${formData.inventoryName}`}</h3>
              </div>
              <button onClick={() => setIsFormModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-950/30 px-6 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveFormTab('general')}
                className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all ${
                  activeFormTab === 'general' ? 'border-amber-500 text-amber-400 bg-slate-900' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Informasi Umum
              </button>
              <button
                type="button"
                onClick={() => setActiveFormTab('pricing')}
                className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all ${
                  activeFormTab === 'pricing' ? 'border-amber-500 text-amber-400 bg-slate-900' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Harga & Grosir
              </button>
              {modalMode === 'edit' && (
                <button
                  type="button"
                  onClick={() => setActiveFormTab('history')}
                  className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all ${
                    activeFormTab === 'history' ? 'border-amber-500 text-amber-400 bg-slate-900' : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Riwayat HPP Modal
                </button>
              )}
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveForm} className="flex-1 overflow-y-auto p-6 space-y-4">
              {activeFormTab === 'general' && (
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Inventory No (SKU)</label>
                    <input
                      type="text"
                      required
                      value={formData.inventoryNo || ''}
                      onChange={(e) => setFormData({ ...formData, inventoryNo: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Barcode</label>
                    <input
                      type="text"
                      value={formData.barcode || ''}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-slate-400 font-semibold mb-1">Nama Barang</label>
                    <input
                      type="text"
                      required
                      value={formData.inventoryName || ''}
                      onChange={(e) => setFormData({ ...formData, inventoryName: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Brand</label>
                    <select
                      value={formData.inventoryBrandId || 1}
                      onChange={(e) => setFormData({ ...formData, inventoryBrandId: parseInt(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    >
                      {lookups.brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.brandName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Category</label>
                    <select
                      value={formData.inventoryCategoryId || 1}
                      onChange={(e) => setFormData({ ...formData, inventoryCategoryId: parseInt(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    >
                      {lookups.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.categoryName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Product Type</label>
                    <select
                      value={formData.inventoryProductId || 1}
                      onChange={(e) => setFormData({ ...formData, inventoryProductId: parseInt(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    >
                      {lookups.productTypes.map((pt) => (
                        <option key={pt.id} value={pt.id}>
                          {pt.productName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Satuan (UoM)</label>
                    <select
                      value={formData.uoMId || 1}
                      onChange={(e) => setFormData({ ...formData, uoMId: parseInt(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    >
                      {lookups.uoms.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.uomName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Min Stock Threshold</label>
                    <input
                      type="number"
                      value={formData.minStock ?? 0}
                      onChange={(e) => setFormData({ ...formData, minStock: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Max Stock Limit</label>
                    <input
                      type="number"
                      value={formData.maxStock ?? 0}
                      onChange={(e) => setFormData({ ...formData, maxStock: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                </div>
              )}

              {activeFormTab === 'pricing' && (
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Harga Retail (Jual)</label>
                    <input
                      type="number"
                      required
                      value={formData.price ?? 0}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-emerald-400 font-semibold mb-1">HPP / Harga Modal</label>
                    <input
                      type="number"
                      value={formData.hpp ?? 0}
                      onChange={(e) => setFormData({ ...formData, hpp: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-emerald-900/50 rounded-xl px-3 py-2 text-emerald-400 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-amber-400 font-semibold mb-1">Harga Grosir Tier 1</label>
                    <input
                      type="number"
                      value={formData.grosir1 ?? 0}
                      onChange={(e) => setFormData({ ...formData, grosir1: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-amber-900/50 rounded-xl px-3 py-2 text-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-amber-400 font-semibold mb-1">Harga Grosir Tier 2</label>
                    <input
                      type="number"
                      value={formData.grosir2 ?? 0}
                      onChange={(e) => setFormData({ ...formData, grosir2: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-amber-900/50 rounded-xl px-3 py-2 text-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-amber-400 font-semibold mb-1">Harga Grosir Tier 3</label>
                    <input
                      type="number"
                      value={formData.grosir3 ?? 0}
                      onChange={(e) => setFormData({ ...formData, grosir3: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-amber-900/50 rounded-xl px-3 py-2 text-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Diskon Standard (%)</label>
                    <input
                      type="number"
                      value={formData.disc ?? 0}
                      onChange={(e) => setFormData({ ...formData, disc: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                </div>
              )}

              {activeFormTab === 'history' && (
                <div className="space-y-3 text-xs">
                  <h4 className="font-bold text-slate-300">Riwayat HPP & Penerimaan Barang</h4>
                  <div className="rounded-xl border border-slate-800 overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-950 border-b border-slate-800 text-slate-400">
                          <th className="p-2.5">No Penerimaan (MR)</th>
                          <th className="p-2.5">Tanggal</th>
                          <th className="p-2.5">Supplier</th>
                          <th className="p-2.5 text-right">HPP Item</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {hppHistory.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-slate-500">
                              Belum ada riwayat HPP penerimaan.
                            </td>
                          </tr>
                        ) : (
                          hppHistory.map((h) => (
                            <tr key={h.id}>
                              <td className="p-2.5 font-mono text-amber-400">{h.mrNo}</td>
                              <td className="p-2.5 text-slate-400">{h.mrDate}</td>
                              <td className="p-2.5 text-slate-200">{h.supplierName}</td>
                              <td className="p-2.5 text-right font-bold text-emerald-400">Rp {h.hpp.toLocaleString('id-ID')}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Modal Footer Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800"
                >
                  Batal
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md">
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
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Input Qty Stok Opname</h3>
              </div>
              <button onClick={() => setIsOpnameModalOpen(false)} className="p-1 rounded hover:bg-slate-800 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-slate-400 font-mono">{selectedProduct.inventoryNo}</div>
                <div className="font-bold text-sm text-white">{selectedProduct.inventoryName}</div>
                <div className="text-slate-400 mt-1">Stok System Saat Ini: <span className="font-bold text-emerald-400">{selectedProduct.stokAkhir}</span></div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Stok Fisik Hasil Opname</label>
                <input
                  type="number"
                  value={opnameQty}
                  onChange={(e) => setOpnameQty(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-emerald-900 rounded-xl px-4 py-2.5 text-emerald-400 font-bold text-base focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsOpnameModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold"
              >
                Batal
              </button>
              <button onClick={handleSaveOpname} className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shadow-md">
                Perbarui Stok
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🏷️ MODAL 3: BARCODE PRINT QUEUE DIALOG */}
      {isBarcodeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm">Cetak Queue Barcode Label</h3>
              </div>
              <button onClick={() => setIsBarcodeModalOpen(false)} className="p-1 rounded hover:bg-slate-800 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs max-h-60 overflow-y-auto">
              {barcodeQueue.length === 0 ? (
                <div className="text-center p-6 text-slate-400">Daftar cetak barcode masih kosong. Klik kanan barang lalu pilih &Cetak Barcode.</div>
              ) : (
                barcodeQueue.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div>
                      <div className="font-bold text-white">{item.product.inventoryName}</div>
                      <div className="font-mono text-slate-400 text-[11px]">{item.product.barcode}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-slate-400">Jumlah Label:</label>
                      <input
                        type="number"
                        min="1"
                        value={item.printQty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setBarcodeQueue((prev) => prev.map((b, i) => (i === idx ? { ...b, printQty: val } : b)));
                        }}
                        className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center font-bold text-indigo-400"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-between items-center pt-2">
              <button onClick={() => setBarcodeQueue([])} className="text-rose-400 hover:text-rose-300 text-xs font-semibold">
                Kosongkan Queue
              </button>
              <div className="flex gap-2">
                <button onClick={() => setIsBarcodeModalOpen(false)} className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold">
                  Tutup
                </button>
                <button
                  onClick={() => alert(`Mengirim ${barcodeQueue.reduce((a, b) => a + b.printQty, 0)} label barcode ke printer...`)}
                  className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs shadow-md"
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

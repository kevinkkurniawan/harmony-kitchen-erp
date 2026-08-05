'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  Plus,
  Users,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  X,
  AlertTriangle,
  Download,
  Zap,
  ChevronUp,
  ChevronDown,
  Building2,
  MapPin,
  Phone,
  Mail,
  ShieldAlert,
} from 'lucide-react';
import { Supplier } from '@/types/erp';

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

interface MasterSupplierManagerProps {
  isDark: boolean;
}

export default function MasterSupplierManager({ isDark }: MasterSupplierManagerProps) {
  // Main Data States
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterOnlyActive, setFilterOnlyActive] = useState<boolean>(true);
  const [filterOnlyTaxable, setFilterOnlyTaxable] = useState<boolean>(false);

  // Selection & Context Menu
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; supplier: Supplier } | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<keyof Supplier>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

  // Form Data
  const [formData, setFormData] = useState<Partial<Supplier>>({
    supplierNo: '',
    supplierName: '',
    address: '',
    city: '',
    phone1: '',
    phone2: '',
    fax: '',
    contactPerson: '',
    email: '',
    taxNo: '',
    isTaxable: false,
    description: '',
    isActive: true,
  });

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const addToast = useCallback((text: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // Fetch Suppliers from PostgreSQL
  const fetchSuppliers = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = `/api/suppliers?q=${encodeURIComponent(searchQuery)}`;
      if (filterOnlyActive) url += `&onlyActive=true`;
      if (filterOnlyTaxable) url += `&onlyTaxable=true`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setSuppliers(json.data);
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err);
      addToast('Gagal terhubung ke database supplier', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterOnlyActive, filterOnlyTaxable, addToast]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      let url = `/api/suppliers?q=${encodeURIComponent(searchQuery)}`;
      if (filterOnlyActive) url += `&onlyActive=true`;
      if (filterOnlyTaxable) url += `&onlyTaxable=true`;
      const res = await fetch(url);
      const json = await res.json();
      if (isMounted && json.success && Array.isArray(json.data)) {
        setSuppliers(json.data);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [searchQuery, filterOnlyActive, filterOnlyTaxable]);

  // Open Create Modal
  const handleOpenCreateModal = useCallback(() => {
    setModalMode('create');
    setFormData({
      supplierNo: `S${(suppliers.length + 1).toString().padStart(5, '0')}`,
      supplierName: '',
      address: '',
      city: '',
      phone1: '',
      phone2: '',
      fax: '',
      contactPerson: '',
      email: '',
      taxNo: '',
      isTaxable: false,
      description: '',
      isActive: true,
    });
    setIsModalOpen(true);
  }, [suppliers.length]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
        setContextMenu(null);
      } else if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleOpenCreateModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOpenCreateModal]);

  // Handle Save Form (Create/Edit)
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = modalMode === 'edit' && selectedSupplier;
      const url = isEdit ? `/api/suppliers/${selectedSupplier.id}` : `/api/suppliers`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (json.success) {
        setIsModalOpen(false);
        addToast(isEdit ? 'Data supplier berhasil diperbarui!' : 'Supplier baru berhasil dibuat!', 'success');
        fetchSuppliers();
      } else {
        addToast(`Gagal menyimpan: ${json.error}`, 'error');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(`Error: ${message}`, 'error');
    }
  };

  // Handle Delete Supplier
  const handleDeleteSupplier = async (supplier: Supplier) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus supplier "${supplier.supplierName}"?`)) return;
    try {
      const res = await fetch(`/api/suppliers/${supplier.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        addToast(`Supplier "${supplier.supplierName}" berhasil dihapus`, 'info');
        fetchSuppliers();
      } else {
        addToast(`Gagal menghapus: ${json.error}`, 'error');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(`Error: ${message}`, 'error');
    }
  };

  // Toggle Active Supplier
  const handleToggleActiveSupplier = async (supplier: Supplier) => {
    try {
      const currentActive = supplier.isActive !== false;
      const res = await fetch(`/api/suppliers/${supplier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      const json = await res.json();
      if (json.success) {
        addToast(`Status "${supplier.supplierName}" diubah menjadi ${!currentActive ? 'AKTIF' : 'NON-AKTIF'}`, 'info');
        fetchSuppliers();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(`Error: ${message}`, 'error');
    }
  };

  // Export CSV
  const exportToCSV = () => {
    if (suppliers.length === 0) return addToast('Tidak ada data supplier untuk diexport', 'warning');
    const headers = ['ID', 'Kode Supplier', 'Nama Supplier', 'Alamat', 'Kota', 'Phone 1', 'Phone 2', 'Fax', 'Contact Person', 'Email', 'NPWP Tax No', 'Is Taxable', 'Status Active', 'Keterangan'];
    const csvRows = [headers.join(',')];
    suppliers.forEach((s) => {
      csvRows.push([
        s.id,
        `"${s.supplierNo || ''}"`,
        `"${s.supplierName.replace(/"/g, '""')}"`,
        `"${(s.address || '').replace(/"/g, '""')}"`,
        `"${s.city || ''}"`,
        `"${s.phone1 || ''}"`,
        `"${s.phone2 || ''}"`,
        `"${s.fax || ''}"`,
        `"${(s.contactPerson || '').replace(/"/g, '""')}"`,
        `"${s.email || ''}"`,
        `"${s.taxNo || ''}"`,
        s.isTaxable ? 'PKP' : 'NON-PKP',
        s.isActive !== false ? 'AKTIF' : 'NON-AKTIF',
        `"${(s.description || '').replace(/"/g, '""')}"`,
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Master_Supplier_${new Date().toISOString().slice(0, 10)}.csv`);
    link.click();
    addToast(`Berhasil mengexport ${suppliers.length} data supplier ke CSV`, 'success');
  };

  // Close context menu on outside click
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Sorted Suppliers
  const sortedSuppliers = [...suppliers].sort((a, b) => {
    const valA = a[sortField] ?? '';
    const valB = b[sortField] ?? '';
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    }
    return sortOrder === 'asc'
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA));
  });

  // Calculate unique cities
  const uniqueCitiesCount = new Set(suppliers.map((s) => s.city).filter(Boolean)).size;

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

      {/* 📊 SUMMARY CARDS HEADER */}
      <div className={`p-4 border-b grid grid-cols-2 md:grid-cols-4 gap-3.5 shadow-sm ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
          isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-blue-50/60 border-blue-200/80'
        }`}>
          <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Supplier</div>
            <div className={`text-lg font-black ${isDark ? 'text-blue-300' : 'text-blue-950'}`}>{suppliers.length}</div>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
          isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-emerald-50/60 border-emerald-200/80'
        }`}>
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Supplier Aktif</div>
            <div className={`text-lg font-black ${isDark ? 'text-emerald-300' : 'text-emerald-950'}`}>
              {suppliers.filter((s) => s.isActive !== false).length}
            </div>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
          isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-amber-50/60 border-amber-200/80'
        }`}>
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Supplier PKP (Taxable)</div>
            <div className={`text-lg font-black ${isDark ? 'text-amber-300' : 'text-amber-950'}`}>
              {suppliers.filter((s) => s.isTaxable).length}
            </div>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
          isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-purple-50/60 border-purple-200/80'
        }`}>
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Kota Jaringan Supplier</div>
            <div className={`text-lg font-black ${isDark ? 'text-purple-300' : 'text-purple-950'}`}>{uniqueCitiesCount} Kota</div>
          </div>
        </div>
      </div>

      {/* 👑 MASTER SUPPLIER TOOLBAR */}
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
              placeholder="Cari Supplier (Nama / Kode / Kota / CP / Phone)... [/]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full border-2 rounded-xl pl-10 pr-10 py-1.5 text-xs font-black focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-400 focus:border-amber-400'
                  : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-500 focus:border-slate-700'
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter Checkbox Aktif */}
          <label className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
            filterOnlyActive
              ? isDark ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300' : 'bg-emerald-100 border-emerald-400 text-emerald-950'
              : isDark ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-white border-slate-300 text-slate-700'
          }`}>
            <input
              type="checkbox"
              checked={filterOnlyActive}
              onChange={(e) => setFilterOnlyActive(e.target.checked)}
              className="w-3.5 h-3.5 accent-emerald-500 rounded cursor-pointer"
            />
            <span>Hanya Aktif</span>
          </label>

          {/* Filter Checkbox PKP */}
          <label className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
            filterOnlyTaxable
              ? isDark ? 'bg-amber-950/60 border-amber-700 text-amber-300' : 'bg-amber-100 border-amber-400 text-amber-950'
              : isDark ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-white border-slate-300 text-slate-700'
          }`}>
            <input
              type="checkbox"
              checked={filterOnlyTaxable}
              onChange={(e) => setFilterOnlyTaxable(e.target.checked)}
              className="w-3.5 h-3.5 accent-amber-500 rounded cursor-pointer"
            />
            <span>Hanya PKP</span>
          </label>

          <button
            onClick={handleOpenCreateModal}
            className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-black active:scale-95 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            title="Tambah Supplier (Alt+N)"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Tambah Supplier</span>
          </button>

          <button
            onClick={exportToCSV}
            className={`px-3 py-2 rounded-xl border text-xs font-black flex items-center gap-2 transition-all cursor-pointer active:scale-95 ${
              isDark
                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border-emerald-500/50'
                : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-emerald-300 shadow-sm'
            }`}
          >
            <Download className="w-4 h-4 text-emerald-300" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => {
              fetchSuppliers();
              addToast('Data supplier berhasil di-refresh', 'info');
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
        </div>
      </div>

      {/* 📄 MAIN CONTENT DATA TABLE AREA */}
      <div className="flex-1 overflow-auto p-4">
        <div className={`rounded-2xl border overflow-hidden shadow-lg ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <table className="w-full text-left border-collapse text-xs">
            <thead className={`font-black uppercase tracking-wider ${
              isDark ? 'bg-slate-800/90 text-amber-400' : 'bg-slate-200 text-slate-950'
            }`}>
              <tr>
                <th className="py-3 px-3.5 text-center w-12">ID</th>
                <th className="py-3 px-4 w-28">Kode Supplier</th>
                <th
                  onClick={() => {
                    if (sortField === 'supplierName') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortField('supplierName'); setSortOrder('asc'); }
                  }}
                  className="py-3 px-4 cursor-pointer hover:text-amber-300 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Nama Supplier / Perusahaan</span>
                    {sortField === 'supplierName' && (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                  </div>
                </th>
                <th className="py-3 px-4">Alamat & Kota</th>
                <th className="py-3 px-4">Telepon & Fax</th>
                <th className="py-3 px-4">Contact Person (PIC)</th>
                <th className="py-3 px-3 text-center">Status PKP</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center font-bold text-slate-400">
                    <RefreshCw className="w-5 h-5 text-amber-400 animate-spin mx-auto mb-2" />
                    Memuat data supplier dari database PostgreSQL...
                  </td>
                </tr>
              ) : sortedSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={9} className={`py-12 text-center font-bold ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
                    Tidak ada supplier ditemukan.
                  </td>
                </tr>
              ) : (
                sortedSuppliers.map((sup) => (
                  <tr
                    key={sup.id}
                    onClick={() => setSelectedSupplier(sup)}
                    onDoubleClick={() => {
                      setSelectedSupplier(sup);
                      setModalMode('edit');
                      setFormData({ ...sup });
                      setIsModalOpen(true);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSelectedSupplier(sup);
                      setContextMenu({ x: e.clientX, y: e.clientY, supplier: sup });
                    }}
                    className={`transition-colors cursor-pointer ${
                      selectedSupplier?.id === sup.id
                        ? isDark ? 'bg-slate-800 text-amber-300 font-bold border-l-4 border-amber-500' : 'bg-amber-100 text-slate-950 font-bold border-l-4 border-amber-600'
                        : isDark ? 'hover:bg-slate-800/50 text-slate-200' : 'hover:bg-slate-50 text-slate-900'
                    }`}
                  >
                    <td className="py-3 px-3.5 text-center font-mono font-bold text-slate-400">{sup.id}</td>
                    <td className="py-3 px-4 font-mono font-black text-amber-400">{sup.supplierNo || '-'}</td>
                    <td className="py-3 px-4 font-black">
                      <div>{sup.supplierName}</div>
                      {sup.email && <div className="text-[11px] font-normal text-indigo-400 flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" />{sup.email}</div>}
                    </td>
                    <td className="py-3 px-4 text-slate-300 max-w-xs truncate">
                      <div>{sup.address && sup.address !== '-' ? sup.address : 'Alamat belum diisi'}</div>
                      {sup.city && <div className="text-[11px] font-bold text-amber-400/90 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{sup.city}</div>}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <div className="flex items-center gap-1">{sup.phone1 && sup.phone1 !== '-' ? <Phone className="w-3 h-3 text-emerald-400 shrink-0" /> : null}<span>{sup.phone1 || '-'}</span></div>
                      {sup.phone2 && sup.phone2 !== '-' && <div className="text-slate-400 text-[11px]">Alt: {sup.phone2}</div>}
                    </td>
                    <td className="py-3 px-4 font-bold">
                      {sup.contactPerson && sup.contactPerson !== '-' ? (
                        <div className="flex items-center gap-1 text-slate-200">
                          <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>{sup.contactPerson}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 font-normal">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {sup.isTaxable ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          PKP
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700">
                          Non-PKP
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        sup.isActive !== false
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      }`}>
                        {sup.isActive !== false ? 'AKTIF' : 'NON-AKTIF'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSupplier(sup);
                            setModalMode('edit');
                            setFormData({ ...sup });
                            setIsModalOpen(true);
                          }}
                          className="p-1 rounded-lg hover:bg-amber-500/20 text-amber-400 cursor-pointer"
                          title="Edit Supplier"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSupplier(sup);
                          }}
                          className="p-1 rounded-lg hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                          title="Hapus Supplier"
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

      {/* 📌 RIGHT-CLICK CONTEXT MENU */}
      {contextMenu && (
        <div
          className={`fixed z-50 w-52 rounded-2xl border shadow-2xl py-1.5 text-xs font-bold overflow-hidden animate-in fade-in duration-100 ${
            isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
          }`}
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-700/50">
            Aksi Supplier Menu
          </div>
          <button
            onClick={() => {
              setSelectedSupplier(contextMenu.supplier);
              setModalMode('edit');
              setFormData({ ...contextMenu.supplier });
              setIsModalOpen(true);
              setContextMenu(null);
            }}
            className="w-full px-3.5 py-2 text-left hover:bg-amber-500/20 hover:text-amber-300 flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Edit className="w-4 h-4 text-amber-400" />
            <span>&Edit Supplier</span>
          </button>

          <button
            onClick={() => {
              handleToggleActiveSupplier(contextMenu.supplier);
              setContextMenu(null);
            }}
            className="w-full px-3.5 py-2 text-left hover:bg-emerald-500/20 hover:text-emerald-300 flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Zap className="w-4 h-4 text-emerald-400" />
            <span>&Toggle Status Aktif</span>
          </button>

          <button
            onClick={() => {
              handleDeleteSupplier(contextMenu.supplier);
              setContextMenu(null);
            }}
            className="w-full px-3.5 py-2 text-left hover:bg-rose-500/20 text-rose-400 flex items-center gap-2 cursor-pointer transition-colors border-t border-slate-700/50"
          >
            <Trash2 className="w-4 h-4" />
            <span>&Hapus Supplier</span>
          </button>
        </div>
      )}

      {/* ✏️ FORM MODAL FOR SUPPLIER (Create / Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
            isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
          }`}>
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
              isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-300'
            }`}>
              <div className="flex items-center gap-2 font-black text-sm text-amber-400">
                <Building2 className="w-4 h-4" />
                <span>{modalMode === 'create' ? 'Tambah Supplier Baru' : 'Edit Data Supplier'}</span>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveForm} className="p-6 space-y-4 text-xs font-bold overflow-y-auto flex-1">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block mb-1 text-slate-400">Kode Supplier *</label>
                  <input
                    type="text"
                    required
                    placeholder="S00001"
                    value={formData.supplierNo || ''}
                    onChange={(e) => setFormData({ ...formData, supplierNo: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border font-mono font-bold text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
                    }`}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block mb-1 text-slate-400">Nama Supplier / Perusahaan *</label>
                  <input
                    type="text"
                    required
                    placeholder="PT. RKM Utama / Paramount / CKU"
                    value={formData.supplierName || ''}
                    onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block mb-1 text-slate-400">Alamat Perusahaan</label>
                  <input
                    type="text"
                    placeholder="Jl. Raya Industri No. 88"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400">Kota</label>
                  <input
                    type="text"
                    placeholder="Surabaya / Jakarta"
                    value={formData.city || ''}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block mb-1 text-slate-400">No. Telepon 1</label>
                  <input
                    type="text"
                    placeholder="031-888999"
                    value={formData.phone1 || ''}
                    onChange={(e) => setFormData({ ...formData, phone1: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400">No. Telepon 2</label>
                  <input
                    type="text"
                    placeholder="0812345678"
                    value={formData.phone2 || ''}
                    onChange={(e) => setFormData({ ...formData, phone2: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400">Fax</label>
                  <input
                    type="text"
                    placeholder="031-888990"
                    value={formData.fax || ''}
                    onChange={(e) => setFormData({ ...formData, fax: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-slate-400">Contact Person (PIC Sales)</label>
                  <input
                    type="text"
                    placeholder="Bpk. Budi Santoso"
                    value={formData.contactPerson || ''}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400">Email Resmi</label>
                  <input
                    type="email"
                    placeholder="sales@supplier.com"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-slate-400">Nomor NPWP Pajak</label>
                  <input
                    type="text"
                    placeholder="01.234.567.8-012.000"
                    value={formData.taxNo || ''}
                    onChange={(e) => setFormData({ ...formData, taxNo: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border font-mono font-bold text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
                    }`}
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isTaxable || false}
                      onChange={(e) => setFormData({ ...formData, isTaxable: e.target.checked })}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                    <span className="text-amber-400">Pengusaha Kena Pajak (Status PKP)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block mb-1 text-slate-400">Deskripsi / Catatan Tambahan</label>
                <textarea
                  rows={2}
                  placeholder="Catatan ketentuan pembayaran / term of payment..."
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive !== false}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                  <span className="text-emerald-400">Status Supplier Aktif</span>
                </label>
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700/50 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 cursor-pointer font-bold transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black cursor-pointer shadow-lg transition-all"
                >
                  Simpan Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

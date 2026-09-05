'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  Plus,
  Tag,
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
  Layers,
  Percent,
} from 'lucide-react';

export interface PromoRuleItem {
  id: number | string;
  promoNo?: string;
  promo_no?: string;
  promoName: string;
  promo_name?: string;
  groupName?: string;
  group_name?: string;
  promoBundle?: number;
  promoGrosir?: number;
  promoPercentage?: number;
  discountPct?: number;
  discount_pct?: number;
  qtyMin?: number;
  qtyMax?: number;
  isPartial?: boolean;
  isGroup?: boolean;
  description?: string;
  promoGrosirType?: string;
  startDate?: string;
  start_date?: string;
  endDate?: string;
  end_date?: string;
  isActive: boolean;
  is_active?: boolean;
}

export interface PromoGroupItem {
  id: number | string;
  promoCode?: string;
  promoName?: string;
  groupName?: string;
  group_name?: string;
  description?: string;
  promosCount?: number;
  promos_count?: number;
  isActive?: boolean;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

interface MasterPromoManagerProps {
  isDark: boolean;
}

export default function MasterPromoManager({ isDark }: MasterPromoManagerProps) {
  // Main Data States
  const [promoTab, setPromoTab] = useState<'rules' | 'groups'>('rules');
  const [promoRules, setPromoRules] = useState<PromoRuleItem[]>([]);
  const [promoGroups, setPromoGroups] = useState<PromoGroupItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterOnlyActive, setFilterOnlyActive] = useState<boolean>(true);

  // Selection & Context Menu
  const [selectedRule, setSelectedRule] = useState<PromoRuleItem | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<PromoGroupItem | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: PromoRuleItem | PromoGroupItem; type: 'rule' | 'group' } | null>(null);

  // Sorting
  const [sortFieldRule, setSortFieldRule] = useState<keyof PromoRuleItem>('id');
  const [sortOrderRule, setSortOrderRule] = useState<'asc' | 'desc'>('asc');

  // Modals
  const [isRuleModalOpen, setIsRuleModalOpen] = useState<boolean>(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

  // Form Data
  const [ruleFormData, setRuleFormData] = useState<Partial<PromoRuleItem>>({
    promoName: '',
    promoBundle: 0,
    promoGrosir: 0,
    promoPercentage: 0,
    qtyMin: 1,
    qtyMax: 9999,
    isPartial: true,
    isGroup: true,
    description: '',
    promoGrosirType: 'PERCENT',
    isActive: true,
  });

  const [groupFormData, setGroupFormData] = useState<Partial<PromoGroupItem>>({
    promoCode: '',
    promoName: '',
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

  // Fetch Promo Rules
  const fetchPromoRules = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = `/api/promos/items?q=${encodeURIComponent(searchQuery)}`;
      if (filterOnlyActive) url += `&onlyActive=true`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setPromoRules(json.data);
      }
    } catch (err) {
      console.error('Error fetching promo rules:', err);
      addToast('Gagal terhubung ke database promo rules', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterOnlyActive, addToast]);

  // Fetch Promo Groups
  const fetchPromoGroups = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = `/api/promos?q=${encodeURIComponent(searchQuery)}`;
      if (filterOnlyActive) url += `&onlyActive=true`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setPromoGroups(json.data);
      }
    } catch (err) {
      console.error('Error fetching promo groups:', err);
      addToast('Gagal terhubung ke database promo groups', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterOnlyActive, addToast]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (promoTab === 'rules') {
        let url = `/api/promos/items?q=${encodeURIComponent(searchQuery)}`;
        if (filterOnlyActive) url += `&onlyActive=true`;
        const res = await fetch(url);
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data)) {
          setPromoRules(json.data);
        }
      } else {
        let url = `/api/promos?q=${encodeURIComponent(searchQuery)}`;
        if (filterOnlyActive) url += `&onlyActive=true`;
        const res = await fetch(url);
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data)) {
          setPromoGroups(json.data);
        }
      }
    };
    load();
    return () => { isMounted = false; };
  }, [promoTab, searchQuery, filterOnlyActive]);

  // Open Rule Modal
  const handleOpenCreateRuleModal = useCallback(() => {
    setModalMode('create');
    setRuleFormData({
      promoName: '',
      promoBundle: 0,
      promoGrosir: 0,
      promoPercentage: 10,
      qtyMin: 1,
      qtyMax: 9999,
      isPartial: true,
      isGroup: true,
      description: '',
      promoGrosirType: 'PERCENT',
      isActive: true,
    });
    setIsRuleModalOpen(true);
  }, []);

  // Open Group Modal
  const handleOpenCreateGroupModal = useCallback(() => {
    setModalMode('create');
    setGroupFormData({
      promoCode: `PRM-GRP-${Date.now().toString().slice(-4)}`,
      promoName: '',
      description: '',
      isActive: true,
    });
    setIsGroupModalOpen(true);
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsRuleModalOpen(false);
        setIsGroupModalOpen(false);
        setContextMenu(null);
      } else if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (promoTab === 'rules') handleOpenCreateRuleModal();
        else handleOpenCreateGroupModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [promoTab, handleOpenCreateRuleModal, handleOpenCreateGroupModal]);

  // Handle Save Rule Form
  const handleSaveRuleForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = modalMode === 'edit' && selectedRule;
      const url = isEdit ? `/api/promos/items/${selectedRule.id}` : `/api/promos/items`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleFormData),
      });

      const json = await res.json();
      if (json.success) {
        setIsRuleModalOpen(false);
        addToast(isEdit ? 'Aturan promo diperbarui!' : 'Aturan promo baru dibuat!', 'success');
        fetchPromoRules();
      } else {
        addToast(`Gagal menyimpan: ${json.error}`, 'error');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(`Error: ${message}`, 'error');
    }
  };

  // Handle Save Group Form
  const handleSaveGroupForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = modalMode === 'edit' && selectedGroup;
      const url = isEdit ? `/api/promos/${selectedGroup.id}` : `/api/promos`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupFormData),
      });

      const json = await res.json();
      if (json.success) {
        setIsGroupModalOpen(false);
        addToast(isEdit ? 'Kelompok promo diperbarui!' : 'Kelompok promo baru dibuat!', 'success');
        fetchPromoGroups();
      } else {
        addToast(`Gagal menyimpan: ${json.error}`, 'error');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(`Error: ${message}`, 'error');
    }
  };

  // Handle Delete Rule
  const handleDeleteRule = async (rule: PromoRuleItem) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus promo "${rule.promoName}"?`)) return;
    try {
      const res = await fetch(`/api/promos/items/${rule.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        addToast(`Promo "${rule.promoName}" berhasil dihapus`, 'info');
        fetchPromoRules();
      } else {
        addToast(`Gagal menghapus: ${json.error}`, 'error');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(`Error: ${message}`, 'error');
    }
  };

  // Handle Delete Group
  const handleDeleteGroup = async (group: PromoGroupItem) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus kelompok promo "${group.promoName}"?`)) return;
    try {
      const res = await fetch(`/api/promos/${group.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        addToast(`Kelompok promo "${group.promoName}" berhasil dihapus`, 'info');
        fetchPromoGroups();
      } else {
        addToast(`Gagal menghapus: ${json.error}`, 'error');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(`Error: ${message}`, 'error');
    }
  };

  // Toggle Active Rule
  const handleToggleActiveRule = async (rule: PromoRuleItem) => {
    try {
      const res = await fetch(`/api/promos/items/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      const json = await res.json();
      if (json.success) {
        addToast(`Status "${rule.promoName}" diubah menjadi ${!rule.isActive ? 'AKTIF' : 'NON-AKTIF'}`, 'info');
        fetchPromoRules();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(`Error: ${message}`, 'error');
    }
  };

  // Export CSV
  const exportToCSV = () => {
    if (promoTab === 'rules') {
      if (promoRules.length === 0) return addToast('Tidak ada data promo rules untuk diexport', 'warning');
      const headers = ['ID', 'Nama Promo', 'Qty Min', 'Qty Max', 'Diskon %', 'Nominal Grosir', 'Bundle Qty', 'Status Aktif', 'Keterangan'];
      const csvRows = [headers.join(',')];
      promoRules.forEach((r) => {
        csvRows.push([
          r.id,
          `"${r.promoName.replace(/"/g, '""')}"`,
          r.qtyMin,
          r.qtyMax,
          r.promoPercentage,
          r.promoGrosir,
          r.promoBundle,
          r.isActive ? 'AKTIF' : 'NON-AKTIF',
          `"${(r.description || '').replace(/"/g, '""')}"`,
        ].join(','));
      });
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Master_Promo_Rules_${new Date().toISOString().slice(0, 10)}.csv`);
      link.click();
      addToast(`Berhasil mengexport ${promoRules.length} aturan promo ke CSV`, 'success');
    } else {
      if (promoGroups.length === 0) return addToast('Tidak ada data kelompok promo untuk diexport', 'warning');
      const headers = ['ID', 'Kode Promo', 'Nama Kelompok Promo', 'Description', 'Status Aktif'];
      const csvRows = [headers.join(',')];
      promoGroups.forEach((g) => {
        const name = g.groupName || g.promoName || 'Kelompok Promo';
        csvRows.push([
          g.id,
          `"${g.promoCode || ''}"`,
          `"${name.replace(/"/g, '""')}"`,
          `"${(g.description || '').replace(/"/g, '""')}"`,
          g.isActive ? 'AKTIF' : 'NON-AKTIF',
        ].join(','));
      });
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Master_Promo_Groups_${new Date().toISOString().slice(0, 10)}.csv`);
      link.click();
      addToast(`Berhasil mengexport ${promoGroups.length} kelompok promo ke CSV`, 'success');
    }
  };

  // Close context menu on outside click
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Sorted Promo Rules
  const sortedRules = [...promoRules].sort((a, b) => {
    const valA = a[sortFieldRule] ?? '';
    const valB = b[sortFieldRule] ?? '';
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortOrderRule === 'asc' ? valA - valB : valB - valA;
    }
    return sortOrderRule === 'asc'
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA));
  });

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
          isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-purple-50/60 border-purple-200/80'
        }`}>
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <div className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Aturan Promo</div>
            <div className={`text-lg font-black ${isDark ? 'text-purple-300' : 'text-purple-950'}`}>{promoRules.length}</div>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
          isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-emerald-50/60 border-emerald-200/80'
        }`}>
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Promo Aktif</div>
            <div className={`text-lg font-black ${isDark ? 'text-emerald-300' : 'text-emerald-950'}`}>
              {promoRules.filter((r) => r.isActive).length}
            </div>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
          isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-amber-50/60 border-amber-200/80'
        }`}>
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <div className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Promo Diskon %</div>
            <div className={`text-lg font-black ${isDark ? 'text-amber-300' : 'text-amber-950'}`}>
              {promoRules.filter((r) => (r.discountPct ?? r.discount_pct ?? 0) > 0).length}
            </div>
          </div>
        </div>

        <div className={`p-3.5 rounded-2xl border flex items-center gap-3.5 ${
          isDark ? 'bg-slate-800/80 border-slate-700/80' : 'bg-indigo-50/60 border-indigo-200/80'
        }`}>
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Kelompok Promo Group</div>
            <div className={`text-lg font-black ${isDark ? 'text-indigo-300' : 'text-indigo-950'}`}>{promoGroups.length}</div>
          </div>
        </div>
      </div>

      {/* 👑 MASTER PROMO TOOLBAR */}
      <div className={`px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3 shadow-sm ${
        isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-300'
      }`}>
        {/* Tab Switcher & Search Bar */}
        <div className="flex items-center gap-3 flex-1 min-w-[300px] max-w-xl">
          {/* Sub-Tab Navigation */}
          <div className={`p-1 rounded-xl border flex items-center gap-1 ${
            isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-200 border-slate-300'
          }`}>
            <button
              onClick={() => setPromoTab('rules')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                promoTab === 'rules'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-700 hover:text-black'
              }`}
            >
              Aturan Promo ({promoRules.length})
            </button>
            <button
              onClick={() => setPromoTab('groups')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                promoTab === 'groups'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-700 hover:text-black'
              }`}
            >
              Kelompok Group ({promoGroups.length})
            </button>
          </div>

          {/* Search Bar Input */}
          <div className="relative flex-1 group">
            <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${
              isDark ? 'text-slate-400 group-focus-within:text-amber-400' : 'text-slate-700 group-focus-within:text-slate-950'
            }`} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={`Cari ${promoTab === 'rules' ? 'Aturan Promo' : 'Kelompok Promo'}... [/]`}
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
          {/* Checkbox Filter Hanya Promo Aktif */}
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
            <span>Hanya Promo Aktif</span>
          </label>

          <button
            onClick={() => {
              if (promoTab === 'rules') handleOpenCreateRuleModal();
              else handleOpenCreateGroupModal();
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-black active:scale-95 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            title="Tambah Promo (Alt+N)"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{promoTab === 'rules' ? 'Tambah Aturan Promo' : 'Tambah Kelompok Group'}</span>
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
              if (promoTab === 'rules') fetchPromoRules();
              else fetchPromoGroups();
              addToast('Data promo berhasil di-refresh', 'info');
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

      {/* 📄 PROMO DATA TABLE WORKBENCH */}
      <div className="flex-1 min-h-0 p-4 flex flex-col">
        {promoTab === 'rules' ? (
          /* TABLE ATURAN PROMO (sp_MDPromo_GetData) */
          <div className={`flex-1 min-h-0 overflow-auto rounded-2xl border-2 shadow-lg relative ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <table className="w-full text-left border-separate border-spacing-0 text-xs">
              <thead className="sticky top-0 z-20">
                <tr className={`font-black uppercase tracking-wider text-[11px] border-b-2 ${
                  isDark ? 'bg-slate-800 text-slate-100 border-slate-700' : 'bg-slate-200 text-slate-900 border-slate-300'
                }`}>
                  <th className="py-3 px-3.5 text-center w-12">ID</th>
                  <th className="py-3 px-4">Kode Promo</th>
                  <th
                    onClick={() => {
                      if (sortFieldRule === 'promoName') setSortOrderRule(sortOrderRule === 'asc' ? 'desc' : 'asc');
                      else { setSortFieldRule('promoName'); setSortOrderRule('asc'); }
                    }}
                    className="py-3 px-4 cursor-pointer hover:text-amber-300 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Nama Promo</span>
                      {sortFieldRule === 'promoName' && (sortOrderRule === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                    </div>
                  </th>
                  <th className="py-3 px-4">Kelompok Group</th>
                  <th className="py-3 px-3 text-right">Diskon %</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center font-bold text-slate-400">
                      <RefreshCw className="w-5 h-5 text-amber-400 animate-spin mx-auto mb-2" />
                      Memuat aturan promo dari database...
                    </td>
                  </tr>
                ) : promoRules.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={`py-12 text-center font-bold ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
                      Tidak ada aturan promo ditemukan.
                    </td>
                  </tr>
                ) : (
                  promoRules.map((rule) => {
                    const code = rule.promoNo || rule.promo_no || `PRM-${rule.id}`;
                    const name = rule.promoName || rule.promo_name || 'Promo Item';
                    const group = rule.groupName || rule.group_name || 'Promo Utama';
                    const pct = rule.discountPct ?? rule.discount_pct ?? 0;
                    const active = rule.isActive ?? rule.is_active ?? true;

                    return (
                      <tr
                        key={rule.id}
                        onClick={() => setSelectedRule(rule)}
                        onDoubleClick={() => {
                          setSelectedRule(rule);
                          setModalMode('edit');
                          setRuleFormData({ ...rule });
                          setIsRuleModalOpen(true);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setSelectedRule(rule);
                          setContextMenu({ x: e.clientX, y: e.clientY, item: rule, type: 'rule' });
                        }}
                        className={`transition-colors cursor-pointer ${
                          selectedRule?.id === rule.id
                            ? isDark ? 'bg-slate-800 text-amber-300 font-bold border-l-4 border-amber-500' : 'bg-amber-100 text-slate-950 font-bold border-l-4 border-amber-600'
                            : isDark ? 'hover:bg-slate-800/50 text-slate-200' : 'hover:bg-slate-50 text-slate-900'
                        }`}
                      >
                        <td className="py-3 px-3.5 text-center font-mono font-bold text-slate-400">{rule.id}</td>
                        <td className="py-3 px-4 font-mono font-bold text-amber-500">{code}</td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{name}</td>
                        <td className="py-3 px-4 font-bold text-slate-300">{group}</td>
                        <td className="py-3 px-3 text-right font-mono font-black text-emerald-400">
                          {pct > 0 ? `${pct}%` : '-'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                            active
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          }`}>
                            {active ? 'AKTIF' : 'NON-AKTIF'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRule(rule);
                                setModalMode('edit');
                                setRuleFormData({ ...rule });
                                setIsRuleModalOpen(true);
                              }}
                              className="p-1 rounded-lg hover:bg-amber-500/20 text-amber-400 cursor-pointer"
                              title="Edit Promo"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRule(rule);
                              }}
                              className="p-1 rounded-lg hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                              title="Hapus Promo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* TABLE KELOMPOK PROMO GROUP (sp_MDPromoGroup_GetData) */
          <div className={`flex-1 min-h-0 overflow-auto rounded-2xl border-2 shadow-lg relative ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <table className="w-full text-left border-separate border-spacing-0 text-xs">
              <thead className="sticky top-0 z-20">
                <tr className={`font-black uppercase tracking-wider text-[11px] border-b-2 ${
                  isDark ? 'bg-slate-800 text-slate-100 border-slate-700' : 'bg-slate-200 text-slate-900 border-slate-300'
                }`}>
                  <th className="py-3 px-3.5 text-center w-12">ID</th>
                  <th className="py-3 px-4">Nama Kelompok Promo</th>
                  <th className="py-3 px-3 text-center">Jumlah Promo Aktif</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-24">
                      <div className="flex flex-col items-center justify-center animate-pulse">
                        <div className="w-12 h-12 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin mb-4 shadow-lg shadow-amber-500/20"></div>
                        <h3 className="text-lg font-black text-amber-400 tracking-wider uppercase">Sedang Mengambil Data...</h3>
                        <p className="text-xs text-slate-400 mt-2 font-semibold">Memuat data kelompok promo dari Cloud Database</p>
                      </div>
                    </td>
                  </tr>
                ) : promoGroups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={`py-12 text-center font-bold ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
                      Tidak ada kelompok promo ditemukan.
                    </td>
                  </tr>
                ) : (
                  promoGroups.map((group) => {
                    const name = group.groupName || group.group_name || 'Kelompok Promo';
                    const count = group.promosCount ?? group.promos_count ?? 0;

                    return (
                      <tr
                        key={group.id}
                        onClick={() => setSelectedGroup(group)}
                        onDoubleClick={() => {
                          setSelectedGroup(group);
                          setModalMode('edit');
                          setGroupFormData({ ...group });
                          setIsGroupModalOpen(true);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setSelectedGroup(group);
                          setContextMenu({ x: e.clientX, y: e.clientY, item: group, type: 'group' });
                        }}
                        className={`transition-colors cursor-pointer ${
                          selectedGroup?.id === group.id
                            ? isDark ? 'bg-slate-800 text-amber-300 font-bold border-l-4 border-amber-500' : 'bg-amber-100 text-slate-950 font-bold border-l-4 border-amber-600'
                            : isDark ? 'hover:bg-slate-800/50 text-slate-200' : 'hover:bg-slate-50 text-slate-900'
                        }`}
                      >
                        <td className="py-3 px-3.5 text-center font-mono font-bold text-slate-400">{group.id}</td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{name}</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-amber-400">{count} Promo</td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                            AKTIF
                          </span>
                        </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGroup(group);
                              setModalMode('edit');
                              setGroupFormData({ ...group });
                              setIsGroupModalOpen(true);
                            }}
                            className="p-1 rounded-lg hover:bg-amber-500/20 text-amber-400 cursor-pointer"
                            title="Edit Group"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteGroup(group);
                            }}
                            className="p-1 rounded-lg hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                            title="Hapus Group"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              </tbody>
            </table>
          </div>
        )}
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
            Aksi Menu Context
          </div>
          <button
            onClick={() => {
              if (contextMenu.type === 'rule') {
                const rule = contextMenu.item as PromoRuleItem;
                setSelectedRule(rule);
                setModalMode('edit');
                setRuleFormData({ ...rule });
                setIsRuleModalOpen(true);
              } else {
                const group = contextMenu.item as PromoGroupItem;
                setSelectedGroup(group);
                setModalMode('edit');
                setGroupFormData({ ...group });
                setIsGroupModalOpen(true);
              }
              setContextMenu(null);
            }}
            className="w-full px-3.5 py-2 text-left hover:bg-amber-500/20 hover:text-amber-300 flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Edit className="w-4 h-4 text-amber-400" />
            <span>&Edit Promo</span>
          </button>

          {contextMenu.type === 'rule' && (
            <button
              onClick={() => {
                handleToggleActiveRule(contextMenu.item as PromoRuleItem);
                setContextMenu(null);
              }}
              className="w-full px-3.5 py-2 text-left hover:bg-emerald-500/20 hover:text-emerald-300 flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>&Toggle Status Aktif</span>
            </button>
          )}

          <button
            onClick={() => {
              if (contextMenu.type === 'rule') handleDeleteRule(contextMenu.item as PromoRuleItem);
              else handleDeleteGroup(contextMenu.item as PromoGroupItem);
              setContextMenu(null);
            }}
            className="w-full px-3.5 py-2 text-left hover:bg-rose-500/20 text-rose-400 flex items-center gap-2 cursor-pointer transition-colors border-t border-slate-700/50"
          >
            <Trash2 className="w-4 h-4" />
            <span>&Hapus Promo</span>
          </button>
        </div>
      )}

      {/* ✏️ FORM MODAL FOR PROMO RULE (Create / Edit) */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col ${
            isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
          }`}>
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-300'
            }`}>
              <div className="flex items-center gap-2 font-black text-sm text-amber-400">
                <Tag className="w-4 h-4" />
                <span>{modalMode === 'create' ? 'Tambah Aturan Promo Baru' : 'Edit Aturan Promo'}</span>
              </div>
              <button
                onClick={() => setIsRuleModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveRuleForm} className="p-6 space-y-4 text-xs font-bold">
              <div>
                <label className="block mb-1 text-slate-400">Nama Promo *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Promo Grosir Dapur Utama / Paket Parcel"
                  value={ruleFormData.promoName || ''}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, promoName: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-slate-400">Qty Minimum Order *</label>
                  <input
                    type="number"
                    min={1}
                    value={ruleFormData.qtyMin || 1}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, qtyMin: parseInt(e.target.value) || 1 })}
                    className={`w-full p-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400">Qty Maksimum Order *</label>
                  <input
                    type="number"
                    min={1}
                    value={ruleFormData.qtyMax || 9999}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, qtyMax: parseInt(e.target.value) || 9999 })}
                    className={`w-full p-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block mb-1 text-slate-400">Diskon (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={100}
                    value={ruleFormData.promoPercentage || 0}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, promoPercentage: parseFloat(e.target.value) || 0 })}
                    className={`w-full p-2.5 rounded-xl border font-bold text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
                    }`}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400">Diskon Grosir (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={ruleFormData.promoGrosir || 0}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, promoGrosir: parseFloat(e.target.value) || 0 })}
                    className={`w-full p-2.5 rounded-xl border font-bold text-emerald-400 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
                    }`}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-400">Bundle Qty Items</label>
                  <input
                    type="number"
                    min={0}
                    value={ruleFormData.promoBundle || 0}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, promoBundle: parseInt(e.target.value) || 0 })}
                    className={`w-full p-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-slate-400">Deskripsi / Keterangan Promo</label>
                <textarea
                  rows={3}
                  placeholder="Keterangan syarat & ketentuan promo..."
                  value={ruleFormData.description || ''}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, description: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ruleFormData.isPartial}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, isPartial: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                  <span>Dapat Diaplikasikan Sebagian (isPartial)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ruleFormData.isActive}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, isActive: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                  <span className="text-emerald-400">Status Promo Aktif</span>
                </label>
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700/50">
                <button
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 cursor-pointer font-bold transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black cursor-pointer shadow-lg transition-all"
                >
                  Simpan Aturan Promo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✏️ FORM MODAL FOR PROMO GROUP (Create / Edit) */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden flex flex-col ${
            isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
          }`}>
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-300'
            }`}>
              <div className="flex items-center gap-2 font-black text-sm text-amber-400">
                <Layers className="w-4 h-4" />
                <span>{modalMode === 'create' ? 'Tambah Kelompok Promo Baru' : 'Edit Kelompok Promo'}</span>
              </div>
              <button
                onClick={() => setIsGroupModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveGroupForm} className="p-6 space-y-4 text-xs font-bold">
              <div>
                <label className="block mb-1 text-slate-400">Kode Promo Group *</label>
                <input
                  type="text"
                  required
                  placeholder="PRM-GRP-01"
                  value={groupFormData.promoCode || ''}
                  onChange={(e) => setGroupFormData({ ...groupFormData, promoCode: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border font-mono font-bold text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300'
                  }`}
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-400">Nama Kelompok Promo *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Promo Grosir Dapur Utama"
                  value={groupFormData.promoName || ''}
                  onChange={(e) => setGroupFormData({ ...groupFormData, promoName: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block mb-1 text-slate-400">Deskripsi / Keterangan Group</label>
                <textarea
                  rows={3}
                  placeholder="Keterangan tujuan kelompok promo..."
                  value={groupFormData.description || ''}
                  onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupFormData.isActive}
                    onChange={(e) => setGroupFormData({ ...groupFormData, isActive: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                  <span className="text-emerald-400">Status Kelompok Promo Aktif</span>
                </label>
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700/50">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 cursor-pointer font-bold transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black cursor-pointer shadow-lg transition-all"
                >
                  Simpan Kelompok Promo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

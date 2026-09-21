'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  UserCheck,
  ShieldCheck,
  Plus,
  RefreshCw,
  Save,
  CheckCircle,
  XCircle,
  Key,
  Users,
  CheckSquare,
  Square,
  Sparkles,
  Lock,
  Eye,
  Edit,
  Trash2,
  Printer,
  X,
  User as UserIcon,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

export interface UserRecord {
  id: number;
  username: string;
  fullName: string;
  userLevel: string;
  isActive: boolean;
  createdAt: string;
}

export interface ModulePermission {
  id?: number;
  userId: number;
  moduleCode: string;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPrint: boolean;
  canViewPrice: boolean;
}

export const MODULE_LABEL_MAP: Record<string, { label: string; group: string }> = {
  'memo-sync-stok': { label: 'Memo: Cek Sync Stock', group: '📌 Memo Operasional' },
  'stok-opname': { label: 'Memo: Stok Opname', group: '📌 Memo Operasional' },
  'master-barang': { label: 'Master Data: Master Barang', group: '🏬 Master Data' },
  'inventory-stok': { label: 'Master Data: Inventory Stock', group: '🏬 Master Data' },
  'master-promo': { label: 'Master Data: Master Promo', group: '🏬 Master Data' },
  'master-supplier': { label: 'Master Data: Master Supplier', group: '🏬 Master Data' },
  'penerimaan-barang': { label: 'Purchasing: Penerimaan Barang Ekspress', group: '📦 Purchasing' },
  'penerimaan-barang-harga': { label: 'Purchasing: Penerimaan Barang dengan Harga', group: '📦 Purchasing' },
  'sales-sync-stok': { label: 'Sales: Sync Stock', group: '📊 Sales' },
  'sales-monitoring': { label: 'Sales: Sales Monitoring', group: '📊 Sales' },
  'laporan-penjualan': { label: 'Report: Laporan Penjualan', group: '📑 Report' },
  'user-management': { label: 'Admin: User ERP & Hak Akses', group: '🛡️ Admin System' },
  'view-hpp': { label: 'Akses Data: Lihat & Ubah HPP', group: '🛡️ Data Sensitif' },
};

interface UserAccessManagerProps {
  isDark: boolean;
}

export default function UserAccessManager({ isDark }: UserAccessManagerProps) {
  const [usersList, setUsersList] = useState<UserRecord[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [userPermissions, setUserPermissions] = useState<ModulePermission[]>([]);
  const [userCapabilities, setUserCapabilities] = useState<Record<string, boolean>>({});
  const [capabilityCatalog, setCapabilityCatalog] = useState<{ code: string; name: string; description: string; category: string }[]>([]);

  // Add User Form Modal
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newUserLevel, setNewUserLevel] = useState('Kasir');

  // Permission Editor Modal
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);

  // Status & Notifications
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [sortField, setSortField] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

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

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch Users List
  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/users');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setUsersList(json.data);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
      showToast('Gagal memuat daftar user', 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Open Permission Matrix Editor Modal
  const handleEditPermissions = async (user: UserRecord) => {
    setSelectedUser(user);
    setIsLoading(true);
    try {
      const res = await fetch(`/api/users/permissions?userId=${user.id}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setUserPermissions(json.data);
        setUserCapabilities(json.capabilities || {});
        setCapabilityCatalog(json.capabilityCatalog || []);
        setIsPermModalOpen(true);
      } else {
        showToast('Gagal memuat permission user', 'error');
      }
    } catch (err) {
      console.error('Error fetching user permissions:', err);
      showToast('Terjadi kesalahan saat memuat hak akses', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle single permission checkbox
  const handleTogglePerm = (moduleCode: string, field: 'canView' | 'canAdd' | 'canEdit' | 'canDelete' | 'canPrint' | 'canViewPrice') => {
    setUserPermissions((prev) =>
      prev.map((item) => {
        if (item.moduleCode === moduleCode) {
          return { ...item, [field]: !item[field] };
        }
        return item;
      })
    );
  };

  const handleToggleCapability = (capCode: string) => {
    setUserCapabilities((prev) => ({
      ...prev,
      [capCode]: !prev[capCode],
    }));
  };

  // Check / Uncheck All for a user
  const handleCheckAll = (value: boolean) => {
    setUserPermissions((prev) =>
      prev.map((item) => ({
        ...item,
        canView: value,
        canAdd: value,
        canEdit: value,
        canDelete: value,
        canPrint: value,
        canViewPrice: value,
      }))
    );
  };

  // Save Permission Matrix to Server
  const handleSavePermissions = async () => {
    if (!selectedUser) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/users/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          permissions: userPermissions,
          capabilities: userCapabilities,
        }),
      });

      const json = await res.json();
      if (json.success) {
        showToast(json.message || 'Hak akses berhasil disimpan!', 'success');
        setIsPermModalOpen(false);
      } else {
        showToast(json.error || 'Gagal menyimpan hak akses', 'error');
      }
    } catch (err) {
      console.error('Error saving permissions:', err);
      showToast('Terjadi kesalahan saat menyimpan hak akses', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Create New User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newFullName) {
      showToast('Isi Username dan Nama Lengkap!', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          fullName: newFullName,
          userLevel: newUserLevel,
          isActive: true,
        }),
      });

      const json = await res.json();
      if (json.success) {
        showToast(`User "${newUsername}" berhasil ditambahkan!`, 'success');
        setIsAddUserOpen(false);
        setNewUsername('');
        setNewFullName('');
        setNewUserLevel('Kasir');
        loadUsers();
      } else {
        showToast(json.error || 'Gagal membuat user', 'error');
      }
    } catch (err) {
      console.error('Create user error:', err);
      showToast('Terjadi kesalahan saat membuat user', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const sortedUsersList = [...usersList].sort((a, b) => {
    if (!sortField) return 0;
    const aValue = a[sortField as keyof UserRecord];
    const bValue = b[sortField as keyof UserRecord];
    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Group permissions by category for nice UI matrix display
  const groupedPermissions = userPermissions.reduce((acc, perm) => {
    const info = MODULE_LABEL_MAP[perm.moduleCode] || { label: perm.moduleCode, group: 'Lainnya' };
    if (!acc[info.group]) acc[info.group] = [];
    acc[info.group].push({ ...perm, labelName: info.label });
    return acc;
  }, {} as Record<string, (ModulePermission & { labelName: string })[]>);

  // Group capabilities by category
  const groupedCapabilities = capabilityCatalog.reduce((acc, cap) => {
    if (!acc[cap.category]) acc[cap.category] = [];
    acc[cap.category].push(cap);
    return acc;
  }, {} as Record<string, typeof capabilityCatalog>);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2.5 transition-all animate-bounce ${
            toastMessage.type === 'success'
              ? 'bg-emerald-500 text-white border-emerald-400'
              : toastMessage.type === 'error'
              ? 'bg-red-500 text-white border-red-400'
              : 'bg-amber-500 text-slate-950 border-amber-400'
          }`}
        >
          {toastMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Bar */}
      <div
        className={`p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
        }`}
      >
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">User ERP & Hak Akses</h1>
            <p className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              Kelola daftar user ERP, peran, serta hak akses modul dan kapabilitas sensitif.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadUsers}
            disabled={isLoading}
            className={`px-4 py-2 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsAddUserOpen(true)}
            className="px-4 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah User</span>
          </button>
        </div>
      </div>

      {/* Main Users Table */}
      <div
        className={`rounded-3xl border shadow-sm overflow-hidden transition-all ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`border-b font-black uppercase tracking-wider ${isDark ? 'bg-slate-950/60 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-600'}`}>
              <tr>
                <th className="p-4 cursor-pointer" onClick={() => handleSort('id')}>
                  <div className="flex items-center gap-1.5">
                    ID {sortField === 'id' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="p-4 cursor-pointer" onClick={() => handleSort('username')}>
                  <div className="flex items-center gap-1.5">
                    Username {sortField === 'username' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="p-4 cursor-pointer" onClick={() => handleSort('fullName')}>
                  <div className="flex items-center gap-1.5">
                    Nama Lengkap {sortField === 'fullName' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="p-4 cursor-pointer" onClick={() => handleSort('userLevel')}>
                  <div className="flex items-center gap-1.5">
                    Level Access / Role {sortField === 'userLevel' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 font-medium">
              {isLoading && usersList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-bold">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                    Memuat data user...
                  </td>
                </tr>
              ) : sortedUsersList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-bold">
                    Belum ada data user.
                  </td>
                </tr>
              ) : (
                sortedUsersList.map((user) => (
                  <tr
                    key={user.id}
                    className={`transition-colors ${
                      isDark ? 'hover:bg-slate-800/40 text-slate-200' : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <td className="p-4 font-mono font-bold text-slate-500">{user.id}</td>
                    <td className="p-4 font-bold text-emerald-400">{user.username}</td>
                    <td className="p-4 font-semibold">{user.fullName}</td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide uppercase bg-slate-800 text-slate-300 border border-slate-700">
                        {user.userLevel}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        user.isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {user.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleEditPermissions(user)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 flex items-center gap-1.5 ml-auto transition-all cursor-pointer"
                      >
                        <Key className="w-3.5 h-3.5" />
                        <span>Atur Hak Akses</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🔐 MODAL ATUR HAK AKSES */}
      {isPermModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div
            className={`w-full max-w-4xl max-h-[90vh] rounded-3xl border shadow-2xl flex flex-col transition-all overflow-hidden ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black flex items-center gap-2">
                    Hak Akses: <span className="text-emerald-400 font-mono">{selectedUser.username}</span>
                    <span className="text-xs font-normal text-slate-400">({selectedUser.fullName})</span>
                  </h2>
                  <p className="text-xs text-slate-400">Atur hak akses modul dan kapabilitas sensitif untuk user ini.</p>
                </div>
              </div>
              <button
                onClick={() => setIsPermModalOpen(false)}
                className={`p-2 rounded-xl border transition-all ${isDark ? 'border-slate-800 hover:bg-slate-800 text-slate-400' : 'border-slate-300 hover:bg-slate-100 text-slate-600'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Action Controls */}
            <div className="px-6 py-3 border-b border-slate-800/40 bg-slate-950/40 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className={`flex items-center gap-2 font-bold ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Pilih Opsi Hak Akses Massal:</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleCheckAll(true)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold border border-emerald-500/30 cursor-pointer transition-all"
                >
                  ☑️ Centang Semua Modul
                </button>
                <button
                  type="button"
                  onClick={() => handleCheckAll(false)}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold border border-red-500/30 cursor-pointer transition-all"
                >
                  ⬜ Uncentang Semua Modul
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Sensitive Capabilities Section */}
              {Object.keys(groupedCapabilities).length > 0 && (
                <div className="space-y-3 pb-6 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-amber-400">
                      🔒 Otorisasi Aksi Sensitif (Granular Capabilities)
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Otorisasi server-side untuk operasi transaksi material dan data sensitif (Admin memiliki akses penuh secara default).
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    {Object.entries(groupedCapabilities).map(([cat, caps]) => (
                      <div
                        key={cat}
                        className={`p-3.5 rounded-2xl border space-y-2.5 ${
                          isDark ? 'bg-slate-950/60 border-slate-800/80' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                          {cat}
                        </div>
                        <div className="space-y-2">
                          {caps.map((cap) => (
                            <label
                              key={cap.code}
                              className="flex items-start gap-2.5 cursor-pointer select-none group"
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(userCapabilities[cap.code])}
                                onChange={() => handleToggleCapability(cap.code)}
                                className="w-4 h-4 mt-0.5 accent-amber-500 cursor-pointer rounded"
                              />
                              <div>
                                <div className={`text-xs font-bold ${userCapabilities[cap.code] ? 'text-amber-400' : 'text-slate-400'}`}>
                                  {cap.name}
                                </div>
                                <div className="text-[10px] text-slate-500 leading-snug">
                                  {cap.description}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Module Permissions Matrix */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  📋 Hak Akses Modul CRUD
                </h3>
                {Object.entries(groupedPermissions).map(([groupName, items]) => (
                  <div key={groupName} className="space-y-2">
                    <div className="text-xs font-bold text-slate-400 border-b border-slate-800 pb-1">
                      {groupName}
                    </div>
                    <div className="space-y-2">
                      {items.map((perm) => (
                        <div
                          key={perm.moduleCode}
                          className={`p-3 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all ${
                            isDark ? 'bg-slate-950/50 border-slate-800/80' : 'bg-white border-slate-300'
                          }`}
                        >
                          <div className="font-bold text-xs">
                            {perm.labelName}
                            <span className="block text-[10px] font-mono text-slate-500">{perm.moduleCode}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={perm.canView}
                                onChange={() => handleTogglePerm(perm.moduleCode, 'canView')}
                                className="w-4 h-4 accent-emerald-500 cursor-pointer rounded"
                              />
                              <span className={perm.canView ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                                Lihat (View)
                              </span>
                            </label>

                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={perm.canAdd}
                                onChange={() => handleTogglePerm(perm.moduleCode, 'canAdd')}
                                className="w-4 h-4 accent-emerald-500 cursor-pointer rounded"
                              />
                              <span className={perm.canAdd ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                                Tambah
                              </span>
                            </label>

                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={perm.canEdit}
                                onChange={() => handleTogglePerm(perm.moduleCode, 'canEdit')}
                                className="w-4 h-4 accent-emerald-500 cursor-pointer rounded"
                              />
                              <span className={perm.canEdit ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                                Edit
                              </span>
                            </label>

                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={perm.canDelete}
                                onChange={() => handleTogglePerm(perm.moduleCode, 'canDelete')}
                                className="w-4 h-4 accent-emerald-500 cursor-pointer rounded"
                              />
                              <span className={perm.canDelete ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                                Hapus
                              </span>
                            </label>

                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={perm.canPrint}
                                onChange={() => handleTogglePerm(perm.moduleCode, 'canPrint')}
                                className="w-4 h-4 accent-emerald-500 cursor-pointer rounded"
                              />
                              <span className={perm.canPrint ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                                Cetak
                              </span>
                            </label>

                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={perm.canViewPrice}
                                onChange={() => handleTogglePerm(perm.moduleCode, 'canViewPrice')}
                                className="w-4 h-4 accent-amber-500 cursor-pointer rounded"
                              />
                              <span className={perm.canViewPrice ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                                Lihat Harga (HPP)
                              </span>
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800/60 bg-slate-950/80 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsPermModalOpen(false)}
                className="px-4 py-2 rounded-xl border text-xs font-bold border-slate-700 hover:bg-slate-800 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs flex items-center gap-2 shadow cursor-pointer transition-all"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Hak Akses'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ➕ MODAL TAMBAH USER BARU */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div
            className={`w-full max-w-md rounded-3xl border shadow-2xl p-6 transition-all ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-black flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-emerald-400" />
                Tambah User ERP Baru
              </h3>
              <button onClick={() => setIsAddUserOpen(false)} className={`hover:text-white ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 mt-4 text-xs">
              <div className="space-y-1">
                <label className={`font-bold ${isDark ? "text-slate-400" : "text-slate-600"}`}>Username :</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. kasir2"
                  className={`w-full p-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-900 border-slate-300'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className={`font-bold ${isDark ? "text-slate-400" : "text-slate-600"}`}>Nama Lengkap :</label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. Dewi Sartika"
                  className={`w-full p-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-900 border-slate-300'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className={`font-bold ${isDark ? "text-slate-400" : "text-slate-600"}`}>Level Access / Role :</label>
                <select
                  value={newUserLevel}
                  onChange={(e) => setNewUserLevel(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-900 border-slate-300'
                  }`}
                >
                  <option value="Kasir">Kasir POS</option>
                  <option value="Supervisor">Supervisor Floor</option>
                  <option value="Manager">Manager ERP</option>
                  <option value="Admin">Super Admin</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2 rounded-xl border text-xs font-bold border-slate-700 hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow"
                >
                  {isSaving ? 'Menyimpan...' : 'Simpan User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

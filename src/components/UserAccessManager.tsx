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
};

interface UserAccessManagerProps {
  isDark: boolean;
}

export default function UserAccessManager({ isDark }: UserAccessManagerProps) {
  const [usersList, setUsersList] = useState<UserRecord[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [userPermissions, setUserPermissions] = useState<ModulePermission[]>([]);

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
  const handleTogglePerm = (moduleCode: string, field: 'canView' | 'canAdd' | 'canEdit' | 'canDelete' | 'canPrint') => {
    setUserPermissions((prev) =>
      prev.map((item) => {
        if (item.moduleCode === moduleCode) {
          return { ...item, [field]: !item[field] };
        }
        return item;
      })
    );
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

  // Group permissions by category for nice UI matrix display
  const groupedPermissions = userPermissions.reduce((acc, perm) => {
    const info = MODULE_LABEL_MAP[perm.moduleCode] || { label: perm.moduleCode, group: 'Lainnya' };
    if (!acc[info.group]) acc[info.group] = [];
    acc[info.group].push({ ...perm, labelName: info.label });
    return acc;
  }, {} as Record<string, (ModulePermission & { labelName: string })[]>);

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
          {toastMessage.type === 'success' && <CheckCircle className="w-4 h-4" />}
          {toastMessage.type === 'error' && <XCircle className="w-4 h-4" />}
          {toastMessage.type === 'info' && <Sparkles className="w-4 h-4" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* 🛡️ PAGE HEADER */}
      <div
        className={`p-6 rounded-3xl border shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
          isDark
            ? 'bg-gradient-to-r from-slate-900 via-emerald-950/20 to-slate-900 border-slate-800'
            : 'bg-gradient-to-r from-emerald-50/70 via-white to-emerald-50/40 border-emerald-200'
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                User ERP & Hak Akses Management
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                1:1 Module Manager (ControlPanel.frmUserSetting)
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Manajemen Pengguna ERP dan Matriks Hak Akses Modul (View, Add, Edit, Delete, Print)
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsAddUserOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs flex items-center gap-2 shadow-md cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah User Baru</span>
          </button>

          <button
            onClick={loadUsers}
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 active:scale-95 cursor-pointer transition-all ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 👥 USERS TABLE GRID */}
      <div
        className={`rounded-2xl border shadow-lg overflow-hidden transition-all ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
          <span className="font-black text-xs uppercase tracking-wider text-emerald-400 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Daftar User & Hak Akses ERP
          </span>
          <span className="text-xs text-slate-400 font-semibold">Total: {usersList.length} User Terdaftar</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr
                className={`text-[11px] font-black uppercase tracking-wider border-b ${
                  isDark ? 'bg-slate-800/60 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                <th className="py-3.5 px-4 text-center">#ID</th>
                <th className="py-3.5 px-4">Username</th>
                <th className="py-3.5 px-4">Nama Lengkap</th>
                <th className="py-3.5 px-4">Level Akses</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Aksi Hak Akses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-xs">
              {usersList.map((user) => (
                <tr
                  key={user.id}
                  className={`transition-colors ${
                    isDark ? 'hover:bg-slate-800/50 text-slate-200' : 'hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-400">{user.id}</td>
                  <td className="py-3.5 px-4 font-mono font-black text-emerald-400">@{user.username}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{user.fullName}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                        user.userLevel === 'Admin'
                          ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                          : user.userLevel === 'Manager'
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                          : user.userLevel === 'Supervisor'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      {user.userLevel}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Aktif
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => handleEditPermissions(user)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-[11px] flex items-center gap-1.5 mx-auto shadow cursor-pointer transition-all"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>Pengaturan Hak Akses</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🔐 MODAL EDIT PERMISSION MATRIX (1:1 ControlPanel.frmUserSetting) */}
      {isPermModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div
            className={`w-full max-w-4xl rounded-3xl border shadow-2xl overflow-hidden my-8 transition-all ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800/60 flex items-center justify-between bg-gradient-to-r from-emerald-950/30 via-slate-900 to-slate-900">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black shadow">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black tracking-tight">
                    Pengaturan Hak Akses: <span className="text-emerald-400">{selectedUser.fullName}</span> (@{selectedUser.username})
                  </h2>
                  <p className="text-xs text-slate-400 font-medium">
                    Level Access: <strong className="text-amber-400 uppercase">{selectedUser.userLevel}</strong> | Sesuaikan matriks fungsi modul
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPermModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Action Controls */}
            <div className="px-6 py-3 border-b border-slate-800/40 bg-slate-950/40 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 font-bold text-slate-400">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Pilih Opsi Hak Akses Massal:</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleCheckAll(true)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold border border-emerald-500/30 cursor-pointer transition-all"
                >
                  ☑️ Centang Semua
                </button>
                <button
                  type="button"
                  onClick={() => handleCheckAll(false)}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold border border-red-500/30 cursor-pointer transition-all"
                >
                  ⬜ Uncentang Semua
                </button>
              </div>
            </div>

            {/* Permission Matrix Tree / Table */}
            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              {Object.entries(groupedPermissions).map(([groupName, items]) => (
                <div key={groupName} className="space-y-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 border-b border-slate-800 pb-1.5">
                    {groupName}
                  </h3>
                  <div className="space-y-2">
                    {items.map((perm) => (
                      <div
                        key={perm.moduleCode}
                        className={`p-3 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all ${
                          isDark ? 'bg-slate-950/50 border-slate-800/80' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="font-bold text-xs">
                          {perm.labelName}
                          <span className="block text-[10px] font-mono text-slate-500">{perm.moduleCode}</span>
                        </div>

                        {/* 5 Function Checkboxes (View, Add, Edit, Delete, Print) */}
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
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
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
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-black flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-emerald-400" />
                Tambah User ERP Baru
              </h3>
              <button onClick={() => setIsAddUserOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 mt-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-400">Username :</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. kasir2"
                  className={`w-full p-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-900 border-slate-300'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-400">Nama Lengkap :</label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. Dewi Sartika"
                  className={`w-full p-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-900 border-slate-300'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-400">Level Access / Role :</label>
                <select
                  value={newUserLevel}
                  onChange={(e) => setNewUserLevel(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-900 border-slate-300'
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

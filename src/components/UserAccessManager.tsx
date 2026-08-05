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
  // Master Data (MD)
  'MD_INV': { label: 'Master Data: Master Barang (MD_INV)', group: '🏬 Master Data' },
  'master-barang': { label: 'Master Data: Master Barang (Tab)', group: '🏬 Master Data' },
  'MD_STOCK': { label: 'Master Data: Inventory Stock & Kartu Stok (MD_STOCK)', group: '🏬 Master Data' },
  'inventory-stok': { label: 'Master Data: Inventory Stock (Tab)', group: '🏬 Master Data' },
  'MD_USAGE': { label: 'Master Data: Pemakaian Barang / Usage (MD_USAGE)', group: '🏬 Master Data' },
  'pemakaian-barang': { label: 'Master Data: Pemakaian Barang (Tab)', group: '🏬 Master Data' },
  'MD_BARCODE': { label: 'Master Data: Cetak Label Barcode (MD_BARCODE)', group: '🏬 Master Data' },
  'cetak-barcode': { label: 'Master Data: Cetak Label Barcode (Tab)', group: '🏬 Master Data' },
  'MD_EMP': { label: 'Master Data: Master Karyawan (MD_EMP)', group: '🏬 Master Data' },
  'master-karyawan': { label: 'Master Data: Master Karyawan (Tab)', group: '🏬 Master Data' },
  'MD_CUST': { label: 'Master Data: Master Customer (MD_CUST)', group: '🏬 Master Data' },
  'master-customer': { label: 'Master Data: Master Customer (Tab)', group: '🏬 Master Data' },
  'MD_BANK': { label: 'Master Data: Master Bank & Rekening (MD_BANK)', group: '🏬 Master Data' },
  'master-bank': { label: 'Master Data: Master Bank (Tab)', group: '🏬 Master Data' },
  'MD_SUPP': { label: 'Master Data: Master Supplier (MD_SUPP)', group: '🏬 Master Data' },
  'master-supplier': { label: 'Master Data: Master Supplier (Tab)', group: '🏬 Master Data' },
  'MD_PROMO': { label: 'Master Data: Master Promo & Diskon (MD_PROMO)', group: '🏬 Master Data' },
  'master-promo': { label: 'Master Data: Master Promo (Tab)', group: '🏬 Master Data' },

  // Purchasing (PUR)
  'PUR_PR': { label: 'Purchasing: Pengajuan Pembelian PR (PUR_PR)', group: '📦 Purchasing' },
  'pengajuan-pembelian': { label: 'Purchasing: Pengajuan Pembelian PR (Tab)', group: '📦 Purchasing' },
  'PUR_PO': { label: 'Purchasing: Order Pembelian PO (PUR_PO)', group: '📦 Purchasing' },
  'order-pembelian': { label: 'Purchasing: Order Pembelian PO (Tab)', group: '📦 Purchasing' },
  'PUR_EXP': { label: 'Purchasing: Penerimaan Barang Ekspress (PUR_EXP)', group: '📦 Purchasing' },
  'penerimaan-barang': { label: 'Purchasing: Penerimaan Barang Ekspress (Tab)', group: '📦 Purchasing' },
  'PUR_RCV': { label: 'Purchasing: Penerimaan dengan Harga (PUR_RCV)', group: '📦 Purchasing' },
  'penerimaan-barang-harga': { label: 'Purchasing: Penerimaan dengan Harga (Tab)', group: '📦 Purchasing' },
  'PUR_PAY': { label: 'Purchasing: Pembayaran Supplier (PUR_PAY)', group: '📦 Purchasing' },
  'pembayaran-supplier': { label: 'Purchasing: Pembayaran Supplier (Tab)', group: '📦 Purchasing' },
  'PUR_RET': { label: 'Purchasing: Retur Pembelian (PUR_RET)', group: '📦 Purchasing' },
  'retur-pembelian': { label: 'Purchasing: Retur Pembelian (Tab)', group: '📦 Purchasing' },

  // Inventory & Opname (INV)
  'INV_OPN': { label: 'Inventory: Stock Opname (INV_OPN)', group: '📌 Inventory & Stock' },
  'stok-opname': { label: 'Inventory: Stock Opname (Tab)', group: '📌 Inventory & Stock' },
  'SLS_SYNC': { label: 'Inventory: Sync Stock & Memo (SLS_SYNC)', group: '📌 Inventory & Stock' },
  'sync-stok': { label: 'Inventory: Sync Stock (Tab)', group: '📌 Inventory & Stock' },

  // Sales & Report (SLS & RPT)
  'SLS_MON': { label: 'Sales: Sales Monitoring (SLS_MON)', group: '📊 Sales & Report' },
  'sales-monitoring': { label: 'Sales: Sales Monitoring (Tab)', group: '📊 Sales & Report' },
  'RPT_SALES': { label: 'Report: Laporan Penjualan (RPT_SALES)', group: '📊 Sales & Report' },
  'laporan-penjualan': { label: 'Report: Laporan Penjualan (Tab)', group: '📊 Sales & Report' },

  // Admin System (ADM)
  'ADM_USER': { label: 'Admin: User ERP & Hak Akses (ADM_USER)', group: '🛡️ Admin System' },
  'user-management': { label: 'Admin: User ERP & Hak Akses (Tab)', group: '🛡️ Admin System' },
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

  // Load Permissions for Selected User
  const loadPermissionsForUser = async (user: UserRecord) => {
    setSelectedUser(user);
    setIsPermModalOpen(true);
    try {
      const res = await fetch(`/api/users/permissions?userId=${user.id}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setUserPermissions(json.data);
      }
    } catch (err) {
      console.error('Failed to load permissions:', err);
      showToast('Gagal memuat data hak akses user', 'error');
    }
  };

  const handleTogglePermission = (moduleCode: string, field: 'canView' | 'canAdd' | 'canEdit' | 'canDelete' | 'canPrint') => {
    setUserPermissions((prev) =>
      prev.map((p) => {
        if (p.moduleCode === moduleCode) {
          return { ...p, [field]: !p[field] };
        }
        return p;
      })
    );
  };

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
        showToast(`Hak akses per halaman untuk ${selectedUser.username} berhasil disimpan!`, 'success');
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

  const handleAddUser = async () => {
    if (!newUsername.trim() || !newFullName.trim()) {
      showToast('Username dan Nama Lengkap wajib diisi', 'error');
      return;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          fullName: newFullName,
          userLevel: newUserLevel,
        }),
      });

      const json = await res.json();
      if (json.success) {
        showToast(`User ${newUsername} berhasil ditambahkan!`, 'success');
        setNewUsername('');
        setNewFullName('');
        setIsAddUserOpen(false);
        loadUsers();
      } else {
        showToast(json.error || 'Gagal membuat user baru', 'error');
      }
    } catch (err) {
      console.error('Add user error:', err);
      showToast('Gagal membuat user baru', 'error');
    }
  };

  const groupedModules = Object.entries(MODULE_LABEL_MAP).reduce((acc, [code, meta]) => {
    if (!acc[meta.group]) acc[meta.group] = [];
    acc[meta.group].push({ code, label: meta.label });
    return acc;
  }, {} as Record<string, { code: string; label: string }[]>);

  return (
    <div
      className={`h-full w-full flex flex-col font-sans transition-colors duration-200 ${
        isDark ? 'bg-[#0b0f19] text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Toast Popup */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-5 duration-200 pointer-events-none">
          <div
            className={`px-4 py-3 rounded-xl shadow-xl border flex items-center gap-3 text-xs font-semibold ${
              toastMessage.type === 'success'
                ? 'bg-emerald-500 text-white border-emerald-400'
                : toastMessage.type === 'error'
                ? 'bg-rose-500 text-white border-rose-400'
                : 'bg-blue-500 text-white border-blue-400'
            }`}
          >
            {toastMessage.type === 'success' && <CheckCircle className="w-4 h-4" />}
            {toastMessage.type === 'error' && <XCircle className="w-4 h-4" />}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* TOP HEADER */}
      <header
        className={`h-16 px-6 border-b flex items-center justify-between shrink-0 shadow-sm ${
          isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight flex items-center gap-2">
              User ERP & Pengaturan Hak Akses Per Halaman (ADM_USER)
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                ADM_USER 1:1
              </span>
            </h1>
            <p className="text-xs text-slate-400">Pengaturan izin akses per halaman (CanView, CanAdd, CanEdit, CanDelete, CanPrint)</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddUserOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Tambah User ERP
          </button>
        </div>
      </header>

      {/* MAIN CONTENT TABLE */}
      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
        <div
          className={`rounded-2xl border overflow-hidden ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-500" /> Daftar Pengguna Sistem ERP & Tipe Otoritas
            </h3>
            <button
              onClick={loadUsers}
              className={`p-1.5 rounded-lg border text-slate-400 hover:text-white ${
                isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'
              }`}
              title="Refresh User"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead
                className={`uppercase font-bold border-b tracking-wider ${
                  isDark ? 'bg-slate-800/50 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
              >
                <tr>
                  <th className="px-4 py-3.5">ID</th>
                  <th className="px-4 py-3.5">Username</th>
                  <th className="px-4 py-3.5">Nama Lengkap</th>
                  <th className="px-4 py-3.5">User Level</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-center">Pengaturan Hak Akses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                      <span>Memuat data User ERP...</span>
                    </td>
                  </tr>
                ) : (
                  usersList.map((u) => (
                    <tr key={u.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-3 font-mono font-bold text-slate-400">#{u.id}</td>
                      <td className="px-4 py-3 font-extrabold text-emerald-400 flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-emerald-500" />
                        <span>{u.username}</span>
                      </td>
                      <td className="px-4 py-3 font-bold text-white">{u.fullName}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            u.userLevel === 'Admin'
                              ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                              : u.userLevel === 'Manager'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : u.userLevel === 'Supervisor'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {u.userLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          Aktif
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => loadPermissionsForUser(u)}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-xs flex items-center gap-1.5 mx-auto shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                        >
                          <Key className="w-3.5 h-3.5" />
                          Edit Hak Akses Per Halaman
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PERMISSION EDITOR MODAL */}
      {isPermModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div
            className={`w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <div>
                  <h3 className="font-extrabold text-sm">
                    Edit Hak Akses Halaman untuk: <span className="text-emerald-400">{selectedUser.username}</span> ({selectedUser.fullName})
                  </h3>
                  <p className="text-[11px] text-slate-400">Atur izin per halaman (CanView, CanAdd, CanEdit, CanDelete, CanPrint)</p>
                </div>
              </div>
              <button
                onClick={() => setIsPermModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 font-sans space-y-6">
              {Object.entries(groupedModules).map(([groupName, modules]) => (
                <div key={groupName} className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-500 border-b border-slate-800 pb-2">
                    {groupName}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {modules.map(({ code, label }) => {
                      const perm = userPermissions.find((p) => p.moduleCode === code) || {
                        moduleCode: code,
                        canView: true,
                        canAdd: true,
                        canEdit: true,
                        canDelete: true,
                        canPrint: true,
                      };

                      return (
                        <div
                          key={code}
                          className={`p-3 rounded-xl border flex flex-col gap-2 ${
                            isDark ? 'bg-slate-800/40 border-slate-700/80' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-xs text-white">{label}</span>
                            <button
                              type="button"
                              onClick={() => handleTogglePermission(code, 'canView')}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                                perm.canView
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                              }`}
                            >
                              {perm.canView ? 'Akses Buka' : 'Tutup Akses'}
                            </button>
                          </div>

                          {/* Detail Checkboxes */}
                          <div className="grid grid-cols-4 gap-1 pt-1 border-t border-slate-700/50 text-[10px]">
                            <label className="flex items-center gap-1 cursor-pointer select-none text-slate-300">
                              <input
                                type="checkbox"
                                checked={perm.canAdd}
                                onChange={() => handleTogglePermission(code, 'canAdd')}
                                className="rounded accent-emerald-500"
                              />
                              <span>Tambah</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer select-none text-slate-300">
                              <input
                                type="checkbox"
                                checked={perm.canEdit}
                                onChange={() => handleTogglePermission(code, 'canEdit')}
                                className="rounded accent-emerald-500"
                              />
                              <span>Edit</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer select-none text-slate-300">
                              <input
                                type="checkbox"
                                checked={perm.canDelete}
                                onChange={() => handleTogglePermission(code, 'canDelete')}
                                className="rounded accent-emerald-500"
                              />
                              <span>Hapus</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer select-none text-slate-300">
                              <input
                                type="checkbox"
                                checked={perm.canPrint}
                                onChange={() => handleTogglePermission(code, 'canPrint')}
                                className="rounded accent-emerald-500"
                              />
                              <span>Cetak</span>
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-950/50">
              <button
                onClick={() => setIsPermModalOpen(false)}
                className="px-4 py-2 rounded-xl border text-xs font-bold text-slate-400 hover:text-white border-slate-700"
              >
                Batal
              </button>
              <button
                onClick={handleSavePermissions}
                disabled={isSaving}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Menyimpan...' : 'Simpan Hak Akses Per Halaman'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD USER MODAL */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-500" />
                <h3 className="font-extrabold text-sm">Tambah User ERP Baru</h3>
              </div>
              <button
                onClick={() => setIsAddUserOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 font-sans space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-400">Username *</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Contoh: rina.kasir"
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-400">Nama Lengkap *</label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="Contoh: Rina Kartika"
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-400">User Level</label>
                <select
                  value={newUserLevel}
                  onChange={(e) => setNewUserLevel(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none cursor-pointer ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Kasir">Kasir</option>
                </select>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-950/50">
              <button
                onClick={() => setIsAddUserOpen(false)}
                className="px-4 py-2 rounded-xl border text-xs font-bold text-slate-400 hover:text-white border-slate-700"
              >
                Batal
              </button>
              <button
                onClick={handleAddUser}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all cursor-pointer"
              >
                Simpan User Baru
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

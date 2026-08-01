'use client';

import React, { useState } from 'react';
import {
  Store,
  Package,
  RefreshCw,
  Tag,
  Users,
  ShoppingBag,
  Sun,
  Moon,
  Search,
  BarChart3,
  Calendar,
  FileSpreadsheet,
  ShieldCheck,
  UserCheck,
  User as UserIcon,
  Check,
  X,
  Plus,
  Trash2,
  Lock,
} from 'lucide-react';
import {
  MOCK_ERP_PRODUCTS,
  MOCK_STOCK_SYNC,
  MOCK_PROMO_RULES,
  MOCK_SUPPLIERS,
  MOCK_GOODS_RECEIPTS,
  MOCK_SALES_MONITORING,
  MOCK_SALES_REPORT_DAILY,
} from '@/data/mockErp';
import { MOCK_ERP_USERS, ERPUser } from '@/types/user';
import LoginModal from '@/components/LoginModal';

export default function ERPDashboard() {
  const [currentUser, setCurrentUser] = useState<ERPUser | null>(MOCK_ERP_USERS[0]); // Default Admin ERP
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<
    | 'master-barang'
    | 'sync-stok'
    | 'master-promo'
    | 'master-supplier'
    | 'penerimaan-barang'
    | 'sales-monitoring'
    | 'laporan-penjualan'
    | 'user-management'
  >('master-barang');

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('31 Jul 2026');

  // ERP User Management State (Terpisah dari POS)
  const [usersList, setUsersList] = useState<ERPUser[]>(MOCK_ERP_USERS);
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'staff' | 'manager'>('staff');

  const isDark = theme === 'dark';
  const isAdmin = currentUser?.role === 'admin';

  // Sales Monitoring Totals
  const totalNomTransaksi = MOCK_SALES_MONITORING.reduce((acc, row) => acc + row.nomTransaksi, 0);
  const totalDiskon = MOCK_SALES_MONITORING.reduce((acc, row) => acc + row.diskonAkhir, 0);
  const totalTunai = MOCK_SALES_MONITORING.reduce((acc, row) => acc + row.tunai, 0);
  const totalDebit = MOCK_SALES_MONITORING.reduce((acc, row) => acc + row.debit, 0);
  const totalQris = MOCK_SALES_MONITORING.reduce((acc, row) => acc + row.qris, 0);
  const totalCc = MOCK_SALES_MONITORING.reduce((acc, row) => acc + row.cc, 0);

  // Laporan Total Penjualan Totals
  const reportTotalTunai = MOCK_SALES_REPORT_DAILY.reduce((acc, r) => acc + r.tunai, 0);
  const reportTotalDebit = MOCK_SALES_REPORT_DAILY.reduce((acc, r) => acc + r.debit, 0);
  const reportTotalKredit = MOCK_SALES_REPORT_DAILY.reduce((acc, r) => acc + r.kredit, 0);
  const reportTotalQris = MOCK_SALES_REPORT_DAILY.reduce((acc, r) => acc + r.qris, 0);
  const reportGrandTotal = MOCK_SALES_REPORT_DAILY.reduce((acc, r) => acc + r.totalHarian, 0);

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newName) return;

    const newUserObj: ERPUser = {
      id: String(Date.now()),
      username: newUsername.toLowerCase(),
      name: newName,
      role: newRole,
      permissions: {
        canViewReports: newRole === 'admin' || newRole === 'manager',
        canManageSuppliers: newRole === 'admin' || newRole === 'staff',
        canManagePromos: newRole === 'admin' || newRole === 'manager',
        canManageInventory: newRole === 'admin' || newRole === 'staff',
        canManageUsers: newRole === 'admin',
      },
    };

    setUsersList([...usersList, newUserObj]);
    setNewUsername('');
    setNewName('');
  };

  const handleDeleteUser = (id: string) => {
    setUsersList(usersList.filter((u) => u.id !== id));
  };

  const togglePermission = (userId: string, key: keyof ERPUser['permissions']) => {
    setUsersList(
      usersList.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            permissions: {
              ...u.permissions,
              [key]: !u.permissions[key],
            },
          };
        }
        return u;
      })
    );
  };

  return (
    <div
      className={`h-screen w-screen flex flex-col font-sans overflow-hidden select-none transition-colors duration-200 ${
        isDark ? 'bg-[#070b14] text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* 🚀 ERP TOP HEADER */}
      <header
        className={`h-14 border-b px-6 flex items-center justify-between shrink-0 z-30 shadow-md ${
          isDark
            ? 'border-slate-800 bg-slate-900/95 text-white'
            : 'border-slate-200 bg-white text-slate-900'
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-amber-500/20">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm tracking-tight flex items-center gap-2">
                Harmony ERP <span className="text-slate-400 font-normal">| Module Manager v2.0</span>
              </h1>
            </div>
          </div>

          <div className={`h-5 w-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

          {/* Logged in User Badge */}
          <button
            onClick={() => setIsLoginOpen(true)}
            className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20 text-xs flex items-center gap-1.5 hover:bg-amber-500/20 transition-all"
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>{currentUser ? `${currentUser.name} (${currentUser.role.toUpperCase()})` : 'Login ERP'}</span>
          </button>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`p-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${
              isDark
                ? 'bg-slate-800 text-amber-400 border-slate-700'
                : 'bg-slate-100 text-slate-700 border-slate-300'
            }`}
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-600" />}
            <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </header>

      {/* 📦 ERP BODY */}
      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR NAVIGATION */}
        <aside
          className={`w-64 border-r flex flex-col shrink-0 transition-colors ${
            isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="p-4 border-b border-slate-800/60 font-bold text-xs uppercase text-slate-400 tracking-wider">
            Modul Utama ERP
          </div>
          <nav className="p-2 space-y-1 overflow-y-auto flex-1">
            <button
              onClick={() => setActiveTab('master-barang')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all ${
                activeTab === 'master-barang'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : isDark
                  ? 'text-slate-300 hover:bg-slate-800'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>1. Master Barang</span>
            </button>

            <button
              onClick={() => setActiveTab('sync-stok')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all ${
                activeTab === 'sync-stok'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : isDark
                  ? 'text-slate-300 hover:bg-slate-800'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              <span>2. Sync Stok & Opname</span>
            </button>

            <button
              onClick={() => setActiveTab('master-promo')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all ${
                activeTab === 'master-promo'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : isDark
                  ? 'text-slate-300 hover:bg-slate-800'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Tag className="w-4 h-4" />
              <span>3. Master Promo Grosir</span>
            </button>

            <button
              onClick={() => setActiveTab('master-supplier')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all ${
                activeTab === 'master-supplier'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : isDark
                  ? 'text-slate-300 hover:bg-slate-800'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>4. Master Supplier</span>
            </button>

            <button
              onClick={() => setActiveTab('penerimaan-barang')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all ${
                activeTab === 'penerimaan-barang'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : isDark
                  ? 'text-slate-300 hover:bg-slate-800'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>5. Penerimaan Barang</span>
            </button>

            <div className="pt-2 pb-1 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Sales & Reporting
            </div>

            <button
              onClick={() => setActiveTab('sales-monitoring')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all ${
                activeTab === 'sales-monitoring'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : isDark
                  ? 'text-slate-300 hover:bg-slate-800'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>6. Bill Opname (Monitoring)</span>
            </button>

            <button
              onClick={() => setActiveTab('laporan-penjualan')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all ${
                activeTab === 'laporan-penjualan'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : isDark
                  ? 'text-slate-300 hover:bg-slate-800'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>7. Laporan Penjualan</span>
            </button>

            {/* ADMIN EXCLUSIVE TAB: USER ERP MANAGEMENT */}
            {isAdmin && (
              <>
                <div className="pt-2 pb-1 px-3 text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                  Admin System
                </div>
                <button
                  onClick={() => setActiveTab('user-management')}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all ${
                    activeTab === 'user-management'
                      ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                      : isDark
                      ? 'text-emerald-400 hover:bg-slate-800'
                      : 'text-emerald-600 hover:bg-slate-100'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>8. User ERP & Hak Akses</span>
                </button>
              </>
            )}
          </nav>
        </aside>

        {/* TAB CONTENTS */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {activeTab === 'master-barang' && (
            <div className="flex-1 flex flex-col p-4 overflow-hidden">
              <div className="flex items-center justify-between gap-4 pb-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari Barang (Ketik nama / barcode)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full border rounded-xl pl-9 pr-4 py-2 text-xs font-medium ${
                        isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className={`flex-1 overflow-auto rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className={`border-b uppercase text-[11px] font-bold ${isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                      <th className="py-3 px-3">No. Barang</th>
                      <th className="py-3 px-3">Barcode</th>
                      <th className="py-3 px-3">Nama Barang</th>
                      <th className="py-3 px-3">Description</th>
                      <th className="py-3 px-3 text-right">Harga Retail</th>
                      <th className="py-3 px-3 text-right text-amber-500">Grosir 1</th>
                      <th className="py-3 px-3 text-right text-amber-500">Grosir 2</th>
                      <th className="py-3 px-3 text-right text-amber-500">Grosir 3</th>
                      <th className="py-3 px-3 text-right text-emerald-500">Harga Beli</th>
                      <th className="py-3 px-3 text-center">Stok</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y font-medium ${isDark ? 'divide-slate-800/60' : 'divide-slate-200'}`}>
                    {MOCK_ERP_PRODUCTS.map((item) => (
                      <tr key={item.id} className={isDark ? 'hover:bg-slate-800/40 text-slate-200' : 'hover:bg-slate-50 text-slate-800'}>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-400">{item.noBarang}</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-400">{item.barcode}</td>
                        <td className="py-3 px-3 font-semibold">{item.nama}</td>
                        <td className="py-3 px-3 text-slate-400">{item.description}</td>
                        <td className="py-3 px-3 text-right font-bold">Rp {item.hargaRetail.toLocaleString('id-ID')}</td>
                        <td className="py-3 px-3 text-right text-amber-500">Rp {item.grosir1.toLocaleString('id-ID')}</td>
                        <td className="py-3 px-3 text-right text-amber-500">Rp {item.grosir2.toLocaleString('id-ID')}</td>
                        <td className="py-3 px-3 text-right text-amber-500">Rp {item.grosir3.toLocaleString('id-ID')}</td>
                        <td className="py-3 px-3 text-right text-emerald-500">Rp {item.hargaBeli.toLocaleString('id-ID')}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${item.stok < 0 ? 'bg-rose-500/20 text-rose-500' : 'bg-emerald-500/15 text-emerald-500'}`}>
                            {item.stok}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'sync-stok' && (
            <div className="flex-1 flex p-4 gap-4 overflow-hidden">
              <div className="flex-1 flex flex-col min-w-0">
                <h2 className="font-bold text-sm mb-3">Sync Stok dan Laporan Opname</h2>
                <div className={`flex-1 overflow-auto rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className={`border-b uppercase font-bold ${isDark ? 'bg-slate-900 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                        <th className="py-3 px-4">Nama Barang</th>
                        <th className="py-3 px-4 text-center">Inv. Stok</th>
                        <th className="py-3 px-4 text-center">RT. Stok</th>
                        <th className="py-3 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MOCK_STOCK_SYNC.map((s) => (
                        <tr key={s.id} className="border-b border-slate-800/40">
                          <td className="py-3 px-4 font-semibold">{s.namaBarang}</td>
                          <td className="py-3 px-4 text-center">{s.invStok}</td>
                          <td className="py-3 px-4 text-center text-emerald-400 font-bold">{s.rtStok}</td>
                          <td className="py-3 px-4 text-center">{s.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'master-promo' && (
            <div className="flex-1 p-4 overflow-hidden">
              <h2 className="font-bold text-sm mb-3">Aturan Promo Grosir</h2>
            </div>
          )}

          {activeTab === 'master-supplier' && (
            <div className="flex-1 p-4 overflow-hidden">
              <h2 className="font-bold text-sm mb-3">Daftar Master Supplier</h2>
            </div>
          )}

          {activeTab === 'penerimaan-barang' && (
            <div className="flex-1 p-4 overflow-hidden">
              <h2 className="font-bold text-sm mb-3">Penerimaan Barang Express</h2>
            </div>
          )}

          {activeTab === 'sales-monitoring' && (
            <div className="flex-1 p-4 overflow-hidden">
              <h2 className="font-bold text-sm mb-3">Bill Opname (Sales Monitoring)</h2>
            </div>
          )}

          {activeTab === 'laporan-penjualan' && (
            <div className="flex-1 p-4 overflow-hidden flex items-center justify-center">
              <div className="bg-white text-slate-900 p-6 rounded-2xl max-w-2xl w-full">
                <h2 className="font-bold text-center text-lg">LAPORAN TOTAL PENJUALAN</h2>
              </div>
            </div>
          )}

          {/* MODUL 8: ERP USER MANAGEMENT & PERMISSIONS (PURE ERP ROLES) */}
          {activeTab === 'user-management' && isAdmin && (
            <div className="flex-1 flex flex-col p-5 overflow-hidden">
              <div className="pb-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="font-extrabold text-base text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    Manajemen User ERP & Hak Akses (Murni Internal ERP)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Pengaturan akun staf gudang, manager, & admin untuk aplikasi Harmony ERP.
                  </p>
                </div>
              </div>

              {/* Add New User Form */}
              <form onSubmit={handleAddUser} className="py-4 border-b border-slate-800/80 grid grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Username ERP..."
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
                <input
                  type="text"
                  placeholder="Nama Lengkap..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="staff">Staff Gudang</option>
                  <option value="manager">Manager Operasional</option>
                  <option value="admin">Administrator ERP</option>
                </select>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Tambah User ERP
                </button>
              </form>

              {/* ERP Users Table */}
              <div className="flex-1 overflow-auto pt-4">
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                        <th className="py-3 px-4">User ERP</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4 text-center">Laporan Penjualan</th>
                        <th className="py-3 px-4 text-center">Kelola Supplier</th>
                        <th className="py-3 px-4 text-center">Kelola Promo</th>
                        <th className="py-3 px-4 text-center">Stok & Inventory</th>
                        <th className="py-3 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {usersList.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-800/40">
                          <td className="py-3.5 px-4 font-bold text-white">
                            {u.name} <span className="text-slate-500 font-mono">(@{u.username})</span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold uppercase text-amber-400">{u.role}</td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => togglePermission(u.id, 'canViewReports')}
                              className={`p-1 rounded-lg border ${
                                u.permissions.canViewReports ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-slate-950 text-slate-600 border-slate-800'
                              }`}
                            >
                              {u.permissions.canViewReports ? <Check className="w-4 h-4 mx-auto" /> : <X className="w-4 h-4 mx-auto" />}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => togglePermission(u.id, 'canManageSuppliers')}
                              className={`p-1 rounded-lg border ${
                                u.permissions.canManageSuppliers ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-slate-950 text-slate-600 border-slate-800'
                              }`}
                            >
                              {u.permissions.canManageSuppliers ? <Check className="w-4 h-4 mx-auto" /> : <X className="w-4 h-4 mx-auto" />}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => togglePermission(u.id, 'canManagePromos')}
                              className={`p-1 rounded-lg border ${
                                u.permissions.canManagePromos ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-slate-950 text-slate-600 border-slate-800'
                              }`}
                            >
                              {u.permissions.canManagePromos ? <Check className="w-4 h-4 mx-auto" /> : <X className="w-4 h-4 mx-auto" />}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => togglePermission(u.id, 'canManageInventory')}
                              className={`p-1 rounded-lg border ${
                                u.permissions.canManageInventory ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-slate-950 text-slate-600 border-slate-800'
                              }`}
                            >
                              {u.permissions.canManageInventory ? <Check className="w-4 h-4 mx-auto" /> : <X className="w-4 h-4 mx-auto" />}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {u.role !== 'admin' && (
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                              >
                                <Trash2 className="w-4 h-4 mx-auto" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <LoginModal
        isOpen={isLoginOpen}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsLoginOpen(false);
        }}
      />
    </div>
  );
}

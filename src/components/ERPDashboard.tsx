'use client';

import React, { useState, useEffect } from 'react';
import {
  Store,
  Package,
  RefreshCw,
  Tag,
  Users,
  ShoppingBag,
  Sun,
  Moon,
  BarChart3,
  FileSpreadsheet,
  ShieldCheck,
  UserCheck,
  User as UserIcon,
  Trash2,
  Database,
  Sparkles,
  DollarSign,
} from 'lucide-react';
import { MOCK_ERP_USERS, ERPUser } from '@/types/user';
import LoginModal from '@/components/LoginModal';
import MasterBarangManager from '@/components/MasterBarangManager';
import MasterPromoManager from '@/components/MasterPromoManager';
import MasterSupplierManager from '@/components/MasterSupplierManager';
import PenerimaanBarangEkspressManager from '@/components/PenerimaanBarangEkspressManager';
import PenerimaanBarangHargaManager from '@/components/PenerimaanBarangHargaManager';
import SyncStockManager from '@/components/SyncStockManager';
import MemoWidget from '@/components/MemoWidget';
import SalesMonitoringManager from '@/components/SalesMonitoringManager';
import StockOpnameManager from '@/components/StockOpnameManager';
import SalesReportManager from '@/components/SalesReportManager';
import UserAccessManager from '@/components/UserAccessManager';

export default function ERPDashboard() {
  const [currentUser, setCurrentUser] = useState<any>({
    id: 1,
    username: 'admin',
    fullName: 'Super Administrator ERP',
    userLevel: 'Admin',
  });
  const [userPermissions, setUserPermissions] = useState<any[]>([]);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<
    | 'master-barang'
    | 'inventory-stok'
    | 'stok-opname'
    | 'sync-stok'
    | 'memo-sync-stok'
    | 'sales-sync-stok'
    | 'master-promo'
    | 'master-supplier'
    | 'penerimaan-barang'
    | 'penerimaan-barang-harga'
    | 'sales-monitoring'
    | 'laporan-penjualan'
    | 'user-management'
  >('master-barang');

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Load User Permissions when logged in user changes
  useEffect(() => {
    if (!currentUser?.id) return;
    const fetchPerms = async () => {
      try {
        const res = await fetch(`/api/users/permissions?userId=${currentUser.id}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setUserPermissions(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch user permissions:', err);
      }
    };
    fetchPerms();
  }, [currentUser]);

  // Permission Check Helper Function (1:1 with Module Manager Isi_NavBarMenu)
  const canView = (moduleCode: string) => {
    if (currentUser?.userLevel === 'Admin') return true; // Super Admin has access to all
    if (!userPermissions || userPermissions.length === 0) return true;
    const perm = userPermissions.find((p) => p.moduleCode === moduleCode);
    return perm ? perm.canView : true;
  };

  const isDark = theme === 'dark';
  const isAdmin = currentUser?.userLevel === 'Admin';

  return (
    <div
      className={`h-screen w-screen flex flex-col font-sans overflow-hidden select-none transition-colors duration-200 ${
        isDark ? 'bg-[#070b14] text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* 🚀 ERP TOP HEADER WITH PREMIUM UI/UX */}
      <header
        className={`h-14 border-b px-6 flex items-center justify-between shrink-0 z-30 shadow-md ${
          isDark
            ? 'border-slate-800 bg-slate-900/95 text-white'
            : 'border-slate-200 bg-white text-slate-900'
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 cursor-pointer group" onClick={() => setActiveTab('master-barang')}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm tracking-tight flex items-center gap-2">
                Harmony ERP <span className="text-slate-400 font-normal">| Module Manager v2.0</span>
              </h1>
            </div>
          </div>

          <div className={`h-5 w-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

          {/* Database Status Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <Database className="w-3.5 h-3.5" />
            <span>PostgreSQL Ready</span>
          </div>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-3">
          {/* User Profile Badge Button */}
          <button
            onClick={() => setIsLoginOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 text-amber-400 font-bold border border-amber-500/30 text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            title="Klik untuk ganti user atau login"
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>
              {currentUser
                ? `Current user: ${currentUser.fullName || currentUser.username} (${(currentUser.userLevel || 'User').toUpperCase()})`
                : 'Login ERP'}
            </span>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-sm ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            }`}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
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
          <div className="p-4 border-b border-slate-800/60 font-bold text-xs uppercase text-slate-400 tracking-wider flex items-center justify-between">
            <span>Modul Utama ERP</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <nav className="p-2 space-y-1 overflow-y-auto flex-1">
            {/* 📌 MEMO GROUP (BEFORE MASTER DATA) */}
            {(canView('memo-sync-stok') || canView('stok-opname')) && (
              <div className="space-y-1 pb-1">
                <div className="px-3.5 pt-2 pb-1 text-[11px] font-bold text-amber-500/80 uppercase tracking-wider flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Memo</span>
                </div>

                {canView('memo-sync-stok') && (
                  <button
                    onClick={() => setActiveTab('memo-sync-stok')}
                    className={`w-full px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all cursor-pointer active:scale-98 text-left ${
                      activeTab === 'memo-sync-stok'
                        ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                        : isDark
                        ? 'text-slate-300 hover:bg-slate-800/80 hover:translate-x-0.5'
                        : 'text-slate-700 hover:bg-slate-100 hover:translate-x-0.5'
                    }`}
                  >
                    <RefreshCw className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-left leading-snug">Cek Sync Stock</span>
                  </button>
                )}

                {canView('stok-opname') && (
                  <button
                    onClick={() => setActiveTab('stok-opname')}
                    className={`w-full px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all cursor-pointer active:scale-98 text-left ${
                      activeTab === 'stok-opname'
                        ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                        : isDark
                        ? 'text-slate-300 hover:bg-slate-800/80 hover:translate-x-0.5'
                        : 'text-slate-700 hover:bg-slate-100 hover:translate-x-0.5'
                    }`}
                  >
                    <Package className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-left leading-snug">Opname</span>
                  </button>
                )}
              </div>
            )}

            {/* 1. MASTER DATA GROUP */}
            {(canView('master-barang') || canView('inventory-stok') || canView('master-promo') || canView('master-supplier')) && (
              <div className="space-y-1">
                <div className="px-3.5 pt-2 pb-1 text-[11px] font-bold text-amber-500/80 uppercase tracking-wider flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Master Data</span>
                </div>

                {canView('master-barang') && (
                  <button
                    onClick={() => setActiveTab('master-barang')}
                    className={`w-full px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all cursor-pointer active:scale-98 text-left ${
                      activeTab === 'master-barang'
                        ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                        : isDark
                        ? 'text-slate-300 hover:bg-slate-800/80 hover:translate-x-0.5'
                        : 'text-slate-700 hover:bg-slate-100 hover:translate-x-0.5'
                    }`}
                  >
                    <Package className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-left leading-snug">Master Barang</span>
                  </button>
                )}

                {canView('inventory-stok') && (
                  <button
                    onClick={() => setActiveTab('inventory-stok')}
                    className={`w-full px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all cursor-pointer active:scale-98 text-left ${
                      activeTab === 'inventory-stok'
                        ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                        : isDark
                        ? 'text-slate-300 hover:bg-slate-800/80 hover:translate-x-0.5'
                        : 'text-slate-700 hover:bg-slate-100 hover:translate-x-0.5'
                    }`}
                  >
                    <RefreshCw className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-left leading-snug">Inventory Stock</span>
                  </button>
                )}

                {canView('master-promo') && (
                  <button
                    onClick={() => setActiveTab('master-promo')}
                    className={`w-full px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all cursor-pointer active:scale-98 text-left ${
                      activeTab === 'master-promo'
                        ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                        : isDark
                        ? 'text-slate-300 hover:bg-slate-800/80 hover:translate-x-0.5'
                        : 'text-slate-700 hover:bg-slate-100 hover:translate-x-0.5'
                    }`}
                  >
                    <Tag className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="text-left leading-snug">Master Promo</span>
                  </button>
                )}

                {canView('master-supplier') && (
                  <button
                    onClick={() => setActiveTab('master-supplier')}
                    className={`w-full px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all cursor-pointer active:scale-98 text-left ${
                      activeTab === 'master-supplier'
                        ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                        : isDark
                        ? 'text-slate-300 hover:bg-slate-800/80 hover:translate-x-0.5'
                        : 'text-slate-700 hover:bg-slate-100 hover:translate-x-0.5'
                    }`}
                  >
                    <Users className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="text-left leading-snug">Master Supplier</span>
                  </button>
                )}
              </div>
            )}

            {/* 2. PURCHASING GROUP */}
            {(canView('penerimaan-barang') || canView('penerimaan-barang-harga')) && (
              <div className="space-y-1 pt-2">
                <div className="px-3.5 pt-2 pb-1 text-[11px] font-bold text-amber-500/80 uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Purchasing</span>
                </div>

                {canView('penerimaan-barang') && (
                  <button
                    onClick={() => setActiveTab('penerimaan-barang')}
                    className={`w-full px-3.5 py-2 rounded-xl text-xs font-semibold flex items-start gap-3 transition-all cursor-pointer active:scale-98 text-left ${
                      activeTab === 'penerimaan-barang'
                        ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                        : isDark
                        ? 'text-slate-300 hover:bg-slate-800/80 hover:translate-x-0.5'
                        : 'text-slate-700 hover:bg-slate-100 hover:translate-x-0.5'
                    }`}
                  >
                    <Package className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                    <span className="text-left leading-snug">Penerimaan Barang Ekspress</span>
                  </button>
                )}

                {canView('penerimaan-barang-harga') && (
                  <button
                    onClick={() => setActiveTab('penerimaan-barang-harga')}
                    className={`w-full px-3.5 py-2 rounded-xl text-xs font-semibold flex items-start gap-3 transition-all cursor-pointer active:scale-98 text-left ${
                      activeTab === 'penerimaan-barang-harga'
                        ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                        : isDark
                        ? 'text-slate-300 hover:bg-slate-800/80 hover:translate-x-0.5'
                        : 'text-slate-700 hover:bg-slate-100 hover:translate-x-0.5'
                    }`}
                  >
                    <DollarSign className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-left leading-snug">Penerimaan Barang dengan Harga</span>
                  </button>
                )}
              </div>
            )}

            {/* 3. SALES GROUP */}
            {(canView('sales-sync-stok') || canView('sales-monitoring')) && (
              <div className="space-y-1 pt-2">
                <div className="px-3.5 pt-2 pb-1 text-[11px] font-bold text-amber-500/80 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Sales</span>
                </div>

                {canView('sales-sync-stok') && (
                  <button
                    onClick={() => setActiveTab('sales-sync-stok')}
                    className={`w-full px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all cursor-pointer active:scale-98 text-left ${
                      activeTab === 'sales-sync-stok'
                        ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                        : isDark
                        ? 'text-slate-300 hover:bg-slate-800/80 hover:translate-x-0.5'
                        : 'text-slate-700 hover:bg-slate-100 hover:translate-x-0.5'
                    }`}
                  >
                    <RefreshCw className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-left leading-snug">Sync Stock</span>
                  </button>
                )}

                {canView('sales-monitoring') && (
                  <button
                    onClick={() => setActiveTab('sales-monitoring')}
                    className={`w-full px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all cursor-pointer active:scale-98 text-left ${
                      activeTab === 'sales-monitoring'
                        ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                        : isDark
                        ? 'text-slate-300 hover:bg-slate-800/80 hover:translate-x-0.5'
                        : 'text-slate-700 hover:bg-slate-100 hover:translate-x-0.5'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="text-left leading-snug">Sales Monitoring</span>
                  </button>
                )}
              </div>
            )}

            {/* 4. REPORT GROUP */}
            {canView('laporan-penjualan') && (
              <div className="space-y-1 pt-2">
                <div className="px-3.5 pt-2 pb-1 text-[11px] font-bold text-amber-500/80 uppercase tracking-wider flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Report</span>
                </div>
                <button
                  onClick={() => setActiveTab('laporan-penjualan')}
                  className={`w-full px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all cursor-pointer active:scale-98 text-left ${
                    activeTab === 'laporan-penjualan'
                      ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                      : isDark
                      ? 'text-slate-300 hover:bg-slate-800/80 hover:translate-x-0.5'
                      : 'text-slate-700 hover:bg-slate-100 hover:translate-x-0.5'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 text-pink-400 shrink-0" />
                  <span className="text-left leading-snug">Laporan Penjualan</span>
                </button>
              </div>
            )}

            {/* ADMIN EXCLUSIVE TAB: USER ERP MANAGEMENT */}
            {canView('user-management') && (
              <div className="pt-2">
                <div className="px-3.5 pt-2 pb-1 text-[11px] font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Admin System</span>
                </div>
                <button
                  onClick={() => setActiveTab('user-management')}
                  className={`w-full px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all cursor-pointer active:scale-98 text-left ${
                    activeTab === 'user-management'
                      ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                      : isDark
                      ? 'text-emerald-400 hover:bg-slate-800/80 hover:translate-x-0.5'
                      : 'text-emerald-600 hover:bg-slate-100 hover:translate-x-0.5'
                  }`}
                >
                  <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-left leading-snug">User ERP & Hak Akses</span>
                </button>
              </div>
            )}
          </nav>
        </aside>

        {/* TAB CONTENTS */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {activeTab === 'master-barang' && <MasterBarangManager isDark={isDark} mode="master" />}
          {activeTab === 'inventory-stok' && <MasterBarangManager isDark={isDark} mode="stock" />}
          {activeTab === 'stok-opname' && <StockOpnameManager isDark={isDark} />}
          {(activeTab === 'sync-stok' || activeTab === 'memo-sync-stok' || activeTab === 'sales-sync-stok') && (
            <SyncStockManager isDark={isDark} />
          )}

          {activeTab === 'master-promo' && <MasterPromoManager isDark={isDark} />}

          {activeTab === 'master-supplier' && <MasterSupplierManager isDark={isDark} />}

          {activeTab === 'penerimaan-barang' && <PenerimaanBarangEkspressManager isDark={isDark} />}
          {activeTab === 'penerimaan-barang-harga' && <PenerimaanBarangHargaManager isDark={isDark} />}

          {activeTab === 'sales-monitoring' && <SalesMonitoringManager isDark={isDark} />}

          {activeTab === 'laporan-penjualan' && <SalesReportManager isDark={isDark} />}

          {activeTab === 'user-management' && <UserAccessManager isDark={isDark} />}
        </main>
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={(user, perms) => {
          setCurrentUser(user);
          setUserPermissions(perms);
          setIsLoginOpen(false);
        }}
      />
    </div>
  );
}

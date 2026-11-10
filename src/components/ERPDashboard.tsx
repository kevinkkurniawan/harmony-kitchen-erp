'use client';

import React, { useState, useEffect } from 'react';
import { Store, Sun, Moon, LogOut, KeyRound } from 'lucide-react';
import type { AuthenticatedUser } from '@/components/LoginModal';
import type { ERPClientPermission } from '@/components/AuthGuard';
import MasterBarangManager from '@/components/MasterBarangManager';
import MasterPromoManager from '@/components/MasterPromoManager';
import MasterSupplierManager from '@/components/MasterSupplierManager';
import InventoryStockManager from '@/components/InventoryStockManager';
import PenerimaanBarangEkspressManager from '@/components/PenerimaanBarangEkspressManager';
import PenerimaanBarangHargaManager from '@/components/PenerimaanBarangHargaManager';

import SalesMonitoringManager from '@/components/SalesMonitoringManager';
import StockOpnameManager from '@/components/StockOpnameManager';
import SalesReportManager from '@/components/SalesReportManager';
import UserAccessManager from '@/components/UserAccessManager';
import TableColumnResizer from '@/components/TableColumnResizer';
import BarcodePrintManager from '@/components/BarcodePrintManager';
import ChangePasswordDialog from '@/components/ChangePasswordDialog';

interface ERPDashboardProps {
  currentUser: AuthenticatedUser;
  userPermissions: ERPClientPermission[];
  onLogout: () => Promise<void>;
}

type TabKey = 
    | 'master-barang'
    | 'inventory-stok'
    | 'stok-opname'
    | 'cetak-barcode'
    | 'master-promo'
    | 'master-supplier'
    | 'penerimaan-barang'
    | 'penerimaan-barang-harga'
    | 'sales-monitoring'
    | 'laporan-penjualan'
    | 'user-management';

export default function ERPDashboard({ currentUser, userPermissions, onLogout }: ERPDashboardProps) {
  const [selectedTab, setActiveTab] = useState<TabKey>('master-barang');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('erp_active_tab');
    if (saved) {
      setActiveTab(saved as TabKey);
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      sessionStorage.setItem('erp_active_tab', selectedTab);
    }
  }, [selectedTab, isInitialized]);

  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  // Permission Check Helper Function (1:1 with Module Manager Isi_NavBarMenu)
  const canView = (moduleCode: string) => {
    if (currentUser?.userLevel === 'Admin') return true; // Super Admin has access to all
    if (!userPermissions || userPermissions.length === 0) return true;
    const perm = userPermissions.find((p) => p.moduleCode === moduleCode);
    return perm ? perm.canView : true;
  };

  const isDark = theme === 'dark';
  const isAdmin = currentUser?.userLevel === 'Admin';
  // Client rule: only Admin sees HPP, profit and margin
  const canViewHpp = isAdmin;

  if (!isInitialized) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
        <div className="flex items-center gap-3">
          <Store className="w-8 h-8 text-amber-500 animate-pulse" />
          <span className="font-black text-xl tracking-wider">Memuat Workspace...</span>
        </div>
      </div>
    );
  }

  // Menu like Module Manager's navigation (reconstructed group / item names); Stok Opname, Cetak Barcode and the
  // user setting are ERP-only screens the client uses.
  const menu: { group: string; items: { key: TabKey; label: string; visible: boolean }[] }[] = [
    {
      group: 'Master Data',
      items: [
        { key: 'master-barang', label: 'Master Barang', visible: canView('master-barang') },
        { key: 'inventory-stok', label: 'Inventory Stock', visible: canView('inventory-stok') },
        { key: 'stok-opname', label: 'Stok Opname', visible: canView('stok-opname') },
        { key: 'cetak-barcode', label: 'Cetak Barcode', visible: canView('cetak-barcode') },
        { key: 'master-promo', label: 'Master Promo', visible: canView('master-promo') },
        { key: 'master-supplier', label: 'Master Supplier', visible: canView('master-supplier') },
      ],
    },
    {
      group: 'Purchasing',
      items: [
        { key: 'penerimaan-barang', label: 'Penerimaan Barang Ekspress', visible: canView('penerimaan-barang') },
        { key: 'penerimaan-barang-harga', label: 'Penerimaan Barang dengan harga', visible: canView('penerimaan-barang-harga') },
      ],
    },
    { group: 'Sales', items: [{ key: 'sales-monitoring', label: 'Sales Monitoring', visible: canView('sales-monitoring') }] },
    { group: 'Report', items: [{ key: 'laporan-penjualan', label: 'Laporan Penjualan', visible: canView('laporan-penjualan') }] },
    // Only Admin manages ERP users and access rights
    { group: 'Setting', items: [{ key: 'user-management', label: 'User ERP & Hak Akses', visible: isAdmin }] },
  ];
  // A tab restored from an earlier session (e.g. another user before Log Off) may be hidden for this user
  const visibleKeys = menu.flatMap((g) => g.items).filter((i) => i.visible).map((i) => i.key);
  const activeTab: TabKey = visibleKeys.includes(selectedTab) ? selectedTab : (visibleKeys[0] ?? selectedTab);
  const activeLabel = menu.flatMap((g) => g.items).find((i) => i.key === activeTab)?.label ?? '';

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden text-xs ${isDark ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
      <TableColumnResizer />
      {/* Title bar, like the "Harmony - Module Manager" main window */}
      <header className={`h-10 px-3 border-b flex items-center justify-between shrink-0 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}>
        <div className="flex items-center gap-2 font-bold text-[13px]">
          <Store className="w-4 h-4 text-blue-600" />
          <span>Harmony - Module Manager</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>
            Current User : <b>{currentUser.fullName || currentUser.username}</b> ({currentUser.userLevel || 'User'})
          </span>
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`px-2 py-1 rounded border inline-flex items-center gap-1 cursor-pointer ${isDark ? 'border-slate-600 hover:bg-slate-800' : 'border-slate-400 hover:bg-slate-100'}`}
            title={isDark ? 'Light' : 'Dark'}
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={async () => { await onLogout(); }}
            className={`px-2 py-1 rounded border inline-flex items-center gap-1 cursor-pointer ${isDark ? 'border-slate-600 hover:bg-slate-800' : 'border-slate-400 hover:bg-slate-100'}`}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Off</span>
          </button>
          {/* Old ribbon "Action" group: Log In, Log Off, Change Password */}
          <button
            onClick={() => setChangePasswordOpen(true)}
            aria-label="Change Password"
            title="Change Password"
            className={`px-2 py-1 rounded border inline-flex items-center gap-1 whitespace-nowrap cursor-pointer ${isDark ? 'border-slate-600 hover:bg-slate-800' : 'border-slate-400 hover:bg-slate-100'}`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            {/* Icon only on narrow screens, where the top bar has no room for the caption */}
            <span className="hidden md:inline">Change Password</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Navigation (accordion groups like the old main window's menu) */}
        <aside className={`w-56 border-r flex flex-col shrink-0 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}>
          <nav className="flex-1 overflow-y-auto py-1">
            {menu.map((g) => {
              const items = g.items.filter((i) => i.visible);
              if (items.length === 0) return null;
              const open = !collapsed[g.group];
              return (
                <div key={g.group}>
                  <button
                    onClick={() => setCollapsed((c) => ({ ...c, [g.group]: open }))}
                    className={`w-full px-3 py-1.5 flex items-center justify-between font-bold cursor-pointer ${isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'}`}
                  >
                    <span>{g.group}</span>
                    <span className="text-[10px]">{open ? '▾' : '▸'}</span>
                  </button>
                  {open && items.map((i) => (
                    <button
                      key={i.key}
                      onClick={() => setActiveTab(i.key)}
                      className={`w-full pl-6 pr-3 py-1.5 text-left cursor-pointer ${
                        activeTab === i.key
                          ? 'bg-blue-600 text-white font-semibold'
                          : isDark ? 'hover:bg-slate-800' : 'hover:bg-blue-50'
                      }`}
                    >
                      {i.label}
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* TAB CONTENTS */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {activeTab === 'master-barang' && <MasterBarangManager isDark={isDark} mode="master" canViewPrice={canViewHpp} />}
          {activeTab === 'inventory-stok' && <InventoryStockManager isDark={isDark} canViewPrice={canViewHpp} />}
          {activeTab === 'stok-opname' && <StockOpnameManager isDark={isDark} canViewPrice={canViewHpp} />}
          {activeTab === 'cetak-barcode' && <BarcodePrintManager isDark={isDark} />}

          {activeTab === 'master-promo' && <MasterPromoManager isDark={isDark} />}

          {activeTab === 'master-supplier' && <MasterSupplierManager isDark={isDark} />}

          {activeTab === 'penerimaan-barang' && <PenerimaanBarangEkspressManager isDark={isDark} canViewPrice={canViewHpp} />}
          {activeTab === 'penerimaan-barang-harga' && <PenerimaanBarangHargaManager isDark={isDark} canViewPrice={canViewHpp} />}

          {activeTab === 'sales-monitoring' && <SalesMonitoringManager isDark={isDark} canViewPrice={canViewHpp} />}

          {activeTab === 'laporan-penjualan' && <SalesReportManager isDark={isDark} canViewPrice={canViewHpp} />}

          {activeTab === 'user-management' && isAdmin && <UserAccessManager isDark={isDark} />}
        </main>
      </div>
      {changePasswordOpen && <ChangePasswordDialog isDark={isDark} onClose={() => setChangePasswordOpen(false)} />}
      <footer className={`h-6 px-3 border-t flex items-center gap-4 shrink-0 text-[11px] ${isDark ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-300 text-slate-500'}`}>
        <span>User : {currentUser.username}</span>
        <span>{activeLabel}</span>
      </footer>
    </div>
  );
}

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
  Filter,
  Download,
  FileSpreadsheet,
  Layers,
  DollarSign,
  TrendingUp,
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

export default function ERPDashboard() {
  const [activeTab, setActiveTab] = useState<
    | 'master-barang'
    | 'sync-stok'
    | 'master-promo'
    | 'master-supplier'
    | 'penerimaan-barang'
    | 'sales-monitoring'
    | 'laporan-penjualan'
  >('master-barang');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('31 Jul 2026');

  const isDark = theme === 'dark';

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

  return (
    <div
      className={`h-screen w-screen flex flex-col font-sans overflow-hidden select-none transition-colors duration-200 ${
        isDark ? 'bg-[#070b14] text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* 🚀 ERP TOP HEADER (Module Manager Bar) */}
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

          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-500 font-semibold border border-amber-500/20">
              Config: Harmony.conf
            </span>
            <span className="text-slate-400 font-medium hidden sm:inline">IP: 192.168.137.1</span>
          </div>
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
            <span className="hidden sm:inline">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <div className="text-xs text-slate-400 font-medium">User: <strong className="text-emerald-500">HY</strong></div>
        </div>
      </header>

      {/* 📦 ERP BODY: NAVIGATION SIDEBAR & TAB CONTENT */}
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
          </nav>

          <div className="p-3 border-t border-slate-800 text-[11px] text-slate-400">
            Connected to: <strong className="text-slate-200">SRV-PC db_Harmony</strong>
          </div>
        </aside>

        {/* TAB CONTENTS */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* MODUL 1: MASTER BARANG */}
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
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-xs">
                    + Tambah Barang
                  </button>
                  <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700">
                    Export Data
                  </button>
                </div>
              </div>

              {/* Data Table */}
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
                      <th className="py-3 px-3 text-center">Gr. Pr</th>
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
                        <td className="py-3 px-3 text-center font-bold">{item.grPr}</td>
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

          {/* MODUL 2: SYNC STOK DAN LAPORAN */}
          {activeTab === 'sync-stok' && (
            <div className="flex-1 flex p-4 gap-4 overflow-hidden">
              <div className="flex-1 flex flex-col min-w-0">
                <div className="pb-3 flex items-center justify-between">
                  <h2 className="font-bold text-sm flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-emerald-500" />
                    Sync Stok dan Laporan Opname
                  </h2>
                  <button className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-xs">
                    Sync Semua Stok
                  </button>
                </div>
                <div className={`flex-1 overflow-auto rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className={`border-b uppercase text-[11px] font-bold ${isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                        <th className="py-3 px-4">Nama Barang</th>
                        <th className="py-3 px-4 text-center">Inv. Stok</th>
                        <th className="py-3 px-4 text-center">RT. Stok</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Last Sync</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y font-medium ${isDark ? 'divide-slate-800/60' : 'divide-slate-200'}`}>
                      {MOCK_STOCK_SYNC.map((sync) => (
                        <tr key={sync.id} className={isDark ? 'hover:bg-slate-800/40 text-slate-200' : 'hover:bg-slate-50 text-slate-800'}>
                          <td className="py-3.5 px-4 font-semibold">{sync.namaBarang}</td>
                          <td className="py-3.5 px-4 text-center font-bold">{sync.invStok}</td>
                          <td className="py-3.5 px-4 text-center font-bold text-emerald-500">{sync.rtStok}</td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-md font-bold text-[10px] ${sync.status === 'OK' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                              {sync.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right text-slate-400 text-[11px] font-mono">{sync.lastSync}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Panel Laporan Detail */}
              <div className={`w-80 rounded-2xl border p-4 flex flex-col ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'}`}>
                <h3 className="font-bold text-xs uppercase text-slate-400 border-b pb-2 mb-3">Laporan Detail</h3>
                <div className="space-y-3 text-xs flex-1">
                  <div className="flex justify-between p-2.5 rounded-xl border border-slate-800 bg-slate-950/50">
                    <span className="text-slate-400">Tahun:</span>
                    <span className="font-bold">2026</span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded-xl border border-slate-800 bg-slate-950/50">
                    <span className="text-slate-400">Bulan:</span>
                    <span className="font-bold">Agustus</span>
                  </div>
                  <div className="flex justify-between p-2.5 rounded-xl border border-slate-800 bg-slate-950/50">
                    <span className="text-slate-400">Qty Transaksi:</span>
                    <span className="font-bold text-emerald-400">1,420 Item</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODUL 3: MASTER PROMO GROSIR */}
          {activeTab === 'master-promo' && (
            <div className="flex-1 flex flex-col p-4 overflow-hidden">
              <div className="pb-3 flex justify-between items-center">
                <h2 className="font-bold text-sm flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-500" />
                  Aturan Promo & Tier Harga Grosir
                </h2>
                <button className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-xs">
                  + New Promo Rule
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto flex-1 pr-2">
                {MOCK_PROMO_RULES.map((rule) => (
                  <div key={rule.id} className={`rounded-2xl border p-4 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <h3 className="font-bold text-sm text-amber-500 pb-2 border-b border-slate-800/80">{rule.promoName}</h3>
                    <table className="w-full text-left text-xs mt-2">
                      <thead>
                        <tr className="text-slate-400 uppercase text-[10px]">
                          <th className="py-2">Tier Promo</th>
                          <th className="py-2 text-center">Qty Min</th>
                          <th className="py-2 text-center">Qty Max</th>
                          <th className="py-2">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {rule.tiers.map((t, idx) => (
                          <tr key={idx}>
                            <td className="py-2 font-bold text-slate-200">{t.tierName}</td>
                            <td className="py-2 text-center font-mono font-bold text-emerald-400">{t.qtyMin}</td>
                            <td className="py-2 text-center font-mono font-bold text-amber-400">{t.qtyMax}</td>
                            <td className="py-2 text-slate-400">{t.keterangan}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MODUL 4: MASTER SUPPLIER */}
          {activeTab === 'master-supplier' && (
            <div className="flex-1 flex flex-col p-4 overflow-hidden">
              <div className="pb-3 flex justify-between items-center">
                <h2 className="font-bold text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-500" />
                  Daftar Master Supplier
                </h2>
                <button className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-xs">
                  + New Supplier
                </button>
              </div>

              <div className={`flex-1 overflow-auto rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className={`border-b uppercase text-[11px] font-bold ${isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                      <th className="py-3 px-3">Supplier No</th>
                      <th className="py-3 px-3">Supplier Name</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3">Alamat</th>
                      <th className="py-3 px-3">Kota</th>
                      <th className="py-3 px-3">Phone</th>
                      <th className="py-3 px-3">Bank ID</th>
                      <th className="py-3 px-3 text-right">Credit Limit</th>
                      <th className="py-3 px-3">Contact</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y font-medium ${isDark ? 'divide-slate-800/60' : 'divide-slate-200'}`}>
                    {MOCK_SUPPLIERS.map((s) => (
                      <tr key={s.id} className={isDark ? 'hover:bg-slate-800/40 text-slate-200' : 'hover:bg-slate-50 text-slate-800'}>
                        <td className="py-3 px-3 font-mono text-slate-400">{s.supplierNo}</td>
                        <td className="py-3 px-3 font-bold text-white">{s.supplierName}</td>
                        <td className="py-3 px-3 text-amber-400 font-semibold">{s.supplierType}</td>
                        <td className="py-3 px-3 text-slate-400">{s.address}</td>
                        <td className="py-3 px-3">{s.city}</td>
                        <td className="py-3 px-3 font-mono text-[11px]">{s.phone1}</td>
                        <td className="py-3 px-3 font-bold">{s.bankId}</td>
                        <td className="py-3 px-3 text-right font-extrabold text-emerald-400">Rp {s.creditLimit.toLocaleString('id-ID')}</td>
                        <td className="py-3 px-3">{s.contactPerson}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODUL 5: PENERIMAAN BARANG EXPRESS */}
          {activeTab === 'penerimaan-barang' && (
            <div className="flex-1 flex p-4 gap-4 overflow-hidden">
              {/* Panel Kiri: List Nota Penerimaan */}
              <div className={`w-80 rounded-2xl border p-4 flex flex-col ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                <h3 className="font-bold text-xs uppercase text-slate-400 pb-3 border-b border-slate-800">Daftar Nota Penerimaan</h3>
                <div className="space-y-2 overflow-y-auto flex-1 pt-3">
                  {MOCK_GOODS_RECEIPTS.map((mr) => (
                    <div key={mr.id} className={`p-3 rounded-xl border cursor-pointer transition-all ${isDark ? 'bg-slate-950/80 border-slate-800 hover:border-amber-500/50' : 'bg-slate-50 border-slate-200 hover:border-amber-500'}`}>
                      <div className="flex justify-between items-center font-bold text-xs">
                        <span className="text-amber-500">{mr.mrNo}</span>
                        <span className="text-[10px] text-slate-400">{mr.mrDate}</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-200 mt-1">{mr.supplier}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{mr.keterangan}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Panel Kanan: Form & Detail Goods Receipt */}
              <div className={`flex-1 rounded-2xl border p-5 flex flex-col ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                  <h3 className="font-bold text-sm text-white">Detail Nota Penerimaan Barang Express</h3>
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700">
                      Refresh Supplier
                    </button>
                    <button className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-xs">
                      Save Nota
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-4 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">No. Order</label>
                    <input type="text" value="MR-260727-002" readOnly className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-white" />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Supplier</label>
                    <input type="text" value="ETC Hardware" readOnly className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-semibold text-white" />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Tanggal</label>
                    <input type="text" value="27 Jul 2026" readOnly className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" />
                  </div>
                </div>

                {/* Tabel Detail Item Barang */}
                <div className="flex-1 overflow-auto mt-4 rounded-xl border border-slate-800 bg-slate-950/60">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                        <th className="py-2.5 px-3">Barang</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Harga</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {MOCK_GOODS_RECEIPTS[0].items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-900/40">
                          <td className="py-2.5 px-3 font-semibold text-slate-200">{item.barangName}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-amber-400">{item.qty}</td>
                          <td className="py-2.5 px-3 text-right font-mono">Rp {item.harga.toLocaleString('id-ID')}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-400">Rp {(item.qty * item.harga).toLocaleString('id-ID')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MODUL 6: BILL OPNAME (SALES MONITORING MODUL SAMA DENGAN SCREENSHOT 6) */}
          {activeTab === 'sales-monitoring' && (
            <div className="flex-1 flex flex-col p-4 overflow-hidden">
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-3">
                  <h2 className="font-bold text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-500" />
                    Bill Opname & Sales Monitoring
                  </h2>
                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1 text-xs">
                    <Calendar className="w-3.5 h-3.5 text-amber-500" />
                    <span>Tanggal: <strong>{selectedDate}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-sky-400" /> Refresh
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className={`flex-1 overflow-auto rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className={`border-b uppercase text-[11px] font-bold ${isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                      <th className="py-3 px-3">No. Nota</th>
                      <th className="py-3 px-3">Jenis Bayar</th>
                      <th className="py-3 px-3">Bank</th>
                      <th className="py-3 px-3 text-right">Nom. Transaksi</th>
                      <th className="py-3 px-3 text-right">Diskon Akhir</th>
                      <th className="py-3 px-3 text-right">Nom. Bayar</th>
                      <th className="py-3 px-3 text-right">Change Val</th>
                      <th className="py-3 px-3">Keterangan</th>
                      <th className="py-3 px-3 text-right text-emerald-500">Tunai</th>
                      <th className="py-3 px-3 text-right text-sky-500">Debit</th>
                      <th className="py-3 px-3 text-right text-purple-500">Qris</th>
                      <th className="py-3 px-3 text-right text-amber-500">CC</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y font-medium ${isDark ? 'divide-slate-800/60' : 'divide-slate-200'}`}>
                    {MOCK_SALES_MONITORING.map((row) => (
                      <tr key={row.id} className={isDark ? 'hover:bg-slate-800/40 text-slate-200' : 'hover:bg-slate-50 text-slate-800'}>
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-400">{row.noNota}</td>
                        <td className="py-2.5 px-3">{row.jenisBayar}</td>
                        <td className="py-2.5 px-3 text-slate-400">{row.bank}</td>
                        <td className="py-2.5 px-3 text-right font-bold">Rp {row.nomTransaksi.toLocaleString('id-ID')}</td>
                        <td className="py-2.5 px-3 text-right">{row.diskonAkhir}</td>
                        <td className="py-2.5 px-3 text-right font-bold">Rp {row.nomBayar.toLocaleString('id-ID')}</td>
                        <td className="py-2.5 px-3 text-right text-slate-400">{row.changeVal.toLocaleString('id-ID')}</td>
                        <td className="py-2.5 px-3 text-slate-400">{row.keterangan}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-400">{row.tunai > 0 ? `Rp ${row.tunai.toLocaleString('id-ID')}` : '0'}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-sky-400">{row.debit > 0 ? `Rp ${row.debit.toLocaleString('id-ID')}` : '0'}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-purple-400">{row.qris > 0 ? `Rp ${row.qris.toLocaleString('id-ID')}` : '0'}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-amber-400">{row.cc > 0 ? `Rp ${row.cc.toLocaleString('id-ID')}` : '0'}</td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Summary Footer Row */}
                  <tfoot>
                    <tr className={`border-t-2 font-extrabold text-xs ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-200 border-slate-300 text-slate-900'}`}>
                      <td colSpan={3} className="py-3 px-3">TOTAL SUMMARY:</td>
                      <td className="py-3 px-3 text-right text-white">Rp {totalNomTransaksi.toLocaleString('id-ID')}</td>
                      <td className="py-3 px-3 text-right">Rp {totalDiskon.toLocaleString('id-ID')}</td>
                      <td colSpan={3} className="py-3 px-3"></td>
                      <td className="py-3 px-3 text-right text-emerald-400">Rp {totalTunai.toLocaleString('id-ID')}</td>
                      <td className="py-3 px-3 text-right text-sky-400">Rp {totalDebit.toLocaleString('id-ID')}</td>
                      <td className="py-3 px-3 text-right text-purple-400">Rp {totalQris.toLocaleString('id-ID')}</td>
                      <td className="py-3 px-3 text-right text-amber-400">Rp {totalCc.toLocaleString('id-ID')}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* MODUL 7: LAPORAN TOTAL PENJUALAN (MATCH SCREENSHOT 7 PREVIEW) */}
          {activeTab === 'laporan-penjualan' && (
            <div className="flex-1 flex flex-col p-4 overflow-hidden items-center justify-center bg-slate-950/90">
              {/* Paper Preview Document */}
              <div className="bg-white text-slate-900 p-8 rounded-2xl shadow-2xl border border-slate-300 max-w-4xl w-full max-h-[85vh] overflow-y-auto">
                <div className="text-center pb-6 border-b border-slate-300">
                  <h2 className="font-extrabold text-2xl tracking-wider text-slate-900 uppercase">
                    LAPORAN TOTAL PENJUALAN
                  </h2>
                  <p className="text-sm font-semibold text-slate-600 mt-1">Periode : Juli 2026</p>
                </div>

                <div className="py-6">
                  <table className="w-full text-left text-xs border-collapse font-sans">
                    <thead>
                      <tr className="bg-amber-500 text-slate-950 uppercase font-bold text-center border border-amber-600">
                        <th className="py-2.5 px-3 border border-amber-600">Tanggal</th>
                        <th className="py-2.5 px-3 border border-amber-600">Tunai</th>
                        <th className="py-2.5 px-3 border border-amber-600">Debit</th>
                        <th className="py-2.5 px-3 border border-amber-600">Kredit</th>
                        <th className="py-2.5 px-3 border border-amber-600">Qris</th>
                        <th className="py-2.5 px-3 border border-amber-600">Lain-lain</th>
                        <th className="py-2.5 px-3 border border-amber-600">Total Harian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {MOCK_SALES_REPORT_DAILY.map((row, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-amber-50/50' : 'bg-white'}>
                          <td className="py-2 px-3 font-semibold text-center border border-slate-200">{row.tanggal}</td>
                          <td className="py-2 px-3 text-right border border-slate-200 font-mono">{row.tunai.toLocaleString('id-ID')}</td>
                          <td className="py-2 px-3 text-right border border-slate-200 font-mono">{row.debit.toLocaleString('id-ID')}</td>
                          <td className="py-2 px-3 text-right border border-slate-200 font-mono">{row.kredit.toLocaleString('id-ID')}</td>
                          <td className="py-2 px-3 text-right border border-slate-200 font-mono">{row.qris.toLocaleString('id-ID')}</td>
                          <td className="py-2 px-3 text-right border border-slate-200 font-mono">{row.lainLain}</td>
                          <td className="py-2 px-3 text-right border border-slate-200 font-bold font-mono text-slate-900">
                            {row.totalHarian.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-amber-100 font-extrabold text-xs text-slate-900 border-t-2 border-slate-400">
                        <td className="py-2.5 px-3 border border-slate-300">TOTAL:</td>
                        <td className="py-2.5 px-3 text-right border border-slate-300">{reportTotalTunai.toLocaleString('id-ID')}</td>
                        <td className="py-2.5 px-3 text-right border border-slate-300">{reportTotalDebit.toLocaleString('id-ID')}</td>
                        <td className="py-2.5 px-3 text-right border border-slate-300">{reportTotalKredit.toLocaleString('id-ID')}</td>
                        <td className="py-2.5 px-3 text-right border border-slate-300">{reportTotalQris.toLocaleString('id-ID')}</td>
                        <td className="py-2.5 px-3 text-right border border-slate-300">0</td>
                        <td className="py-2.5 px-3 text-right border border-slate-300 text-amber-900 font-black">
                          {reportGrandTotal.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Footer Totals Summary */}
                <div className="pt-4 border-t border-slate-200 text-xs font-bold space-y-1 text-slate-700">
                  <p>Total Tunai : <span className="font-mono pl-4">119,396,750</span></p>
                  <p>Total Debit : <span className="font-mono pl-4">22,273,250</span></p>
                  <p>Total Kartu Kredit : <span className="font-mono pl-4">108,278,000</span></p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

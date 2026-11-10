'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import {
  LegacyWindow, LegacyButton, LegacyGrid, LegacyPager, LegacyInput, GroupBox, fmtN0, fmtDate, lx, type LegacyColumn,
} from '@/components/legacy';

interface InventoryItem {
  id: string;
  barcode: string;
  inventoryNo: string;
  inventoryName: string;
  price: number;
  hpp: number;
  stokAkhir: number;
  syncDate: string | null;
}

/** One row of /api/inventory/[id]/movement (the Kartu Stok ledger, newest first). */
export interface MovementRow {
  id: string;
  date: string | null;
  transactionNo: string;
  type: string;
  qtyIn: number;
  qtyOut: number;
  price: number;
  balance: number;
}

export interface MonthRow {
  key: string;
  year: number;
  month: number;
  monthName: string;
  qty: number;
}

const YEAR_MONTH = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit' });
const MONTH_NAME = new Intl.DateTimeFormat('id-ID', { month: 'long', timeZone: 'UTC' });

/** "YYYY-MM" of a movement date in shop time (Asia/Bangkok), or null when the row has no date. */
export function movementMonthKey(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? null : YEAR_MONTH.format(d).slice(0, 7);
}

/**
 * Legacy "Tahun / Bulan / Qty" summary of the stock card: net quantity (in - out) per month, newest month first.
 * Built from the movement ledger because the ERP has no per-month stock table.
 */
export function groupMovementByMonth(rows: MovementRow[]): MonthRow[] {
  const byMonth = new Map<string, number>();
  for (const r of rows) {
    const key = movementMonthKey(r.date);
    if (key) byMonth.set(key, (byMonth.get(key) ?? 0) + Number(r.qtyIn || 0) - Number(r.qtyOut || 0));
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([key, qty]) => {
      const year = Number(key.slice(0, 4));
      const month = Number(key.slice(5, 7));
      return { key, year, month, monthName: MONTH_NAME.format(new Date(Date.UTC(year, month - 1, 1))), qty };
    });
}

/** Full stock card of one item (limit 5000: enough for the monthly summary to cover every month). */
export async function fetchMovement(inventoryId: string): Promise<{ rows: MovementRow[]; total: number; lastOpnameDate: string | null }> {
  const json = await fetch(`/api/inventory/${inventoryId}/movement?limit=5000`).then((r) => r.json());
  if (!json.success || !Array.isArray(json.data)) throw new Error(json.error || 'Gagal memuat kartu stok');
  return { rows: json.data, total: json.total ?? json.data.length, lastOpnameDate: json.lastOpnameDate ?? null };
}

interface InventoryStockManagerProps {
  canViewPrice?: boolean;
  isDark: boolean;
}

const PAGE_SIZE = 100;
/** Batch size for the full-catalog report (the API maximum) */
const REPORT_BATCH = 5000;

/** Report preview window of the legacy app: overlay with a title bar (same look as Master Barang's). */
function ReportDialog({ title, isDark, onClose, children }: { title: string; isDark: boolean; onClose: () => void; children: React.ReactNode }) {
  const c = lx(isDark);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-5xl max-h-[90vh] flex flex-col border rounded shadow-2xl text-xs ${c.panel} ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
      >
        <div className={`px-3 py-1.5 border-b flex items-center justify-between font-bold text-[13px] ${c.bar}`}>
          <span>{title}</span>
          <button type="button" onClick={onClose} title="Close" className="p-0.5 rounded hover:bg-rose-600 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 flex flex-col p-2 gap-2 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

/** Legacy Frm_InventoryStock (" Sync Stok dan Laporan"): stock list plus a ".:: Detail" side group with the stock card. */
export default function InventoryStockManager({ isDark, canViewPrice = false }: InventoryStockManagerProps) {
  const c = lx(isDark);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [sort, setSort] = useState<{ key: string; order: 'asc' | 'desc' } | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // The page belongs to one search + sort; changing either starts again at page 1
  const filterKey = JSON.stringify([debouncedSearchQuery, sort]);
  const [pageState, setPageState] = useState<{ filterKey: string; page: number }>({ filterKey: '', page: 1 });
  const page = pageState.filterKey === filterKey ? pageState.page : 1;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  // ".:: Detail" group: the item opened with "=>" and its stock card
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);
  const [ledger, setLedger] = useState<MovementRow[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [lastOpnameDate, setLastOpnameDate] = useState<string | null>(null);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);
  const months = useMemo(() => groupMovementByMonth(ledger), [ledger]);

  // "Laporan Stok Akhir" (legacy Rpt_InventoryStock): null while loading
  const [isStockReportOpen, setIsStockReportOpen] = useState(false);
  const [reportItems, setReportItems] = useState<InventoryItem[] | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  // Server-side page and sort over the whole active catalog; responses older than the latest request are dropped
  const itemsReqIdRef = useRef(0);
  const fetchItems = useCallback(async () => {
    const reqId = ++itemsReqIdRef.current;
    setIsLoading(true);
    try {
      let url = `/api/inventory?q=${encodeURIComponent(debouncedSearchQuery)}&page=${page}&limit=${PAGE_SIZE}&onlyActive=true`;
      if (sort) url += `&sort=${sort.key}&order=${sort.order}`;
      const json = await fetch(url).then((r) => r.json());
      if (reqId === itemsReqIdRef.current && json.success && Array.isArray(json.data)) {
        setItems(json.data);
        setTotalItems(json.pagination?.total ?? json.data.length);
      }
    } catch (e) {
      console.error('Failed to fetch inventory items', e);
    } finally {
      if (reqId === itemsReqIdRef.current) setIsLoading(false);
    }
  }, [debouncedSearchQuery, sort, page]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Stock card of the detail item; a newer "=>" click wins over a slower earlier one
  const ledgerReqIdRef = useRef(0);
  const loadLedger = useCallback(async (item: InventoryItem) => {
    const reqId = ++ledgerReqIdRef.current;
    setIsLoadingLedger(true);
    setLedger([]);
    setLedgerTotal(0);
    setLastOpnameDate(null);
    try {
      const result = await fetchMovement(item.id);
      if (reqId !== ledgerReqIdRef.current) return;
      setLedger(result.rows);
      setLedgerTotal(result.total);
      setLastOpnameDate(result.lastOpnameDate);
    } catch (e) {
      console.error('Failed to fetch ledger', e);
    } finally {
      if (reqId === ledgerReqIdRef.current) setIsLoadingLedger(false);
    }
  }, []);

  const openDetail = (item: InventoryItem) => {
    setFocusedId(item.id);
    setDetailItem(item);
    loadLedger(item);
  };

  const handleRefresh = async () => {
    await fetchItems();
    if (detailItem) await loadLedger(detailItem);
  };

  // Every active item (the list this screen shows, without its search), fetched in API-max batches.
  // A newer open (or a close) makes an older load obsolete.
  const reportReqIdRef = useRef(0);
  const openStockReport = async () => {
    const reqId = ++reportReqIdRef.current;
    setReportItems(null);
    setReportError(null);
    setIsStockReportOpen(true);
    try {
      const all: InventoryItem[] = [];
      for (let p = 1; ; p++) {
        const json = await fetch(`/api/inventory?page=${p}&limit=${REPORT_BATCH}&onlyActive=true&sort=inventoryNo&order=asc`).then((r) => r.json());
        if (!json.success || !Array.isArray(json.data)) throw new Error(json.error || 'Gagal memuat Laporan Stok Akhir');
        all.push(...json.data);
        if (json.data.length < REPORT_BATCH || all.length >= (json.pagination?.total ?? 0)) break;
      }
      if (reqId === reportReqIdRef.current) setReportItems(all);
    } catch (e) {
      console.error('Failed to fetch stock report', e);
      if (reqId === reportReqIdRef.current) setReportError('Gagal memuat Laporan Stok Akhir.');
    }
  };
  const closeStockReport = () => {
    reportReqIdRef.current++;
    setIsStockReportOpen(false);
  };

  // Legacy report columns: IN HPP = HPP x Stok (admin only), IN H. Jual = Stok x Harga, footer = sums.
  // "|| 0" turns the -0 of a negative stock x 0 price into 0 (it would print as "-0").
  const reportSum = useMemo(() => (reportItems ?? []).reduce(
    (acc, r) => {
      const stock = Number(r.stokAkhir || 0);
      acc.stock += stock;
      acc.hpp += stock * Number(r.hpp || 0);
      acc.retail += stock * Number(r.price || 0);
      return acc;
    },
    { stock: 0, hpp: 0, retail: 0 },
  ), [reportItems]);
  const reportColumns: LegacyColumn<InventoryItem>[] = [
    { key: 'inventoryNo', caption: 'PLU' },
    { key: 'barcode', caption: 'Barcode' },
    { key: 'inventoryName', caption: 'Nama Barang' },
    { key: 'price', caption: 'H. Jual', format: 'n0' },
    { key: 'stokAkhir', caption: 'Stok', format: 'n0', footer: fmtN0(reportSum.stock) },
    ...(canViewPrice
      ? ([{ key: 'inHpp', caption: 'IN HPP', format: 'n0', footer: fmtN0(reportSum.hpp), render: (r) => fmtN0(Number(r.stokAkhir || 0) * Number(r.hpp || 0) || 0) }] as LegacyColumn<InventoryItem>[])
      : []),
    { key: 'inRetail', caption: 'IN H. Jual', format: 'n0', footer: fmtN0(reportSum.retail), render: (r) => fmtN0(Number(r.stokAkhir || 0) * Number(r.price || 0) || 0) },
  ];

  const handleSort = (key: string) => {
    setSort((prev) => (prev?.key !== key ? { key, order: 'asc' } : prev.order === 'asc' ? { key, order: 'desc' } : null));
  };

  // Row number across pages ("No"); a map keeps the lookup O(1) per cell
  const rowIndex = useMemo(() => new Map(items.map((row, i) => [row.id, i])), [items]);

  // Legacy GV_Header columns and order; HPP and Total (HPP x stock) are admin-only like everywhere else
  const columns: LegacyColumn<InventoryItem>[] = [
    { key: 'no', caption: 'No', align: 'right', render: (row) => fmtN0((page - 1) * PAGE_SIZE + (rowIndex.get(row.id) ?? 0) + 1) },
    { key: 'inventoryNo', caption: 'PLU', sortKey: 'inventoryNo' },
    { key: 'barcode', caption: 'Barcode', sortKey: 'barcode' },
    { key: 'inventoryName', caption: 'Nama Barang', sortKey: 'inventoryName' },
    { key: 'price', caption: 'Price', format: 'n0', sortKey: 'price' },
    ...(canViewPrice
      ? ([
          { key: 'hpp', caption: 'HPP', format: 'n0', sortKey: 'hpp' },
          { key: 'total', caption: 'Total', format: 'n0', render: (row) => fmtN0(Number(row.hpp || 0) * Number(row.stokAkhir || 0)) },
        ] as LegacyColumn<InventoryItem>[])
      : []),
    {
      key: 'stokAkhir', caption: 'Stok Terbaru', format: 'n0', sortKey: 'stokAkhir',
      render: (row) => <span className={row.stokAkhir < 0 ? 'text-rose-600 font-semibold' : ''}>{fmtN0(row.stokAkhir)}</span>,
    },
    {
      key: 'detail', caption: '=>', align: 'center', width: 40,
      render: (row) => (
        <button
          type="button"
          title="Detail"
          onClick={(e) => { e.stopPropagation(); openDetail(row); }}
          className={`px-1.5 rounded border font-bold cursor-pointer ${isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-slate-400 hover:bg-slate-100'}`}
        >
          =&gt;
        </button>
      ),
    },
    { key: 'syncDate', caption: 'Last Sync', format: 'date' },
  ];

  const monthColumns: LegacyColumn<MonthRow>[] = [
    { key: 'year', caption: 'Tahun', render: (r) => String(r.year) },
    { key: 'monthName', caption: 'Bulan' },
    { key: 'qty', caption: 'Qty Transaksi', format: 'n0' },
  ];

  // Stock card (client doc item 5: transaction history), captions from the legacy "Laporan Detail" report
  const ledgerColumns: LegacyColumn<MovementRow>[] = [
    { key: 'date', caption: 'Tgl. Transaksi', format: 'date' },
    { key: 'transactionNo', caption: 'No. Transaksi' },
    { key: 'type', caption: 'Mode' },
    { key: 'qtyIn', caption: 'Masuk', format: 'n0', render: (r) => (r.qtyIn ? fmtN0(r.qtyIn) : '') },
    { key: 'qtyOut', caption: 'Keluar', format: 'n0', render: (r) => (r.qtyOut ? fmtN0(r.qtyOut) : '') },
    { key: 'balance', caption: 'Saldo Akhir', format: 'n0' },
  ];

  return (
    <LegacyWindow
      title="Sync Stok dan Laporan"
      isDark={isDark}
      toolbar={
        <>
          <LegacyButton isDark={isDark} onClick={handleRefresh} icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}>
            Refresh
          </LegacyButton>
          <LegacyButton isDark={isDark} onClick={openStockReport}>Laporan Stok Akhir</LegacyButton>
          <div className="w-full sm:w-72 sm:ml-auto">
            <LegacyInput
              isDark={isDark}
              type="search"
              placeholder="Enter text to search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </>
      }
    >
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2">
        <div className="flex-1 min-w-0 min-h-[240px] flex flex-col gap-2">
          <LegacyGrid
            isDark={isDark}
            columns={columns}
            rows={items}
            rowKey={(row) => row.id}
            loading={isLoading}
            emptyText="Tidak ada barang yang cocok dengan filter."
            focusedKey={focusedId}
            onRowClick={(row) => setFocusedId(row.id)}
            sort={sort}
            onSort={handleSort}
          />
          <LegacyPager
            isDark={isDark}
            page={page}
            totalPages={totalPages}
            total={totalItems}
            shown={items.length}
            unit="barang"
            onPage={(p) => setPageState({ filterKey, page: Math.min(Math.max(1, p), totalPages) })}
          />
        </div>

        {/* Shown once an item is opened with "=>", so the grid keeps its full width until then */}
        {detailItem && (
        <GroupBox caption=".:: Detail" isDark={isDark} className="lg:w-[400px] shrink-0 min-h-[320px]">
          <div className="font-bold text-[13px] truncate" title={detailItem?.inventoryName}>{detailItem?.inventoryName || ' '}</div>
          {detailItem && (
            <div className={c.muted}>
              Terakhir opname: <span className="font-semibold">{lastOpnameDate ? fmtDate(lastOpnameDate) : '-'}</span>
            </div>
          )}
          <div className="h-40 shrink-0 flex flex-col">
            <LegacyGrid
              isDark={isDark}
              columns={monthColumns}
              rows={months}
              rowKey={(r) => r.key}
              loading={isLoadingLedger}
              emptyText={detailItem ? 'Belum ada transaksi.' : 'Klik => pada barang.'}
            />
          </div>
          <div className="flex-1 min-h-[160px] flex flex-col">
            <LegacyGrid
              isDark={isDark}
              columns={ledgerColumns}
              rows={ledger}
              rowKey={(r) => r.id}
              loading={isLoadingLedger}
              emptyText={detailItem ? 'Belum ada riwayat mutasi stok untuk barang ini.' : ''}
              rowClassName={(r) => (r.qtyIn > 0 ? (isDark ? 'text-emerald-300' : 'text-emerald-800') : r.qtyOut > 0 ? (isDark ? 'text-rose-300' : 'text-rose-800') : '')}
            />
          </div>
          {ledgerTotal > ledger.length && (
            <div className={c.muted}>Menampilkan {fmtN0(ledger.length)} dari {fmtN0(ledgerTotal)} mutasi terbaru.</div>
          )}
        </GroupBox>
        )}
      </div>

      {isStockReportOpen && (
        <ReportDialog title="Laporan Stok Akhir" isDark={isDark} onClose={closeStockReport}>
          <div className="flex-1 min-h-[300px] flex flex-col">
            <LegacyGrid
              isDark={isDark}
              columns={reportColumns}
              rows={reportItems ?? []}
              rowKey={(r) => r.id}
              loading={reportItems === null && !reportError}
              emptyText={reportError || 'Tidak ada data barang.'}
              showFooter
            />
          </div>
        </ReportDialog>
      )}
    </LegacyWindow>
  );
}

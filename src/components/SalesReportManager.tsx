'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Printer } from 'lucide-react';
import { getTodayBangkok } from '@/lib/date-utils';
import { LegacyWindow, LegacyButton, LegacyGrid, LegacyInput, GroupBox, FieldRow, fmtN0, fmtDate, lx, type LegacyColumn } from '@/components/legacy';

type Num = number | string;

/** One row of GET /api/reports/sales?type=daily (or monthly, with `month` instead of `date`). */
interface PeriodRow {
  date?: string;
  month?: string;
  totalOrders: number;
  totalItems: number;
  grossSales: Num;
  totalDiscount: Num;
  netSales: Num;
  cashSales: Num;
  qrisSales: Num;
  transferSales: Num;
  cardSales: Num;
  debitSales: Num;
  creditSales: Num;
  otherSales: Num;
}

interface ItemReportRow {
  barcode: string;
  inventoryId?: number;
  inventoryName: string;
  totalQtySold: number;
  avgUnitPrice: string;
  totalRevenue: string;
  totalCost: string;
  profit: string;
}

interface SummaryReportData {
  totalOrders: number;
  totalItemsSold: number;
  grossSales: string;
  totalDiscount: string;
  netSales: string;
  totalCost: number;
  profit: number;
  profitMarginPct: number;
}

/** One row of GET /api/reports/sales?type=nota: one paid, non-void sale (net after every discount). */
export interface NotaRow {
  id: number;
  date: string;
  salesPosNo: string;
  time: string;
  paymentName: string;
  cashier: string;
  amount: number;
}

interface SalesReportManagerProps {
  canViewPrice?: boolean;
  isDark: boolean;
}

// NavBar items of Frm_SalesDashboard, then the ERP's extra reports
type ReportKey = 'summary-month' | 'summary-custom' | 'harian' | 'harian-kasir' | 'monthly' | 'items' | 'summary';
const NOTA_REPORTS: ReportKey[] = ['harian', 'harian-kasir'];

/** Old report columns (Rpt_SalesMonthly): Tunai | Debit | Kredit | Qris | Lain-lain | Total Harian. */
interface PayRow {
  key: string;
  tunai: number;
  debit: number;
  kredit: number;
  qris: number;
  lain: number;
  total: number;
}

// Transfer and marketplace sales have no column in the old report: they count as Lain-lain
function toPayRow(key: string, r: PeriodRow): PayRow {
  const tunai = Number(r.cashSales || 0);
  const debit = Number(r.debitSales || 0);
  const kredit = Number(r.creditSales || 0);
  const qris = Number(r.qrisSales || 0);
  const lain = Number(r.transferSales || 0) + Number(r.otherSales || 0);
  return { key, tunai, debit, kredit, qris, lain, total: tunai + debit + kredit + qris + lain };
}

const PAY_KEYS = ['tunai', 'debit', 'kredit', 'qris', 'lain', 'total'] as const;

function sumPay(rows: PayRow[]) {
  const t = { tunai: 0, debit: 0, kredit: 0, qris: 0, lain: 0, total: 0 };
  rows.forEach((r) => PAY_KEYS.forEach((k) => { t[k] += r[k]; }));
  return t;
}

const MONTH_FMT = new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const fmtMonth = (ym: string) => {
  const d = new Date(`${ym}-01T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? ym : MONTH_FMT.format(d);
};

/** First and last day (YYYY-MM-DD) of a YYYY-MM month. */
export function monthRange(ym: string): { start: string; end: string } {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${ym}-01`, end: `${ym}-${String(last).padStart(2, '0')}` };
}

// Old report date formats: "dd MMMM yyyy" (Indonesian month names like the old GetBulan) and
// Rpt_Monthly's "dddd, dd - MMM - yyyy". Inputs are YYYY-MM-DD calendar days, so format them in UTC.
const LONG_DATE_FMT = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
const DAY_DATE_FMT = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const ymdToUtc = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
export const fmtLongDate = (ymd: string) => (ymd ? LONG_DATE_FMT.format(ymdToUtc(ymd)) : '');
export function fmtDayDate(ymd: string): string {
  if (!ymd) return '';
  const p = Object.fromEntries(DAY_DATE_FMT.formatToParts(ymdToUtc(ymd)).map((x) => [x.type, x.value]));
  return `${p.weekday}, ${p.day} - ${p.month} - ${p.year}`;
}

/** Consecutive-key groups in first-seen order; rows keep their order inside a group. */
function groupRows<T>(rows: T[], keyOf: (r: T) => string): { key: string; rows: T[] }[] {
  const map = new Map<string, T[]>();
  rows.forEach((r) => {
    const k = keyOf(r);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  });
  return Array.from(map, ([key, list]) => ({ key, rows: list }));
}

const sumAmount = (rows: NotaRow[]) => rows.reduce((s, r) => s + Number(r.amount || 0), 0);
const byText = (a: string, b: string) => a.localeCompare(b, 'id', { sensitivity: 'base' });

/**
 * Rpt_SalesDaily / Rpt_SalesDailyPerCashier: per day (or per cashier) and payment method, the notas in three
 * columns ("No. Nota | Pembelanjaan"), then "Total Transaksi [Name] :", "Total Harian :" and "Total Keseluruhan :".
 * The old report groups ascending by date (or cashier), then by payment name; the rows come sorted by date + nota no.
 */
function NotaSheet({ rows, perCashier, isDark }: { rows: NotaRow[]; perCashier: boolean; isDark: boolean }) {
  const c = lx(isDark);
  const outer = groupRows(rows, (r) => (perCashier ? r.cashier : r.date));
  if (perCashier) outer.sort((a, b) => byText(a.key, b.key));
  const colHead = (
    <div className={`grid grid-cols-[1fr_auto] gap-2 pl-4 font-bold border-b ${c.border}`}>
      <span>No. Nota</span>
      <span className="text-right">Pembelanjaan</span>
    </div>
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        {outer.map((g) => (
          <div key={g.key} className="nota-group flex flex-col gap-2" data-testid="nota-group">
            <div className="flex flex-wrap justify-between gap-x-6 font-bold text-[13px]">
              {perCashier ? (
                <>
                  <span>Kasir : {g.key}</span>
                  <span>Tanggal : {fmtLongDate(g.rows[0].date)}</span>
                </>
              ) : (
                <span>Tanggal : {fmtLongDate(g.key)}</span>
              )}
            </div>
            {groupRows(g.rows, (r) => r.paymentName)
              .sort((a, b) => byText(a.key, b.key))
              .map((m) => (
                <div key={m.key} className="flex flex-col gap-1" data-testid="nota-method">
                  <div className="font-bold">Metode Pembayaran : {m.key}</div>
                  <div className="grid grid-cols-3 gap-x-8 gap-y-0.5">
                    {colHead}{colHead}{colHead}
                    {m.rows.map((r) => (
                      <div key={r.id} className="grid grid-cols-[auto_1fr_auto] gap-2 min-w-0">
                        <span>-</span>
                        <span className="font-semibold truncate">{r.salesPosNo}</span>
                        <span className="text-right tabular-nums">{fmtN0(r.amount)}</span>
                      </div>
                    ))}
                  </div>
                  <div className={`flex justify-end gap-6 border-t pt-1 font-bold ${c.border}`}>
                    <span>Total Transaksi {m.key} :</span>
                    <span className="w-32 text-right tabular-nums">{fmtN0(sumAmount(m.rows))}</span>
                  </div>
                </div>
              ))}
            <div className="flex justify-end gap-6 font-bold text-[13px]">
              <span>Total Harian :</span>
              <span className="w-32 text-right tabular-nums" data-testid="nota-day-total">{fmtN0(sumAmount(g.rows))}</span>
            </div>
          </div>
        ))}
      </div>
      <div className={`flex justify-end gap-6 font-bold text-[13px] border-t-2 pt-1 ${c.border}`}>
        <span>Total Keseluruhan :</span>
        <span className="w-32 text-right tabular-nums" data-testid="nota-grand-total">{fmtN0(sumAmount(rows))}</span>
      </div>
    </div>
  );
}

export default function SalesReportManager({ isDark, canViewPrice = false }: SalesReportManagerProps) {
  const c = lx(isDark);
  const today = getTodayBangkok();

  const [active, setActive] = useState<ReportKey>('summary-month');

  // Parameter Filter (old Frm_Parameter): "1 Bulan" tab = month, "Tgl Awal Dan Akhir" tab = date range.
  // The inputs are drafts; the report only reloads on "OK", like the old window.
  const [monthDraft, setMonthDraft] = useState(today.slice(0, 7));
  const [startDraft, setStartDraft] = useState(`${today.slice(0, 7)}-01`);
  const [endDraft, setEndDraft] = useState(today);
  const [applied, setApplied] = useState({ month: today.slice(0, 7), start: `${today.slice(0, 7)}-01`, end: today });
  // "Laporan Harian Per Kasir" asks for one day only (old form hides Tgl. Akhir and defaults to today)
  const [dayDraft, setDayDraft] = useState(today);
  const [appliedDay, setAppliedDay] = useState(today);

  const [periodRows, setPeriodRows] = useState<PeriodRow[]>([]);
  const [itemRows, setItemRows] = useState<ItemReportRow[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryReportData | null>(null);
  const [notaRows, setNotaRows] = useState<NotaRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const usesMonth = active === 'summary-month';
  const usesDay = active === 'harian-kasir';
  const isNota = NOTA_REPORTS.includes(active);
  const period = usesMonth
    ? monthRange(applied.month)
    : usesDay ? { start: appliedDay, end: appliedDay } : { start: applied.start, end: applied.end };

  // Load only the report that is open; the API type follows the report
  useEffect(() => {
    let isMounted = true;
    const type = active === 'summary-month' || active === 'summary-custom' ? 'daily' : NOTA_REPORTS.includes(active) ? 'nota' : active;
    async function load() {
      setIsLoading(true);
      setLoadError('');
      try {
        const res = await fetch(`/api/reports/sales?type=${type}&startDate=${period.start}&endDate=${period.end}`);
        const json = await res.json();
        if (!isMounted) return;
        if (!json.success) {
          // Never leave the previous period's numbers under the new period line (they would also print)
          setPeriodRows([]);
          setItemRows([]);
          setSummaryData(null);
          setNotaRows([]);
          setLoadError(typeof json.error === 'string' ? json.error : json.error?.message || 'Gagal memuat laporan penjualan');
          return;
        }
        if (type === 'items') setItemRows(json.data || []);
        else if (type === 'summary') setSummaryData(json.data || null);
        else if (type === 'nota') setNotaRows(json.data || []);
        else setPeriodRows(json.data || []);
      } catch (err) {
        console.error('Failed to load sales report data:', err);
        if (isMounted) {
          setPeriodRows([]);
          setItemRows([]);
          setSummaryData(null);
          setNotaRows([]);
          setLoadError('Gagal memuat laporan penjualan');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [active, period.start, period.end, reloadKey]);

  const openReport = (key: ReportKey) => {
    if (key === active) return;
    // Clear the other report's rows so they never show under this report's columns
    setPeriodRows([]);
    setNotaRows([]);
    setActive(key);
  };

  const submitParams = () => {
    // OK always reloads, also when the period did not change (e.g. to see today's new sales)
    setReloadKey((k) => k + 1);
    if (usesMonth) {
      if (monthDraft) setApplied((a) => ({ ...a, month: monthDraft }));
    } else if (usesDay) {
      if (dayDraft) setAppliedDay(dayDraft);
    } else if (startDraft && endDraft) {
      // Swap a reversed range instead of asking the API for an empty one
      const [s, e] = startDraft <= endDraft ? [startDraft, endDraft] : [endDraft, startDraft];
      setApplied((a) => ({ ...a, start: s, end: e }));
    }
  };

  // Old report rows: one per day, oldest first (the API returns newest first)
  const dailyPayRows = useMemo(
    () => (active === 'summary-month' || active === 'summary-custom'
      ? periodRows.filter((r) => r.date).map((r) => toPayRow(r.date!, r)).sort((a, b) => a.key.localeCompare(b.key))
      : []),
    [periodRows, active],
  );
  const dailyTotals = useMemo(() => sumPay(dailyPayRows), [dailyPayRows]);

  const monthlyRows = useMemo(
    () => (active === 'monthly'
      ? periodRows.filter((r) => r.month).map((r) => ({ ...r, pay: toPayRow(r.month!, r) })).sort((a, b) => a.month!.localeCompare(b.month!))
      : []),
    [periodRows, active],
  );

  const navItems: { key: ReportKey; label: string }[] = [
    { key: 'summary-month', label: 'Laporan Summary' },
    // Old caption: "Laporan Summary Custom (On Progress)"; this report works, so the note is left out
    { key: 'summary-custom', label: 'Laporan Summary Custom' },
    { key: 'harian', label: 'Laporan Harian' },
    { key: 'harian-kasir', label: 'Laporan Harian Per Kasir' },
    { key: 'monthly', label: 'Laporan Bulanan' },
    { key: 'items', label: 'Per Barang' },
    { key: 'summary', label: canViewPrice ? 'Summary & Profit' : 'Summary' },
  ];
  const activeLabel = navItems.find((n) => n.key === active)!.label;
  // Rpt_SalesDaily writes the period with full month names (GetBulan)
  const periodLine = isNota
    ? `Periode : ${fmtLongDate(period.start)} s/d ${fmtLongDate(period.end)}`
    : `Periode : ${fmtDate(period.start)} s/d ${fmtDate(period.end)}`;

  // Columns of the old LAPORAN TOTAL PENJUALAN (Rpt_SalesMonthly / Rpt_SalesMonthlyCustom)
  const dailyColumns: LegacyColumn<PayRow>[] = [
    { key: 'key', caption: 'Tanggal', format: 'date', footer: '' },
    { key: 'tunai', caption: 'Tunai', format: 'n0', footer: fmtN0(dailyTotals.tunai) },
    { key: 'debit', caption: 'Debit', format: 'n0', footer: fmtN0(dailyTotals.debit) },
    { key: 'kredit', caption: 'Kredit', format: 'n0', footer: fmtN0(dailyTotals.kredit) },
    { key: 'qris', caption: 'Qris', format: 'n0', footer: fmtN0(dailyTotals.qris) },
    { key: 'lain', caption: 'Lain-lain', format: 'n0', footer: fmtN0(dailyTotals.lain) },
    { key: 'total', caption: 'Total Harian', format: 'n0', footer: fmtN0(dailyTotals.total) },
  ];

  // Extra ERP report: one row per month, same payment columns as the old report
  type MonthlyRow = (typeof monthlyRows)[number];
  const monthlyTotals = sumPay(monthlyRows.map((r) => r.pay));
  const monthlyColumns: LegacyColumn<MonthlyRow>[] = [
    { key: 'month', caption: 'Periode Bulan', render: (r) => fmtMonth(r.month!) },
    { key: 'totalOrders', caption: 'Jumlah Transaksi', format: 'n0', footer: fmtN0(monthlyRows.reduce((s, r) => s + Number(r.totalOrders || 0), 0)) },
    { key: 'totalItems', caption: 'Total Item Terjual', format: 'n0', footer: fmtN0(monthlyRows.reduce((s, r) => s + Number(r.totalItems || 0), 0)) },
    { key: 'grossSales', caption: 'Omset Bruto', format: 'n0', footer: fmtN0(monthlyRows.reduce((s, r) => s + Number(r.grossSales || 0), 0)) },
    { key: 'totalDiscount', caption: 'Total Diskon', format: 'n0', footer: fmtN0(monthlyRows.reduce((s, r) => s + Number(r.totalDiscount || 0), 0)) },
    { key: 'tunai', caption: 'Tunai', format: 'n0', render: (r) => fmtN0(r.pay.tunai), footer: fmtN0(monthlyTotals.tunai) },
    { key: 'debit', caption: 'Debit', format: 'n0', render: (r) => fmtN0(r.pay.debit), footer: fmtN0(monthlyTotals.debit) },
    { key: 'kredit', caption: 'Kredit', format: 'n0', render: (r) => fmtN0(r.pay.kredit), footer: fmtN0(monthlyTotals.kredit) },
    { key: 'qris', caption: 'Qris', format: 'n0', render: (r) => fmtN0(r.pay.qris), footer: fmtN0(monthlyTotals.qris) },
    { key: 'lain', caption: 'Lain-lain', format: 'n0', render: (r) => fmtN0(r.pay.lain), footer: fmtN0(monthlyTotals.lain) },
    { key: 'netSales', caption: 'Omset Bersih', format: 'n0', footer: fmtN0(monthlyRows.reduce((s, r) => s + Number(r.netSales || 0), 0)) },
  ];

  // Extra ERP report: sales per item; profit only for users who may see HPP (also masked by the API)
  const itemColumns: LegacyColumn<ItemReportRow>[] = [
    { key: 'barcode', caption: 'Barcode / Kode' },
    { key: 'inventoryName', caption: 'Nama Barang Persediaan' },
    { key: 'totalQtySold', caption: 'Total Qty Terjual', format: 'n0', footer: fmtN0(itemRows.reduce((s, r) => s + Number(r.totalQtySold || 0), 0)) },
    { key: 'avgUnitPrice', caption: 'Harga Jual Rata-rata', format: 'n0' },
    { key: 'totalRevenue', caption: 'Total Subtotal Revenue', format: 'n0', footer: fmtN0(itemRows.reduce((s, r) => s + Number(r.totalRevenue || 0), 0)) },
    ...(canViewPrice
      ? [{ key: 'profit', caption: 'Estimasi Profit', format: 'n0' as const, footer: fmtN0(itemRows.reduce((s, r) => s + Number(r.profit || 0), 0)) }]
      : []),
  ];

  // Label-value lines like the old report's footer block
  const totalLine = (label: string, value: React.ReactNode, strong = false) => (
    <div key={label} className={`flex justify-between gap-6 py-0.5 ${strong ? 'font-bold border-t pt-1 mt-0.5 ' + c.border : ''}`}>
      <span className="whitespace-pre">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );

  return (
    <LegacyWindow
      title="Laporan Penjualan"
      isDark={isDark}
      toolbar={
        <LegacyButton isDark={isDark} onClick={() => window.print()} icon={<Printer className="w-3.5 h-3.5" />}>Print</LegacyButton>
      }
    >
      {/* Print only the report sheet, on white paper */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          /* The dashboard's <main> is relative + overflow hidden: un-clip the sheet's ancestors so long reports print on every page */
          body *:has(#printable-sales-report) { position: static !important; overflow: visible !important; height: auto !important; }
          #printable-sales-report, #printable-sales-report * { visibility: visible !important; color: black !important; }
          #printable-sales-report {
            position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important;
            height: auto !important; overflow: visible !important; background: white !important; border: none !important;
          }
          #printable-sales-report .overflow-auto { overflow: visible !important; }
          #printable-sales-report thead, #printable-sales-report tfoot { position: static !important; }
          #printable-sales-report th, #printable-sales-report td { background: white !important; border-color: #94a3b8 !important; }
          /* Old daily reports start each day (or cashier) on a new page */
          #printable-sales-report .nota-group:not(:last-child) { break-after: page; }
        }
      `}</style>

      <div className="flex-1 min-h-0 flex gap-2">
        {/* Left NavBar, like Frm_SalesDashboard */}
        <GroupBox caption="Laporan Penjualan" isDark={isDark} className="w-48 shrink-0">
          <nav aria-label="Laporan Penjualan" className="flex flex-col gap-0.5">
            {navItems.map((item, i) => (
              <React.Fragment key={item.key}>
                {/* Old report items first; the ERP's extra reports follow below a divider */}
                {i === 4 && <div className={`my-1 border-t ${c.border}`} />}
                <button
                  type="button"
                  onClick={() => openReport(item.key)}
                  className={`text-left px-2 py-1 rounded cursor-pointer ${
                    active === item.key ? 'bg-blue-600 text-white font-semibold' : c.rowHover
                  }`}
                >
                  {item.label}
                </button>
              </React.Fragment>
            ))}
          </nav>
        </GroupBox>

        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-2">
          {/* Parameter Filter (old Frm_Parameter), inline */}
          <GroupBox caption={usesMonth ? '1 Bulan' : 'Tgl Awal Dan Akhir'} isDark={isDark}>
            <form
              className="flex flex-wrap items-center gap-3"
              onSubmit={(e) => { e.preventDefault(); submitParams(); }}
            >
              {usesMonth ? (
                <div className="w-56">
                  <FieldRow label="Bulan :" isDark={isDark} labelWidth="w-auto">
                    <LegacyInput isDark={isDark} type="month" value={monthDraft} onChange={(e) => setMonthDraft(e.target.value)} className={isDark ? '[color-scheme:dark]' : ''} />
                  </FieldRow>
                </div>
              ) : usesDay ? (
                <div className="w-56">
                  <FieldRow label="Tgl. Awal :" isDark={isDark} labelWidth="w-auto">
                    <LegacyInput isDark={isDark} type="date" value={dayDraft} onChange={(e) => setDayDraft(e.target.value)} className={isDark ? '[color-scheme:dark]' : ''} />
                  </FieldRow>
                </div>
              ) : (
                <>
                  <div className="w-56">
                    <FieldRow label="Tgl. Awal :" isDark={isDark} labelWidth="w-auto">
                      <LegacyInput isDark={isDark} type="date" value={startDraft} onChange={(e) => setStartDraft(e.target.value)} className={isDark ? '[color-scheme:dark]' : ''} />
                    </FieldRow>
                  </div>
                  <div className="w-56">
                    <FieldRow label="Tgl. Akhir :" isDark={isDark} labelWidth="w-auto">
                      <LegacyInput isDark={isDark} type="date" value={endDraft} onChange={(e) => setEndDraft(e.target.value)} className={isDark ? '[color-scheme:dark]' : ''} />
                    </FieldRow>
                  </div>
                </>
              )}
              <LegacyButton isDark={isDark} type="submit" variant="primary">OK</LegacyButton>
            </form>
          </GroupBox>

          {/* Report sheet: the part that prints */}
          <section id="printable-sales-report" className={`flex-1 min-h-0 flex flex-col gap-2 p-3 border rounded ${c.panel}`}>
            <div className="text-center">
              <div className="text-sm font-bold">
                {active === 'summary-month' || active === 'summary-custom'
                  ? 'LAPORAN TOTAL PENJUALAN'
                  : isNota ? 'LAPORAN PENJUALAN HARIAN' : `LAPORAN PENJUALAN - ${activeLabel.toUpperCase()}`}
              </div>
              <div className={c.muted}>{periodLine}</div>
            </div>

            {loadError && <div className="px-2 py-1 rounded bg-rose-500/15 text-rose-700 font-semibold">{loadError}</div>}

            {(active === 'summary-month' || active === 'summary-custom') && (
              <>
                <LegacyGrid
                  isDark={isDark}
                  columns={dailyColumns}
                  rows={dailyPayRows}
                  rowKey={(r) => r.key}
                  loading={isLoading}
                  emptyText="Tidak ada penjualan pada periode ini."
                  showFooter
                />
                {/* Footer block of the old report */}
                <div className="self-end w-72 text-xs">
                  {totalLine('Total Tunai :', fmtN0(dailyTotals.tunai))}
                  {totalLine('Total Debit :', fmtN0(dailyTotals.debit))}
                  {totalLine('Total Kartu Kredit :', fmtN0(dailyTotals.kredit))}
                  {totalLine('Total Qris :', fmtN0(dailyTotals.qris))}
                  {totalLine('Total Lain-lain :', fmtN0(dailyTotals.lain))}
                  {totalLine('Total Penjualan  :', fmtN0(dailyTotals.total), true)}
                </div>
              </>
            )}

            {isNota && (
              <div className="flex-1 min-h-0 overflow-auto">
                {isLoading ? (
                  <div className={`py-10 text-center ${c.muted}`}>Memuat data...</div>
                ) : notaRows.length === 0 ? (
                  !loadError && <div className={`py-10 text-center ${c.muted}`}>Tidak ada penjualan pada periode ini.</div>
                ) : (
                  <NotaSheet rows={notaRows} perCashier={active === 'harian-kasir'} isDark={isDark} />
                )}
              </div>
            )}

            {active === 'monthly' && (
              <LegacyGrid
                isDark={isDark}
                columns={monthlyColumns}
                rows={monthlyRows}
                rowKey={(r) => r.month!}
                loading={isLoading}
                emptyText="Tidak ada penjualan pada periode ini."
                showFooter
              />
            )}

            {active === 'items' && (
              <LegacyGrid
                isDark={isDark}
                columns={itemColumns}
                rows={itemRows}
                rowKey={(r) => r.inventoryId ?? `${r.barcode}|${r.inventoryName}`}
                loading={isLoading}
                emptyText="Tidak ada penjualan pada periode ini."
                showFooter
              />
            )}

            {active === 'summary' && (
              isLoading ? (
                <div className={`py-10 text-center ${c.muted}`}>Memuat data...</div>
              ) : summaryData && (
                <div className={`grid gap-4 ${canViewPrice ? 'md:grid-cols-2' : ''}`}>
                  <GroupBox caption="Ringkasan Penjualan & Diskon" isDark={isDark}>
                    {totalLine('Total Transaksi POS:', fmtN0(summaryData.totalOrders))}
                    {totalLine('Total Qty Item Terjual:', fmtN0(summaryData.totalItemsSold))}
                    {totalLine('Total Penjualan Kotor (Gross):', fmtN0(summaryData.grossSales))}
                    {totalLine('Total Potongan / Diskon Promo:', fmtN0(summaryData.totalDiscount))}
                    {totalLine('Total Omset Bersih (Net Revenue):', fmtN0(summaryData.netSales), true)}
                  </GroupBox>
                  {/* HPP and profit: Admin only (the API masks them for everyone else) */}
                  {canViewPrice && (
                    <GroupBox caption="Estimasi Margin & Keuntungan" isDark={isDark}>
                      {totalLine('Total Omset Bersih:', fmtN0(summaryData.netSales))}
                      {totalLine('Total Harga Pokok Penjualan (HPP):', fmtN0(summaryData.totalCost))}
                      {totalLine('Laba Bersih (Estimasi Net Profit):', fmtN0(summaryData.profit), true)}
                      {totalLine('Persentase Margin Profit:', `${summaryData.profitMarginPct}%`)}
                    </GroupBox>
                  )}
                </div>
              )
            )}
          </section>
        </div>
      </div>
    </LegacyWindow>
  );
}

/**
 * Admin Bill Opname "Laporan Bulanan" / "Laporan Harian" (old Admin.Rpt_Monthly, SP sp_BOReport_Monthly mode 0 / 1):
 * per day "Tanggal : dddd, dd - MMM - yyyy", the notas' payment time and amount in three "Jam | Nominal" columns,
 * then "Total :". Monthly = every day of the date's month, daily = that date. Opens over Sales Monitoring like the
 * old print preview; each day prints on its own page.
 */
export function BillOpnameReport({ isDark, mode, date, onClose }: {
  isDark: boolean;
  mode: 'monthly' | 'daily';
  date: string;
  onClose: () => void;
}) {
  const c = lx(isDark);
  const [rows, setRows] = useState<NotaRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const range = mode === 'monthly' ? monthRange(date.slice(0, 7)) : { start: date, end: date };
  const title = mode === 'monthly' ? 'Laporan Bulanan' : 'Laporan Harian';

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/reports/sales?type=nota&startDate=${range.start}&endDate=${range.end}`);
        const json = await res.json();
        if (!isMounted) return;
        if (json.success) setRows(json.data || []);
        else setLoadError(typeof json.error === 'string' ? json.error : json.error?.message || 'Gagal memuat laporan');
      } catch {
        if (isMounted) setLoadError('Gagal memuat laporan');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [range.start, range.end]);

  const days = useMemo(() => groupRows(rows, (r) => r.date), [rows]);
  const colHead = (
    <div className={`grid grid-cols-2 font-mono font-bold text-center border-b ${c.border}`}>
      <span>Jam</span>
      <span>Nominal</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" role="dialog" aria-modal="true" aria-label={title}>
      {/* Print only the report sheet; the receipt print rules are scoped to .receipt-paper and stay out of this */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          /* Un-clip the dialog and the dashboard around it, so every day prints, not only the first screen */
          body *:has(#printable-bill-report) { position: static !important; overflow: visible !important; height: auto !important; max-height: none !important; }
          /* Drop the hidden Bill Opname grid behind the dialog, or its rows feed blank pages */
          body *:not(:has(#printable-bill-report)):not(#printable-bill-report):not(#printable-bill-report *) { display: none !important; }
          #printable-bill-report, #printable-bill-report * { visibility: visible !important; color: black !important; }
          #printable-bill-report {
            position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important;
            height: auto !important; max-height: none !important; overflow: visible !important; background: white !important; border: none !important;
          }
          #printable-bill-report .bill-day:not(:last-child) { break-after: page; }
        }
      `}</style>
      <div className={`w-full max-w-4xl max-h-[90vh] flex flex-col border rounded shadow-xl text-xs ${c.panel}`}>
        <div className={`px-3 py-1.5 border-b flex items-center gap-2 ${c.bar}`}>
          <span className="font-bold text-[13px]">{title}</span>
          <span className={c.muted}>{mode === 'monthly' ? fmtMonth(date.slice(0, 7)) : fmtDate(date)}</span>
          <div className="ml-auto flex gap-2">
            <LegacyButton isDark={isDark} onClick={() => window.print()} disabled={isLoading || rows.length === 0} icon={<Printer className="w-3.5 h-3.5" />}>Print</LegacyButton>
            <LegacyButton isDark={isDark} onClick={onClose}>Tutup</LegacyButton>
          </div>
        </div>
        <div id="printable-bill-report" className="flex-1 min-h-0 overflow-auto p-4">
          {loadError && <div className="px-2 py-1 rounded bg-rose-500/15 text-rose-700 font-semibold">{loadError}</div>}
          {isLoading ? (
            <div className={`py-10 text-center ${c.muted}`}>Memuat data...</div>
          ) : days.length === 0 ? (
            !loadError && <div className={`py-10 text-center ${c.muted}`}>Tidak ada penjualan pada periode ini.</div>
          ) : (
            <div className="flex flex-col gap-6">
              {days.map((d) => (
                <div key={d.key} className="bill-day flex flex-col gap-1" data-testid="bill-day">
                  <div className="text-base">Tanggal : {fmtDayDate(d.key)}</div>
                  <div className="grid grid-cols-3 gap-x-8 gap-y-0.5 font-mono">
                    {colHead}{colHead}{colHead}
                    {d.rows.map((r) => (
                      <div key={r.id} className="grid grid-cols-2 tabular-nums">
                        <span>{r.time}</span>
                        <span className="text-right">{fmtN0(r.amount)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-6 text-base">
                    <span>Total :</span>
                    <span className="w-36 text-right font-bold tabular-nums" data-testid="bill-day-total">{fmtN0(sumAmount(d.rows))}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

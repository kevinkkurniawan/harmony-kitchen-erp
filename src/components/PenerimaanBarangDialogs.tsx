'use client';

import React, { useEffect, useState } from 'react';
import { Printer, RefreshCw, X } from 'lucide-react';
import type { Supplier } from '@/types/erp';
import { LegacyButton, LegacyInput, FieldRow, fmtN0, lx } from '@/components/legacy';

// Pop-ups shared by "Penerimaan Barang Ekspress" and "Penerimaan Barang dengan harga" (old separate windows).

const MASK = '••••••';
const money = (v: number | null | undefined) => (v == null ? MASK : fmtN0(v));

/** Modal window frame with the old window title; Escape closes it. */
function LegacyDialog({ title, isDark, onClose, width = 'max-w-lg', children }: {
  title: string;
  isDark: boolean;
  onClose: () => void;
  width?: string;
  children: React.ReactNode;
}) {
  const c = lx(isDark);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" role="dialog" aria-label={title}>
      <div className={`w-full ${width} max-h-[90vh] flex flex-col rounded border shadow-2xl text-xs ${c.panel}`}>
        <div className={`px-3 py-1.5 border-b flex items-center justify-between gap-2 font-bold text-[13px] print:hidden ${c.bar}`}>
          <span>{title}</span>
          <LegacyButton isDark={isDark} onClick={onClose} aria-label="Tutup" icon={<X className="w-3.5 h-3.5" />} />
        </div>
        <div className="flex-1 min-h-0 overflow-auto p-3 flex flex-col gap-2">{children}</div>
      </div>
    </div>
  );
}

/** Next "S00000" code, the rule Master Supplier uses for a new supplier. */
function nextSupplierNo(all: Supplier[]): string {
  const max = all.reduce((m, s) => {
    const digits = (s.supplierNo || '').match(/\d+/);
    return Math.max(m, digits ? parseInt(digits[0], 10) : 0, Number(s.id) || 0);
  }, 0);
  return `S${String(max + 1).padStart(5, '0')}`;
}

/**
 * Old Frm_InputSupplier ("Input Supplier"): quick-add a supplier from the receipt screen.
 * "AUTO" in Sup. Code gets the next code; Alamat / No. Telp / No. HP start as "-" like the old form.
 */
export function InputSupplierDialog({ isDark, onClose, onSaved, onError }: {
  isDark: boolean;
  onClose: () => void;
  onSaved: (supplier: Supplier) => void;
  onError: (message: string) => void;
}) {
  const [form, setForm] = useState({ supplierNo: 'AUTO', supplierName: '', address: '-', city: '', phone1: '-', phone2: '-' });
  const [isSaving, setIsSaving] = useState(false);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    if (!form.supplierNo.trim() || !form.supplierName.trim()) {
      onError('Sup. Code dan Sup. Name wajib diisi');
      return;
    }
    setIsSaving(true);
    try {
      let supplierNo = form.supplierNo.trim();
      if (supplierNo.toUpperCase() === 'AUTO') {
        const res = await fetch('/api/suppliers?all=true');
        const json = await res.json();
        supplierNo = nextSupplierNo(json.success && Array.isArray(json.data) ? json.data : []);
      }
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, supplierNo, supplierName: form.supplierName.trim(), isActive: true }),
      });
      const json = await res.json();
      if (!json.success) {
        onError(`Error On Save Data: ${typeof json.error === 'string' ? json.error : json.error?.message || res.status}`);
        return;
      }
      onSaved(json.data);
    } catch (err) {
      onError(`Error On Save Data: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <LegacyDialog title="Input Supplier" isDark={isDark} onClose={onClose} width="max-w-2xl">
      <FieldRow label="Sup. Code :" isDark={isDark} labelWidth="w-24">
        <LegacyInput isDark={isDark} value={form.supplierNo} onChange={set('supplierNo')} />
      </FieldRow>
      <FieldRow label="Sup. Name :" isDark={isDark} labelWidth="w-24">
        <LegacyInput isDark={isDark} value={form.supplierName} onChange={set('supplierName')} autoFocus />
      </FieldRow>
      <FieldRow label="Alamat :" isDark={isDark} labelWidth="w-24">
        <LegacyInput isDark={isDark} value={form.address} onChange={set('address')} />
      </FieldRow>
      <FieldRow label="Kota :" isDark={isDark} labelWidth="w-24">
        <LegacyInput isDark={isDark} value={form.city} onChange={set('city')} />
      </FieldRow>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <FieldRow label="No. Telp :" isDark={isDark} labelWidth="w-24">
          <LegacyInput isDark={isDark} value={form.phone1} onChange={set('phone1')} />
        </FieldRow>
        <FieldRow label="No. HP :" isDark={isDark} labelWidth="w-24">
          <LegacyInput isDark={isDark} value={form.phone2} onChange={set('phone2')} />
        </FieldRow>
      </div>
      <div className="flex items-center justify-between gap-2 pt-1">
        <LegacyButton isDark={isDark} onClick={onClose}>Cancel</LegacyButton>
        <LegacyButton isDark={isDark} variant="primary" onClick={submit} disabled={isSaving}>{isSaving ? 'Menyimpan...' : 'Submit'}</LegacyButton>
      </div>
    </LegacyDialog>
  );
}

/** Old DevExpress ToggleSwitch: the switch plus its current text ("Belum Terbayar" off / "Terbayar" on). */
export function PaidToggle({ isDark, checked, onChange }: { isDark: boolean; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="Terbayar"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-1.5 shrink-0 cursor-pointer"
    >
      <span className={`relative w-8 h-4 rounded-full border transition-colors ${checked ? 'bg-blue-600 border-blue-700' : isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-300 border-slate-400'}`}>
        <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow transition-all ${checked ? 'left-[1.15rem]' : 'left-0.5'}`} />
      </span>
      <span className="w-24 text-left">{checked ? 'Terbayar' : 'Belum Terbayar'}</span>
    </button>
  );
}

export interface DailyReportLine {
  id: number;
  inventoryName: string;
  qty: number;
  price: number | null;
  discTotal: number | null;
  subtotal: number | null;
}

export interface DailyReportReceipt {
  id: number;
  mrNo: string;
  description: string;
  supplierName: string;
  isCash: boolean;
  isPaid: boolean;
  disc1: number;
  disc2: number;
  disc3: number;
  discValue: number | null;
  ppnPercentage: number;
  ppnValue: number | null;
  grandTotal: number | null;
  items: DailyReportLine[];
}

const pct1 = (v: number) => `${v.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const sumOrNull = (values: (number | null)[]) => (values.some((v) => v == null) ? null : values.reduce<number>((s, v) => s + (v as number), 0));
const longDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * "Daily Report": the receipts of one MR date as the old print preview.
 * variant "summary" = Rpt_PReceivement_Summary (dengan harga: per payment type, discounts, PPn, cash / owed totals);
 * variant "cashier" = Rpt_PReceivement_SummaryCashier (Ekspress: per receipt, Nama Barang | Qty | Harga | Sub Total).
 */
export function DailyReportDialog({ isDark, date, variant, onClose }: {
  isDark: boolean;
  date: string;
  variant: 'summary' | 'cashier';
  onClose: () => void;
}) {
  // Opens on today like the old report (it ignored the list dates); "Tanggal :" picks another day
  const [day, setDay] = useState(date);
  const [receipts, setReceipts] = useState<DailyReportReceipt[] | null>(null);
  const [error, setError] = useState('');
  const changeDay = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value === day) return;
    setReceipts(null);
    setError('');
    setDay(value);
  };

  useEffect(() => {
    let alive = true;
    fetch(`/api/purchasing/daily-report?date=${encodeURIComponent(day)}`)
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return;
        if (json.success) setReceipts(json.data.receipts);
        else setError(json.error?.message || 'Gagal memuat laporan');
      })
      .catch(() => alive && setError('Gagal memuat laporan'));
    return () => { alive = false; };
  }, [day]);

  // Old report: cash receipts (PaymentType 0) first, then credit; inside a group by MR No
  const groups = receipts
    ? [true, false].map((isCash) => ({ isCash, rows: receipts.filter((r) => r.isCash === isCash) })).filter((g) => g.rows.length > 0)
    : [];
  const cashTotal = receipts ? sumOrNull(receipts.filter((r) => r.isCash).map((r) => r.grandTotal)) : 0;
  const creditTotal = receipts ? sumOrNull(receipts.filter((r) => !r.isCash).map((r) => r.grandTotal)) : 0;
  const allTotal = cashTotal == null || creditTotal == null ? null : cashTotal + creditTotal;
  const td = 'px-1.5 py-0.5';
  const num = `${td} text-right tabular-nums`;

  return (
    <LegacyDialog title="Daily Report" isDark={isDark} onClose={onClose} width="max-w-5xl">
      <div className="flex items-center justify-end gap-2 print:hidden">
        <label className="flex items-center gap-1.5">
          <span>Tanggal :</span>
          <LegacyInput isDark={isDark} type="date" aria-label="Tanggal Daily Report" className="w-40" value={day} onChange={(e) => changeDay(e.target.value)} />
        </label>
        <LegacyButton isDark={isDark} variant="primary" onClick={() => window.print()} disabled={!receipts} icon={<Printer className="w-3.5 h-3.5" />}>
          Cetak
        </LegacyButton>
      </div>
      <div className="printable-daily-report bg-white text-slate-900 p-4 rounded border border-slate-300 flex flex-col gap-3">
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            .printable-daily-report, .printable-daily-report * { visibility: visible !important; color: black !important; }
            .printable-daily-report { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; border: none !important; }
          }
        `}</style>
        <div className={variant === 'cashier' ? 'text-right' : ''}>
          <div className="text-base font-bold">{variant === 'cashier' ? 'Laporan Penerimaan Barang' : 'Laporan Harian Penerimaan Barang'}</div>
          <div className="text-[11px]">{longDate(day)}</div>
        </div>

        {!receipts && !error && (
          <div className="flex items-center gap-2 text-slate-500"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Memuat data...</div>
        )}
        {error && <div className="text-rose-700 font-semibold">{error}</div>}
        {receipts && receipts.length === 0 && <div className="text-slate-500">Tidak ada penerimaan pada tanggal ini.</div>}

        {receipts && variant === 'cashier' && receipts.map((r) => (
          <div key={r.id} data-mrno={r.mrNo} className="border-t border-slate-400 pt-2">
            <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-3 font-semibold">
              <span>No. Penerimaan :</span><span>{r.mrNo}</span>
              <span>Supplier :</span><span>{r.supplierName}</span>
            </div>
            <table className="w-full mt-2 border-collapse">
              <thead>
                <tr className="font-bold border-b border-slate-300">
                  <th className={`${td} text-left`}>Nama Barang</th>
                  <th className={`${td} text-right`}>Qty</th>
                  <th className={`${td} text-right`}>Harga</th>
                  <th className={`${td} text-right`}>Sub Total</th>
                </tr>
              </thead>
              <tbody>
                {r.items.map((it) => (
                  <tr key={it.id}>
                    <td className={td}>{it.inventoryName}</td>
                    <td className={num}>{fmtN0(it.qty)}</td>
                    <td className={num}>{money(it.price)}</td>
                    <td className={num}>{money(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right font-bold text-sm pt-1">{money(r.grandTotal)}</div>
          </div>
        ))}

        {receipts && variant === 'summary' && groups.map((g) => {
          const groupTotal = sumOrNull(g.rows.map((r) => r.grandTotal));
          return (
            <div key={String(g.isCash)} className="flex flex-col gap-2">
              <div className="text-right font-bold">{g.isCash ? 'Pembayaran Tunai' : 'Pembayaran Kredit'}</div>
              {g.rows.map((r) => (
                <div key={r.id} data-mrno={r.mrNo}>
                  <div className="grid grid-cols-[1fr_2fr_1fr] gap-x-3 font-semibold">
                    <span>{r.mrNo}</span><span>{r.description}</span><span className="text-right">{r.supplierName}</span>
                  </div>
                  <table className="w-full border-collapse">
                    <tbody>
                      {r.items.map((it) => (
                        <tr key={it.id}>
                          <td className={`${td} w-4`}>-</td>
                          <td className={td}>{it.inventoryName}</td>
                          <td className={num}>{fmtN0(it.qty)}</td>
                          <td className={num}>{money(it.price)}</td>
                          <td className={num}>{money(it.discTotal)}</td>
                          <td className={num}>{money(it.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex items-end justify-between gap-4 border-b border-slate-400 pb-1">
                    <div className="grid grid-cols-[auto_auto_auto_auto_auto_auto] gap-x-3 gap-y-0.5 tabular-nums">
                      <span className="font-semibold">Disc :</span><span>{pct1(r.disc1)}</span><span>{pct1(r.disc2)}</span><span>{pct1(r.disc3)}</span>
                      <span className="text-right">{money(r.discValue)}</span><span>{r.isPaid ? 'Lunas' : 'Belum Lunas'}</span>
                      <span className="font-semibold">PPn :</span><span>{pct1(r.ppnPercentage)}</span><span /><span />
                      <span className="text-right">{money(r.ppnValue)}</span><span />
                    </div>
                    <div className="font-bold text-sm tabular-nums">{money(r.grandTotal)}</div>
                  </div>
                </div>
              ))}
              <div className="flex justify-end gap-6 font-bold">
                <span>Total Transaksi :</span><span className="tabular-nums">{money(groupTotal)}</span>
              </div>
            </div>
          );
        })}

        {receipts && variant === 'summary' && receipts.length > 0 && (
          <div className="grid grid-cols-[auto_auto] justify-start gap-x-6 gap-y-1 pt-2 font-bold text-sm tabular-nums">
            <span>Total Transaksi :</span><span className="text-right">{money(allTotal)}</span>
            <span>Total Pembayaran Cash :</span><span className="text-right">{money(cashTotal)}</span>
            <span>Total Terhutang :</span><span className="text-right">{money(creditTotal)}</span>
          </div>
        )}
      </div>
    </LegacyDialog>
  );
}

/**
 * Old PopUp_CashPayment: shows the receipt and its "Saldo Terhutang", "Proses" pays it in cash.
 * The old "Sumber Dana :" lookup is left out: it was never saved and no column can hold it.
 */
export function CashPaymentDialog({ isDark, receiptId, mrNo, mrDate, supplierName, balance, onClose, onPaid, onError }: {
  isDark: boolean;
  receiptId: number;
  mrNo: string;
  mrDate: string;
  supplierName: string;
  /** null when the user may not see purchase amounts */
  balance: number | null;
  onClose: () => void;
  onPaid: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const process = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/purchasing/priced/${receiptId}/cash-payment`, { method: 'POST' });
      const json = await res.json();
      if (json.success) onPaid(json.message || 'Transaksi telah berhasil dilunasi');
      else onError(json.error?.message || (typeof json.error === 'string' ? json.error : 'Gagal memproses pembayaran'));
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <LegacyDialog title="PopUp_CashPayment" isDark={isDark} onClose={onClose}>
      <FieldRow label="Total Transaksi :" isDark={isDark} labelWidth="w-32">
        <LegacyInput isDark={isDark} readOnly value={money(balance)} className="text-right tabular-nums text-sm font-bold" />
      </FieldRow>
      <FieldRow label="Supplier :" isDark={isDark} labelWidth="w-32">
        <LegacyInput isDark={isDark} readOnly value={supplierName} />
      </FieldRow>
      <FieldRow label="No. Penerimaan :" isDark={isDark} labelWidth="w-32">
        <LegacyInput isDark={isDark} readOnly value={mrNo} className="font-mono" />
      </FieldRow>
      <FieldRow label="Tgl. Penerimaan :" isDark={isDark} labelWidth="w-32">
        <LegacyInput isDark={isDark} readOnly value={mrDate} />
      </FieldRow>
      <div className="flex flex-col gap-2 pt-1">
        <LegacyButton isDark={isDark} onClick={onClose}>Batal</LegacyButton>
        <LegacyButton isDark={isDark} variant="primary" onClick={process} disabled={isSaving}>{isSaving ? 'Memproses...' : 'Proses'}</LegacyButton>
      </div>
    </LegacyDialog>
  );
}

interface StockRow {
  id: string;
  barcode: string;
  inventoryName: string;
  stock: number;
}

/** "Lihat Stok": current stock of the receipt's items (columns as the old stock check window: Barcode | Nama Barang | Stok). */
export function StockDialog({ isDark, inventoryIds, onClose }: { isDark: boolean; inventoryIds: string[]; onClose: () => void }) {
  const c = lx(isDark);
  const [rows, setRows] = useState<StockRow[] | null>(null);
  const [error, setError] = useState('');
  const key = inventoryIds.join(',');
  useEffect(() => {
    let alive = true;
    fetch(`/api/purchasing/stock?ids=${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return;
        if (!json.success) return setError(json.error?.message || 'Gagal memuat stok');
        // Keep the receipt's line order
        const byId = new Map<string, StockRow>(json.data.map((r: StockRow) => [r.id, r]));
        setRows(key.split(',').map((id) => byId.get(id)).filter((r): r is StockRow => Boolean(r)));
      })
      .catch(() => alive && setError('Gagal memuat stok'));
    return () => { alive = false; };
  }, [key]);
  return (
    <LegacyDialog title="Lihat Stok" isDark={isDark} onClose={onClose} width="max-w-2xl">
      {error && <div className="text-rose-600 font-semibold">{error}</div>}
      {!rows && !error && <div className={`flex items-center gap-2 ${c.muted}`}><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Memuat data...</div>}
      {rows && (
        <table className={`w-full border-collapse border ${c.border}`}>
          <thead className={c.head}>
            <tr>
              <th className={`px-2 py-1 text-left border ${c.border}`}>Barcode</th>
              <th className={`px-2 py-1 text-left border ${c.border}`}>Nama Barang</th>
              <th className={`px-2 py-1 text-right border ${c.border}`}>Stok</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={`px-2 py-1 border font-mono ${c.border}`}>{r.barcode || '-'}</td>
                <td className={`px-2 py-1 border ${c.border}`}>{r.inventoryName}</td>
                <td className={`px-2 py-1 border text-right tabular-nums font-semibold ${c.border} ${r.stock < 0 ? 'text-rose-600' : ''}`}>{fmtN0(r.stock)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} className={`px-2 py-3 text-center ${c.muted}`}>Tidak ada barang.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </LegacyDialog>
  );
}

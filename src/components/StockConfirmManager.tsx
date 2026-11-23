'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle, RefreshCw, XCircle } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { findExactScanMatch } from '@/lib/inventory-lookup';
import { LegacyWindow, LegacyButton, GroupBox, FieldRow, LegacyInput, LegacyGrid, lx, fmtDate, type LegacyColumn } from '@/components/legacy';

interface ConfirmItem {
  id: number;
  barcode: string;
  inventoryNo: string;
  inventoryName: string;
  lastSync: string | null;
}

interface ConfirmLogRow {
  id: string;
  time: string;
  user: string;
  barcode: string;
  inventoryNo: string;
  inventoryName: string;
  countedQty: number;
  systemQty: number | null;
  match: boolean;
}

const TIME = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });

const errorText = (json: { error?: { message?: string }; message?: string } | null, fallback: string) => json?.error?.message || json?.message || fallback;

/**
 * Konfirmasi Stok (client, 23 Nov): staff count an item without seeing the system stock; the confirm is accepted
 * only when the count equals it. A mismatch is refused ("hubungi admin") and shows up in the Admin's list.
 */
export default function StockConfirmManager({ isDark, isAdmin }: { isDark: boolean; isAdmin: boolean }) {
  const c = lx(isDark);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState<ConfirmItem[]>([]);
  const [selected, setSelected] = useState<ConfirmItem | null>(null);
  const [qty, setQty] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [log, setLog] = useState<ConfirmLogRow[]>([]);
  const [logLoading, setLogLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const searchReqRef = useRef(0);

  const search = useCallback(async (q: string): Promise<ConfirmItem[]> => {
    const json = await fetch(`/api/inventory/stock-confirm?q=${encodeURIComponent(q.trim())}`).then((r) => r.json()).catch(() => null);
    return json?.success && Array.isArray(json.data) ? json.data : [];
  }, []);

  const fetchLog = useCallback(async (): Promise<ConfirmLogRow[]> => {
    const json = await fetch('/api/inventory/stock-confirm?log=1').then((r) => r.json()).catch(() => null);
    return json?.success && Array.isArray(json.data) ? json.data : [];
  }, []);

  const loadLog = useCallback(() => {
    setLogLoading(true);
    fetchLog().then((rows) => { setLog(rows); setLogLoading(false); });
  }, [fetchLog]);

  useEffect(() => {
    fetchLog().then((rows) => { setLog(rows); setLogLoading(false); });
  }, [fetchLog]);

  // Typed search; an older answer must not replace a newer one (an emptied box is cleared in onChange)
  useEffect(() => {
    if (!debouncedQuery.trim()) return;
    const req = ++searchReqRef.current;
    search(debouncedQuery).then((items) => { if (req === searchReqRef.current) setResults(items); });
  }, [debouncedQuery, search]);

  const pick = (item: ConfirmItem) => {
    searchReqRef.current++;
    setSelected(item);
    setQuery('');
    setResults([]);
    setQty('');
    setResult(null);
    setTimeout(() => qtyRef.current?.focus(), 0);
  };

  // Scanners press Enter before the debounce fires: look the value up at once and take the exact match
  const onSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setResults([]); return; }
    if (e.key !== 'Enter' || !query.trim()) return;
    e.preventDefault();
    const raw = query.trim();
    const req = ++searchReqRef.current;
    const items = await search(raw);
    if (req !== searchReqRef.current) return;
    const hit = findExactScanMatch(items, raw) || (items.length === 1 ? items[0] : undefined);
    if (hit) pick(hit);
    else if (items.length === 0) setResult({ ok: false, text: `Barang tidak ditemukan: ${raw}` });
    else setResults(items);
  };

  const confirm = async () => {
    if (!selected || busy) return;
    if (!/^\d+$/.test(qty.trim())) {
      setResult({ ok: false, text: 'Isi Qty Hitung dengan angka bulat.' });
      return;
    }
    setBusy(true);
    const res = await fetch('/api/inventory/stock-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inventoryId: selected.id, qty: Number(qty.trim()) }),
    }).catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    setBusy(false);
    if (json?.success) {
      setResult({ ok: true, text: `${selected.inventoryName}: stok sesuai, berhasil dikonfirmasi.` });
      setSelected(null);
      setQty('');
      setTimeout(() => searchRef.current?.focus(), 0);
    } else {
      setResult({ ok: false, text: `${selected.inventoryName}: ${errorText(json, 'Gagal konfirmasi stok.')}` });
    }
    loadLog();
  };

  const columns: LegacyColumn<ConfirmLogRow>[] = [
    { key: 'time', caption: 'Jam', render: (r) => TIME.format(new Date(r.time)), width: 52 },
    ...(isAdmin ? [{ key: 'user', caption: 'User', width: 70 }] : []),
    // Barcode under the name and long names wrap, so every column fits on a tablet
    {
      key: 'inventoryName', caption: 'Nama Barang',
      render: (r) => (
        <div className="whitespace-normal">
          <div>{r.inventoryName}</div>
          <div className={c.muted}>{r.barcode || r.inventoryNo}</div>
        </div>
      ),
    },
    { key: 'countedQty', caption: 'Qty Hitung', format: 'n0', width: 72 },
    ...(isAdmin ? [{ key: 'systemQty', caption: 'Stok Sistem', format: 'n0' as const, width: 80 }] : []),
    {
      key: 'match', caption: 'Hasil', width: 88,
      render: (r) => (r.match
        ? <span className="text-emerald-600 font-semibold">Sesuai</span>
        : <span className="text-rose-600 font-semibold">Tidak Sama</span>),
    },
  ];
  const mismatches = log.filter((r) => !r.match).length;

  return (
    <LegacyWindow
      title="Konfirmasi Stok"
      isDark={isDark}
      status={`Hari ini: ${log.length} konfirmasi, ${mismatches} tidak sama`}
    >
      <GroupBox caption=".:: Hitung Barang ::." isDark={isDark} className="flex-none">
        <div className="relative max-w-xl">
          <FieldRow label="Scan / Cari :" isDark={isDark} labelWidth="w-24">
            <LegacyInput
              ref={searchRef}
              isDark={isDark}
              autoFocus
              value={query}
              placeholder="Scan barcode atau ketik nama barang"
              onChange={(e) => {
                setQuery(e.target.value);
                if (!e.target.value.trim()) { searchReqRef.current++; setResults([]); }
              }}
              onKeyDown={onSearchKeyDown}
            />
          </FieldRow>
          {results.length > 0 && (
            <ul className={`absolute left-26 right-0 z-30 mt-1 max-h-64 overflow-auto border rounded shadow ${c.panel}`}>
              {results.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => pick(item)} className={`w-full px-2 py-1 text-left cursor-pointer ${c.rowHover}`}>
                    <span className="font-semibold">{item.inventoryName}</span>
                    <span className={`ml-2 ${c.muted}`}>{item.barcode || item.inventoryNo}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected && (
          <div className="max-w-xl flex flex-col gap-2">
            <FieldRow label="Barang :" isDark={isDark} labelWidth="w-24">
              <span className="font-semibold break-words">{selected.inventoryName}</span>
            </FieldRow>
            <FieldRow label="Barcode :" isDark={isDark} labelWidth="w-24">
              <span>{selected.barcode || selected.inventoryNo}</span>
              <span className={`ml-auto ${c.muted}`}>Last Sync: {selected.lastSync ? fmtDate(selected.lastSync) : '-'}</span>
            </FieldRow>
            <FieldRow label="Qty Hitung :" isDark={isDark} labelWidth="w-24">
              <LegacyInput
                ref={qtyRef}
                isDark={isDark}
                inputMode="numeric"
                aria-label="Qty Hitung"
                className="w-28"
                value={qty}
                onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirm(); } }}
              />
              <LegacyButton isDark={isDark} variant="primary" icon={<CheckCircle className="w-3.5 h-3.5" />} disabled={busy || !qty} onClick={confirm}>
                Konfirmasi
              </LegacyButton>
              <LegacyButton isDark={isDark} disabled={busy} onClick={() => { setSelected(null); setQty(''); searchRef.current?.focus(); }}>
                Batal
              </LegacyButton>
            </FieldRow>
          </div>
        )}

        {result && (
          <div
            role="status"
            className={`max-w-xl px-2 py-1.5 rounded border flex items-start gap-1.5 font-semibold ${result.ok
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200'
              : 'border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200'}`}
          >
            {result.ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
            <span>{result.text}</span>
          </div>
        )}
      </GroupBox>

      <GroupBox
        caption={isAdmin ? '.:: Konfirmasi Hari Ini (semua user) ::.' : '.:: Konfirmasi Saya Hari Ini ::.'}
        isDark={isDark}
        className="flex-1"
        actions={<LegacyButton isDark={isDark} icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={loadLog}>Refresh</LegacyButton>}
      >
        <LegacyGrid
          isDark={isDark}
          columns={columns}
          rows={log}
          rowKey={(r) => r.id}
          loading={logLoading}
          emptyText="Belum ada konfirmasi hari ini."
          rowClassName={(r) => (r.match ? '' : isDark ? 'bg-rose-950/40' : 'bg-rose-50')}
        />
      </GroupBox>
    </LegacyWindow>
  );
}

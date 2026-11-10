'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Plus, Edit, Trash2, CheckCircle, XCircle, AlertTriangle, Zap, ArrowLeft, Save } from 'lucide-react';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import {
  LegacyWindow, LegacyButton, GroupBox, FieldRow, LegacyInput, LegacyGrid, ContextMenu, menuAt, lx, fmtN0,
  type LegacyColumn, type ContextMenuState,
} from '@/components/legacy';

/** One m_promo row as returned by GET /api/promos/items. */
export interface PromoRow {
  id: string;
  promoName: string;
  promoBundle: number;
  /** Grosir tier 1/2/3 (m_promo.promogrosir) */
  promoGrosir: number;
  qtyMin: number;
  qtyMax: number;
  isPartial: boolean;
  /** true = global promo (Promo Global grid), false = per-item quantity promo */
  isGroup: boolean;
  description: string | null;
  discountPct: number;
  isActive: boolean;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

/** Detail form state; `kind` picks the old detail group (per-item grosir promo or global promo). */
interface PromoForm {
  kind: 'grosir' | 'global';
  mode: 'create' | 'edit';
  id?: string;
  /** Set on create = Add Promo into this existing bundle; unset on create = New Promo (new bundle) */
  promoBundle?: number;
  promoGrosir?: number;
  /** Tiers the bundle already has (Add Promo): their radios are disabled */
  usedGrosir?: number[];
  promoName: string;
  qtyMin: number;
  qtyMax: number;
  discountPct?: number;
  description: string;
  isActive: boolean;
}

interface MasterPromoManagerProps {
  isDark: boolean;
}

const errorText = (json: { error?: unknown }) =>
  typeof json.error === 'object' && json.error !== null ? (json.error as { message?: string }).message : String(json.error);

/** Loads every m_promo row; returns an error text instead of throwing. */
async function loadPromos(): Promise<{ rows?: PromoRow[]; error?: string }> {
  try {
    const res = await fetch('/api/promos/items?limit=1000');
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) return { rows: json.data };
    return { error: `Gagal memuat promo: ${errorText(json)}` };
  } catch (err) {
    console.error('Error fetching promos:', err);
    return { error: 'Gagal terhubung ke database promo' };
  }
}

/** Old Master_Data.Frm_Promo: ".:: Header ::." grids on the left, ".:: Detail ::." form on the right. */
export default function MasterPromoManager({ isDark }: MasterPromoManagerProps) {
  const c = lx(isDark);
  const { confirmDialog, dialog: confirmDialogEl } = useConfirmDialog(isDark);
  const [promos, setPromos] = useState<PromoRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [rowMenu, setRowMenu] = useState<ContextMenuState<PromoRow> | null>(null);
  const [form, setForm] = useState<PromoForm | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((text: string, type: ToastMessage['type'] = 'success') => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  // All m_promo rows (active and inactive); the page splits them into the two old grids
  const fetchPromos = useCallback(async () => {
    setIsLoading(true);
    const { rows, error } = await loadPromos();
    if (rows) setPromos(rows);
    if (error) addToast(error, 'error');
    setIsLoading(false);
  }, [addToast]);

  useEffect(() => {
    let alive = true;
    loadPromos().then(({ rows, error }) => {
      if (!alive) return;
      if (rows) setPromos(rows);
      if (error) addToast(error, 'error');
      setIsLoading(false);
    });
    return () => { alive = false; };
  }, [addToast]);

  // Per-item grosir promos, grouped by Promo Name like the old GV_Promo
  const grosirRows = useMemo(
    () => promos
      .filter((p) => !p.isGroup)
      .sort((a, b) => a.promoName.localeCompare(b.promoName) || a.promoGrosir - b.promoGrosir || a.qtyMin - b.qtyMin),
    [promos],
  );
  // Global promos (old GV_GroupPromo)
  const globalRows = useMemo(
    () => promos.filter((p) => p.isGroup).sort((a, b) => a.promoBundle - b.promoBundle || a.promoGrosir - b.promoGrosir),
    [promos],
  );

  const openCreate = useCallback(() => {
    setForm({ kind: 'grosir', mode: 'create', promoName: '', promoGrosir: 1, qtyMin: 1, qtyMax: 9999, description: '', isActive: true });
  }, []);

  // Add Promo: a new tier in the clicked row's bundle, preselecting the first free Grosir tier
  const openAddPromo = (row: PromoRow) => {
    const usedGrosir = promos.filter((p) => !p.isGroup && p.promoBundle === row.promoBundle).map((p) => p.promoGrosir);
    const free = [1, 2, 3].find((n) => !usedGrosir.includes(n));
    if (!free) return addToast(`Promo "${row.promoName}" sudah punya Grosir 1, 2 dan 3`, 'warning');
    setForm({
      kind: 'grosir', mode: 'create', promoBundle: row.promoBundle, promoGrosir: free, usedGrosir,
      promoName: row.promoName || '', qtyMin: 1, qtyMax: 9999, description: '', isActive: true,
    });
  };

  const openEdit = (row: PromoRow) => {
    setFocusedId(row.id);
    setForm({
      kind: row.isGroup ? 'global' : 'grosir',
      mode: 'edit',
      id: row.id,
      promoBundle: row.promoBundle,
      promoGrosir: row.promoGrosir,
      promoName: row.promoName || '',
      qtyMin: row.qtyMin,
      qtyMax: row.qtyMax,
      discountPct: row.discountPct,
      description: row.description && row.description !== '-' ? row.description : '',
      isActive: row.isActive,
    });
  };

  // Alt+N = New Promo, Escape = Back (kept from the previous screen)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setForm(null);
      else if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        openCreate();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openCreate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!form.promoName.trim()) return addToast('Promo Name wajib diisi', 'warning');

    // Global promo: the API saves only name, description and Aktif (Qty / Promo % stay read-only)
    let url: string;
    let method: 'POST' | 'PUT';
    let body: Record<string, unknown>;
    if (form.kind === 'global') {
      url = `/api/promos/${form.id}`;
      method = 'PUT';
      body = { promoName: form.promoName, description: form.description, isActive: form.isActive };
    } else {
      if (Number(form.qtyMin) > Number(form.qtyMax)) {
        return addToast('Qty Minimum tidak boleh lebih besar dari Qty Maksimum', 'error');
      }
      const fields = { promoName: form.promoName, qtyMin: form.qtyMin, qtyMax: form.qtyMax, description: form.description, isActive: form.isActive };
      if (form.mode === 'edit') {
        url = `/api/promos/items/${form.id}`;
        method = 'PUT';
        body = fields;
      } else {
        // New rows from this group are per-item quantity promos, like the old "Promo Grosir Jumlah Barang"
        url = '/api/promos/items';
        method = 'POST';
        body = { ...fields, isPartial: true, isGroup: false, promoGrosir: form.promoGrosir, promoBundle: form.promoBundle };
      }
    }

    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) {
        setForm(null);
        addToast(form.mode === 'edit' ? 'Promo diperbarui!' : 'Promo baru dibuat!', 'success');
        fetchPromos();
      } else {
        addToast(`Gagal menyimpan: ${errorText(json)}`, 'error');
      }
    } catch (err: unknown) {
      addToast(`Error: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  const handleDelete = async (row: PromoRow) => {
    if (!(await confirmDialog(`Apakah Anda yakin ingin menghapus promo "${row.promoName}"?`))) return;
    try {
      const url = row.isGroup ? `/api/promos/${row.id}` : `/api/promos/items/${row.id}`;
      const res = await fetch(url, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        addToast(`Promo "${row.promoName}" berhasil dihapus`, 'info');
        if (form?.id === row.id) setForm(null);
        fetchPromos();
      } else {
        addToast(`Gagal menghapus: ${errorText(json)}`, 'error');
      }
    } catch (err: unknown) {
      addToast(`Error: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  const closeRowMenu = useCallback(() => setRowMenu(null), []);
  const inactiveClass = (row: PromoRow) => (row.isActive ? '' : `${c.muted} line-through`);

  const grosirColumns: LegacyColumn<PromoRow>[] = [
    { key: 'promoGrosir', caption: 'Promo Grosir', width: 100, render: (r) => (r.promoGrosir > 0 ? `Grosir ${r.promoGrosir}` : '') },
    { key: 'qtyMin', caption: 'Qty Min', format: 'n0', width: 80 },
    { key: 'qtyMax', caption: 'Qty Max', format: 'n0', width: 80 },
    { key: 'description', caption: 'Keterangan', render: (r) => (r.description && r.description !== '-' ? r.description : '') },
  ];

  const globalColumns: LegacyColumn<PromoRow>[] = [
    { key: 'promoBundle', caption: 'Promo Global No.', align: 'left' },
    { key: 'promoName', caption: 'Promo Global Name' },
    { key: 'discountPct', caption: 'Promo Percentage', align: 'right', render: (r) => fmtN0(r.discountPct) },
    { key: 'qtyMin', caption: 'Qty Min', format: 'n0' },
    { key: 'qtyMax', caption: 'Qty Max', format: 'n0' },
    { key: 'description', caption: 'Description', render: (r) => (r.description && r.description !== '-' ? r.description : '') },
    { key: 'isActive', caption: 'Aktif', align: 'center', render: (r) => <input type="checkbox" checked={r.isActive} readOnly tabIndex={-1} className="pointer-events-none" /> },
  ];

  const setField = <K extends keyof PromoForm>(key: K, value: PromoForm[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const isGlobalForm = form?.kind === 'global';
  const isAddToBundle = form?.mode === 'create' && form.promoBundle !== undefined;

  return (
    <LegacyWindow title="Master Promo" isDark={isDark}>
      {confirmDialogEl}
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-xl border text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-top-4 fade-in duration-200 ${
              t.type === 'success'
                ? isDark ? 'bg-emerald-950/90 border-emerald-800 text-emerald-300' : 'bg-emerald-800 text-white border-emerald-900'
                : t.type === 'error'
                ? isDark ? 'bg-rose-950/90 border-rose-800 text-rose-300' : 'bg-rose-800 text-white border-rose-900'
                : t.type === 'warning'
                ? isDark ? 'bg-amber-950/90 border-amber-800 text-amber-300' : 'bg-amber-800 text-white border-amber-900'
                : isDark ? 'bg-indigo-950/90 border-indigo-800 text-indigo-300' : 'bg-indigo-800 text-white border-indigo-900'
            }`}
          >
            {t.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-300 shrink-0" />}
            {t.type === 'error' && <XCircle className="w-4 h-4 text-rose-300 shrink-0" />}
            {t.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />}
            {t.type === 'info' && <Zap className="w-4 h-4 text-indigo-300 shrink-0" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2 overflow-auto lg:overflow-hidden">
        {/* Header: New Promo / Refresh, global promo grid on top, grosir promo grid below (old order) */}
        <GroupBox caption=".:: Header ::." isDark={isDark} className="flex-1 min-w-0 min-h-[420px]">
          <div className="flex items-center justify-between gap-2">
            <LegacyButton isDark={isDark} icon={<Plus className="w-3.5 h-3.5" />} onClick={() => openCreate()} title="New Promo (Alt+N)">
              New Promo
            </LegacyButton>
            <LegacyButton
              isDark={isDark}
              icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
              onClick={() => { fetchPromos(); addToast('Data promo berhasil di-refresh', 'info'); }}
            >
              Refresh
            </LegacyButton>
          </div>

          <div className="h-40 shrink-0 flex flex-col">
            <LegacyGrid
              isDark={isDark}
              columns={globalColumns}
              rows={globalRows}
              rowKey={(r) => r.id}
              loading={isLoading}
              emptyText="Tidak ada promo global."
              focusedKey={focusedId}
              onRowClick={(r) => setFocusedId(r.id)}
              onRowDoubleClick={openEdit}
              onRowContextMenu={(r, e) => { setFocusedId(r.id); setRowMenu(menuAt(e, r, 2)); }}
              rowClassName={inactiveClass}
            />
          </div>

          <div className="flex-1 min-h-[200px] flex flex-col">
            <LegacyGrid
              isDark={isDark}
              columns={grosirColumns}
              rows={grosirRows}
              rowKey={(r) => r.id}
              loading={isLoading}
              emptyText="Tidak ada promo."
              focusedKey={focusedId}
              onRowClick={(r) => setFocusedId(r.id)}
              onRowDoubleClick={openEdit}
              onRowContextMenu={(r, e) => { setFocusedId(r.id); setRowMenu(menuAt(e, r, 3)); }}
              rowClassName={inactiveClass}
              groupBy={(r) => r.promoName || ''}
              groupCaption={(name) => `Promo Name: ${name}`}
            />
          </div>
        </GroupBox>

        {/* Detail: opened by New Promo / Edit Promo / Add Promo, closed by Back */}
        {form && (
          <GroupBox caption=".:: Detail ::." isDark={isDark} className="lg:w-[380px] shrink-0">
            <div>
              <LegacyButton isDark={isDark} icon={<ArrowLeft className="w-3.5 h-3.5" />} onClick={() => setForm(null)}>Back</LegacyButton>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-2 min-h-0 overflow-auto">
              <GroupBox caption={isGlobalForm ? undefined : 'Promo Grosir Jumlah Barang'} isDark={isDark}>
                {!isGlobalForm && (
                  <FieldRow label="Promo Bundle:" isDark={isDark}>
                    <LegacyInput isDark={isDark} value={form.promoBundle ?? ''} readOnly disabled />
                  </FieldRow>
                )}
                <FieldRow label="Promo Name:" isDark={isDark}>
                  <LegacyInput
                    isDark={isDark}
                    required
                    autoFocus
                    disabled={isAddToBundle}
                    title={isAddToBundle ? 'Nama mengikuti Promo Bundle' : undefined}
                    value={form.promoName}
                    onChange={(e) => setField('promoName', e.target.value)}
                  />
                </FieldRow>
                {!isGlobalForm && (
                  // Chosen when creating; fixed when editing (the tier is part of the row's key).
                  // FieldRow's own markup but a div: a wrapping <label> would send every click to Grosir 1
                  <div role="radiogroup" aria-label="Promo Grosir" className="flex items-center gap-2 min-w-0">
                    <span className={`w-32 shrink-0 text-right ${c.muted}`}>Promo Grosir:</span>
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      {[1, 2, 3].map((n) => {
                        const disabled = form.mode === 'edit' || Boolean(form.usedGrosir?.includes(n));
                        return (
                          <label key={n} className={`flex items-center gap-1 ${disabled ? 'opacity-70' : 'cursor-pointer'}`}>
                            <input
                              type="radio"
                              name="promoGrosir"
                              aria-label={`Grosir ${n}`}
                              checked={form.promoGrosir === n}
                              disabled={disabled}
                              onChange={() => setField('promoGrosir', n)}
                            />
                            <span>Grosir {n}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                <FieldRow label="Qty Min:" isDark={isDark}>
                  <LegacyInput
                    isDark={isDark}
                    type="number"
                    min={isGlobalForm ? undefined : 1}
                    required
                    disabled={isGlobalForm}
                    value={form.qtyMin}
                    onChange={(e) => setField('qtyMin', parseInt(e.target.value, 10) || 1)}
                  />
                </FieldRow>
                <FieldRow label="Qty Max:" isDark={isDark}>
                  <LegacyInput
                    isDark={isDark}
                    type="number"
                    min={isGlobalForm ? undefined : 1}
                    required
                    disabled={isGlobalForm}
                    value={form.qtyMax}
                    onChange={(e) => setField('qtyMax', parseInt(e.target.value, 10) || 9999)}
                  />
                </FieldRow>
                {isGlobalForm && (
                  <FieldRow label="Promo % :" isDark={isDark}>
                    <LegacyInput isDark={isDark} value={fmtN0(form.discountPct)} readOnly disabled />
                  </FieldRow>
                )}
                <FieldRow label="Keterangan Promo :" isDark={isDark}>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setField('description', e.target.value)}
                    className={`w-full min-w-0 px-2 py-1 rounded border text-xs outline-none focus:ring-1 focus:ring-blue-500 ${c.input}`}
                  />
                </FieldRow>
                <div className="flex items-center gap-2">
                  <span className="w-32 shrink-0" />
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={form.isActive} onChange={(e) => setField('isActive', e.target.checked)} />
                    <span>Aktif</span>
                  </label>
                </div>
              </GroupBox>
              <LegacyButton isDark={isDark} type="submit" variant="primary" icon={<Save className="w-3.5 h-3.5" />} className="justify-center">
                Submit
              </LegacyButton>
            </form>
          </GroupBox>
        )}
      </div>

      {rowMenu && (
        <ContextMenu
          isDark={isDark}
          x={rowMenu.x}
          y={rowMenu.y}
          onClose={closeRowMenu}
          items={[
            { label: 'Edit Promo', icon: <Edit className="w-3.5 h-3.5" />, onClick: () => openEdit(rowMenu.row) },
            ...(rowMenu.row.isGroup
              ? []
              : [{ label: 'Add Promo', icon: <Plus className="w-3.5 h-3.5" />, onClick: () => openAddPromo(rowMenu.row) }]),
            { label: 'Hapus Promo', icon: <Trash2 className="w-3.5 h-3.5" />, danger: true, onClick: () => handleDelete(rowMenu.row) },
          ]}
        />
      )}
    </LegacyWindow>
  );
}

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Plus, Edit, Trash2, CheckCircle, XCircle, AlertTriangle, Zap, ArrowLeft, Save, Power } from 'lucide-react';
import { Supplier } from '@/types/erp';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import {
  LegacyWindow, LegacyButton, GroupBox, FieldRow, LegacyInput, LegacyGrid, ContextMenu, menuAt,
  type LegacyColumn, type ContextMenuState,
} from '@/components/legacy';

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

/** Fields of the old Frm_Supplier edit form (the grid's visible columns). */
interface SupplierForm {
  mode: 'create' | 'edit';
  id?: string;
  supplierNo: string;
  supplierName: string;
  address: string;
  city: string;
  phone1: string;
  isActive: boolean;
}

interface MasterSupplierManagerProps {
  isDark: boolean;
}

type SortKey = 'supplierNo' | 'supplierName' | 'address' | 'city' | 'phone1' | 'isActive';

/** Loads every supplier (active and inactive, like the old grid); returns an error text instead of throwing. */
async function loadSuppliers(): Promise<{ rows?: Supplier[]; error?: string }> {
  try {
    const res = await fetch('/api/suppliers');
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) return { rows: json.data };
    return { error: `Gagal memuat supplier: ${json.error}` };
  } catch (err) {
    console.error('Error fetching suppliers:', err);
    return { error: 'Gagal terhubung ke database supplier' };
  }
}

/** Old Master_Data.Frm_Supplier: one supplier grid, edit form in a side ".:: Detail ::." group. */
export default function MasterSupplierManager({ isDark }: MasterSupplierManagerProps) {
  const { confirmDialog, dialog: confirmDialogEl } = useConfirmDialog(isDark);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [rowMenu, setRowMenu] = useState<ContextMenuState<Supplier> | null>(null);
  const [form, setForm] = useState<SupplierForm | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; order: 'asc' | 'desc' } | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((text: string, type: ToastMessage['type'] = 'success') => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const fetchSuppliers = useCallback(async () => {
    setIsLoading(true);
    const { rows, error } = await loadSuppliers();
    if (rows) setSuppliers(rows);
    if (error) addToast(error, 'error');
    setIsLoading(false);
  }, [addToast]);

  useEffect(() => {
    let alive = true;
    loadSuppliers().then(({ rows, error }) => {
      if (!alive) return;
      if (rows) setSuppliers(rows);
      if (error) addToast(error, 'error');
      setIsLoading(false);
    });
    return () => { alive = false; };
  }, [addToast]);

  // New supplier gets the next S00000 number (same rule as before)
  const openCreate = useCallback(() => {
    const maxCodeNum = suppliers.reduce((max, s) => {
      const match = (s.supplierNo || '').match(/\d+/);
      const num = match ? parseInt(match[0], 10) : 0;
      return Math.max(max, isNaN(num) ? 0 : num, Number(s.id) || 0);
    }, 0);
    setForm({
      mode: 'create',
      supplierNo: `S${(maxCodeNum + 1).toString().padStart(5, '0')}`,
      supplierName: '',
      address: '',
      city: '',
      phone1: '',
      isActive: true,
    });
  }, [suppliers]);

  const openEdit = (s: Supplier) => {
    setFocusedId(String(s.id));
    setForm({
      mode: 'edit',
      id: String(s.id),
      supplierNo: s.supplierNo || '',
      supplierName: s.supplierName || '',
      address: s.address || '',
      city: s.city || '',
      phone1: s.phone1 || '',
      isActive: s.isActive !== false,
    });
  };

  // Alt+N = New, Escape = Back (kept from the previous screen)
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!form.supplierNo.trim() || !form.supplierName.trim()) {
      return addToast('No. Supplier dan Nama Supplier wajib diisi!', 'warning');
    }
    const isEdit = form.mode === 'edit';
    const body = {
      supplierNo: form.supplierNo,
      supplierName: form.supplierName,
      address: form.address,
      city: form.city,
      phone1: form.phone1,
      isActive: form.isActive,
    };
    try {
      const res = await fetch(isEdit ? `/api/suppliers/${form.id}` : '/api/suppliers', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        setForm(null);
        addToast(isEdit ? 'Data supplier berhasil diperbarui!' : 'Supplier baru berhasil dibuat!', 'success');
        fetchSuppliers();
      } else {
        addToast(`Gagal menyimpan: ${json.error}`, 'error');
      }
    } catch (err: unknown) {
      addToast(`Error: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  const handleDelete = async (s: Supplier) => {
    if (!(await confirmDialog(`Apakah Anda yakin ingin menghapus supplier "${s.supplierName}"?`))) return;
    try {
      const res = await fetch(`/api/suppliers/${s.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        addToast(`Supplier "${s.supplierName}" berhasil dihapus`, 'info');
        if (form?.id === String(s.id)) setForm(null);
        fetchSuppliers();
      } else {
        addToast(`Gagal menghapus: ${json.error}`, 'error');
      }
    } catch (err: unknown) {
      addToast(`Error: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  const handleToggleActive = async (s: Supplier) => {
    const currentActive = s.isActive !== false;
    try {
      const res = await fetch(`/api/suppliers/${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      const json = await res.json();
      if (json.success) {
        addToast(`Status "${s.supplierName}" diubah menjadi ${!currentActive ? 'AKTIF' : 'NON-AKTIF'}`, 'info');
        fetchSuppliers();
      } else {
        addToast(`Gagal mengubah status: ${json.error}`, 'error');
      }
    } catch (err: unknown) {
      addToast(`Error: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  // Header click: asc -> desc -> off (same cycle as before)
  const handleSort = (key: string) => {
    const k = key as SortKey;
    setSort((prev) => (!prev || prev.key !== k ? { key: k, order: 'asc' } : prev.order === 'asc' ? { key: k, order: 'desc' } : null));
  };

  const sortedSuppliers = useMemo(() => {
    if (!sort) return suppliers;
    const dir = sort.order === 'asc' ? 1 : -1;
    return [...suppliers].sort((a, b) => {
      const va = sort.key === 'isActive' ? Number(a.isActive !== false) : String(a[sort.key] ?? '');
      const vb = sort.key === 'isActive' ? Number(b.isActive !== false) : String(b[sort.key] ?? '');
      return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))) * dir;
    });
  }, [suppliers, sort]);

  const columns: LegacyColumn<Supplier>[] = [
    { key: 'supplierNo', caption: 'No. Supplier', sortKey: 'supplierNo', width: 120 },
    { key: 'supplierName', caption: 'Nama', sortKey: 'supplierName' },
    { key: 'address', caption: 'Alamat', sortKey: 'address', width: 200 },
    { key: 'city', caption: 'Kota', sortKey: 'city', width: 150 },
    { key: 'phone1', caption: 'No. Kontak', sortKey: 'phone1', width: 150 },
    {
      key: 'isActive', caption: 'Status', sortKey: 'isActive', align: 'center', width: 80,
      render: (s) => <input type="checkbox" aria-label="Aktif" checked={s.isActive !== false} readOnly tabIndex={-1} className="pointer-events-none" />,
    },
  ];

  const closeRowMenu = useCallback(() => setRowMenu(null), []);
  const setField = <K extends keyof SupplierForm>(key: K, value: SupplierForm[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));

  return (
    <LegacyWindow
      title="Master Supplier"
      isDark={isDark}
      toolbar={
        <>
          <LegacyButton
            isDark={isDark}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            onClick={() => { fetchSuppliers(); addToast('Data supplier berhasil di-refresh', 'info'); }}
          >
            Refresh
          </LegacyButton>
          <LegacyButton isDark={isDark} icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate} title="New (Alt+N)">New</LegacyButton>
        </>
      }
    >
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
        <div className="flex-1 min-w-0 min-h-[320px] flex flex-col">
          <LegacyGrid
            isDark={isDark}
            columns={columns}
            rows={sortedSuppliers}
            rowKey={(s) => String(s.id)}
            loading={isLoading}
            emptyText="Tidak ada supplier."
            focusedKey={focusedId}
            sort={sort}
            onSort={handleSort}
            onRowClick={(s) => setFocusedId(String(s.id))}
            onRowDoubleClick={openEdit}
            onRowContextMenu={(s, e) => { setFocusedId(String(s.id)); setRowMenu(menuAt(e, s, 3)); }}
          />
        </div>

        {/* Detail: opened by New / View Supplier Data, closed by Back */}
        {form && (
          <GroupBox caption=".:: Detail ::." isDark={isDark} className="lg:w-[380px] shrink-0">
            <div>
              <LegacyButton isDark={isDark} icon={<ArrowLeft className="w-3.5 h-3.5" />} onClick={() => setForm(null)}>Back</LegacyButton>
            </div>
            <form onSubmit={handleSave} className="flex flex-col gap-2 min-h-0 overflow-auto">
              <FieldRow label="No. Supplier :" isDark={isDark}>
                <LegacyInput isDark={isDark} required value={form.supplierNo} onChange={(e) => setField('supplierNo', e.target.value)} />
              </FieldRow>
              <FieldRow label="Nama Supplier :" isDark={isDark}>
                <LegacyInput isDark={isDark} required autoFocus value={form.supplierName} onChange={(e) => setField('supplierName', e.target.value)} />
              </FieldRow>
              <FieldRow label="Alamat :" isDark={isDark}>
                <LegacyInput isDark={isDark} value={form.address} onChange={(e) => setField('address', e.target.value)} />
              </FieldRow>
              <FieldRow label="Kota :" isDark={isDark}>
                <LegacyInput isDark={isDark} value={form.city} onChange={(e) => setField('city', e.target.value)} />
              </FieldRow>
              <FieldRow label="No. Kontak :" isDark={isDark}>
                <LegacyInput isDark={isDark} value={form.phone1} onChange={(e) => setField('phone1', e.target.value)} />
              </FieldRow>
              <FieldRow label="Aktif :" isDark={isDark}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => setField('isActive', e.target.checked)} className="cursor-pointer" />
              </FieldRow>
              <LegacyButton isDark={isDark} type="submit" variant="primary" icon={<Save className="w-3.5 h-3.5" />} className="justify-center">
                Save
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
            { label: 'View Supplier Data', icon: <Edit className="w-3.5 h-3.5" />, onClick: () => openEdit(rowMenu.row) },
            {
              label: rowMenu.row.isActive !== false ? 'Non Aktifkan Supplier' : 'Aktifkan Supplier',
              icon: <Power className="w-3.5 h-3.5" />,
              onClick: () => handleToggleActive(rowMenu.row),
            },
            { label: 'Hapus Supplier', icon: <Trash2 className="w-3.5 h-3.5" />, danger: true, onClick: () => handleDelete(rowMenu.row) },
          ]}
        />
      )}
    </LegacyWindow>
  );
}

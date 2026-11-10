'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CheckCircle, XCircle, Plus, Key, Trash2, Save, Undo2, ChevronDown, ChevronRight } from 'lucide-react';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import { LegacyWindow, LegacyButton, LegacyGrid, LegacyInput, LegacySelect, GroupBox, FieldRow, lx, type LegacyColumn } from '@/components/legacy';
import { USER_TYPES } from '@/lib/user-types';

export interface UserRecord {
  id: number;
  username: string;
  fullName: string;
  userLevel: string;
  isActive: boolean;
  createdAt: string;
}

export interface ModulePermission {
  id?: number;
  userId: number;
  moduleCode: string;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPrint: boolean;
}

// Permission tree nodes, grouped like the menu; module codes are the server's ERP_MODULE_CODES
export const MODULE_LABEL_MAP: Record<string, { label: string; group: string }> = {
  'master-barang': { label: 'Master Barang', group: 'Master Data' },
  'inventory-stok': { label: 'Inventory Stock', group: 'Master Data' },
  'stok-opname': { label: 'Stok Opname', group: 'Master Data' },
  'cetak-barcode': { label: 'Cetak Barcode', group: 'Master Data' },
  'master-promo': { label: 'Master Promo', group: 'Master Data' },
  'master-supplier': { label: 'Master Supplier', group: 'Master Data' },
  'penerimaan-barang': { label: 'Penerimaan Barang Ekspress', group: 'Purchasing' },
  'penerimaan-barang-harga': { label: 'Penerimaan Barang dengan harga', group: 'Purchasing' },
  'sales-monitoring': { label: 'Sales Monitoring', group: 'Sales' },
  'laporan-penjualan': { label: 'Laporan Penjualan', group: 'Report' },
};

// Checkbox that shows a partly-checked state for tree nodes
function TreeCheck({ checked, partial, onChange, label }: { checked: boolean; partial?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={(el) => { if (el) el.indeterminate = !checked && Boolean(partial); }}
      onChange={(e) => onChange(e.target.checked)}
      className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
    />
  );
}

// Indent of one tree level, like the old TreeList
const TREE_INDENT = 16;

// Expand / collapse arrow of a tree node
function Twisty({ id, collapsed, onToggle, muted }: { id: string; collapsed: Record<string, boolean>; onToggle: (id: string) => void; muted: string }) {
  return (
    <button type="button" onClick={() => onToggle(id)} className={`p-0.5 cursor-pointer ${muted}`} aria-label={collapsed[id] ? 'Buka' : 'Tutup'}>
      {collapsed[id] ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
    </button>
  );
}

interface UserAccessManagerProps {
  isDark: boolean;
}

type Mode = 'idle' | 'edit' | 'add';

export default function UserAccessManager({ isDark }: UserAccessManagerProps) {
  const c = lx(isDark);
  const { confirmDialog, dialog: confirmDialogNode } = useConfirmDialog(isDark);

  const [usersList, setUsersList] = useState<UserRecord[]>([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: string; order: 'asc' | 'desc' } | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [mode, setMode] = useState<Mode>('idle');

  // Right group fields ("Change Password" when editing, "Add User" when adding)
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formConfirm, setFormConfirm] = useState('');
  const [formUserType, setFormUserType] = useState('Kasir');
  const passwordRef = useRef<HTMLInputElement>(null);

  // Permission tree of the selected user (module flags + sensitive capabilities)
  const [userPermissions, setUserPermissions] = useState<ModulePermission[]>([]);
  const [userCapabilities, setUserCapabilities] = useState<Record<string, boolean>>({});
  const [capabilityCatalog, setCapabilityCatalog] = useState<{ code: string; name: string; description: string; category: string }[]>([]);
  const [permDirty, setPermDirty] = useState(false);
  const [permLoading, setPermLoading] = useState(false);
  // User id whose tree loaded; the tree (and saving it) only counts when it matches the selected user
  const [permLoadedFor, setPermLoadedFor] = useState<number | null>(null);
  const permReqIdRef = useRef(0);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // All users at once: the grid's search box filters them in the browser
  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/users?all=true');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setUsersList(json.data);
        return json.data as UserRecord[];
      }
    } catch (err) {
      console.error('Failed to load users:', err);
      showToast('Gagal memuat daftar user', 'error');
    } finally {
      setIsLoading(false);
    }
    return null;
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Clears the previous user's tree first; a response for an older click (request id changed) is dropped
  const resetPermissions = () => {
    permReqIdRef.current++;
    setUserPermissions([]);
    setUserCapabilities({});
    setPermLoadedFor(null);
    setPermDirty(false);
    setPermLoading(false);
  };

  const loadPermissions = async (user: UserRecord) => {
    resetPermissions();
    const reqId = permReqIdRef.current;
    setPermLoading(true);
    try {
      const res = await fetch(`/api/users/permissions?userId=${user.id}`);
      const json = await res.json();
      if (reqId !== permReqIdRef.current) return;
      if (json.success && Array.isArray(json.data)) {
        setUserPermissions(json.data);
        setUserCapabilities(json.capabilities || {});
        setCapabilityCatalog(json.capabilityCatalog || []);
        setPermLoadedFor(user.id);
      } else {
        showToast('Gagal memuat permission user', 'error');
      }
    } catch (err) {
      if (reqId !== permReqIdRef.current) return;
      console.error('Error fetching user permissions:', err);
      showToast('Terjadi kesalahan saat memuat hak akses', 'error');
    } finally {
      if (reqId === permReqIdRef.current) setPermLoading(false);
    }
  };

  // Clicking a user opens its "Change Password" group with its permission tree
  const openUser = (user: UserRecord) => {
    setSelectedUser(user);
    setMode('edit');
    setFormUsername(user.username);
    setFormPassword('');
    setFormConfirm('');
    setFormUserType(user.userLevel);
    loadPermissions(user);
  };

  const handleAddUser = () => {
    setSelectedUser(null);
    setMode('add');
    setFormUsername('');
    setFormPassword('');
    setFormConfirm('');
    setFormUserType('Kasir');
    resetPermissions();
  };

  const handleChangePassword = () => {
    if (!selectedUser) {
      showToast('Pilih user di daftar terlebih dahulu.', 'info');
      return;
    }
    if (mode !== 'edit') openUser(selectedUser);
    setTimeout(() => passwordRef.current?.focus(), 0);
  };

  const handleBack = () => {
    setMode('idle');
    setSelectedUser(null);
    resetPermissions();
  };

  // One tick per module = may open it; the other flags follow it (the server writes them the same way)
  const setOpen = (codes: string[], value: boolean) => {
    const set = new Set(codes);
    setUserPermissions((prev) => prev.map((p) => (set.has(p.moduleCode)
      ? { ...p, canView: value, canAdd: value, canEdit: value, canDelete: value, canPrint: value }
      : p)));
    setPermDirty(true);
  };

  const toggleCapabilities = (codes: string[], value: boolean) => {
    setUserCapabilities((prev) => ({ ...prev, ...Object.fromEntries(codes.map((code) => [code, value])) }));
    setPermDirty(true);
  };

  // Create (Add User) or update username / password + permissions (Change Password); each call only when needed
  const handleSave = async () => {
    if (mode === 'idle') return;
    const username = formUsername.trim().toLowerCase();
    if (!username) {
      showToast('Username wajib diisi!', 'error');
      return;
    }
    if (formPassword && formPassword !== formConfirm) {
      showToast('Konfirmasi password tidak sama!', 'error');
      return;
    }

    setIsSaving(true);
    try {
      if (mode === 'add') {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            userLevel: formUserType,
            isActive: true,
            ...(formPassword && { password: formPassword }),
          }),
        });
        const json = await res.json();
        if (!json.success) {
          showToast(json.error || 'Gagal membuat user', 'error');
          return;
        }
        showToast(`User "${username}" berhasil ditambahkan!`, 'success');
        // Continue on the new user so its permissions can be set right away
        const users = await loadUsers();
        const created = users?.find((u) => u.id === Number(json.data?.id));
        if (created) openUser(created);
        else handleBack();
        return;
      }

      if (!selectedUser) return;
      // Never write a tree that is still loading, failed to load, or belongs to another user
      const permReady = permLoadedFor === selectedUser.id;
      const typeChanged = formUserType !== selectedUser.userLevel;
      const userChanged = username !== selectedUser.username.toLowerCase() || formPassword !== '' || typeChanged;
      if (!userChanged && !(permDirty && permReady)) {
        showToast('Tidak ada perubahan.', 'info');
        return;
      }
      if (userChanged) {
        const res = await fetch(`/api/users/${selectedUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, ...(formPassword && { password: formPassword }), ...(typeChanged && { userType: formUserType }) }),
        });
        const json = await res.json();
        if (!json.success) {
          showToast(json.error || 'Gagal mengubah user', 'error');
          return;
        }
      }
      if (permDirty && permReady) {
        const res = await fetch('/api/users/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: selectedUser.id, permissions: userPermissions, capabilities: userCapabilities }),
        });
        const json = await res.json();
        if (!json.success) {
          showToast(json.error || 'Gagal menyimpan hak akses', 'error');
          return;
        }
        setPermDirty(false);
      }
      // The role sits in the session cookie, so it changes only when that user logs in again
      showToast(typeChanged
        ? `User "${username}" berhasil disimpan! User Type baru berlaku saat user ini login berikutnya.`
        : `User "${username}" berhasil disimpan!`, 'success');
      setFormPassword('');
      setFormConfirm('');
      const users = await loadUsers();
      const updated = users?.find((u) => u.id === selectedUser.id);
      if (updated) {
        setSelectedUser(updated);
        setFormUsername(updated.username);
        setFormUserType(updated.userLevel);
      }
    } catch (err) {
      console.error('Save user error:', err);
      showToast('Terjadi kesalahan saat menyimpan user', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) {
      showToast('Pilih user di daftar terlebih dahulu.', 'info');
      return;
    }
    const target = selectedUser;
    const ok = await confirmDialog(
      `Yakin ingin menghapus user ${target.username}?\nUser ini tidak akan bisa login lagi dan hak aksesnya ikut terhapus. Riwayat transaksinya tetap tersimpan.`,
      { title: 'Hapus User', confirmText: 'Ya, Hapus' },
    );
    if (!ok) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/users/${target.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast(`User "${target.username}" berhasil dihapus!`, 'success');
        handleBack();
        loadUsers();
      } else {
        showToast(json.error || 'Gagal menghapus user', 'error');
      }
    } catch (err) {
      console.error('Delete user error:', err);
      showToast('Terjadi kesalahan saat menghapus user', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const visibleUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q
      ? usersList.filter((u) => u.username.toLowerCase().includes(q) || (u.userLevel || '').toLowerCase().includes(q))
      : usersList;
    if (!sort) return rows;
    const key = sort.key as keyof UserRecord;
    return [...rows].sort((a, b) => {
      const av = String(a[key] ?? '').toLowerCase();
      const bv = String(b[key] ?? '').toLowerCase();
      return (av < bv ? -1 : av > bv ? 1 : 0) * (sort.order === 'asc' ? 1 : -1);
    });
  }, [usersList, search, sort]);

  const handleSort = (key: string) =>
    setSort((s) => (!s || s.key !== key ? { key, order: 'asc' } : s.order === 'asc' ? { key, order: 'desc' } : null));

  // Old grid of frmUserSetting: Username | User Type
  const userColumns: LegacyColumn<UserRecord>[] = [
    { key: 'username', caption: 'Username', sortKey: 'username' },
    { key: 'userLevel', caption: 'User Type', sortKey: 'userLevel' },
  ];

  const groupedPermissions = useMemo(() => {
    const groups: Record<string, (ModulePermission & { labelName: string })[]> = {};
    // Tree order = menu order (MODULE_LABEL_MAP), not the API's order
    const order = Object.keys(MODULE_LABEL_MAP);
    const rank = (code: string) => (order.indexOf(code) + 1 || order.length + 1);
    [...userPermissions].sort((a, b) => rank(a.moduleCode) - rank(b.moduleCode)).forEach((perm) => {
      const info = MODULE_LABEL_MAP[perm.moduleCode] || { label: perm.moduleCode, group: 'Lainnya' };
      (groups[info.group] ||= []).push({ ...perm, labelName: info.label });
    });
    return groups;
  }, [userPermissions]);

  const groupedCapabilities = useMemo(() => {
    const groups: Record<string, typeof capabilityCatalog> = {};
    capabilityCatalog.forEach((cap) => { (groups[cap.category] ||= []).push(cap); });
    return groups;
  }, [capabilityCatalog]);

  const toggleNode = (id: string) => setCollapsed((st) => ({ ...st, [id]: !st[id] }));

  const allOpen = (perms: ModulePermission[]) => perms.length > 0 && perms.every((p) => p.canView);
  const someOpen = (perms: ModulePermission[]) => perms.some((p) => p.canView);
  const codesOf = (perms: ModulePermission[]) => perms.map((p) => p.moduleCode);

  // One row of the old "Permission" TreeList: indent, arrow, checkbox and ModuleCode in the first column, ModuleName next
  const treeRow = (o: { key: string; level: number; node?: string; label: string; checked: boolean; partial?: boolean;
    onChange: (v: boolean) => void; code?: string; name: string; title?: string; bold?: boolean }) => (
    <tr key={o.key} className={`${c.rowHover} ${o.bold ? 'font-semibold' : ''}`} title={o.title}>
      <td className={`py-0.5 pr-2 border-b whitespace-nowrap ${c.border}`} style={{ paddingLeft: 4 + o.level * TREE_INDENT }}>
        <span className="inline-flex items-center gap-1.5">
          {o.node ? <Twisty collapsed={collapsed} onToggle={toggleNode} muted={c.muted} id={o.node} /> : <span className="w-4" />}
          <TreeCheck label={o.label} checked={o.checked} partial={o.partial} onChange={o.onChange} />
          {o.code && <span className="font-mono text-[11px]">{o.code}</span>}
        </span>
      </td>
      <td className={`px-2 py-0.5 border-b ${c.border}`}>{o.name}</td>
    </tr>
  );

  const treeRows: React.ReactNode[] = [];
  // Modules: root, menu groups, one tick per module
  treeRows.push(treeRow({ key: '__modules', level: 0, node: '__modules', label: 'Semua Modul', bold: true, name: 'Modul',
    checked: allOpen(userPermissions), partial: someOpen(userPermissions), onChange: (v) => setOpen(codesOf(userPermissions), v) }));
  if (!collapsed.__modules) {
    Object.entries(groupedPermissions).forEach(([group, items]) => {
      treeRows.push(treeRow({ key: `g:${group}`, level: 1, node: group, label: group, bold: true, name: group,
        checked: allOpen(items), partial: someOpen(items), onChange: (v) => setOpen(codesOf(items), v) }));
      if (collapsed[group]) return;
      items.forEach((perm) => treeRows.push(treeRow({ key: perm.moduleCode, level: 2, label: perm.labelName, code: perm.moduleCode,
        name: perm.labelName, checked: perm.canView, onChange: (v) => setOpen([perm.moduleCode], v) })));
    });
  }
  // Sensitive actions, enforced server-side per capability; the description is the row's tooltip
  if (capabilityCatalog.length > 0) {
    const codes = capabilityCatalog.map((cap) => cap.code);
    treeRows.push(treeRow({ key: '__caps', level: 0, node: '__caps', label: 'Semua Otorisasi', bold: true, name: 'Otorisasi Aksi Sensitif',
      checked: codes.every((code) => userCapabilities[code]), partial: codes.some((code) => userCapabilities[code]),
      onChange: (v) => toggleCapabilities(codes, v) }));
    if (!collapsed.__caps) {
      Object.entries(groupedCapabilities).forEach(([cat, caps]) => {
        treeRows.push(treeRow({ key: `cap:${cat}`, level: 1, node: `cap:${cat}`, label: cat, bold: true, name: cat,
          checked: caps.every((cap) => userCapabilities[cap.code]), partial: caps.some((cap) => userCapabilities[cap.code]),
          onChange: (v) => toggleCapabilities(caps.map((cap) => cap.code), v) }));
        if (collapsed[`cap:${cat}`]) return;
        caps.forEach((cap) => treeRows.push(treeRow({ key: cap.code, level: 2, label: cap.name, code: cap.code, title: cap.description,
          name: cap.name,
          checked: Boolean(userCapabilities[cap.code]), onChange: (v) => toggleCapabilities([cap.code], v) })));
      });
    }
  }

  const permissionTree = (
    <div className={`flex-1 min-h-0 overflow-auto border rounded ${c.panel}`}>
      {permLoading ? (
        <div className={`py-6 text-center ${c.muted}`}>Memuat data...</div>
      ) : selectedUser && permLoadedFor !== selectedUser.id ? (
        <div className={`py-6 text-center ${c.muted}`}>Permission user ini gagal dimuat. Klik user-nya lagi untuk memuat ulang.</div>
      ) : (
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-10">
            <tr className={`h-7 font-semibold text-left whitespace-nowrap ${c.head}`}>
              <th className={`px-2 border-b border-r ${c.border}`}>Module Code</th>
              <th className={`px-2 border-b w-full ${c.border}`}>Module Name</th>
            </tr>
          </thead>
          <tbody>{treeRows}</tbody>
        </table>
      )}
    </div>
  );

  // The edited user's role may be one the add list does not offer (legacy positions); show it as is
  const userTypeOptions: string[] = (USER_TYPES as readonly string[]).includes(formUserType) ? [...USER_TYPES] : [formUserType, ...USER_TYPES];

  return (
    <LegacyWindow
      title="Setting - User"
      isDark={isDark}
      toolbar={
        <>
          <LegacyButton isDark={isDark} onClick={handleAddUser} icon={<Plus className="w-3.5 h-3.5" />}>Add User</LegacyButton>
          <LegacyButton isDark={isDark} onClick={handleChangePassword} icon={<Key className="w-3.5 h-3.5" />}>Change Password</LegacyButton>
          <LegacyButton isDark={isDark} onClick={handleDeleteUser} disabled={isSaving} icon={<Trash2 className="w-3.5 h-3.5" />}>Delete User</LegacyButton>
          <LegacyButton isDark={isDark} variant="primary" onClick={handleSave} disabled={mode === 'idle' || isSaving || permLoading} icon={<Save className="w-3.5 h-3.5" />}>
            {isSaving ? 'Menyimpan...' : 'Save'}
          </LegacyButton>
          <LegacyButton isDark={isDark} onClick={handleBack} disabled={mode === 'idle'} icon={<Undo2 className="w-3.5 h-3.5" />}>Back</LegacyButton>
        </>
      }
    >
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg shadow-xl border text-xs font-bold flex items-center gap-2.5 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-700 text-white border-emerald-800'
              : toastMessage.type === 'error'
              ? 'bg-rose-700 text-white border-rose-800'
              : 'bg-amber-500 text-slate-950 border-amber-600'
          }`}
        >
          {toastMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          <span>{toastMessage.text}</span>
        </div>
      )}
      {confirmDialogNode}

      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-2">
        {/* Left: user list */}
        <div className="md:w-80 shrink-0 min-h-0 flex flex-col gap-2 h-64 md:h-auto">
          <LegacyInput isDark={isDark} placeholder="Cari Username / User Type..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <LegacyGrid
            isDark={isDark}
            columns={userColumns}
            rows={visibleUsers}
            rowKey={(u) => u.id}
            loading={isLoading && usersList.length === 0}
            emptyText="Belum ada data user."
            focusedKey={selectedUser?.id ?? null}
            onRowClick={openUser}
            sort={sort}
            onSort={handleSort}
          />
        </div>

        {/* Right: "Change Password" (editing) or "Add User" group */}
        <GroupBox caption={mode === 'add' ? 'Add User' : 'Change Password'} isDark={isDark} className="flex-1 min-w-0">
          {mode === 'idle' ? (
            <div className={`py-10 text-center ${c.muted}`}>Pilih user di daftar, atau klik Add User.</div>
          ) : (
            <form
              className="flex-1 min-h-0 flex flex-col gap-2"
              autoComplete="off"
              onSubmit={(e) => { e.preventDefault(); handleSave(); }}
            >
              <div className="max-w-md flex flex-col gap-1.5">
                <FieldRow label="Username *" isDark={isDark}>
                  <LegacyInput isDark={isDark} value={formUsername} required onChange={(e) => setFormUsername(e.target.value.toLowerCase())} />
                </FieldRow>
                <FieldRow label="Password *" isDark={isDark}>
                  <LegacyInput
                    ref={passwordRef}
                    isDark={isDark}
                    type="password"
                    autoComplete="new-password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={mode === 'add' ? 'Kosongkan untuk password default 123456' : 'Kosongkan jika tidak diubah'}
                  />
                </FieldRow>
                <FieldRow label="Confirm Password *" isDark={isDark}>
                  <LegacyInput isDark={isDark} type="password" autoComplete="new-password" value={formConfirm} disabled={!formPassword} onChange={(e) => setFormConfirm(e.target.value)} />
                </FieldRow>
                <FieldRow label="User Type" isDark={isDark}>
                  <LegacySelect isDark={isDark} value={formUserType} onChange={(e) => setFormUserType(e.target.value)}>
                    {userTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                  </LegacySelect>
                </FieldRow>
              </div>
              <div className="flex-1 min-h-0 flex flex-col gap-1">
                <span className={`font-semibold ${c.muted}`}>Permission</span>
                {mode === 'add' ? (
                  <div className={`py-4 px-2 border rounded ${c.panel} ${c.muted}`}>Klik Save untuk membuat user, lalu atur permission-nya di sini.</div>
                ) : (
                  permissionTree
                )}
              </div>
            </form>
          )}
        </GroupBox>
      </div>
    </LegacyWindow>
  );
}

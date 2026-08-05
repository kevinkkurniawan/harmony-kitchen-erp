'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Search,
  RefreshCw,
  Printer,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit,
  UserCheck,
  Zap,
  BadgeCheck,
  X,
  AlertTriangle,
  Briefcase,
} from 'lucide-react';

export interface Employee {
  id: string | number;
  employee_no: string;
  employee_name: string;
  position_id?: number;
  position_name: string;
  description: string;
  is_active: boolean;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

interface MasterEmployeeManagerProps {
  isDark: boolean;
}

export default function MasterEmployeeManager({ isDark }: MasterEmployeeManagerProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);

  // Form Fields (Exact 1:1 matching Frm_Employee & M_Employee in Module Manager)
  const [employeeNo, setEmployeeNo] = useState<string>('');
  const [employeeName, setEmployeeName] = useState<string>('');
  const [positionName, setPositionName] = useState<string>('Staff');
  const [description, setDescription] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);

  // ID Badge Modal
  const [selectedBadgeEmp, setSelectedBadgeEmp] = useState<Employee | null>(null);
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState<boolean>(false);

  // Submit & Toasts
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((text: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Fetch Employees List
  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/employees?q=${encodeURIComponent(searchQuery)}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setEmployees(json.data);
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
      addToast('Gagal memuat data Karyawan', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, addToast]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleOpenAddModal = () => {
    setEditingEmp(null);
    setEmployeeNo('EM-' + Math.floor(10000 + Math.random() * 90000));
    setEmployeeName('');
    setPositionName('Staff');
    setDescription('');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (emp: Employee) => {
    setEditingEmp(emp);
    setEmployeeNo(emp.employee_no);
    setEmployeeName(emp.employee_name);
    setPositionName(emp.position_name || 'Staff');
    setDescription(emp.description || '');
    setIsActive(emp.is_active);
    setIsModalOpen(true);
  };

  const handleSaveEmployee = async () => {
    if (!employeeNo.trim() || !employeeName.trim()) {
      addToast('Kode Karyawan (EmployeeNo) dan Nama Karyawan (EmployeeName) wajib diisi!', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        id: editingEmp ? editingEmp.id : undefined,
        employee_no: employeeNo,
        employee_name: employeeName,
        position_name: positionName,
        description,
        is_active: isActive,
      };

      const res = await fetch('/api/employees', {
        method: editingEmp ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        addToast(`Karyawan ${employeeName} berhasil ${editingEmp ? 'diperbarui' : 'ditambahkan'}!`, 'success');
        setIsModalOpen(false);
        fetchEmployees();
      } else {
        addToast(json.error || 'Gagal menyimpan data Karyawan', 'error');
      }
    } catch (err) {
      console.error('Save employee error:', err);
      addToast('Terjadi kesalahan koneksi saat menyimpan', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (id: string | number, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus data karyawan ${name}?`)) return;

    try {
      const res = await fetch(`/api/employees?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        addToast(`Data karyawan ${name} berhasil dihapus`, 'success');
        fetchEmployees();
      } else {
        addToast(json.error || 'Gagal menghapus Karyawan', 'error');
      }
    } catch (err) {
      console.error('Delete employee error:', err);
      addToast('Gagal menghapus data Karyawan', 'error');
    }
  };

  // Stats
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => e.is_active).length;

  return (
    <div
      className={`h-full w-full flex flex-col font-sans transition-colors duration-200 ${
        isDark ? 'bg-[#0b0f19] text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Toast Notification */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-xl border flex items-center gap-3 text-xs font-semibold animate-in slide-in-from-bottom-5 duration-200 ${
              t.type === 'success'
                ? 'bg-emerald-500/90 text-white border-emerald-400'
                : t.type === 'error'
                ? 'bg-rose-500/90 text-white border-rose-400'
                : t.type === 'warning'
                ? 'bg-amber-500/90 text-white border-amber-400'
                : 'bg-blue-500/90 text-white border-blue-400'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
            {t.type === 'error' && <XCircle className="w-4 h-4" />}
            {t.type === 'warning' && <AlertTriangle className="w-4 h-4" />}
            {t.type === 'info' && <Zap className="w-4 h-4" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      {/* TOP HEADER */}
      <header
        className={`h-16 px-6 border-b flex items-center justify-between shrink-0 shadow-sm ${
          isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight flex items-center gap-2">
              Master Karyawan (Frm_Employee / M_Employee)
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                MD_EMP 1:1
              </span>
            </h1>
            <p className="text-xs text-slate-400">Pengelolaan data karyawan (EmployeeNo, EmployeeName, Position, Description, isActive)</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Tambah Karyawan Baru
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            className={`p-4 rounded-2xl border flex items-center gap-4 ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center font-bold">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold">Total Data Karyawan</p>
              <p className="text-xl font-extrabold">{totalEmployees} Karyawan</p>
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border flex items-center gap-4 ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold">Karyawan Aktif</p>
              <p className="text-xl font-extrabold text-emerald-400">{activeEmployees} Aktif</p>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Cari EmployeeNo, EmployeeName, PositionName..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 text-xs rounded-xl border outline-none transition-colors ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500 focus:border-cyan-500'
                  : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-cyan-500'
              }`}
            />
          </div>

          <button
            onClick={fetchEmployees}
            className={`p-2 rounded-xl border active:scale-95 transition-all ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-300 text-slate-600'
            }`}
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Table List (Strict 1:1 Frm_Employee Columns) */}
        <div
          className={`rounded-2xl border overflow-hidden ${
            isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead
                className={`uppercase font-bold border-b tracking-wider ${
                  isDark ? 'bg-slate-800/50 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
              >
                <tr>
                  <th className="px-4 py-3.5">Employee No</th>
                  <th className="px-4 py-3.5">Employee Name</th>
                  <th className="px-4 py-3.5">Position (Jabatan)</th>
                  <th className="px-4 py-3.5">Description (Keterangan)</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" />
                      <span>Memuat data Karyawan...</span>
                    </td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      Tidak ada data Karyawan ditemukan.
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr key={emp.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-3 font-mono font-bold text-cyan-400">{emp.employee_no}</td>
                      <td className="px-4 py-3 font-bold text-white">{emp.employee_name}</td>
                      <td className="px-4 py-3 font-semibold text-slate-300">{emp.position_name}</td>
                      <td className="px-4 py-3 text-slate-400">{emp.description || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            emp.is_active
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {emp.is_active ? 'Aktif' : 'Non-Aktif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedBadgeEmp(emp);
                              setIsBadgeModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 active:scale-95 transition-all"
                            title="Print Badge ID"
                          >
                            <BadgeCheck className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(emp)}
                            className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 active:scale-95 transition-all"
                            title="Edit Data"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteEmployee(emp.id, emp.employee_name)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 active:scale-95 transition-all"
                            title="Hapus Data"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div
            className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-500" />
                <h3 className="font-extrabold text-sm">{editingEmp ? 'Edit Data Karyawan' : 'Tambah Karyawan Baru'}</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 font-sans space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-400">Employee No (Kode Karyawan) *</label>
                <input
                  type="text"
                  value={employeeNo}
                  onChange={(e) => setEmployeeNo(e.target.value)}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border font-mono font-bold outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-cyan-400' : 'bg-slate-100 border-slate-300 text-cyan-600'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-400">Employee Name (Nama Karyawan) *</label>
                <input
                  type="text"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  placeholder="Nama Lengkap Karyawan..."
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-400">Position (Jabatan M_Position) *</label>
                <select
                  value={positionName}
                  onChange={(e) => setPositionName(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none cursor-pointer ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="Manager">Manager</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Cashier">Cashier</option>
                  <option value="Staff">Staff</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-400">Description (Keterangan)</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Catatan / Keterangan..."
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-400">Status Aktif (isActive)</label>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`w-full px-3 py-2 text-xs font-bold rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}
                >
                  {isActive ? <UserCheck className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {isActive ? 'Aktif' : 'Non-Aktif'}
                </button>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-950/50">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl border text-xs font-bold text-slate-400 hover:text-white border-slate-700"
              >
                Batal
              </button>
              <button
                onClick={handleSaveEmployee}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all cursor-pointer"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Data Karyawan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ID BADGE PREVIEW MODAL */}
      {isBadgeModalOpen && selectedBadgeEmp && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2">
                <BadgeCheck className="w-5 h-5 text-cyan-500" />
                <h3 className="font-extrabold text-sm">Badge ID Karyawan</h3>
              </div>
              <button
                onClick={() => setIsBadgeModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col items-center justify-center">
              <div className="w-64 bg-gradient-to-b from-slate-900 to-slate-950 text-white p-6 rounded-2xl border-2 border-cyan-500/40 shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
                <div className="w-full border-b border-cyan-500/30 pb-3 mb-4">
                  <h4 className="font-black text-xs tracking-widest text-cyan-400 uppercase">EMPLOYEE BADGE</h4>
                  <p className="text-[9px] text-slate-400">MODULE MANAGER ERP</p>
                </div>

                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-extrabold text-2xl mb-3 shadow-lg shadow-cyan-500/20">
                  {selectedBadgeEmp.employee_name.slice(0, 2).toUpperCase()}
                </div>

                <h3 className="font-extrabold text-sm text-white">{selectedBadgeEmp.employee_name}</h3>
                <p className="text-xs font-semibold text-cyan-400 mb-4">{selectedBadgeEmp.position_name}</p>

                <div className="w-full pt-3 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-400">
                  <span>ID: {selectedBadgeEmp.employee_no}</span>
                  <span className="text-emerald-400 font-bold">ACTIVE</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-950/50">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-cyan-500/20"
              >
                <Printer className="w-4 h-4" /> Cetak ID Badge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

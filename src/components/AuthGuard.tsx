'use client';

import React, { useState, useEffect } from 'react';
import { Store, Lock, User as UserIcon, LogIn, AlertCircle } from 'lucide-react';
import type { AuthenticatedUser } from '@/components/LoginModal';

export interface ERPClientPermission {
  moduleCode: string;
  canView: boolean;
}

interface AuthGuardProps {
  children: (auth: { user: AuthenticatedUser; permissions: ERPClientPermission[]; logout: () => Promise<void> }) => React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [permissions, setPermissions] = useState<ERPClientPermission[]>([]);
  const [isChecking, setIsChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const response = await fetch('/api/auth/session');
        const json = await response.json() as { success: boolean; user?: AuthenticatedUser; permissions?: ERPClientPermission[] };
        if (json.success && json.user) {
          setUser(json.user);
          setPermissions(json.permissions || []);
        }
      } finally {
        setIsChecking(false);
      }
    };
    restoreSession();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const json = await response.json() as { success: boolean; user?: AuthenticatedUser; permissions?: ERPClientPermission[]; error?: string };
      if (!json.success || !json.user) {
        setError(json.error || 'Username atau password salah.');
        return;
      }
      setUser(json.user);
      setPermissions(json.permissions || []);
      setPassword('');
    } catch {
      setError('Terjadi kesalahan saat menghubungi server autentikasi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setPermissions([]);
    setUsername('');
    setPassword('');
  };

  // Jangan render apa-apa selama pengecekan status awal agar tidak berkedip
  if (isChecking) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  // Jika sudah login, tampilkan aplikasi utama
  if (user) {
    return <>{children({ user, permissions, logout })}</>;
  }

  // Jika belum login, tampilkan form login dengan style POS
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="bg-white/80 backdrop-blur-xl border border-slate-300 text-slate-900 w-full max-w-md rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] overflow-hidden relative z-10">
        {/* Header */}
        <div className="p-8 bg-slate-50/80 border-b border-slate-300 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-sky-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/20">
            <Store className="w-8 h-8 text-white font-bold" />
          </div>
          <h2 className="font-extrabold text-2xl text-slate-900 tracking-tight mb-1">
            Harmony Kitchen ERP
          </h2>
          <p className="text-sm text-slate-600 font-medium">
            Sistem Manajemen Terpadu
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="p-8 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm font-semibold flex items-center gap-2.5 animate-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 ml-1">
              <UserIcon className="w-3.5 h-3.5 text-indigo-500" />
              Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan username"
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3.5 text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 ml-1">
              <Lock className="w-3.5 h-3.5 text-indigo-500" />
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3.5 text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="cursor-pointer w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 hover:from-indigo-500 hover:to-sky-400 text-white font-black text-base shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-4"
          >
            <LogIn className="w-5 h-5" />
            {isSubmitting ? 'Memproses...' : 'Login ke ERP'}
          </button>
        </form>
      </div>

      <div className="mt-8 text-center text-xs font-medium text-slate-600">
        &copy; {new Date().getFullYear()} Harmony Kitchenware. All rights reserved.
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { Store, Lock, User as UserIcon, LogIn, AlertCircle } from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Memeriksa status login di sessionStorage saat mount
    const status = sessionStorage.getItem('isLoggedIn');
    if (status === 'true') {
      setIsLoggedIn(true);
    }
    setIsChecking(false);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Hardcoded credential check for now
    if (username === 'admin' && password === '123') {
      sessionStorage.setItem('isLoggedIn', 'true');
      setIsLoggedIn(true);
    } else {
      setError('Username atau Password salah!');
    }
  };

  // Jangan render apa-apa selama pengecekan status awal agar tidak berkedip
  if (isChecking) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-900" />;
  }

  // Jika sudah login, tampilkan aplikasi utama
  if (isLoggedIn) {
    return <>{children}</>;
  }

  // Jika belum login, tampilkan form login dengan style POS
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 text-slate-100 w-full max-w-md rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden relative z-10">
        {/* Header */}
        <div className="p-8 bg-slate-950/50 border-b border-slate-800 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-sky-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/20">
            <Store className="w-8 h-8 text-white font-bold" />
          </div>
          <h2 className="font-extrabold text-2xl text-white tracking-tight mb-1">
            Harmony Kitchen ERP
          </h2>
          <p className="text-sm text-slate-400 font-medium">
            Sistem Manajemen Terpadu
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="p-8 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-semibold flex items-center gap-2.5 animate-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 ml-1">
              <UserIcon className="w-3.5 h-3.5 text-indigo-400" />
              Username Admin
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan username"
              className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3.5 text-base text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 ml-1">
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3.5 text-base text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          <button
            type="submit"
            className="cursor-pointer w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 hover:from-indigo-500 hover:to-sky-400 text-white font-black text-base shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-4"
          >
            <LogIn className="w-5 h-5" />
            Login ke ERP
          </button>
        </form>
      </div>

      <div className="mt-8 text-center text-xs font-medium text-slate-600">
        &copy; {new Date().getFullYear()} Harmony Kitchenware. All rights reserved.
      </div>
    </div>
  );
}

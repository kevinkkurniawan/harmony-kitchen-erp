'use client';

import React, { useState } from 'react';
import { Store, Lock, User as UserIcon, LogIn, AlertCircle } from 'lucide-react';
import { MOCK_ERP_USERS, ERPUser } from '@/types/user';

interface LoginModalProps {
  isOpen: boolean;
  onLoginSuccess: (user: ERPUser) => void;
}

export default function LoginModal({ isOpen, onLoginSuccess }: LoginModalProps) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const foundUser = MOCK_ERP_USERS.find((u) => u.username.toLowerCase() === username.toLowerCase());

    if (!foundUser) {
      setError('Username ERP tidak ditemukan');
      return;
    }

    onLoginSuccess(foundUser);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-slate-950/80 border-b border-slate-800 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/20">
            <Store className="w-6 h-6 text-slate-950 font-bold" />
          </div>
          <h2 className="font-extrabold text-lg text-white">Login Module Manager ERP</h2>
          <p className="text-xs text-slate-400 mt-1">Masukan Akun Administrator / Staff ERP</p>
        </div>

        {/* Quick Demo Login Preset Buttons */}
        <div className="p-4 bg-slate-900/60 border-b border-slate-800 text-xs">
          <span className="text-slate-400 block mb-2 font-medium">Pilih Akun ERP:</span>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setUsername('admin');
                setPassword('123456');
              }}
              className="px-2 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-center font-bold hover:bg-amber-500/30 transition-all"
            >
              Admin ERP
            </button>
            <button
              type="button"
              onClick={() => {
                setUsername('staff1');
                setPassword('123456');
              }}
              className="px-2 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-center font-bold hover:bg-emerald-500/30 transition-all"
            >
              Staff Gudang
            </button>
            <button
              type="button"
              onClick={() => {
                setUsername('manager');
                setPassword('123456');
              }}
              className="px-2 py-1.5 bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-lg text-center font-bold hover:bg-sky-500/30 transition-all"
            >
              Manager
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-amber-400" />
              Username ERP
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan username ERP..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 mt-2"
          >
            <LogIn className="w-4 h-4" />
            Masuk ERP Manager
          </button>
        </form>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { Store, Lock, User as UserIcon, LogIn, AlertCircle, Sparkles } from 'lucide-react';

export interface AuthenticatedUser {
  id: number;
  username: string;
  fullName: string;
  userLevel: string;
  isActive: boolean;
}

interface LoginModalProps {
  isOpen: boolean;
  onLoginSuccess: (user: AuthenticatedUser, permissions: any[]) => void;
  onClose?: () => void;
}

export default function LoginModal({ isOpen, onLoginSuccess, onClose }: LoginModalProps) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const json = await res.json();
      if (json.success) {
        onLoginSuccess(json.user, json.permissions || []);
      } else {
        // Match exact Module Manager error string
        setError(json.error || 'User not registered. Please contact your administrator');
        setPassword('');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Terjadi kesalahan saat menghubungi server autentikasi');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
        {/* Header 1:1 frmStartScreen */}
        <div className="p-6 bg-gradient-to-b from-slate-950 to-slate-900 border-b border-slate-800 text-center relative">
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-xs font-bold px-2 py-1 rounded-lg bg-slate-800/60"
            >
              ✕
            </button>
          )}
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 font-black flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/20">
            <Store className="w-6 h-6" />
          </div>
          <h2 className="font-black text-lg text-white tracking-tight">Login Module Manager ERP</h2>
          <p className="text-xs text-slate-400 mt-1">Masukan Akun Administrator / Staff User ERP</p>
        </div>

        {/* Quick Demo Preset Selection */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800 text-xs">
          <span className="text-slate-400 block mb-2 font-bold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Pilih User Demo:</span>
          </span>
          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setUsername('admin');
                setPassword('123456');
              }}
              className="px-2 py-1.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-xl text-center font-black text-[11px] hover:bg-purple-500/30 cursor-pointer transition-all"
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => {
                setUsername('manager');
                setPassword('123456');
              }}
              className="px-2 py-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-xl text-center font-black text-[11px] hover:bg-blue-500/30 cursor-pointer transition-all"
            >
              Manager
            </button>
            <button
              type="button"
              onClick={() => {
                setUsername('supervisor');
                setPassword('123456');
              }}
              className="px-2 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-center font-black text-[11px] hover:bg-amber-500/30 cursor-pointer transition-all"
            >
              Supervisor
            </button>
            <button
              type="button"
              onClick={() => {
                setUsername('kasir1');
                setPassword('123456');
              }}
              className="px-2 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-center font-black text-[11px] hover:bg-emerald-500/30 cursor-pointer transition-all"
            >
              Kasir 1
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>Username :</span>
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Password :</span>
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-98 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all mt-2"
          >
            <LogIn className="w-4 h-4" />
            <span>{isLoading ? 'Memproses Authentikasi...' : 'Masuk ERP System'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

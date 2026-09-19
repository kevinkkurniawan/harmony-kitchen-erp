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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-300 text-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
        {/* Header 1:1 frmStartScreen */}
        <div className="p-6 bg-slate-50 border-b border-slate-300 text-center relative">
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-900 text-xs font-bold px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 transition-colors"
            >
              ✕
            </button>
          )}
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 font-black flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/20">
            <Store className="w-6 h-6" />
          </div>
          <h2 className="font-black text-lg text-slate-900 tracking-tight">Login Module Manager ERP</h2>
          <p className="text-xs text-slate-600 mt-1">Masukan Akun Administrator / Staff User ERP</p>
        </div>

        {/* Quick Demo Preset Selection */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-300 text-xs">
          <span className="text-slate-600 block mb-2 font-bold flex items-center gap-1.5">
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
              className="px-2 py-1.5 bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-center font-black text-[11px] hover:bg-purple-200 cursor-pointer transition-all"
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => {
                setUsername('manager');
                setPassword('123456');
              }}
              className="px-2 py-1.5 bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-center font-black text-[11px] hover:bg-blue-200 cursor-pointer transition-all"
            >
              Manager
            </button>
            <button
              type="button"
              onClick={() => {
                setUsername('supervisor');
                setPassword('123456');
              }}
              className="px-2 py-1.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-center font-black text-[11px] hover:bg-amber-200 cursor-pointer transition-all"
            >
              Supervisor
            </button>
            <button
              type="button"
              onClick={() => {
                setUsername('kasir1');
                setPassword('123456');
              }}
              className="px-2 py-1.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-center font-black text-[11px] hover:bg-emerald-200 cursor-pointer transition-all"
            >
              Kasir 1
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold flex items-center gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-amber-500" />
              <span>Username :</span>
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-500" />
              <span>Password :</span>
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
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

'use client';

import React, { useRef, useState } from 'react';
import { LegacyButton, LegacyInput, GroupBox, FieldRow, lx } from '@/components/legacy';

// Module Manager frmChangePassword: a borderless box centred on the main window with one group
// "Change password..", three password rows and the OK / CLOSE buttons side by side.
export default function ChangePasswordDialog({ isDark, onClose }: { isDark: boolean; onClose: () => void }) {
  const c = lx(isDark);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const oldRef = useRef<HTMLInputElement>(null);
  // Only Enter in Confirm New Password sends (old ConfirmNewPasswordTextEdit_KeyDown); the other rows ignore it
  const ignoreEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') e.preventDefault(); };

  // Like the old ChangePassword(): send the three values, show the answer, then empty the fields
  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword, confirmNewPassword }),
      });
      const json = await res.json().catch(() => ({}));
      setMessage(json.success
        ? { text: 'Password berhasil diubah.', ok: true }
        : { text: json.error || 'Gagal mengubah password.', ok: false });
    } catch {
      setMessage({ text: 'Gagal mengubah password.', ok: false });
    } finally {
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setSaving(false);
      oldRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/30">
      <div role="dialog" aria-modal="true" aria-label="Change Password" className={`w-full max-w-[507px] shadow-2xl ${c.page}`}>
        <form
          autoComplete="off"
          onSubmit={(e) => { e.preventDefault(); submit(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        >
          <GroupBox caption="Change password.." isDark={isDark}>
            <div className="flex flex-col gap-1.5">
              <FieldRow label="Old Password" isDark={isDark} labelWidth="w-40">
                <LegacyInput ref={oldRef} autoFocus isDark={isDark} type="password" autoComplete="current-password" maxLength={15}
                  value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} onKeyDown={ignoreEnter} className="py-1.5" />
              </FieldRow>
              <FieldRow label="New Password" isDark={isDark} labelWidth="w-40">
                <LegacyInput isDark={isDark} type="password" autoComplete="new-password" maxLength={15}
                  value={newPassword} onChange={(e) => setNewPassword(e.target.value)} onKeyDown={ignoreEnter} className="py-1.5" />
              </FieldRow>
              <FieldRow label="Confirm New Password" isDark={isDark} labelWidth="w-40">
                <LegacyInput isDark={isDark} type="password" autoComplete="new-password" maxLength={15}
                  value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className="py-1.5" />
              </FieldRow>
            </div>
            {message && (
              <div role="status" className={`px-2 py-1 rounded border font-semibold ${message.ok
                ? (isDark ? 'bg-emerald-950 border-emerald-800 text-emerald-200' : 'bg-emerald-50 border-emerald-300 text-emerald-800')
                : (isDark ? 'bg-rose-950 border-rose-800 text-rose-200' : 'bg-rose-50 border-rose-300 text-rose-800')}`}>
                {message.text}
              </div>
            )}
            <div className="grid grid-cols-2 gap-1">
              <LegacyButton isDark={isDark} type="submit" disabled={saving} className="h-10 justify-center text-[13px]">OK</LegacyButton>
              <LegacyButton isDark={isDark} onClick={onClose} className="h-10 justify-center text-[13px]">CLOSE</LegacyButton>
            </div>
          </GroupBox>
        </form>
      </div>
    </div>
  );
}

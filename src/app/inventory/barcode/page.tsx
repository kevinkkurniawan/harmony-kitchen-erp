'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import BarcodePrintManager from '@/components/BarcodePrintManager';

export default function BarcodePage() {
  const router = useRouter();

  return (
    <AuthGuard>
      {() => (
        <BarcodePrintManager
          isDark={false}
          onBack={() => router.push('/')}
        />
      )}
    </AuthGuard>
  );
}

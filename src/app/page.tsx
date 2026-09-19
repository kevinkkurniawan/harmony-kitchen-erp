'use client';

import ERPDashboard from '@/components/ERPDashboard';
import AuthGuard from '@/components/AuthGuard';

export default function Page() {
  return (
    <AuthGuard>
      {({ user, permissions, logout }) => <ERPDashboard currentUser={user} userPermissions={permissions} onLogout={logout} />}
    </AuthGuard>
  );
}

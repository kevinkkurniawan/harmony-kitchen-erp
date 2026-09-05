import ERPDashboard from '@/components/ERPDashboard';
import AuthGuard from '@/components/AuthGuard';

export default function Page() {
  return (
    <AuthGuard>
      <ERPDashboard />
    </AuthGuard>
  );
}

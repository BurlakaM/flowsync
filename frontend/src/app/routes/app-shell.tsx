import { Outlet, useNavigate } from 'react-router';
import { AppLayout } from '@/components/layouts/app-layout';
import { EmailVerificationBanner, useLogout, useMe } from '@/features/auth';
import { NotificationsLink } from '@/features/notifications';
import { useRealtimeSync } from '../realtime/use-realtime-sync';

/** The layout of all signed-in pages; it connects the shared layout to the auth feature. */
export default function AppShell() {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  useRealtimeSync();

  return (
    <AppLayout
      userName={me.data?.name}
      navExtra={<NotificationsLink />}
      onLogout={() => {
        logout();
        navigate('/login', { replace: true });
      }}
    >
      <EmailVerificationBanner />
      <Outlet />
    </AppLayout>
  );
}

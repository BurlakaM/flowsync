import { Outlet, useNavigate } from 'react-router';
import { AppLayout } from '@/components/layouts/app-layout';
import { useLogout, useMe } from '@/features/auth';

/** The layout of all signed-in pages; it connects the shared layout to the auth feature. */
export default function AppShell() {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <AppLayout
      userName={me.data?.name}
      onLogout={() => {
        logout();
        navigate('/login', { replace: true });
      }}
    >
      <Outlet />
    </AppLayout>
  );
}

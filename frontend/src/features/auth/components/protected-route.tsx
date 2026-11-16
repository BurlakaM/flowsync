import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageSpinner } from '@/components/spinner';
import { getErrorStatus } from '@/lib/api-client';
import { authStorage } from '@/lib/auth-storage';
import { useMe } from '../api/get-me';
import { useRestoreSession } from '../api/restore-session';
import { buildLoginPath } from '../utils/redirect';

/** Renders the nested routes only for a signed-in user; everyone else is sent to the login page. */
export function ProtectedRoute() {
  const location = useLocation();
  const restore = useRestoreSession();
  const me = useMe();
  const loginPath = buildLoginPath(location.pathname + location.search);

  if (!authStorage.hasToken()) {
    // A reload dropped the in-memory token: wait for the refresh cookie to bring it back.
    if (restore.isFetching) return <FullPageSpinner />;
    return <Navigate to={loginPath} replace />;
  }
  if (me.isPending) return <FullPageSpinner />;

  if (me.isError) {
    // An expired token is already cleared by the API client; anything else is a real failure
    // that the route error boundary should show.
    if (getErrorStatus(me.error) === 401) {
      return <Navigate to={loginPath} replace />;
    }
    throw me.error;
  }

  return <Outlet />;
}

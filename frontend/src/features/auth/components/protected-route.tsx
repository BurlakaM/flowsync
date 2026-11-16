import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageSpinner } from '@/components/spinner';
import { getErrorStatus } from '@/lib/api-client';
import { authStorage } from '@/lib/auth-storage';
import { useMe } from '../api/get-me';
import { buildLoginPath } from '../utils/redirect';

/** Renders the nested routes only for a signed-in user; everyone else is sent to the login page. */
export function ProtectedRoute() {
  const location = useLocation();
  const me = useMe();
  const loginPath = buildLoginPath(location.pathname + location.search);

  if (!authStorage.hasToken()) return <Navigate to={loginPath} replace />;
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

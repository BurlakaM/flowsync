import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { authStorage } from '@/lib/auth-storage';

/** Returns a function that ends the session: the refresh cookie is revoked, the token and every cached response are dropped. */
export function useLogout() {
  const queryClient = useQueryClient();

  return () => {
    // The user is signed out locally at once; a failed request only leaves a cookie that expires by itself.
    void apiClient.post('/auth/logout').catch(() => undefined);
    authStorage.clear();
    queryClient.clear();
  };
}

import { useQuery } from '@tanstack/react-query';
import { refreshSession } from '@/lib/api-client';
import { authStorage } from '@/lib/auth-storage';
import { authKeys } from './get-me';

/**
 * After a reload the access token (kept in memory) is gone, but the httpOnly refresh cookie may still
 * be valid. This asks the API for a new token. It runs only while there is no token, and never retries:
 * a refused cookie simply means "signed out".
 */
export function useRestoreSession() {
  return useQuery({
    queryKey: authKeys.session,
    queryFn: async () => {
      await refreshSession();
      return true;
    },
    enabled: !authStorage.hasToken(),
    retry: false,
    staleTime: Infinity,
  });
}

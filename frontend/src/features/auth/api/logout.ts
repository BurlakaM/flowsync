import { useQueryClient } from '@tanstack/react-query';
import { authStorage } from '@/lib/auth-storage';

/** Returns a function that ends the session: the token and every cached response are dropped. */
export function useLogout() {
  const queryClient = useQueryClient();

  return () => {
    authStorage.clear();
    queryClient.clear();
  };
}

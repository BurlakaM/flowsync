import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { authKeys } from './get-me';

/** Confirms the address with the token from the emailed link. */
export function useVerifyEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      apiClient.post<void>('/auth/verify-email', { token }),
    // A signed-in user's banner goes away at once.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.me }),
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: () => apiClient.post<void>('/auth/resend-verification'),
  });
}

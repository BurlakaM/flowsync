import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/** Always succeeds from the user's point of view: the API does not reveal whether the address has an account. */
export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) =>
      apiClient.post<void>('/auth/forgot-password', { email }),
  });
}

/** `token` comes from the emailed link. Every session of the user ends, so nothing is cached afterwards. */
export function useResetPassword() {
  return useMutation({
    mutationFn: (input: { token: string; password: string }) =>
      apiClient.post<void>('/auth/reset-password', input),
  });
}

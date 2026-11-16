import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { authStorage } from '@/lib/auth-storage';
import type { LoginInput, LoginResponse } from '../types';
import { authKeys } from './get-me';

export const login = (input: LoginInput) =>
  apiClient.post<LoginResponse>('/auth/login', input);

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    onSuccess: async ({ access_token }) => {
      authStorage.setToken(access_token);
      // Forget anything cached for a previous user.
      await queryClient.invalidateQueries({ queryKey: authKeys.me });
    },
  });
}

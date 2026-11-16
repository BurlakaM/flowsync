import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { authStorage } from '@/lib/auth-storage';
import type { RegisterInput, User } from '../types';
import { authKeys } from './get-me';
import { login } from './login';

export const register = (input: RegisterInput) =>
  apiClient.post<User>('/auth/register', input);

/** Creates the account and signs in at once: the API returns no token on registration. */
export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RegisterInput) => {
      await register(input);
      return login({ email: input.email, password: input.password });
    },
    onSuccess: async ({ access_token }) => {
      authStorage.setToken(access_token);
      await queryClient.invalidateQueries({ queryKey: authKeys.me });
    },
  });
}

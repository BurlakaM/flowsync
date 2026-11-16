import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { authStorage } from '@/lib/auth-storage';
import type { User } from '../types';

export const authKeys = {
  me: ['auth', 'me'] as const,
};

export const getMe = () => apiClient.get<User>('/auth/me');

/** The signed-in user. Disabled (and never requested) while there is no stored token. */
export function useMe() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: getMe,
    enabled: authStorage.hasToken(),
  });
}

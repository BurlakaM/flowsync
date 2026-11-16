import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Page, Schemas } from '@/types/api';
import type { Notification } from '../types';

export const NOTIFICATIONS_PAGE_SIZE = 20;
/** How often the badge in the header asks whether something new arrived. */
export const UNREAD_POLL_MS = 30_000;

export const notificationsKeys = {
  all: ['notifications'] as const,
  list: (page: number, unreadOnly: boolean) =>
    [...notificationsKeys.all, 'list', page, unreadOnly] as const,
  unreadCount: () => [...notificationsKeys.all, 'unread-count'] as const,
};

export const useNotifications = (page: number, unreadOnly: boolean) =>
  useQuery({
    queryKey: notificationsKeys.list(page, unreadOnly),
    queryFn: () =>
      apiClient.get<Page<Notification>>('/notifications', {
        params: {
          page,
          limit: NOTIFICATIONS_PAGE_SIZE,
          ...(unreadOnly && { unread: true }),
        },
      }),
    staleTime: 0,
    placeholderData: keepPreviousData,
  });

export const useUnreadCount = () =>
  useQuery({
    queryKey: notificationsKeys.unreadCount(),
    queryFn: () =>
      apiClient.get<Schemas['UnreadCountDto']>('/notifications/unread-count'),
    refetchInterval: UNREAD_POLL_MS,
  });

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.post(`/notifications/${id}/read`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all }),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post('/notifications/read-all'),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all }),
  });
}

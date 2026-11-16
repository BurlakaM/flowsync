import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Comment } from '../types';
import { commentsKeys } from './comments-keys';

export function useCreateComment(taskId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      apiClient.post<Comment>(`/tasks/${taskId}/comments`, { text }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: commentsKeys.all }),
  });
}

export function useUpdateComment(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      apiClient.patch<Comment>(`/comments/${id}`, { text }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: commentsKeys.all }),
  });
}

export function useDeleteComment(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete(`/comments/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: commentsKeys.all }),
  });
}

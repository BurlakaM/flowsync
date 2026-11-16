import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Tag } from '../types';
import { tasksKeys } from './tasks-keys';

export const useTags = (projectId: number) =>
  useQuery({
    queryKey: tasksKeys.tags(projectId),
    queryFn: () => apiClient.get<Tag[]>(`/projects/${projectId}/tags`),
  });

export function useCreateTag(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiClient.post<Tag>(`/projects/${projectId}/tags`, { name }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: tasksKeys.tags(projectId) }),
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/tags/${id}`),
    // Tasks show their tags, so they have to be reloaded as well.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKeys.all }),
  });
}

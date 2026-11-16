import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { TaskDetails, TaskInput } from '../types';
import { tasksKeys } from './tasks-keys';

export function useCreateTask(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskInput) =>
      apiClient.post<TaskDetails>(`/projects/${projectId}/tasks`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKeys.all }),
  });
}

/** Updates any subset of the fields: the status select sends only `{ status }`. */
export function useUpdateTask(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<TaskInput>) =>
      apiClient.patch<TaskDetails>(`/tasks/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKeys.all }),
  });
}

export function useDeleteTask(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete(`/tasks/${id}`),
    onSuccess: () => {
      // The task is gone: drop its detail instead of refetching a 404.
      queryClient.removeQueries({ queryKey: tasksKeys.detail(id) });
      return queryClient.invalidateQueries({ queryKey: tasksKeys.lists() });
    },
  });
}

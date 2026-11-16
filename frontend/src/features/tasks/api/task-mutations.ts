import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Page } from '@/types/api';
import type { Task, TaskDetails, TaskInput, TaskStatus } from '../types';
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

/**
 * Moves a task to another status from the board. The card jumps at once and goes back if the API refuses,
 * because waiting for the answer makes dragging feel broken.
 */
export function useMoveTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: TaskStatus }) =>
      apiClient.patch<TaskDetails>(`/tasks/${id}`, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: tasksKeys.lists() });
      const snapshots = queryClient.getQueriesData<Page<Task>>({
        queryKey: tasksKeys.lists(),
      });
      queryClient.setQueriesData<Page<Task>>(
        { queryKey: tasksKeys.lists() },
        (page) =>
          page && {
            ...page,
            items: page.items.map((task) =>
              task.id === id ? { ...task, status } : task,
            ),
          },
      );
      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      context?.snapshots.forEach(([key, data]) =>
        queryClient.setQueryData(key, data),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: tasksKeys.all }),
  });
}

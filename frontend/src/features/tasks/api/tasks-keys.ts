import type { TaskFilters } from '../types';

export const tasksKeys = {
  all: ['tasks'] as const,
  lists: () => [...tasksKeys.all, 'list'] as const,
  list: (projectId: number, filters: TaskFilters) =>
    [...tasksKeys.lists(), projectId, filters] as const,
  detail: (id: number) => [...tasksKeys.all, 'detail', id] as const,
  tags: (projectId: number) => [...tasksKeys.all, 'tags', projectId] as const,
};

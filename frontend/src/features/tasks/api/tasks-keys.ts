import type { TaskFilters, TaskStatus } from '../types';

export const tasksKeys = {
  all: ['tasks'] as const,
  lists: () => [...tasksKeys.all, 'list'] as const,
  list: (projectId: number, filters: TaskFilters, limit: number) =>
    [...tasksKeys.lists(), projectId, filters, limit] as const,
  count: (projectId: number, status: TaskStatus, scope: object) =>
    [...tasksKeys.all, 'count', projectId, status, scope] as const,
  detail: (id: number) => [...tasksKeys.all, 'detail', id] as const,
  tags: (projectId: number) => [...tasksKeys.all, 'tags', projectId] as const,
};

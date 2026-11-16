import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Page } from '@/types/api';
import { TASKS_PAGE_SIZE } from '../constants';
import type { Task, TaskFilters } from '../types';
import { tasksKeys } from './tasks-keys';

export const getProjectTasks = (
  projectId: number,
  filters: TaskFilters,
  limit: number,
) =>
  apiClient.get<Page<Task>>(`/projects/${projectId}/tasks`, {
    params: { ...filters, limit },
  });

/** `limit` is the page size: the list pages through tasks, the board loads as many as the API allows at once. */
export const useProjectTasks = (
  projectId: number,
  filters: TaskFilters,
  limit: number = TASKS_PAGE_SIZE,
) =>
  useQuery({
    queryKey: tasksKeys.list(projectId, filters, limit),
    queryFn: () => getProjectTasks(projectId, filters, limit),
    // Keep the current page on screen while a filter or the page changes.
    placeholderData: keepPreviousData,
  });

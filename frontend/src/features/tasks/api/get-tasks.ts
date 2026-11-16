import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Page } from '@/types/api';
import { TASKS_PAGE_SIZE } from '../constants';
import type { Task, TaskFilters } from '../types';
import { tasksKeys } from './tasks-keys';

export const getProjectTasks = (projectId: number, filters: TaskFilters) =>
  apiClient.get<Page<Task>>(`/projects/${projectId}/tasks`, {
    params: { ...filters, limit: TASKS_PAGE_SIZE },
  });

export const useProjectTasks = (projectId: number, filters: TaskFilters) =>
  useQuery({
    queryKey: tasksKeys.list(projectId, filters),
    queryFn: () => getProjectTasks(projectId, filters),
    // Keep the current page on screen while a filter or the page changes.
    placeholderData: keepPreviousData,
  });

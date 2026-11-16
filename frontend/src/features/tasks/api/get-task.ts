import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { TaskDetails } from '../types';
import { tasksKeys } from './tasks-keys';

export const getTask = (id: number) =>
  apiClient.get<TaskDetails>(`/tasks/${id}`);

export const useTask = (id: number) =>
  useQuery({
    queryKey: tasksKeys.detail(id),
    queryFn: () => getTask(id),
    // A malformed id in the URL is answered on the page itself, without a request.
    enabled: Number.isInteger(id) && id > 0,
  });

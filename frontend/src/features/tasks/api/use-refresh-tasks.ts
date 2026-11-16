import { useQueryClient } from '@tanstack/react-query';
import { tasksKeys } from './tasks-keys';

/**
 * Reloads cached tasks. Pages that change things a task displays (its number of comments)
 * call it, because the comments feature does not know about tasks.
 */
export function useRefreshTasks() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: tasksKeys.all });
}

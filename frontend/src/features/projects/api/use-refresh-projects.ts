import { useQueryClient } from '@tanstack/react-query';
import { projectsKeys } from './projects-keys';

/**
 * Reloads cached projects. Pages that change things a project displays (its number of tasks)
 * call it, because the tasks feature does not know about projects.
 */
export function useRefreshProjects() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: projectsKeys.all });
}

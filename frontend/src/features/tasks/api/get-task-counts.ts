import { keepPreviousData, useQueries } from '@tanstack/react-query';
import { TASK_STATUSES } from '../constants';
import type { TaskFilters, TaskStatus } from '../types';
import { getProjectTasks } from './get-tasks';
import { tasksKeys } from './tasks-keys';

/** What narrows the counts: the status is what is being counted, and ordering and paging do not matter. */
export type TaskCountScope = Pick<
  TaskFilters,
  'assigneeId' | 'tagId' | 'search'
>;

export interface TaskCounts {
  TODO?: number;
  IN_PROGRESS?: number;
  DONE?: number;
  /** The sum over all statuses; known only once every count is. */
  all?: number;
}

/**
 * How many tasks each status has, under the same assignee, tag and search filters as the list. The API has no
 * counting endpoint, but every page carries the total, so one task per status is enough (three tiny requests).
 */
export function useTaskCounts(
  projectId: number,
  scope: TaskCountScope,
): TaskCounts {
  const results = useQueries({
    queries: TASK_STATUSES.map((status) => ({
      queryKey: tasksKeys.count(projectId, status, scope),
      queryFn: async () => {
        const page = await getProjectTasks(
          projectId,
          { ...scope, status, sortBy: 'createdAt', order: 'desc', page: 1 },
          1,
        );
        return page.meta.total;
      },
      placeholderData: keepPreviousData,
    })),
  });

  const counts: TaskCounts = {};
  TASK_STATUSES.forEach((status: TaskStatus, index) => {
    counts[status] = results[index]?.data;
  });
  counts.all = TASK_STATUSES.every((status) => counts[status] !== undefined)
    ? TASK_STATUSES.reduce((sum, status) => sum + (counts[status] ?? 0), 0)
    : undefined;
  return counts;
}

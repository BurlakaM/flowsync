import { TASK_STATUSES } from '../constants';
import type { Task, TaskStatus } from '../types';

/** Tasks per column, in the order they came from the API. Every status has a column, even an empty one. */
export function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const columns: Record<TaskStatus, Task[]> = {
    TODO: [],
    IN_PROGRESS: [],
    DONE: [],
  };
  for (const task of tasks) columns[task.status].push(task);
  return columns;
}

/**
 * The status a card should get when dropped on `overId` (the id of a column), or null when nothing
 * has to change: dropped outside the columns, on its own column, or on something unknown.
 */
export function getDropStatus(
  currentStatus: TaskStatus,
  overId: unknown,
): TaskStatus | null {
  const target = TASK_STATUSES.find((status) => status === overId);
  return target && target !== currentStatus ? target : null;
}

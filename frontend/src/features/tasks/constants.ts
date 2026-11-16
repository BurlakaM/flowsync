import type { SortOrder, TaskSortBy, TaskStatus } from './types';

export const TASK_STATUSES: readonly TaskStatus[] = [
  'TODO',
  'IN_PROGRESS',
  'DONE',
];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
};

export const TASKS_PAGE_SIZE = 20;

export interface SortOption {
  value: string;
  label: string;
  sortBy: TaskSortBy;
  order: SortOrder;
}

export const SORT_OPTIONS: readonly SortOption[] = [
  {
    value: 'createdAt:desc',
    label: 'Newest first',
    sortBy: 'createdAt',
    order: 'desc',
  },
  {
    value: 'createdAt:asc',
    label: 'Oldest first',
    sortBy: 'createdAt',
    order: 'asc',
  },
  {
    value: 'updatedAt:desc',
    label: 'Recently updated',
    sortBy: 'updatedAt',
    order: 'desc',
  },
  { value: 'name:asc', label: 'Name A–Z', sortBy: 'name', order: 'asc' },
  { value: 'name:desc', label: 'Name Z–A', sortBy: 'name', order: 'desc' },
];

import { tKey } from '@/i18n/t-key';
import type { SortOrder, TaskSortBy, TaskStatus } from './types';

export const TASK_STATUSES: readonly TaskStatus[] = [
  'TODO',
  'IN_PROGRESS',
  'DONE',
];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: tKey('To do'),
  IN_PROGRESS: tKey('In progress'),
  DONE: tKey('Done'),
};

export const TASKS_PAGE_SIZE = 20;

/** The most tasks one request can return (the API limit): the board shows them all without paging. */
export const BOARD_PAGE_SIZE = 100;

export interface SortOption {
  value: string;
  label: string;
  sortBy: TaskSortBy;
  order: SortOrder;
}

export const SORT_OPTIONS: readonly SortOption[] = [
  {
    value: 'createdAt:desc',
    label: tKey('Newest first'),
    sortBy: 'createdAt',
    order: 'desc',
  },
  {
    value: 'createdAt:asc',
    label: tKey('Oldest first'),
    sortBy: 'createdAt',
    order: 'asc',
  },
  {
    value: 'updatedAt:desc',
    label: tKey('Recently updated'),
    sortBy: 'updatedAt',
    order: 'desc',
  },
  { value: 'name:asc', label: tKey('Name A–Z'), sortBy: 'name', order: 'asc' },
  {
    value: 'name:desc',
    label: tKey('Name Z–A'),
    sortBy: 'name',
    order: 'desc',
  },
  // Offered only while a search is active (see TaskFiltersBar).
  {
    value: 'relevance:desc',
    label: tKey('Best match'),
    sortBy: 'relevance',
    order: 'desc',
  },
];

import { TASK_STATUSES } from '../constants';
import type { TaskFilters, TaskSortBy, TaskStatus } from '../types';

const SORT_FIELDS: readonly TaskSortBy[] = ['createdAt', 'updatedAt', 'name'];

const positiveInt = (value: string | null): number | undefined => {
  const number = Number(value);
  return value !== null && Number.isInteger(number) && number > 0
    ? number
    : undefined;
};

/** Reads the filters from a query string. Anything unknown or malformed falls back to the default. */
export function parseTaskFilters(params: URLSearchParams): TaskFilters {
  const status = params.get('status');
  const sortBy = params.get('sortBy');
  const order = params.get('order');

  return {
    status: TASK_STATUSES.includes(status as TaskStatus)
      ? (status as TaskStatus)
      : undefined,
    assigneeId: positiveInt(params.get('assigneeId')),
    tagId: positiveInt(params.get('tagId')),
    search: params.get('search')?.trim() || undefined,
    sortBy: SORT_FIELDS.includes(sortBy as TaskSortBy)
      ? (sortBy as TaskSortBy)
      : 'createdAt',
    order: order === 'asc' ? 'asc' : 'desc',
    page: positiveInt(params.get('page')) ?? 1,
  };
}

/**
 * Applies a change to the query string. Defaults are left out to keep URLs short, and any change
 * other than the page itself returns to the first page (the old page may not exist any more).
 */
export function applyTaskFilters(
  params: URLSearchParams,
  changes: Partial<TaskFilters>,
): URLSearchParams {
  const next = parseTaskFilters(params);
  const merged: TaskFilters = {
    ...next,
    ...changes,
    page: 'page' in changes ? (changes.page ?? 1) : 1,
  };

  const result = new URLSearchParams(params);
  const set = (key: string, value: string | undefined) => {
    if (value) result.set(key, value);
    else result.delete(key);
  };
  set('status', merged.status);
  set('assigneeId', merged.assigneeId?.toString());
  set('tagId', merged.tagId?.toString());
  set('search', merged.search?.trim());
  // The default ordering (newest first) is left out; any other one is written as a pair.
  const defaultSort = merged.sortBy === 'createdAt' && merged.order === 'desc';
  set('sortBy', defaultSort ? undefined : merged.sortBy);
  set('order', defaultSort ? undefined : merged.order);
  set('page', merged.page > 1 ? String(merged.page) : undefined);
  return result;
}

/** True when any filter that narrows the list is set (the empty state then reads "no matches"). */
export const hasActiveFilters = (filters: TaskFilters): boolean =>
  Boolean(
    filters.status || filters.assigneeId || filters.tagId || filters.search,
  );

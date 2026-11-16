import type { Schemas } from '@/types/api';

export type Task = Schemas['TaskResponseDto'];
export type TaskDetails = Schemas['TaskDetailsDto'];
export type TaskTag = Schemas['TaskTagDto'];
export type Tag = Schemas['TagResponseDto'];
export type TaskStatus = Task['status'];

/** What the task form always sends: every field is set, the API accepts any subset when updating. */
export type TaskInput = Required<
  Pick<
    Schemas['CreateTaskDto'],
    'name' | 'description' | 'status' | 'assigneeIds' | 'tagIds'
  >
>;

/** A person a task can be assigned to; the page that composes features supplies them (e.g. project members). */
export interface AssigneeOption {
  id: number;
  name: string;
}

export type TaskSortBy = 'createdAt' | 'updatedAt' | 'name';
export type SortOrder = 'asc' | 'desc';

/** Everything the list of tasks can be narrowed or ordered by; mirrors the query string of the page. */
export interface TaskFilters {
  status?: TaskStatus;
  assigneeId?: number;
  tagId?: number;
  search?: string;
  sortBy: TaskSortBy;
  order: SortOrder;
  page: number;
}

import type { UserSummary } from '@/types/api';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface TaskTag {
  id: number;
  name: string;
}

export interface Tag extends TaskTag {
  projectId: number;
  createdAt: string;
}

export interface Task {
  id: number;
  name: string;
  description: string | null;
  status: TaskStatus;
  projectId: number;
  createdById: number | null;
  assignees: UserSummary[];
  tags: TaskTag[];
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDetails extends Task {
  project: { id: number; name: string };
  /** Null when the account of the author was deleted. */
  createdBy: UserSummary | null;
}

export interface TaskInput {
  name: string;
  description: string;
  status: TaskStatus;
  assigneeIds: number[];
  tagIds: number[];
}

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

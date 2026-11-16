/** Pagination block of every list response of the API. */
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Page<T> {
  items: T[];
  meta: PageMeta;
}

/** A user as embedded in other responses (project owner, task assignee, comment author). */
export interface UserSummary {
  id: number;
  name: string;
}

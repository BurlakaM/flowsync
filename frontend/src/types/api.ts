import type { components } from './api.generated';

/** Schemas generated from backend/openapi.json (`npm run api:types`): the single source of truth for API shapes. */
export type Schemas = components['schemas'];

export type PageMeta = Schemas['PageMetaDto'];

/** The generated page types differ only by `items`; this generic describes all of them. */
export interface Page<T> {
  items: T[];
  meta: PageMeta;
}

/** A user as embedded in other responses (project owner, task assignee, comment author). */
export type UserSummary = Schemas['UserSummaryDto'];

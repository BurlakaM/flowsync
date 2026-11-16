import type { ProjectListParams } from '../types';

export const projectsKeys = {
  all: ['projects'] as const,
  lists: () => [...projectsKeys.all, 'list'] as const,
  list: (params: ProjectListParams) =>
    [...projectsKeys.lists(), params] as const,
  detail: (id: number) => [...projectsKeys.all, 'detail', id] as const,
};

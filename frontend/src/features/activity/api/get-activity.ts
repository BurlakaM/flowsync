import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { CursorPage } from '@/types/api';
import type { Activity } from '../types';

export const ACTIVITY_PAGE_SIZE = 15;

export const activityKeys = {
  all: ['activity'] as const,
  list: (projectId: number) => [...activityKeys.all, projectId] as const,
};

/**
 * The feed grows all the time, so it is read by cursor: "show older" asks for what comes after the
 * last entry already shown, and entries that arrive meanwhile never push the next page around.
 */
export const useActivity = (projectId: number) =>
  useInfiniteQuery({
    queryKey: activityKeys.list(projectId),
    queryFn: ({ pageParam }) =>
      apiClient.get<CursorPage<Activity>>(`/projects/${projectId}/activity`, {
        params: { limit: ACTIVITY_PAGE_SIZE, cursor: pageParam },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // The feed is about what just happened: always show fresh data when the page is opened.
    staleTime: 0,
  });

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Page } from '@/types/api';
import type { Activity } from '../types';

export const ACTIVITY_PAGE_SIZE = 15;

export const activityKeys = {
  all: ['activity'] as const,
  list: (projectId: number, page: number) =>
    [...activityKeys.all, projectId, page] as const,
};

export const useActivity = (projectId: number, page: number) =>
  useQuery({
    queryKey: activityKeys.list(projectId, page),
    queryFn: () =>
      apiClient.get<Page<Activity>>(`/projects/${projectId}/activity`, {
        params: { page, limit: ACTIVITY_PAGE_SIZE },
      }),
    // The feed is about what just happened: always show fresh data when the page is opened.
    staleTime: 0,
    placeholderData: keepPreviousData,
  });

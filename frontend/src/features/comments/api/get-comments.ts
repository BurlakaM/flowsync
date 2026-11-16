import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Page } from '@/types/api';
import type { Comment } from '../types';
import { commentsKeys } from './comments-keys';

export const COMMENTS_PAGE_SIZE = 50;

/** Comments come oldest first, like a conversation. */
export const useComments = (taskId: number, page: number) =>
  useQuery({
    queryKey: commentsKeys.list(taskId, page),
    queryFn: () =>
      apiClient.get<Page<Comment>>(`/tasks/${taskId}/comments`, {
        params: { page, limit: COMMENTS_PAGE_SIZE },
      }),
    placeholderData: keepPreviousData,
  });

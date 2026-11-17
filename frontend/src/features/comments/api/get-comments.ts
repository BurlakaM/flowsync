import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { CursorPage } from '@/types/api';
import type { Comment } from '../types';
import { commentsKeys } from './comments-keys';

export const COMMENTS_PAGE_SIZE = 50;

/** Comments come oldest first, like a conversation, and are read by cursor. */
export const useComments = (taskId: number) =>
  useInfiniteQuery({
    queryKey: commentsKeys.list(taskId),
    queryFn: ({ pageParam }) =>
      apiClient.get<CursorPage<Comment>>(`/tasks/${taskId}/comments`, {
        params: { limit: COMMENTS_PAGE_SIZE, cursor: pageParam },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

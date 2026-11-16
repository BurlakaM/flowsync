import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Pagination } from '@/components/pagination';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import { COMMENTS_PAGE_SIZE, useComments } from '../api/get-comments';
import { CommentForm } from './comment-form';
import { CommentItem } from './comment-item';

interface CommentsSectionProps {
  taskId: number;
  /** The signed-in user: decides which comments can be edited. */
  currentUserId: number;
  /** The owner of the project may delete any comment (moderation). */
  isProjectOwner: boolean;
  /** Called after a comment was added or deleted, so the page can refresh counters shown elsewhere. */
  onChanged?: () => void;
}

export function CommentsSection({
  taskId,
  currentUserId,
  isProjectOwner,
  onChanged,
}: CommentsSectionProps) {
  const [page, setPage] = useState(1);
  const { t } = useTranslation();
  const comments = useComments(taskId, page);

  return (
    <section aria-labelledby="comments-heading" className="space-y-4">
      <h2 id="comments-heading" className="text-lg font-semibold">
        {t('Comments')}
      </h2>

      {comments.isPending ? (
        <LoadingState label={t('Loading comments')} />
      ) : comments.isError ? (
        <ErrorState
          error={comments.error}
          title={t('Could not load comments')}
          onRetry={() => void comments.refetch()}
        />
      ) : comments.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('No comments yet. Start the conversation below.')}
        </p>
      ) : (
        <>
          <ul className="divide-y">
            {comments.data.items.map((comment) => {
              const isAuthor = comment.author?.id === currentUserId;
              return (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  canEdit={isAuthor}
                  canDelete={isAuthor || isProjectOwner}
                  onDeleted={() => {
                    // The last comment of a page is gone: go back instead of showing an empty page.
                    if (comments.data.items.length === 1 && page > 1) {
                      setPage(page - 1);
                    }
                    onChanged?.();
                  }}
                />
              );
            })}
          </ul>
          <Pagination
            page={comments.data.meta.page}
            totalPages={comments.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      <CommentForm
        taskId={taskId}
        onCreated={() => {
          // New comments are added at the end: show the page that contains it.
          const total = comments.data?.meta.total ?? 0;
          setPage(Math.max(1, Math.ceil((total + 1) / COMMENTS_PAGE_SIZE)));
          onChanged?.();
        }}
      />
    </section>
  );
}

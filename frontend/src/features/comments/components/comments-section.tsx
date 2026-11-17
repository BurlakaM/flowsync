import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import { Button } from '@/components/ui/button';
import { useComments } from '../api/get-comments';
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
  const { t } = useTranslation();
  const comments = useComments(taskId);
  const items = comments.data?.pages.flatMap((page) => page.items) ?? [];

  /** A new comment is the newest, so it sits after every page: read on until the end. */
  const showNewest = async () => {
    const lastCursor = (result: { data?: typeof comments.data }) =>
      result.data?.pages.at(-1)?.nextCursor;
    let next = lastCursor(await comments.refetch());
    while (next) next = lastCursor(await comments.fetchNextPage());
  };

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
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('No comments yet. Start the conversation below.')}
        </p>
      ) : (
        <>
          <ul className="divide-y">
            {items.map((comment) => {
              const isAuthor = comment.author?.id === currentUserId;
              return (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  canEdit={isAuthor}
                  canDelete={isAuthor || isProjectOwner}
                  onDeleted={() => onChanged?.()}
                />
              );
            })}
          </ul>
          {comments.hasNextPage && (
            <Button
              variant="outline"
              size="sm"
              disabled={comments.isFetchingNextPage}
              onClick={() => void comments.fetchNextPage()}
            >
              {t('Show more comments')}
            </Button>
          )}
        </>
      )}

      <CommentForm
        taskId={taskId}
        onCreated={() => {
          void showNewest();
          onChanged?.();
        }}
      />
    </section>
  );
}

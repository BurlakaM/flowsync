import { useTranslation } from 'react-i18next';
import { formatDateTime } from '@/lib/format-date';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Spinner } from '@/components/spinner';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/api-client';
import { useDeleteComment, useUpdateComment } from '../api/comment-mutations';
import type { Comment } from '../types';

interface CommentItemProps {
  comment: Comment;
  /** Only the author edits a comment. */
  canEdit: boolean;
  /** The author and the owner of the project may delete it. */
  canDelete: boolean;
  onDeleted: () => void;
}

export function CommentItem({
  comment,
  canEdit,
  canDelete,
  onDeleted,
}: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(comment.text);
  const update = useUpdateComment(comment.id);
  const remove = useDeleteComment(comment.id);

  const edited = comment.updatedAt !== comment.createdAt;
  const trimmed = draft.trim();

  return (
    <li className="flex gap-3 py-4">
      <Avatar
        name={comment.author?.name ?? t('Deleted user')}
        seed={comment.author?.id ?? 0}
        decorative
      />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span className="font-medium">
            {comment.author?.name ?? t('Deleted user')}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDateTime(comment.createdAt)}
            {edited && ` (${t('edited')})`}
          </span>
        </div>

        {editing ? (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!trimmed) return;
              update.mutate(trimmed, { onSuccess: () => setEditing(false) });
            }}
          >
            <Textarea
              aria-label={t('Edit comment')}
              rows={3}
              value={draft}
              maxLength={5000}
              onChange={(event) => setDraft(event.target.value)}
            />
            {update.isError && (
              <p role="alert" className="text-sm text-destructive">
                {getErrorMessage(update.error)}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={update.isPending || !trimmed}
              >
                {update.isPending && <Spinner className="text-current" />}
                {t('Save')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setDraft(comment.text);
                  update.reset();
                }}
              >
                {t('Cancel')}
              </Button>
            </div>
          </form>
        ) : (
          <p className="whitespace-pre-wrap text-sm">{comment.text}</p>
        )}

        {!editing && (canEdit || canDelete) && (
          <div className="flex gap-2">
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                aria-label={t('Edit comment by {{name}}', {
                  name: comment.author?.name ?? t('deleted user'),
                })}
                onClick={() => setEditing(true)}
              >
                {t('Edit')}
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                aria-label={t('Delete comment by {{name}}', {
                  name: comment.author?.name ?? t('deleted user'),
                })}
                onClick={() => setConfirming(true)}
              >
                {t('Delete')}
              </Button>
            )}
          </div>
        )}

        <ConfirmDialog
          open={confirming}
          onOpenChange={(next) => {
            if (!next) remove.reset();
            setConfirming(next);
          }}
          title={t('Delete this comment?')}
          description={t('This cannot be undone.')}
          confirmLabel={t('Delete comment')}
          isPending={remove.isPending}
          error={remove.isError ? getErrorMessage(remove.error) : null}
          onConfirm={() =>
            remove.mutate(undefined, {
              onSuccess: () => {
                setConfirming(false);
                onDeleted();
              },
            })
          }
        />
      </div>
    </li>
  );
}

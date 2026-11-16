import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Spinner } from '@/components/spinner';
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

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

export function CommentItem({
  comment,
  canEdit,
  canDelete,
  onDeleted,
}: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(comment.text);
  const update = useUpdateComment(comment.id);
  const remove = useDeleteComment(comment.id);

  const edited = comment.updatedAt !== comment.createdAt;
  const trimmed = draft.trim();

  return (
    <li className="space-y-2 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">
          {comment.author?.name ?? 'Deleted user'}
        </span>
        <span className="text-muted-foreground">
          {formatDateTime(comment.createdAt)}
          {edited && ' (edited)'}
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
            aria-label="Edit comment"
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
              Save
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
              Cancel
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
              aria-label={`Edit comment by ${comment.author?.name ?? 'deleted user'}`}
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Delete comment by ${comment.author?.name ?? 'deleted user'}`}
              onClick={() => setConfirming(true)}
            >
              Delete
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
        title="Delete this comment?"
        description="This cannot be undone."
        confirmLabel="Delete comment"
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
    </li>
  );
}

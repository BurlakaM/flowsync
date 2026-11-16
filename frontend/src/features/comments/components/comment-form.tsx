import { useTranslation } from 'react-i18next';
import { tKey } from '@/i18n/t-key';
import { FormFieldError } from '@/components/form/form-field-error';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Spinner } from '@/components/spinner';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/api-client';
import { useCreateComment } from '../api/comment-mutations';
import type { Comment } from '../types';

const commentSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, tKey('Write something first'))
    .max(5000, tKey('Use at most 5000 characters')),
});

type CommentValues = z.infer<typeof commentSchema>;

interface CommentFormProps {
  taskId: number;
  onCreated: (comment: Comment) => void;
}

export function CommentForm({ taskId, onCreated }: CommentFormProps) {
  const { t } = useTranslation();
  const create = useCreateComment(taskId);
  const form = useForm<CommentValues>({
    resolver: zodResolver(commentSchema),
    defaultValues: { text: '' },
  });

  const submit = form.handleSubmit(({ text }) =>
    create.mutate(text, {
      onSuccess: (comment) => {
        form.reset();
        onCreated(comment);
      },
    }),
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <Controller
        name="text"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="new-comment">{t('Add a comment')}</FieldLabel>
            <Textarea
              {...field}
              id="new-comment"
              rows={3}
              aria-invalid={fieldState.invalid}
            />
            {fieldState.invalid && <FormFieldError error={fieldState.error} />}
          </Field>
        )}
      />

      {create.isError && (
        <p role="alert" className="text-sm text-destructive">
          {getErrorMessage(create.error)}
        </p>
      )}

      <Button type="submit" disabled={create.isPending}>
        {create.isPending && <Spinner className="text-current" />}
        {t('Comment')}
      </Button>
    </form>
  );
}

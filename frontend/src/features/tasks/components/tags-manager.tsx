import { useTranslation } from 'react-i18next';
import { useState, type FormEvent } from 'react';
import { LoadingState } from '@/components/states/loading-state';
import { ErrorState } from '@/components/states/error-state';
import { Spinner } from '@/components/spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getErrorMessage } from '@/lib/api-client';
import { useCreateTag, useDeleteTag, useTags } from '../api/tags';

interface TagsManagerProps {
  projectId: number;
  /** Only the owner of the project changes tags (the API enforces it too). */
  canManage: boolean;
}

export function TagsManager({ projectId, canManage }: TagsManagerProps) {
  const { t } = useTranslation();
  const tags = useTags(projectId);
  const create = useCreateTag(projectId);
  const remove = useDeleteTag();
  const [name, setName] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate(trimmed, { onSuccess: () => setName('') });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Tags')}</CardTitle>
        <CardDescription>
          {t('Labels that group tasks of the project.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tags.isPending ? (
          <LoadingState label={t('Loading tags')} />
        ) : tags.isError ? (
          <ErrorState
            error={tags.error}
            title={t('Could not load tags')}
            onRetry={() => void tags.refetch()}
          />
        ) : tags.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('No tags yet.')}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {tags.data.map((tag) => (
              <li key={tag.id} className="flex items-center gap-1">
                <Badge variant="secondary">{tag.name}</Badge>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t('Delete tag {{name}}', { name: tag.name })}
                    disabled={remove.isPending}
                    onClick={() =>
                      remove.mutate(tag.id, {
                        onSuccess: () => void tags.refetch(),
                      })
                    }
                  >
                    ×
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {remove.isError && (
          <p role="alert" className="text-sm text-destructive">
            {getErrorMessage(remove.error)}
          </p>
        )}

        {canManage && (
          <form onSubmit={submit} className="space-y-2">
            <Label htmlFor="new-tag">{t('New tag')}</Label>
            <div className="flex gap-2">
              <Input
                id="new-tag"
                value={name}
                maxLength={50}
                onChange={(event) => setName(event.target.value)}
                autoComplete="off"
              />
              <Button type="submit" disabled={create.isPending || !name.trim()}>
                {create.isPending && <Spinner className="text-current" />}
                {t('Add tag')}
              </Button>
            </div>
            {create.isError && (
              <p role="alert" className="text-sm text-destructive">
                {getErrorMessage(create.error)}
              </p>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}

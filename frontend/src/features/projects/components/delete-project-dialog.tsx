import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { getErrorMessage } from '@/lib/api-client';
import { useDeleteProject } from '../api/project-mutations';
import type { Project } from '../types';

interface DeleteProjectDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
  onDeleted,
}: DeleteProjectDialogProps) {
  const remove = useDeleteProject(project.id);
  const { t } = useTranslation();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) remove.reset();
        onOpenChange(next);
      }}
      title={t('Delete “{{name}}”?', { name: project.name })}
      description={t(
        'The project with all its tasks, comments and tags will be deleted. This cannot be undone.',
      )}
      confirmLabel={t('Delete project')}
      isPending={remove.isPending}
      error={remove.isError ? getErrorMessage(remove.error) : null}
      onConfirm={() => remove.mutate(undefined, { onSuccess: onDeleted })}
    />
  );
}

import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { getErrorMessage } from '@/lib/api-client';
import { useDeleteTask } from '../api/task-mutations';
import type { Task } from '../types';

interface DeleteTaskDialogProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

export function DeleteTaskDialog({
  task,
  open,
  onOpenChange,
  onDeleted,
}: DeleteTaskDialogProps) {
  const remove = useDeleteTask(task.id);
  const { t } = useTranslation();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) remove.reset();
        onOpenChange(next);
      }}
      title={t('Delete “{{name}}”?', { name: task.name })}
      description={t(
        'The task and its comments will be deleted. This cannot be undone.',
      )}
      confirmLabel={t('Delete task')}
      isPending={remove.isPending}
      error={remove.isError ? getErrorMessage(remove.error) : null}
      onConfirm={() => remove.mutate(undefined, { onSuccess: onDeleted })}
    />
  );
}

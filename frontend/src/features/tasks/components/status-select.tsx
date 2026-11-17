import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '@/lib/api-client';
import { OptionSelect } from '@/components/ui/option-select';
import { useUpdateTask } from '../api/task-mutations';
import { STATUS_LABELS, TASK_STATUSES } from '../constants';
import type { TaskStatus } from '../types';
import { StatusIcon } from './status-icon';

interface StatusSelectProps {
  taskId: number;
  taskName: string;
  status: TaskStatus;
  /** `icon` is just the glyph (rows and cards); `pill` adds the name of the status (task page). */
  variant?: 'icon' | 'pill';
  onChanged?: () => void;
}

/** Changes the status of a task in place, without opening the form. */
export function StatusSelect({
  taskId,
  taskName,
  status,
  variant = 'icon',
  onChanged,
}: StatusSelectProps) {
  const { t } = useTranslation();
  const update = useUpdateTask(taskId);

  return (
    <div className="space-y-1">
      <OptionSelect
        variant={variant}
        aria-label={t('Status of {{name}}', { name: taskName })}
        value={status}
        disabled={update.isPending}
        options={TASK_STATUSES.map((value) => ({
          value,
          label: t(STATUS_LABELS[value]),
          icon: <StatusIcon status={value} />,
        }))}
        onValueChange={(value) =>
          update.mutate(
            { status: value as TaskStatus },
            { onSuccess: onChanged },
          )
        }
      />
      {update.isError && (
        <p role="alert" className="text-xs text-destructive">
          {getErrorMessage(update.error)}
        </p>
      )}
    </div>
  );
}

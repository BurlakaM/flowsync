import { getErrorMessage } from '@/lib/api-client';
import { NativeSelect } from '@/components/ui/native-select';
import { useUpdateTask } from '../api/task-mutations';
import { STATUS_LABELS, TASK_STATUSES } from '../constants';
import type { TaskStatus } from '../types';

interface StatusSelectProps {
  taskId: number;
  taskName: string;
  status: TaskStatus;
  onChanged?: () => void;
}

/** Changes the status of a task in place, without opening the form. */
export function StatusSelect({
  taskId,
  taskName,
  status,
  onChanged,
}: StatusSelectProps) {
  const update = useUpdateTask(taskId);

  return (
    <div className="space-y-1">
      <NativeSelect
        aria-label={`Status of ${taskName}`}
        value={status}
        disabled={update.isPending}
        className="w-36"
        onChange={(event) =>
          update.mutate(
            { status: event.target.value as TaskStatus },
            { onSuccess: onChanged },
          )
        }
      >
        {TASK_STATUSES.map((value) => (
          <option key={value} value={value}>
            {STATUS_LABELS[value]}
          </option>
        ))}
      </NativeSelect>
      {update.isError && (
        <p role="alert" className="text-xs text-destructive">
          {getErrorMessage(update.error)}
        </p>
      )}
    </div>
  );
}

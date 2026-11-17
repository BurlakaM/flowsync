import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '@/components/ui/segmented-control';
import type { TaskCounts } from '../api/get-task-counts';
import { STATUS_LABELS, TASK_STATUSES } from '../constants';
import type { TaskStatus } from '../types';
import { StatusIcon } from './status-icon';

interface TaskStatusTabsProps {
  value: TaskStatus | undefined;
  counts: TaskCounts;
  onChange: (status: TaskStatus | undefined) => void;
}

/** The statuses as tabs with the number of tasks in each: one click narrows the list to a status. */
export function TaskStatusTabs({
  value,
  counts,
  onChange,
}: TaskStatusTabsProps) {
  const { t } = useTranslation();

  return (
    <SegmentedControl
      aria-label={t('Status')}
      value={value ?? ''}
      onChange={(next) => onChange(next === '' ? undefined : next)}
      options={[
        { value: '', label: t('All'), count: counts.all },
        ...TASK_STATUSES.map((status) => ({
          value: status,
          label: t(STATUS_LABELS[status]),
          icon: <StatusIcon status={status} />,
          count: counts[status],
        })),
      ]}
    />
  );
}

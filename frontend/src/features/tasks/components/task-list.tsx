import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import type { Task } from '../types';
import { StatusSelect } from './status-select';

interface TaskListProps {
  tasks: Task[];
  onChanged?: () => void;
}

export function TaskList({ tasks, onChanged }: TaskListProps) {
  const { t } = useTranslation();
  return (
    <ul className="divide-y rounded-lg border">
      {tasks.map((task) => (
        <li
          key={task.id}
          className="flex flex-wrap items-center justify-between gap-3 p-4"
        >
          <div className="min-w-0 flex-1 space-y-1">
            <Link
              to={`/tasks/${task.id}`}
              className="font-medium hover:underline"
            >
              {task.name}
            </Link>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {task.assignees.length > 0 && (
                <span>
                  {task.assignees.map((user) => user.name).join(', ')}
                </span>
              )}
              {task.tags.map((tag) => (
                <Badge key={tag.id} variant="secondary">
                  {tag.name}
                </Badge>
              ))}
              {task.commentsCount > 0 && (
                <span>
                  {t('comments_count', { count: task.commentsCount })}
                </span>
              )}
            </div>
          </div>
          <StatusSelect
            taskId={task.id}
            taskName={task.name}
            status={task.status}
            onChanged={onChanged}
          />
        </li>
      ))}
    </ul>
  );
}

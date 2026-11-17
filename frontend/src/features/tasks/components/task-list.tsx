import { MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AvatarStack } from '@/components/ui/avatar';
import { formatDateTime, formatRelativeTime } from '@/lib/format-date';
import type { Task } from '../types';
import { StatusSelect } from './status-select';
import { TagChip } from './tag-chip';

interface TaskListProps {
  tasks: Task[];
  onChanged?: () => void;
}

export function TaskList({ tasks, onChanged }: TaskListProps) {
  const { t } = useTranslation();
  return (
    <ul className="divide-y overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-border">
      {tasks.map((task) => (
        <li
          key={task.id}
          className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/40 sm:px-4"
        >
          <StatusSelect
            taskId={task.id}
            taskName={task.name}
            status={task.status}
            onChanged={onChanged}
          />
          <div className="min-w-0 flex-1 space-y-1">
            <Link
              to={`/tasks/${task.id}`}
              className="line-clamp-2 font-medium break-words hover:text-primary-ink"
            >
              {task.name}
            </Link>
            {task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {task.tags.map((tag) => (
                  <TagChip key={tag.id} tag={tag} />
                ))}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-4 text-sm text-muted-foreground">
            {task.commentsCount > 0 && (
              <span className="flex items-center gap-1 tabular-nums">
                <MessageSquare aria-hidden="true" className="size-4" />
                <span aria-hidden="true">{task.commentsCount}</span>
                <span className="sr-only">
                  {t('comments_count', { count: task.commentsCount })}
                </span>
              </span>
            )}
            {task.assignees.length > 0 && (
              <AvatarStack people={task.assignees} />
            )}
            <time
              dateTime={task.updatedAt}
              title={formatDateTime(task.updatedAt)}
              className="hidden w-28 text-right text-xs md:block"
            >
              {formatRelativeTime(task.updatedAt)}
            </time>
          </div>
        </li>
      ))}
    </ul>
  );
}

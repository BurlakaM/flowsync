import { useTranslation } from 'react-i18next';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { GripVertical, MessageSquare } from 'lucide-react';
import { Link } from 'react-router';
import { AvatarStack } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useMoveTask } from '../api/task-mutations';
import { STATUS_LABELS, TASK_STATUSES } from '../constants';
import type { Task, TaskStatus } from '../types';
import { getDropStatus, groupByStatus } from '../utils/board';
import { StatusIcon } from './status-icon';
import { StatusSelect } from './status-select';
import { TagChip } from './tag-chip';

interface TaskBoardProps {
  tasks: Task[];
  onChanged?: () => void;
}

/**
 * Tasks in a column per status; dragging a card to another column changes its status.
 * Dragging is a convenience: every card also has the status select, which works with any input device.
 */
export function TaskBoard({ tasks, onChanged }: TaskBoardProps) {
  const move = useMoveTask();
  const columns = groupByStatus(tasks);
  const sensors = useSensors(
    // A small distance keeps clicks on links and selects inside a card from starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const task = tasks.find((item) => item.id === active.id);
    const status = task && getDropStatus(task.status, over?.id);
    if (task && status) {
      move.mutate({ id: task.id, status }, { onSuccess: onChanged });
    }
  };

  return (
    <div className="space-y-3">
      {move.isError && (
        <p role="alert" className="text-sm text-destructive">
          {getErrorMessage(move.error)}
        </p>
      )}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid gap-4 md:grid-cols-3">
          {TASK_STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              tasks={columns[status]}
              onChanged={onChanged}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

interface ColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onChanged?: () => void;
}

function Column({ status, tasks, onChanged }: ColumnProps) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const headingId = `column-${status}`;

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={cn(
        'min-h-48 space-y-3 rounded-2xl bg-muted/60 p-3 dark:bg-black/20 ring-2 ring-transparent transition-all',
        isOver && 'bg-accent ring-primary/40',
      )}
    >
      <h3
        id={headingId}
        className="flex items-center gap-2 px-1 text-sm font-semibold"
      >
        <StatusIcon status={status} />
        {t(STATUS_LABELS[status])}
        <span className="ml-auto rounded-md bg-background/80 px-1.5 text-xs leading-5 font-medium text-muted-foreground tabular-nums">
          {tasks.length}
        </span>
      </h3>
      {tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
          {t('No tasks here.')}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {tasks.map((task) => (
            <li key={task.id}>
              <Card task={task} onChanged={onChanged} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface CardProps {
  task: Task;
  onChanged?: () => void;
}

function Card({ task, onChanged }: CardProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      style={
        transform
          ? {
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0) rotate(2deg)`,
            }
          : undefined
      }
      className={cn(
        'group/card space-y-3 rounded-xl bg-card p-3 shadow-card ring-1 ring-border transition-shadow hover:shadow-lift',
        isDragging && 'relative z-10 shadow-lift ring-primary/40',
      )}
    >
      <div className="flex items-start gap-1.5">
        <div className="-mt-0.5 -ml-1">
          <StatusSelect
            taskId={task.id}
            taskName={task.name}
            status={task.status}
            onChanged={onChanged}
          />
        </div>
        <Link
          to={`/tasks/${task.id}`}
          className="min-w-0 flex-1 pt-1 leading-snug font-medium hover:text-primary-ink"
        >
          {task.name}
        </Link>
        {/* Only the handle starts a drag: the card holds a link and a select, which must stay clickable. */}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('Move {{name}}', { name: task.name })}
          className="-mt-0.5 -mr-1 shrink-0 cursor-grab touch-none opacity-0 transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" />
        </Button>
      </div>
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <TagChip key={tag.id} tag={tag} />
          ))}
        </div>
      )}
      {(task.assignees.length > 0 || task.commentsCount > 0) && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <AvatarStack people={task.assignees} />
          {task.commentsCount > 0 && (
            <span className="flex items-center gap-1 tabular-nums">
              <MessageSquare aria-hidden="true" className="size-4" />
              <span aria-hidden="true">{task.commentsCount}</span>
              <span className="sr-only">
                {t('comments_count', { count: task.commentsCount })}
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

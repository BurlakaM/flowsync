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
import { GripVertical } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useMoveTask } from '../api/task-mutations';
import { STATUS_LABELS, TASK_STATUSES } from '../constants';
import type { Task, TaskStatus } from '../types';
import { getDropStatus, groupByStatus } from '../utils/board';
import { StatusSelect } from './status-select';

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
        'min-h-40 space-y-3 rounded-lg border bg-muted/30 p-3 transition-colors',
        isOver && 'border-primary bg-muted',
      )}
    >
      <h3
        id={headingId}
        className="flex items-center justify-between text-sm font-semibold"
      >
        {t(STATUS_LABELS[status])}
        <Badge variant="secondary">{tasks.length}</Badge>
      </h3>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('No tasks here.')}</p>
      ) : (
        <ul className="space-y-3">
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
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
      className={cn(
        'space-y-2 rounded-md border bg-background p-3 shadow-xs',
        isDragging && 'relative z-10 shadow-lg',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link to={`/tasks/${task.id}`} className="font-medium hover:underline">
          {task.name}
        </Link>
        {/* Only the handle starts a drag: the card holds a link and a select, which must stay clickable. */}
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('Move {{name}}', { name: task.name })}
          className="size-7 shrink-0 cursor-grab touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {task.assignees.length > 0 && (
          <span>{task.assignees.map((user) => user.name).join(', ')}</span>
        )}
        {task.tags.map((tag) => (
          <Badge key={tag.id} variant="secondary">
            {tag.name}
          </Badge>
        ))}
      </div>
      <StatusSelect
        taskId={task.id}
        taskName={task.name}
        status={task.status}
        onChanged={onChanged}
      />
    </div>
  );
}

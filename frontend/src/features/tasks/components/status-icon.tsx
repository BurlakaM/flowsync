import { cn } from '@/lib/utils';
import type { TaskStatus } from '../types';

const COLORS: Record<TaskStatus, string> = {
  TODO: 'text-status-todo',
  IN_PROGRESS: 'text-status-progress',
  DONE: 'text-status-done',
};

interface StatusIconProps {
  status: TaskStatus;
  className?: string;
}

/**
 * The status as a glyph: an empty dashed circle, a half-filled one, a checked one. The shape (not only the color)
 * carries the meaning, so it stays readable for everyone. The label is always next to it or on the control.
 */
export function StatusIcon({ status, className }: StatusIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      className={cn('size-4 shrink-0', COLORS[status], className)}
    >
      {status === 'TODO' && (
        <circle
          cx="8"
          cy="8"
          r="6"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeDasharray="2.4 2.2"
        />
      )}
      {status === 'IN_PROGRESS' && (
        <>
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <path d="M8 4.2a3.8 3.8 0 0 1 0 7.6Z" fill="currentColor" />
        </>
      )}
      {status === 'DONE' && (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path
            d="m5.2 8.3 2 2 3.6-4.2"
            className="stroke-card"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}

import { X } from 'lucide-react';
import { getIdentityColor } from '@/lib/identity';
import { cn } from '@/lib/utils';
import type { TaskTag } from '../types';

interface TagChipProps {
  tag: TaskTag;
  /** Adds a small remove button inside the chip (for the owner of the project, on the tags list). */
  onRemove?: () => void;
  /** The accessible name of that button, e.g. "Delete tag bug". */
  removeLabel?: string;
  removeDisabled?: boolean;
  className?: string;
}

/** A tag as a tinted chip; its color comes from its id, so a tag looks the same on every screen. */
export function TagChip({
  tag,
  onRemove,
  removeLabel,
  removeDisabled,
  className,
}: TagChipProps) {
  return (
    <span
      className={cn(
        'inline-flex h-5 max-w-full items-center gap-0.5 rounded-full px-2 text-xs font-medium',
        getIdentityColor(tag.id).chip,
        onRemove && 'h-6 pr-1',
        className,
      )}
    >
      <span className="truncate">{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel}
          disabled={removeDisabled}
          onClick={onRemove}
          className="grid size-4 shrink-0 place-items-center rounded-full opacity-70 transition hover:bg-black/10 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-current focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-white/15"
        >
          <X aria-hidden="true" className="size-3" />
        </button>
      )}
    </span>
  );
}

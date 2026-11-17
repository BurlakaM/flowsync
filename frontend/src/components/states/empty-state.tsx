import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  /** A call to action, usually the button that creates the first item. */
  action?: ReactNode;
  /** A glyph for the tile above the title; a sparkle by default. */
  icon?: ReactNode;
}

export function EmptyState({
  title,
  description,
  action,
  icon = <Sparkles />,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed bg-card/50 px-6 py-14 text-center">
      <span
        aria-hidden="true"
        className="grid size-12 place-items-center rounded-2xl bg-accent text-primary-ink [&_svg]:size-6"
      >
        {icon}
      </span>
      <div className="max-w-sm space-y-1">
        <p className="font-heading text-lg font-semibold">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

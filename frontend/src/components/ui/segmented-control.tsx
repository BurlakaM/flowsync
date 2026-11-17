import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  /** A number shown after the label, for example how many tasks have this status. */
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  'aria-label': string;
  className?: string;
}

/** A row of mutually exclusive choices that all stay visible, such as a view switch or the status tabs. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
  ...props
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={props['aria-label']}
      className={cn(
        'inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl bg-muted/80 p-1',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/40 [&_svg]:size-4 [&_svg]:shrink-0',
              active
                ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.icon}
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  'rounded-md px-1.5 text-xs leading-5 tabular-nums',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-background/70 text-muted-foreground',
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

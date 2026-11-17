import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** A pulsing placeholder with the shape of what is loading. Hidden from screen readers: the parent announces it. */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden="true"
      data-slot="skeleton"
      className={cn('animate-shimmer rounded-md bg-muted', className)}
      {...props}
    />
  );
}

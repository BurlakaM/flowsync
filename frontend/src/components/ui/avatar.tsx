import { getIdentityColor, getInitials } from '@/lib/identity';
import { cn } from '@/lib/utils';

const SIZES = {
  xs: 'size-5 text-[9px]',
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-12 text-base',
} as const;

interface AvatarProps {
  name: string;
  /** What the color is derived from; an id spreads colors better than a name. */
  seed?: string | number;
  size?: keyof typeof SIZES;
  /** Hide it from screen readers when the name is written next to it anyway. */
  decorative?: boolean;
  className?: string;
}

/** A round tile with the initials of a person on their own gradient. */
export function Avatar({
  name,
  seed = name,
  size = 'md',
  decorative = false,
  className,
}: AvatarProps) {
  return (
    <span
      {...(decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': name, title: name })}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-linear-to-br font-semibold text-white select-none',
        getIdentityColor(seed).avatar,
        SIZES[size],
        className,
      )}
    >
      {getInitials(name)}
    </span>
  );
}

interface AvatarStackProps {
  people: { id: number; name: string }[];
  /** How many avatars to show before "+N". */
  max?: number;
  size?: keyof typeof SIZES;
  className?: string;
}

/** Overlapping avatars; the rest of the people collapse into a counter. */
export function AvatarStack({
  people,
  max = 3,
  size = 'sm',
  className,
}: AvatarStackProps) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className={cn('flex items-center -space-x-1.5', className)}>
      {shown.map((person) => (
        <Avatar
          key={person.id}
          name={person.name}
          seed={person.id}
          size={size}
          className="ring-2 ring-card"
        />
      ))}
      {rest > 0 && (
        <span
          title={people
            .slice(max)
            .map((person) => person.name)
            .join(', ')}
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-card',
            SIZES[size],
          )}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}

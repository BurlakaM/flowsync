import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface SelectOption {
  value: string;
  label: string;
  /** Shown before the label in the list and, with `variant="icon"`, instead of it in the trigger. */
  icon?: ReactNode;
}

interface OptionSelectProps {
  value: string;
  options: SelectOption[];
  onValueChange: (value: string) => void;
  id?: string;
  'aria-label'?: string;
  disabled?: boolean;
  /** `field` for forms, `pill` for filters, `icon` for a glyph-only trigger. */
  variant?: 'field' | 'pill' | 'icon';
  /** A visible hint before the value of a pill: a short word such as "Assignee" or an icon. */
  prefix?: ReactNode;
  /** Tint a pill while something other than "nothing selected" is chosen (an active filter). */
  tinted?: boolean;
  /** On a phone show only the prefix (an icon) and hide the chosen value: for crowded bars such as the header. */
  compact?: boolean;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

// Radix forbids an item with an empty value, but filters need an "all" choice that maps to "no value".
const EMPTY = '__empty__';

/** A themed dropdown over a flat list of options; an option with the value "" stands for "nothing selected". */
export function OptionSelect({
  value,
  options,
  onValueChange,
  variant = 'field',
  prefix,
  tinted = false,
  compact = false,
  align,
  className,
  ...props
}: OptionSelectProps) {
  const selected = options.find((option) => option.value === value);

  return (
    <Select
      value={value === '' ? EMPTY : value}
      onValueChange={(next) => onValueChange(next === EMPTY ? '' : next)}
      disabled={props.disabled}
    >
      <SelectTrigger
        id={props.id}
        aria-label={props['aria-label']}
        variant={variant}
        data-active={tinted && value !== ''}
        className={cn(
          // Radix ignores className on SelectValue, so the value is hidden from the trigger.
          compact && 'max-sm:[&>[data-slot=select-value]]:hidden',
          className,
        )}
      >
        {variant === 'icon' ? (
          selected?.icon
        ) : (
          <>
            {prefix && (
              <span aria-hidden="true" className="text-muted-foreground">
                {prefix}
              </span>
            )}
            <SelectValue />
          </>
        )}
      </SelectTrigger>
      <SelectContent align={align}>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value === '' ? EMPTY : option.value}
          >
            {option.icon}
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

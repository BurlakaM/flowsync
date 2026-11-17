import type { ComponentProps, ReactNode } from 'react';
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { FormFieldError } from './form-field-error';

interface TextFieldProps<TValues extends FieldValues> extends Omit<
  ComponentProps<typeof Input>,
  'name' | 'defaultValue' | 'value' | 'onChange' | 'onBlur' | 'ref'
> {
  control: Control<TValues>;
  name: FieldPath<TValues>;
  label: string;
  description?: string;
  /** A decorative glyph inside the field, before the text. */
  icon?: ReactNode;
  /** A control inside the field, after the text (for example the show-password button). */
  endAdornment?: ReactNode;
}

/** A labelled input with its validation error, wired to react-hook-form. */
export function TextField<TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  icon,
  endAdornment,
  id = name,
  className,
  ...inputProps
}: TextFieldProps<TValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <div className="relative">
            {icon && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground [&_svg]:size-4"
              >
                {icon}
              </span>
            )}
            <Input
              {...inputProps}
              {...field}
              id={id}
              aria-invalid={fieldState.invalid}
              className={cn(icon && 'pl-9', endAdornment && 'pr-11', className)}
            />
            {endAdornment && (
              <div className="absolute inset-y-0 right-1 flex items-center">
                {endAdornment}
              </div>
            )}
          </div>
          {description && <FieldDescription>{description}</FieldDescription>}
          {fieldState.invalid && <FormFieldError error={fieldState.error} />}
        </Field>
      )}
    />
  );
}

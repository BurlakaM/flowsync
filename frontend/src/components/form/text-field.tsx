import type { ComponentProps } from 'react';
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { FormFieldError } from './form-field-error';

interface TextFieldProps<TValues extends FieldValues> extends Omit<
  ComponentProps<typeof Input>,
  'name' | 'defaultValue' | 'value' | 'onChange' | 'onBlur' | 'ref'
> {
  control: Control<TValues>;
  name: FieldPath<TValues>;
  label: string;
  description?: string;
}

/** A labelled input with its validation error, wired to react-hook-form. */
export function TextField<TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  id = name,
  ...inputProps
}: TextFieldProps<TValues>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Input
            {...inputProps}
            {...field}
            id={id}
            aria-invalid={fieldState.invalid}
          />
          {description && <FieldDescription>{description}</FieldDescription>}
          {fieldState.invalid && <FormFieldError error={fieldState.error} />}
        </Field>
      )}
    />
  );
}

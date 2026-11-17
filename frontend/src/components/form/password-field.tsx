import { Eye, EyeOff, Lock } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { TextField } from './text-field';

interface PasswordFieldProps<TValues extends FieldValues> {
  control: Control<TValues>;
  name: FieldPath<TValues>;
  label: string;
  autoComplete: 'current-password' | 'new-password';
  description?: string;
}

/** A password field with a button that reveals what was typed, so typos are easy to catch. */
export function PasswordField<TValues extends FieldValues>({
  autoComplete,
  ...fieldProps
}: PasswordFieldProps<TValues>) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...fieldProps}
      type={visible ? 'text' : 'password'}
      autoComplete={autoComplete}
      icon={<Lock />}
      endAdornment={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={visible ? t('Hide password') : t('Show password')}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff /> : <Eye />}
        </Button>
      }
    />
  );
}

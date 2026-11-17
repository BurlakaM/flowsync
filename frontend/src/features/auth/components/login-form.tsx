import { useTranslation } from 'react-i18next';
import { tKey } from '@/i18n/t-key';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PasswordField } from '@/components/form/password-field';
import { TextField } from '@/components/form/text-field';
import { Spinner } from '@/components/spinner';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { getErrorMessage, getErrorStatus } from '@/lib/api-client';
import { useLogin } from '../api/login';

const loginSchema = z.object({
  email: z.email(tKey('Enter a valid email address')),
  password: z.string().min(1, tKey('Enter your password')),
});

type LoginValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  /** Called after the token is stored; the page decides where to go next. */
  onSuccess: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { t } = useTranslation();
  const login = useLogin();
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = form.handleSubmit((values) =>
    login.mutate(values, { onSuccess }),
  );

  const serverError = login.isError
    ? getErrorStatus(login.error) === 401
      ? t('Invalid email or password')
      : getErrorMessage(login.error)
    : null;

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <FieldGroup>
        <TextField
          control={form.control}
          name="email"
          label={t('Email')}
          type="email"
          autoComplete="email"
          icon={<Mail />}
        />
        <PasswordField
          control={form.control}
          name="password"
          label={t('Password')}
          autoComplete="current-password"
        />
      </FieldGroup>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={login.isPending}
      >
        {login.isPending && <Spinner className="text-current" />}
        {t('Sign in')}
        {!login.isPending && <ArrowRight data-icon="inline-end" />}
      </Button>
    </form>
  );
}

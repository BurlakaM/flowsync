import { useTranslation } from 'react-i18next';
import { tKey } from '@/i18n/t-key';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Mail, UserRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PasswordField } from '@/components/form/password-field';
import { TextField } from '@/components/form/text-field';
import { Spinner } from '@/components/spinner';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { getErrorMessage } from '@/lib/api-client';
import { useRegister } from '../api/register';

const registerSchema = z.object({
  name: z.string().trim().min(1, tKey('Enter your name')).max(100),
  email: z.email(tKey('Enter a valid email address')).max(255),
  password: z
    .string()
    .min(8, tKey('Use at least 8 characters'))
    .max(72, tKey('Use at most 72 characters')),
});

type RegisterValues = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  /** Called once the account exists and the user is signed in. */
  onSuccess: () => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const { t } = useTranslation();
  const register = useRegister();
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const submit = form.handleSubmit((values) =>
    register.mutate(values, { onSuccess }),
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <FieldGroup>
        <TextField
          control={form.control}
          name="name"
          label={t('Name')}
          autoComplete="name"
          icon={<UserRound />}
        />
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
          autoComplete="new-password"
          description={t('8 to 72 characters.')}
        />
      </FieldGroup>

      {register.isError && (
        <p role="alert" className="text-sm text-destructive">
          {getErrorMessage(register.error)}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={register.isPending}
      >
        {register.isPending && <Spinner className="text-current" />}
        {t('Create account')}
        {!register.isPending && <ArrowRight data-icon="inline-end" />}
      </Button>
    </form>
  );
}

import { useTranslation } from 'react-i18next';
import { tKey } from '@/i18n/t-key';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PasswordField } from '@/components/form/password-field';
import { Spinner } from '@/components/spinner';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { getErrorMessage } from '@/lib/api-client';
import { useResetPassword } from '../api/password-reset';

const schema = z
  .object({
    password: z
      .string()
      .min(8, tKey('Use at least 8 characters'))
      .max(72, tKey('Use at most 72 characters')),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    path: ['confirm'],
    message: tKey('Passwords do not match'),
  });

type Values = z.infer<typeof schema>;

interface ResetPasswordFormProps {
  /** The token from the emailed link. */
  token: string;
  onSuccess: () => void;
}

export function ResetPasswordForm({
  token,
  onSuccess,
}: ResetPasswordFormProps) {
  const { t } = useTranslation();
  const reset = useResetPassword();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  });

  const submit = form.handleSubmit((values) =>
    reset.mutate({ token, password: values.password }, { onSuccess }),
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <FieldGroup>
        <PasswordField
          control={form.control}
          name="password"
          label={t('New password')}
          autoComplete="new-password"
          description={t('8 to 72 characters.')}
        />
        <PasswordField
          control={form.control}
          name="confirm"
          label={t('Confirm the new password')}
          autoComplete="new-password"
        />
      </FieldGroup>

      {reset.isError && (
        <p role="alert" className="text-sm text-destructive">
          {getErrorMessage(reset.error)}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={reset.isPending}
      >
        {reset.isPending && <Spinner className="text-current" />}
        {t('Set new password')}
      </Button>
    </form>
  );
}

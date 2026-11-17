import { useTranslation } from 'react-i18next';
import { tKey } from '@/i18n/t-key';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, MailCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { TextField } from '@/components/form/text-field';
import { Spinner } from '@/components/spinner';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { getErrorMessage } from '@/lib/api-client';
import { useForgotPassword } from '../api/password-reset';

const schema = z.object({
  email: z.email(tKey('Enter a valid email address')).max(255),
});

type Values = z.infer<typeof schema>;

/** Asks for a reset link. The confirmation is the same for every address, so it never reveals who has an account. */
export function ForgotPasswordForm() {
  const { t } = useTranslation();
  const forgot = useForgotPassword();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  if (forgot.isSuccess) {
    return (
      <div
        role="status"
        className="flex gap-3 rounded-xl bg-accent/50 p-4 text-sm ring-1 ring-border"
      >
        <MailCheck
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-primary-ink"
        />
        <p>
          {t(
            'If an account exists for that address, a reset link is on its way. It works for one hour.',
          )}
        </p>
      </div>
    );
  }

  const submit = form.handleSubmit((values) => forgot.mutate(values.email));

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
      </FieldGroup>

      {forgot.isError && (
        <p role="alert" className="text-sm text-destructive">
          {getErrorMessage(forgot.error)}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={forgot.isPending}
      >
        {forgot.isPending && <Spinner className="text-current" />}
        {t('Send reset link')}
      </Button>
    </form>
  );
}

import { MailWarning } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/api-client';
import { useResendVerification } from '../api/email-verification';
import { useMe } from '../api/get-me';

/**
 * Shown to a signed-in user whose address is not confirmed yet. Notification emails are not sent to
 * unconfirmed addresses, so the banner says what is missing and offers the link again.
 */
export function EmailVerificationBanner() {
  const { t } = useTranslation();
  const me = useMe();
  const resend = useResendVerification();

  if (!me.data || me.data.emailVerifiedAt) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-status-progress-soft px-4 py-3 text-sm ring-1 ring-border"
    >
      <MailWarning aria-hidden="true" className="size-4 shrink-0" />
      <p className="min-w-0 flex-1">
        {resend.isSuccess
          ? t('We sent a new link. Check your inbox.')
          : t(
              'Confirm your email address to receive notification emails. We sent you a link when you signed up.',
            )}
      </p>
      {!resend.isSuccess && (
        <Button
          variant="outline"
          size="sm"
          disabled={resend.isPending}
          onClick={() => resend.mutate()}
        >
          {t('Send the link again')}
        </Button>
      )}
      {resend.isError && (
        <p role="alert" className="w-full text-xs text-destructive">
          {getErrorMessage(resend.error)}
        </p>
      )}
    </div>
  );
}

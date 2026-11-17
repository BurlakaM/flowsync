import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { AuthLayout } from '@/components/layouts/auth-layout';
import { Spinner } from '@/components/spinner';
import { Button } from '@/components/ui/button';
import { readLinkToken, useVerifyEmail } from '@/features/auth';
import { getErrorMessage } from '@/lib/api-client';

/**
 * Confirming takes one click instead of happening on load: mail scanners and link previewers that open
 * a link would otherwise use up the one-time token before the person sees it.
 */
export default function VerifyEmailRoute() {
  const { t } = useTranslation();
  const { hash } = useLocation();
  const [token] = useState(() => readLinkToken(hash));
  const verify = useVerifyEmail();

  const footer = (
    <Link to="/" className="font-medium text-primary-ink hover:underline">
      {t('Go to FlowSync')}
    </Link>
  );

  if (verify.isSuccess) {
    return (
      <AuthLayout
        title={t('Email confirmed')}
        description={t(
          'Your email address is confirmed. Notification emails will reach you now.',
        )}
        footer={footer}
      >
        <Button asChild size="lg" className="w-full">
          <Link to="/">{t('Continue')}</Link>
        </Button>
      </AuthLayout>
    );
  }

  if (!token) {
    return (
      <AuthLayout
        title={t('This link does not work')}
        description={t(
          'The link is incomplete or has expired. Request a new one.',
        )}
        footer={footer}
      >
        <p className="text-sm text-muted-foreground">
          {t('Sign in and use "Send the link again" in the banner at the top.')}
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('Confirm your email address')}
      description={t('One click and we know this address is yours.')}
      footer={footer}
    >
      <div className="space-y-4">
        {verify.isError && (
          <p role="alert" className="text-sm text-destructive">
            {getErrorMessage(verify.error)}
          </p>
        )}
        <Button
          size="lg"
          className="w-full"
          disabled={verify.isPending}
          onClick={() => verify.mutate(token)}
        >
          {verify.isPending && <Spinner className="text-current" />}
          {t('Confirm my email')}
        </Button>
      </div>
    </AuthLayout>
  );
}

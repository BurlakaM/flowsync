import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { AuthLayout } from '@/components/layouts/auth-layout';
import { Button } from '@/components/ui/button';
import { readLinkToken, ResetPasswordForm } from '@/features/auth';

export default function ResetPasswordRoute() {
  const { t } = useTranslation();
  const { hash } = useLocation();
  const navigate = useNavigate();
  // Read once: the secret is then removed from the address bar and from the history entry.
  const [token] = useState(() => readLinkToken(hash));
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (hash) navigate({ hash: '' }, { replace: true });
  }, [hash, navigate]);

  const footer = (
    <Link to="/login" className="font-medium text-primary-ink hover:underline">
      {t('Back to sign in')}
    </Link>
  );

  if (done) {
    return (
      <AuthLayout
        title={t('Password changed')}
        description={t('Your password was changed. Sign in with the new one.')}
        footer={footer}
      >
        <Button asChild size="lg" className="w-full">
          <Link to="/login">{t('Sign in')}</Link>
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
        <Button asChild size="lg" className="w-full">
          <Link to="/forgot-password">{t('Request a new link')}</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('Choose a new password')}
      description={t(
        'You will be signed out everywhere and can sign in with the new password.',
      )}
      footer={footer}
    >
      <ResetPasswordForm token={token} onSuccess={() => setDone(true)} />
    </AuthLayout>
  );
}

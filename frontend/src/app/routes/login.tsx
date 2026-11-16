import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { AuthLayout } from '@/components/layouts/auth-layout';
import { getSafeRedirect, LoginForm } from '@/features/auth';
import { authStorage } from '@/lib/auth-storage';

export default function LoginRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirectTo = getSafeRedirect(params.get('redirectTo'));

  // Already signed in: there is nothing to do here.
  if (authStorage.hasToken()) return <Navigate to={redirectTo} replace />;

  return (
    <AuthLayout
      title={t('Sign in to FlowSync')}
      description={t('Enter your email and password to continue.')}
      footer={
        <>
          {t('No account yet?')}&nbsp;
          <Link
            to={`/register${params.has('redirectTo') ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`}
            className="text-foreground underline"
          >
            {t('Create one')}
          </Link>
        </>
      }
    >
      <LoginForm onSuccess={() => navigate(redirectTo, { replace: true })} />
    </AuthLayout>
  );
}

import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { AuthLayout } from '@/components/layouts/auth-layout';
import { getSafeRedirect, RegisterForm } from '@/features/auth';
import { authStorage } from '@/lib/auth-storage';

export default function RegisterRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirectTo = getSafeRedirect(params.get('redirectTo'));

  if (authStorage.hasToken()) return <Navigate to={redirectTo} replace />;

  return (
    <AuthLayout
      title={t('Create your account')}
      description={t('Start tracking your projects and tasks.')}
      footer={
        <>
          {t('Already have an account?')}&nbsp;
          <Link
            to={`/login${params.has('redirectTo') ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`}
            className="font-medium text-primary-ink hover:underline"
          >
            {t('Sign in')}
          </Link>
        </>
      }
    >
      <RegisterForm onSuccess={() => navigate(redirectTo, { replace: true })} />
    </AuthLayout>
  );
}

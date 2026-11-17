import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AuthLayout } from '@/components/layouts/auth-layout';
import { ForgotPasswordForm } from '@/features/auth';

export default function ForgotPasswordRoute() {
  const { t } = useTranslation();

  return (
    <AuthLayout
      title={t('Reset your password')}
      description={t(
        'Enter your email and we will send you a link to choose a new password.',
      )}
      footer={
        <Link
          to="/login"
          className="font-medium text-primary-ink hover:underline"
        >
          {t('Back to sign in')}
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}

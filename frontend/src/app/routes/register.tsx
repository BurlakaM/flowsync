import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { AuthLayout } from '@/components/layouts/auth-layout';
import { getSafeRedirect, RegisterForm } from '@/features/auth';
import { authStorage } from '@/lib/auth-storage';

export default function RegisterRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirectTo = getSafeRedirect(params.get('redirectTo'));

  if (authStorage.hasToken()) return <Navigate to={redirectTo} replace />;

  return (
    <AuthLayout
      title="Create your account"
      description="Start tracking your projects and tasks."
      footer={
        <>
          Already have an account?&nbsp;
          <Link
            to={`/login${params.has('redirectTo') ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`}
            className="text-foreground underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm onSuccess={() => navigate(redirectTo, { replace: true })} />
    </AuthLayout>
  );
}

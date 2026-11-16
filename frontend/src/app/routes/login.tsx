import { Navigate, useNavigate, useSearchParams } from 'react-router';
import logoMark from '@/assets/logo-mark.svg';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getSafeRedirect, LoginForm } from '@/features/auth';
import { authStorage } from '@/lib/auth-storage';

export default function LoginRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirectTo = getSafeRedirect(params.get('redirectTo'));

  // Already signed in: there is nothing to do here.
  if (authStorage.hasToken()) return <Navigate to={redirectTo} replace />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <img src={logoMark} alt="" className="mb-2 size-10 dark:invert" />
          {/* CardTitle is a div: the page needs a real heading for screen readers. */}
          <CardTitle className="text-xl">
            <h1>Sign in to FlowSync</h1>
          </CardTitle>
          <CardDescription>
            Enter your email and password to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm
            onSuccess={() => navigate(redirectTo, { replace: true })}
          />
        </CardContent>
      </Card>
    </main>
  );
}

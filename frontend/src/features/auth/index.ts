// Public API of the auth feature: other code imports only from here.
export { useMe } from './api/get-me';
export { useLogin } from './api/login';
export { useLogout } from './api/logout';
export { useRestoreSession } from './api/restore-session';
export { useRegister } from './api/register';
export { useForgotPassword, useResetPassword } from './api/password-reset';
export {
  useResendVerification,
  useVerifyEmail,
} from './api/email-verification';
export { EmailVerificationBanner } from './components/email-verification-banner';
export { ForgotPasswordForm } from './components/forgot-password-form';
export { ResetPasswordForm } from './components/reset-password-form';
export { readLinkToken } from './utils/link-token';
export { LoginForm } from './components/login-form';
export { RegisterForm } from './components/register-form';
export { ProtectedRoute } from './components/protected-route';
export type { LoginInput, RegisterInput, Role, User } from './types';
export { buildLoginPath, getSafeRedirect } from './utils/redirect';

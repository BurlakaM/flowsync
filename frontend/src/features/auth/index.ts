// Public API of the auth feature: other code imports only from here.
export { useMe } from './api/get-me';
export { useLogin } from './api/login';
export { useLogout } from './api/logout';
export { useRegister } from './api/register';
export { LoginForm } from './components/login-form';
export { RegisterForm } from './components/register-form';
export { ProtectedRoute } from './components/protected-route';
export type { LoginInput, RegisterInput, Role, User } from './types';
export { buildLoginPath, getSafeRedirect } from './utils/redirect';

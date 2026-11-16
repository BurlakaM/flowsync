import axios, { type AxiosRequestConfig } from 'axios';
import { env } from '@/config/env';
import { authStorage } from '@/lib/auth-storage';
import { queryClient } from '@/lib/query-client';

const LOGIN_PATH = '/login';

/** Drops the session and sends the user to the login page (hard navigation resets all state). */
function redirectToLogin(): void {
  authStorage.clear();
  queryClient.clear();
  if (window.location.pathname === LOGIN_PATH) return;
  const from = window.location.pathname + window.location.search;
  window.location.assign(
    `${LOGIN_PATH}?redirectTo=${encodeURIComponent(from)}`,
  );
}

let onUnauthorized: () => void = redirectToLogin;

/** Replaces the reaction to an expired session (tests use it); without an argument it is restored. */
export function setUnauthorizedHandler(handler?: () => void): void {
  onUnauthorized = handler ?? redirectToLogin;
}

const http = axios.create({
  baseURL: env.VITE_API_URL,
  headers: { Accept: 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = authStorage.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    // A 401 without a stored token is just a failed login, not an expired session.
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      authStorage.hasToken()
    ) {
      onUnauthorized();
    }
    return Promise.reject(error);
  },
);

/** Typed helpers that resolve to the response body. Features use these instead of axios directly. */
export const apiClient = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    http.get<T>(url, config).then((response) => response.data),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    http.post<T>(url, data, config).then((response) => response.data),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    http.patch<T>(url, data, config).then((response) => response.data),
  delete: (url: string, config?: AxiosRequestConfig) =>
    http.delete(url, config).then(() => undefined),
};

/** HTTP status of a failed request, if the server answered at all. */
export function getErrorStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

/**
 * A message for the user taken from the unified error body of the API
 * (`{ statusCode, error, message, path, timestamp }`, where `message` may be a list).
 */
export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!axios.isAxiosError(error)) return fallback;
  if (!error.response) return 'Cannot reach the server. Check your connection.';

  const message: unknown = (error.response.data as { message?: unknown })
    ?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string' && message.length > 0) return message;
  return fallback;
}

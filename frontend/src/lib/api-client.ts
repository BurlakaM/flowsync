import i18n from '@/i18n';
import axios, {
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
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

/** Endpoints that take part in signing in or out: a 401 from them is an answer, not an expired token. */
const AUTH_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
];
const isAuthEndpoint = (url?: string) =>
  AUTH_ENDPOINTS.some((endpoint) => url?.startsWith(endpoint));

// Without interceptors: the refresh request itself must never trigger another refresh.
const bare = axios.create({
  baseURL: env.VITE_API_URL,
  headers: { Accept: 'application/json' },
});

let refreshing: Promise<string> | null = null;

/**
 * Exchanges the httpOnly refresh cookie for a new access token and keeps it in memory.
 * A refresh token works once, so parallel callers must share one request.
 */
export function refreshSession(): Promise<string> {
  refreshing ??= bare
    .post<{ access_token: string }>('/auth/refresh')
    .then((response) => {
      authStorage.setToken(response.data.access_token);
      return response.data.access_token;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error);
    }
    const config = error.config as RetriableConfig | undefined;
    if (!config || config._retried || isAuthEndpoint(config.url)) {
      return Promise.reject(error);
    }

    // The access token is short-lived: renew it once and repeat the request.
    const hadToken = authStorage.hasToken();
    try {
      await refreshSession();
    } catch {
      // The session is over. A 401 without a stored token is not an "expired session" event.
      if (hadToken) {
        authStorage.clear();
        onUnauthorized();
      }
      return Promise.reject(error);
    }
    config._retried = true;
    return http.request(config);
  },
);

/** Typed helpers that resolve to the response body. Features use these instead of axios directly. */
export const apiClient = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    http.get<T>(url, config).then((response) => response.data),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    http.post<T>(url, data, config).then((response) => response.data),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    http.put<T>(url, data, config).then((response) => response.data),
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
  fallback = i18n.t('Something went wrong. Please try again.'),
): string {
  if (!axios.isAxiosError(error)) return fallback;
  if (!error.response)
    return i18n.t('Cannot reach the server. Check your connection.');

  const message: unknown = (error.response.data as { message?: unknown })
    ?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string' && message.length > 0) return message;
  return fallback;
}

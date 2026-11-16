// The only place that touches the stored access token (plan phase 7 replaces it with an in-memory
// token plus an httpOnly refresh cookie). The key is the one the previous frontend used, so
// existing sessions survive the migration.
const TOKEN_KEY = 'access_token';

/** localStorage can be unavailable (private mode, blocked storage): the user then simply logs in again. */
function safely<T>(action: () => T, fallback: T): T {
  try {
    return action();
  } catch {
    return fallback;
  }
}

export const authStorage = {
  getToken: (): string | null =>
    safely(() => localStorage.getItem(TOKEN_KEY), null),
  setToken: (token: string): void =>
    safely(() => localStorage.setItem(TOKEN_KEY, token), undefined),
  clear: (): void =>
    safely(() => localStorage.removeItem(TOKEN_KEY), undefined),
  hasToken: (): boolean => authStorage.getToken() !== null,
};

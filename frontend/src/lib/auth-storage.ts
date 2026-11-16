// The access token lives only in memory: it is gone on reload and unreachable for scripts that read
// localStorage (XSS). A reload restores the session from the httpOnly refresh cookie (see api-client).
let token: string | null = null;

// Earlier versions kept the token in localStorage. It would stay there forever, so it is removed.
try {
  localStorage.removeItem('access_token');
} catch {
  // Blocked storage: there is nothing to clean up.
}

export const authStorage = {
  getToken: (): string | null => token,
  setToken: (value: string): void => {
    token = value;
  },
  clear: (): void => {
    token = null;
  },
  hasToken: (): boolean => token !== null,
};

const LOGIN_PATH = '/login';
const DEFAULT_PATH = '/';

/** The login URL that brings the user back to `from` after signing in. */
export function buildLoginPath(from: string): string {
  return from === DEFAULT_PATH
    ? LOGIN_PATH
    : `${LOGIN_PATH}?redirectTo=${encodeURIComponent(from)}`;
}

/**
 * Only same-origin paths are accepted as a post-login destination. Anything else
 * (`https://evil.example`, `//evil.example`, `/\evil`) would be an open redirect.
 */
export function getSafeRedirect(value: string | null): string {
  if (!value || !value.startsWith('/')) return DEFAULT_PATH;
  if (value.startsWith('//') || value.startsWith('/\\')) return DEFAULT_PATH;
  if (value === LOGIN_PATH || value.startsWith(`${LOGIN_PATH}?`)) {
    return DEFAULT_PATH;
  }
  return value;
}

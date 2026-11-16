import type { CookieOptions, Response } from 'express';

export const REFRESH_COOKIE = 'refresh_token';

// Scoped to the auth routes and SameSite=Strict: the browser never attaches the cookie to other
// endpoints or to requests started from another site, which is what protects refresh from CSRF.
const baseOptions = (secure: boolean): CookieOptions => ({
  httpOnly: true,
  sameSite: 'strict',
  secure,
  path: '/api/auth',
});

export function setRefreshCookie(
  response: Response,
  token: string,
  expires: Date,
  secure: boolean,
): void {
  response.cookie(REFRESH_COOKIE, token, { ...baseOptions(secure), expires });
}

export function clearRefreshCookie(response: Response, secure: boolean): void {
  response.clearCookie(REFRESH_COOKIE, baseOptions(secure));
}

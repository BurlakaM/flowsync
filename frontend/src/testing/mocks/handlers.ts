import { http, HttpResponse } from 'msw';
import type { RequestHandler } from 'msw';

/**
 * Handlers shared by all tests. Tests add their own with `server.use(...)`; unhandled requests fail.
 * By default there is no session cookie: refreshing is refused, and logging out always succeeds.
 */
export const handlers: RequestHandler[] = [
  http.post(
    '*/api/auth/refresh',
    () => new HttpResponse(null, { status: 401 }),
  ),
  http.post('*/api/auth/logout', () => new HttpResponse(null, { status: 204 })),
];

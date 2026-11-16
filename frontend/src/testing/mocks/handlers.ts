import type { RequestHandler } from 'msw';

/** Handlers shared by all tests. Tests add their own with `server.use(...)`; unhandled requests fail. */
export const handlers: RequestHandler[] = [];

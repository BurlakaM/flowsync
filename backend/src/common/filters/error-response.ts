import { STATUS_CODES } from 'node:http';
import type { Request } from 'express';

/** The single error shape returned by every endpoint. */
export interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

export function buildErrorBody(
  statusCode: number,
  message: string | string[],
  path: string,
): ErrorResponseBody {
  return {
    statusCode,
    error: STATUS_CODES[statusCode] ?? 'Error',
    message,
    path,
    timestamp: new Date().toISOString(),
  };
}

/**
 * The full request path without the query string. `request.path` cannot be used: for routes
 * that do not exist it lacks the global prefix (`/nope` instead of `/api/nope`).
 */
export function requestPath(request: Pick<Request, 'originalUrl'>): string {
  return request.originalUrl.split('?')[0];
}

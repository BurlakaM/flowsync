import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const REQUEST_ID_HEADER = 'x-request-id';

// A proxy or a client may send its own id to correlate logs; anything odd is replaced, never trusted,
// because the value ends up in logs and response headers.
const ACCEPTED_ID = /^[\w.-]{1,64}$/;

/**
 * The id of a request: the incoming `X-Request-Id` when it is well formed, otherwise a new UUID.
 * It is echoed in the response header so a client can quote it when reporting a problem.
 */
export function resolveRequestId(
  request: IncomingMessage,
  response: ServerResponse,
): string {
  const incoming = request.headers[REQUEST_ID_HEADER];
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
  const id =
    candidate && ACCEPTED_ID.test(candidate) ? candidate : randomUUID();
  response.setHeader('X-Request-Id', id);
  return id;
}

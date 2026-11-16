import { io, type Socket } from 'socket.io-client';
import { env } from '@/config/env';
import { authStorage } from '@/lib/auth-storage';

/** What the server tells: that something changed, and where. The data itself is fetched over the API. */
export interface RealtimeEvent {
  type: string;
  projectId: number;
  entityType: string;
  entityId: number;
  taskId?: number;
}

// The socket lives under /api, so it goes through the same proxy rule as the API. With a relative
// API address it connects to the page's own origin.
const origin = env.VITE_API_URL.startsWith('http')
  ? new URL(env.VITE_API_URL).origin
  : undefined;

/**
 * A socket that is not connected yet. The token is read again on every (re)connection, so a socket
 * that reconnects after the access token was renewed uses the new one.
 */
export function createRealtimeSocket(): Socket {
  const options = {
    path: '/api/socket.io',
    transports: ['websocket'],
    autoConnect: false,
    auth: (send: (data: { token: string }) => void) =>
      send({ token: authStorage.getToken() ?? '' }),
  };
  return origin ? io(origin, options) : io(options);
}

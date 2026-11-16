import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { notificationsKeys } from '@/features/notifications';
import { refreshSession } from '@/lib/api-client';
import { createRealtimeSocket, type RealtimeEvent } from '@/lib/realtime';
import { queryKeysFor } from './query-keys-for';

/**
 * Keeps the screen up to date while the user is signed in: when someone changes something in a project
 * the user belongs to, the server says so and the affected data is fetched again.
 *
 * If the connection fails the application simply works as before (the data refreshes on navigation);
 * the socket is an improvement, never a requirement.
 */
export function useRealtimeSync(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = createRealtimeSocket();
    let connectedBefore = false;
    let renewing = false;

    socket.on('domain', (event: RealtimeEvent) => {
      for (const queryKey of queryKeysFor(event)) {
        void queryClient.invalidateQueries({ queryKey });
      }
    });
    socket.on('notification', () => {
      void queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    });
    socket.on('ready', () => {
      // Events that arrived while the connection was down are lost: start from fresh data.
      if (connectedBefore) void queryClient.invalidateQueries();
      connectedBefore = true;
    });
    socket.on('connect_error', (error: Error) => {
      // The access token expired while the page was open: renew it once and try again.
      if (error.message !== 'unauthorized' || renewing) return;
      renewing = true;
      refreshSession()
        .then(() => socket.connect())
        .catch(() => undefined)
        .finally(() => {
          renewing = false;
        });
    });

    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, [queryClient]);
}

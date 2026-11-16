import { QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { authStorage } from '@/lib/auth-storage';
import { fakeSockets } from '@/testing/fake-socket';
import { server } from '@/testing/mocks/server';
import { createTestQueryClient } from '@/testing/test-utils';
import { queryKeysFor } from './query-keys-for';
import { useRealtimeSync } from './use-realtime-sync';

function Probe() {
  useRealtimeSync();
  return null;
}

function setup() {
  const queryClient = createTestQueryClient();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const view = render(
    <QueryClientProvider client={queryClient}>
      <Probe />
    </QueryClientProvider>,
  );
  const socket = fakeSockets[0];
  const invalidated = () =>
    invalidate.mock.calls.map(([filters]) => filters?.queryKey?.[0]);
  return { socket, invalidate, invalidated, view };
}

const event = (type: string, entityType: string) => ({
  type,
  entityType,
  projectId: 7,
  entityId: 1,
});

describe('queryKeysFor', () => {
  it.each([
    ['Task', ['activity', 'tasks', 'projects']],
    ['Comment', ['activity', 'comments', 'tasks']],
    ['Tag', ['activity', 'tasks']],
    ['Project', ['activity', 'projects', 'notifications']],
    ['Member', ['activity', 'projects', 'notifications']],
  ])('%s refreshes %j', (entityType, expected) => {
    expect(queryKeysFor(event('x', entityType)).map((key) => key[0])).toEqual(
      expected,
    );
  });

  it('always refreshes the activity, even for an unknown kind of entity', () => {
    expect(queryKeysFor(event('x', 'Sprint'))).toHaveLength(1);
  });
});

describe('useRealtimeSync', () => {
  it('connects once and disconnects when the screen goes away', () => {
    const { socket, view } = setup();

    expect(fakeSockets).toHaveLength(1);
    expect(socket.connectCalls).toBe(1);

    view.unmount();
    expect(socket.disconnected).toBe(true);
  });

  it('fetches again what a change made stale', () => {
    const { socket, invalidated } = setup();

    socket.receive('domain', event('task.created', 'Task'));

    expect(invalidated()).toEqual(['activity', 'tasks', 'projects']);
  });

  it('refreshes the notifications when the bell rings', () => {
    const { socket, invalidated } = setup();

    socket.receive('notification');

    expect(invalidated()).toEqual(['notifications']);
  });

  it('refreshes everything after a reconnection, because events were missed meanwhile', () => {
    const { socket, invalidate } = setup();

    socket.receive('ready');
    expect(invalidate).not.toHaveBeenCalled();

    socket.receive('ready');
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith();
  });

  describe('when the token is refused', () => {
    it('renews the token once and connects again', async () => {
      authStorage.setToken('expired');
      let refreshes = 0;
      server.use(
        http.post('*/api/auth/refresh', () => {
          refreshes += 1;
          return HttpResponse.json({ access_token: 'fresh' }, { status: 201 });
        }),
      );
      const { socket } = setup();

      socket.receive('connect_error', new Error('unauthorized'));
      socket.receive('connect_error', new Error('unauthorized'));

      await waitFor(() => expect(socket.connectCalls).toBe(2));
      expect(refreshes).toBe(1);
      expect(authStorage.getToken()).toBe('fresh');
    });

    it('gives up quietly when the session is over', async () => {
      const { socket } = setup();

      socket.receive('connect_error', new Error('unauthorized'));
      await new Promise((resolve) => setTimeout(resolve, 50));

      // The default test server refuses the refresh: no reconnection loop.
      expect(socket.connectCalls).toBe(1);
    });

    it('ignores other connection problems: the socket retries by itself', async () => {
      const { socket } = setup();

      socket.receive('connect_error', new Error('xhr poll error'));
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(socket.connectCalls).toBe(1);
    });
  });
});

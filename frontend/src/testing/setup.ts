import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import i18n from '@/i18n';
import { authStorage } from '@/lib/auth-storage';
import { queryClient } from '@/lib/query-client';
import { fakeSockets } from './fake-socket';
import { server } from './mocks/server';

// Tests never open a real socket: the app gets a fake one that tests can push messages into.
vi.mock('@/lib/realtime', async () => {
  const { createFakeSocket } = await import('./fake-socket');
  return { createRealtimeSocket: createFakeSocket };
});

// Lazy routes are transformed on first use, which can take more than the default second on a cold start.
configure({ asyncUtilTimeout: 3000 });

// jsdom has no ResizeObserver, which Radix components (checkbox) use to measure themselves.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Any request without a handler is an error: tests must say what the server answers.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
  // A test may switch the language; the next one starts in English again.
  void i18n.changeLanguage('en');
  fakeSockets.length = 0;
  authStorage.clear();
  queryClient.clear();
});

afterAll(() => server.close());

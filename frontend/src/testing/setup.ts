import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { authStorage } from '@/lib/auth-storage';
import { queryClient } from '@/lib/query-client';
import { server } from './mocks/server';

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
  authStorage.clear();
  queryClient.clear();
});

afterAll(() => server.close());

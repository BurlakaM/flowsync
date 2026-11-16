import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { queryClient } from '@/lib/query-client';
import { server } from './mocks/server';

// Any request without a handler is an error: tests must say what the server answers.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
  queryClient.clear();
});

afterAll(() => server.close());

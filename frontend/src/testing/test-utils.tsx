import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { createMemoryRouter, MemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from '@/app/router';

/** A client that never retries and forgets everything at once: failures show up immediately. */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

/** Renders a component with a fresh query client and a router. */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/' }: { route?: string } = {},
) {
  const queryClient = createTestQueryClient();
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

/** Renders the real application routes starting at `path`. */
export function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = createTestQueryClient();
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...result, router, queryClient };
}

/** Opens a Radix Select by its trigger and picks the option with the given visible label. */
export async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  trigger: HTMLElement,
  label: string,
) {
  await user.click(trigger);
  await user.click(await screen.findByRole('option', { name: label }));
}

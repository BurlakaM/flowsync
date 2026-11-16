import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setUnauthorizedHandler } from '@/lib/api-client';
import { authStorage } from '@/lib/auth-storage';
import { server } from '@/testing/mocks/server';
import { renderApp } from '@/testing/test-utils';

const ann = {
  id: 1,
  name: 'Ann',
  email: 'ann@example.test',
  role: 'USER',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const emptyPage = {
  items: [],
  meta: { page: 1, limit: 12, total: 0, totalPages: 0 },
};

const signedInAs = (user = ann) => {
  authStorage.setToken('jwt-token');
  server.use(
    http.get('*/api/auth/me', () => HttpResponse.json(user)),
    http.get('*/api/projects', () => HttpResponse.json(emptyPage)),
  );
};

describe('application routes', () => {
  afterEach(() => setUnauthorizedHandler());

  it('sends an anonymous visitor to the login page and remembers the target', async () => {
    const { router } = renderApp('/?tab=mine');

    expect(
      await screen.findByRole('heading', { name: /sign in to flowsync/i }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe(
      `?redirectTo=${encodeURIComponent('/?tab=mine')}`,
    );
  });

  it('shows the projects to a signed-in user', async () => {
    signedInAs();
    renderApp('/');

    expect(
      await screen.findByRole('heading', { name: 'Projects' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Ann')).toBeInTheDocument();
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
  });

  it('signs in through the login page and lands on the requested page', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json({ access_token: 'jwt-token' }, { status: 201 }),
      ),
      http.get('*/api/auth/me', () => HttpResponse.json(ann)),
    );
    const user = userEvent.setup();
    const { router } = renderApp('/login?redirectTo=%2F');

    await user.type(await screen.findByLabelText('Email'), 'ann@example.test');
    await user.type(screen.getByLabelText('Password'), 'password-123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(
      await screen.findByRole('heading', { name: 'Projects' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/projects');
  });

  it('ignores a redirect target that points to another site', async () => {
    signedInAs();
    const { router } = renderApp(
      `/login?redirectTo=${encodeURIComponent('https://evil.example')}`,
    );

    await screen.findByRole('heading', { name: 'Projects' });
    expect(router.state.location.pathname).toBe('/projects');
  });

  it('signs the user out', async () => {
    signedInAs();
    const user = userEvent.setup();
    const { router } = renderApp('/');

    await user.click(await screen.findByRole('button', { name: /sign out/i }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(authStorage.hasToken()).toBe(false);
  });

  it('sends a user with an expired session back to the login page', async () => {
    authStorage.setToken('expired');
    // The real handler does a hard navigation; here it only clears the token like the real one.
    setUnauthorizedHandler(() => authStorage.clear());
    server.use(
      http.get('*/api/auth/me', () =>
        HttpResponse.json(
          { statusCode: 401, message: 'Unauthorized' },
          { status: 401 },
        ),
      ),
    );

    const { router } = renderApp('/');

    expect(
      await screen.findByRole('heading', { name: /sign in to flowsync/i }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(authStorage.hasToken()).toBe(false);
  });

  it('shows an error page when the server fails', async () => {
    // React and the router print the AxiosError (with a jsdom XHR) which jsdom cannot format.
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    onTestFinished(() => consoleError.mockRestore());
    authStorage.setToken('jwt-token');
    server.use(
      http.get('*/api/auth/me', () =>
        HttpResponse.json(
          { message: 'Internal server error' },
          { status: 500 },
        ),
      ),
    );

    renderApp('/');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Internal server error',
    );
    expect(
      screen.getByRole('button', { name: /reload the page/i }),
    ).toBeInTheDocument();
  });

  it('shows a 404 page for unknown addresses', async () => {
    renderApp('/definitely/not/here');

    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /back to projects/i }),
    ).toHaveAttribute('href', '/');
  });
});

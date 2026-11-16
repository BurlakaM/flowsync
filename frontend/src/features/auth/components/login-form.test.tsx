import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { authStorage } from '@/lib/auth-storage';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import { LoginForm } from './login-form';

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText('Email'), email);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: /sign in/i }));
}

describe('LoginForm', () => {
  it('validates the fields before sending anything', async () => {
    const onSuccess = vi.fn();
    renderWithProviders(<LoginForm onSuccess={onSuccess} />);

    await fillAndSubmit('not-an-email', '');

    expect(
      await screen.findByText('Enter a valid email address'),
    ).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('stores the token and reports success', async () => {
    const onSuccess = vi.fn();
    let body: unknown;
    server.use(
      http.post('*/api/auth/login', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          { access_token: 'jwt-token' },
          { status: 201 },
        );
      }),
    );
    renderWithProviders(<LoginForm onSuccess={onSuccess} />);

    await fillAndSubmit('ann@example.test', 'password-123');

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(authStorage.getToken()).toBe('jwt-token');
    expect(body).toEqual({
      email: 'ann@example.test',
      password: 'password-123',
    });
  });

  it('shows a friendly message for wrong credentials', async () => {
    const onSuccess = vi.fn();
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(
          {
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Invalid credentials',
          },
          { status: 401 },
        ),
      ),
    );
    renderWithProviders(<LoginForm onSuccess={onSuccess} />);

    await fillAndSubmit('ann@example.test', 'wrong-password');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password',
    );
    expect(onSuccess).not.toHaveBeenCalled();
    expect(authStorage.hasToken()).toBe(false);
  });

  it('explains rate limiting with the message of the API', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(
          {
            statusCode: 429,
            message: 'Too many requests, please try again later',
          },
          { status: 429 },
        ),
      ),
    );
    renderWithProviders(<LoginForm onSuccess={vi.fn()} />);

    await fillAndSubmit('ann@example.test', 'password-123');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many requests, please try again later',
    );
  });

  it('reports an unreachable server', async () => {
    server.use(http.post('*/api/auth/login', () => HttpResponse.error()));
    renderWithProviders(<LoginForm onSuccess={vi.fn()} />);

    await fillAndSubmit('ann@example.test', 'password-123');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cannot reach the server',
    );
  });
});

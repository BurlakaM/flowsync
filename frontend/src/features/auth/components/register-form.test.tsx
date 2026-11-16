import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { authStorage } from '@/lib/auth-storage';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import { RegisterForm } from './register-form';

async function fill(name: string, email: string, password: string) {
  const user = userEvent.setup();
  if (name) await user.type(screen.getByLabelText('Name'), name);
  if (email) await user.type(screen.getByLabelText('Email'), email);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: /create account/i }));
}

describe('RegisterForm', () => {
  it('validates the fields before sending anything', async () => {
    const onSuccess = vi.fn();
    renderWithProviders(<RegisterForm onSuccess={onSuccess} />);

    await fill('', 'nope', 'short');

    expect(await screen.findByText('Enter your name')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Use at least 8 characters')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('creates the account, signs in and reports success', async () => {
    const onSuccess = vi.fn();
    let registered: unknown;
    server.use(
      http.post('*/api/auth/register', async ({ request }) => {
        registered = await request.json();
        return HttpResponse.json({ id: 1 }, { status: 201 });
      }),
      http.post('*/api/auth/login', () =>
        HttpResponse.json({ access_token: 'jwt-token' }, { status: 201 }),
      ),
    );
    renderWithProviders(<RegisterForm onSuccess={onSuccess} />);

    await fill('Ann', 'ann@example.test', 'password-123');

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(authStorage.getToken()).toBe('jwt-token');
    expect(registered).toEqual({
      name: 'Ann',
      email: 'ann@example.test',
      password: 'password-123',
    });
  });

  it('shows the message of the API when the email is taken', async () => {
    server.use(
      http.post('*/api/auth/register', () =>
        HttpResponse.json(
          { statusCode: 409, message: 'Email is already registered' },
          { status: 409 },
        ),
      ),
    );
    renderWithProviders(<RegisterForm onSuccess={vi.fn()} />);

    await fill('Ann', 'ann@example.test', 'password-123');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email is already registered',
    );
    expect(authStorage.hasToken()).toBe(false);
  });
});

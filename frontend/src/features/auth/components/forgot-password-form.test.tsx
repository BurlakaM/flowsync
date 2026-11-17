import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import { ForgotPasswordForm } from './forgot-password-form';

describe('ForgotPasswordForm', () => {
  it('validates the email before sending anything', async () => {
    let calls = 0;
    server.use(
      http.post('*/api/auth/forgot-password', () => {
        calls += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(
      await screen.findByText('Enter a valid email address'),
    ).toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it('asks for the link and confirms without saying whether the address has an account', async () => {
    let body: unknown;
    server.use(
      http.post('*/api/auth/forgot-password', async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText('Email'), 'ann@example.test');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'If an account exists for that address',
    );
    expect(body).toEqual({ email: 'ann@example.test' });
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
  });

  it('shows a server error and keeps the form', async () => {
    server.use(
      http.post('*/api/auth/forgot-password', () =>
        HttpResponse.json(
          { statusCode: 429, message: 'Too Many Requests' },
          { status: 429 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText('Email'), 'ann@example.test');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too Many Requests',
    );
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });
});

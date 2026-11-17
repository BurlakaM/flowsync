import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import { ResetPasswordForm } from './reset-password-form';

const TOKEN = 'a'.repeat(43);

async function fill(password: string, confirm: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('New password'), password);
  await user.type(screen.getByLabelText('Confirm the new password'), confirm);
  await user.click(screen.getByRole('button', { name: 'Set new password' }));
}

describe('ResetPasswordForm', () => {
  it('checks length and confirmation before sending anything', async () => {
    let calls = 0;
    server.use(
      http.post('*/api/auth/reset-password', () => {
        calls += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(
      <ResetPasswordForm token={TOKEN} onSuccess={vi.fn()} />,
    );

    await fill('short', 'different');

    expect(
      await screen.findByText('Use at least 8 characters'),
    ).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it('sends the token with the new password and reports success', async () => {
    const onSuccess = vi.fn();
    let body: unknown;
    server.use(
      http.post('*/api/auth/reset-password', async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(
      <ResetPasswordForm token={TOKEN} onSuccess={onSuccess} />,
    );

    await fill('a-new-password', 'a-new-password');

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(body).toEqual({ token: TOKEN, password: 'a-new-password' });
  });

  it('explains why an expired or used link was refused', async () => {
    server.use(
      http.post('*/api/auth/reset-password', () =>
        HttpResponse.json(
          { statusCode: 400, message: 'The link is invalid or has expired' },
          { status: 400 },
        ),
      ),
    );
    const onSuccess = vi.fn();
    renderWithProviders(
      <ResetPasswordForm token={TOKEN} onSuccess={onSuccess} />,
    );

    await fill('a-new-password', 'a-new-password');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The link is invalid or has expired',
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

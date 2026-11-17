import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { authStorage } from '@/lib/auth-storage';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import { EmailVerificationBanner } from './email-verification-banner';

const me = (emailVerifiedAt: string | null) =>
  http.get('*/api/auth/me', () =>
    HttpResponse.json({
      id: 1,
      name: 'Ann',
      email: 'ann@example.test',
      role: 'USER',
      emailVerifiedAt,
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
  );

describe('EmailVerificationBanner', () => {
  beforeEach(() => authStorage.setToken('jwt'));

  it('asks an unconfirmed user to confirm and can send the link again', async () => {
    let resent = 0;
    server.use(
      me(null),
      http.post('*/api/auth/resend-verification', () => {
        resent += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<EmailVerificationBanner />);

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Confirm your email address',
    );
    await user.click(
      screen.getByRole('button', { name: 'Send the link again' }),
    );

    expect(
      await screen.findByText('We sent a new link. Check your inbox.'),
    ).toBeInTheDocument();
    expect(resent).toBe(1);
    // One request is enough: the button goes away until the page is reloaded.
    expect(
      screen.queryByRole('button', { name: 'Send the link again' }),
    ).not.toBeInTheDocument();
  });

  it('shows nothing for a confirmed address', async () => {
    let asked = false;
    server.use(
      http.get('*/api/auth/me', () => {
        asked = true;
        return HttpResponse.json({
          id: 1,
          name: 'Ann',
          email: 'ann@example.test',
          role: 'USER',
          emailVerifiedAt: '2026-01-01T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
        });
      }),
    );
    renderWithProviders(<EmailVerificationBanner />);

    await waitFor(() => expect(asked).toBe(true));
    // Let the answer reach the component before checking that nothing was drawn.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows nothing while nobody is signed in', () => {
    authStorage.clear();
    renderWithProviders(<EmailVerificationBanner />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

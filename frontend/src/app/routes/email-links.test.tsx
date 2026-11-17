import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/testing/mocks/server';
import { renderApp } from '@/testing/test-utils';

const TOKEN = 'a'.repeat(43);

describe('pages opened from an email', () => {
  describe('reset password', () => {
    it('takes the token from the fragment, then removes it from the address', async () => {
      const { router } = renderApp(`/reset-password#token=${TOKEN}`);

      expect(
        await screen.findByRole('heading', { name: 'Choose a new password' }),
      ).toBeInTheDocument();
      await waitFor(() => expect(router.state.location.hash).toBe(''));
      // The form still has the token: it was read before the address was cleaned.
      expect(screen.getByLabelText('New password')).toBeInTheDocument();
    });

    it('offers a new link when the address has no usable token', async () => {
      renderApp('/reset-password#token=short');

      expect(
        await screen.findByRole('heading', { name: 'This link does not work' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Request a new link' }),
      ).toHaveAttribute('href', '/forgot-password');
    });

    it('shows that the password was changed and leads to sign-in', async () => {
      server.use(
        http.post(
          '*/api/auth/reset-password',
          () => new HttpResponse(null, { status: 204 }),
        ),
      );
      const user = userEvent.setup();
      renderApp(`/reset-password#token=${TOKEN}`);

      await user.type(
        await screen.findByLabelText('New password'),
        'a-new-password',
      );
      await user.type(
        screen.getByLabelText('Confirm the new password'),
        'a-new-password',
      );
      await user.click(
        screen.getByRole('button', { name: 'Set new password' }),
      );

      expect(
        await screen.findByRole('heading', { name: 'Password changed' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
        'href',
        '/login',
      );
    });
  });

  describe('confirm email', () => {
    it('does nothing until the person clicks: a mail scanner opening the link must not use it up', async () => {
      let calls = 0;
      server.use(
        http.post('*/api/auth/verify-email', () => {
          calls += 1;
          return new HttpResponse(null, { status: 204 });
        }),
      );
      const user = userEvent.setup();
      renderApp(`/verify-email#token=${TOKEN}`);

      const button = await screen.findByRole('button', {
        name: 'Confirm my email',
      });
      expect(calls).toBe(0);
      await user.click(button);

      expect(
        await screen.findByRole('heading', { name: 'Email confirmed' }),
      ).toBeInTheDocument();
      expect(calls).toBe(1);
    });

    it('explains a refused link', async () => {
      server.use(
        http.post('*/api/auth/verify-email', () =>
          HttpResponse.json(
            { statusCode: 400, message: 'The link is invalid or has expired' },
            { status: 400 },
          ),
        ),
      );
      const user = userEvent.setup();
      renderApp(`/verify-email#token=${TOKEN}`);

      await user.click(
        await screen.findByRole('button', { name: 'Confirm my email' }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'invalid or has expired',
      );
    });

    it('says so when there is no token in the link', async () => {
      renderApp('/verify-email');

      expect(
        await screen.findByRole('heading', { name: 'This link does not work' }),
      ).toBeInTheDocument();
    });
  });

  it('links the sign-in page to the forgot-password page', async () => {
    renderApp('/login');

    expect(
      await screen.findByRole('link', { name: 'Forgot your password?' }),
    ).toHaveAttribute('href', '/forgot-password');
  });
});

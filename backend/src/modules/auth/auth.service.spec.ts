import { HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AppConfigService } from '../../config/app-config.service';
import type { MailQueueService } from '../mail/mail-queue.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { RefreshTokensService } from './refresh-tokens.service';
import type { UserTokensService } from './user-tokens.service';

describe('AuthService', () => {
  const findByEmailForAuth = vi.fn();
  const createUser = vi.fn();
  const getProfile = vi.fn();
  const verifyPassword = vi.fn();
  const recordFailedLogin = vi.fn();
  const clearFailedLogins = vi.fn();
  const hashPassword = vi.fn();
  const applyNewPassword = vi.fn();
  const markEmailVerified = vi.fn();
  const sign = vi.fn();
  const issue = vi.fn();
  const consume = vi.fn();
  const revokeByToken = vi.fn();
  const issueToken = vi.fn();
  const issuedRecently = vi.fn();
  const redeem = vi.fn();
  const enqueue = vi.fn();
  let service: AuthService;

  const refreshExpiresAt = new Date('2026-12-01T00:00:00.000Z');
  const tx = { tx: true };

  beforeEach(() => {
    vi.resetAllMocks();
    // `redeem` runs the work like the real one does, with a stand-in transaction.
    redeem.mockImplementation(
      (
        _token: string,
        _type: string,
        work: (userId: number, tx: unknown) => Promise<void>,
      ) => work(7, tx),
    );
    service = new AuthService(
      {
        findByEmailForAuth,
        createUser,
        getProfile,
        verifyPassword,
        recordFailedLogin,
        clearFailedLogins,
        hashPassword,
        applyNewPassword,
        markEmailVerified,
      } as unknown as UsersService,
      { sign } as unknown as JwtService,
      { issue, consume, revokeByToken } as unknown as RefreshTokensService,
      {
        issue: issueToken,
        issuedRecently,
        redeem,
      } as unknown as UserTokensService,
      { enqueue } as unknown as MailQueueService,
      { appUrl: 'https://app.example' } as AppConfigService,
    );
  });

  describe('validateUser', () => {
    const user = (overrides: object = {}) => ({
      id: 1,
      email: 'a@b.co',
      password: 'hash',
      lockedUntil: null,
      ...overrides,
    });

    it('returns null for an unknown email, after a comparison that costs the same as a real one', async () => {
      findByEmailForAuth.mockResolvedValue(null);
      verifyPassword.mockResolvedValue(false);

      expect(
        await service.validateUser({ email: 'x@y.co', password: 'pw' }),
      ).toBeNull();
      expect(verifyPassword).toHaveBeenCalledWith('pw', null);
      expect(recordFailedLogin).not.toHaveBeenCalled();
    });

    it('counts a wrong password against the account', async () => {
      findByEmailForAuth.mockResolvedValue(user());
      verifyPassword.mockResolvedValue(false);

      expect(
        await service.validateUser({ email: 'a@b.co', password: 'wrong' }),
      ).toBeNull();
      expect(recordFailedLogin).toHaveBeenCalledWith(1);
      expect(clearFailedLogins).not.toHaveBeenCalled();
    });

    it('returns the user without the password hash and clears the failures', async () => {
      findByEmailForAuth.mockResolvedValue(user());
      verifyPassword.mockResolvedValue(true);

      const result = await service.validateUser({
        email: 'a@b.co',
        password: 'right',
      });

      expect(result).toEqual({ id: 1, email: 'a@b.co' });
      expect(clearFailedLogins).toHaveBeenCalledWith(1);
    });

    it('answers 429 while the account is locked, even for the right password', async () => {
      findByEmailForAuth.mockResolvedValue(
        user({ lockedUntil: new Date(Date.now() + 60_000) }),
      );
      verifyPassword.mockResolvedValue(true);

      const attempt = service.validateUser({
        email: 'a@b.co',
        password: 'right',
      });

      await expect(attempt).rejects.toBeInstanceOf(HttpException);
      await expect(attempt).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
      expect(recordFailedLogin).not.toHaveBeenCalled();
    });

    it('lets the user in again once the lock has expired', async () => {
      findByEmailForAuth.mockResolvedValue(
        user({ lockedUntil: new Date(Date.now() - 1000) }),
      );
      verifyPassword.mockResolvedValue(true);

      expect(
        await service.validateUser({ email: 'a@b.co', password: 'right' }),
      ).toEqual({ id: 1, email: 'a@b.co' });
    });
  });

  describe('login', () => {
    it('signs an access token for the user and starts a new refresh family', async () => {
      sign.mockReturnValue('signed-token');
      issue.mockResolvedValue({
        token: 'refresh-1',
        expiresAt: refreshExpiresAt,
      });

      const session = await service.login({ id: 9, email: 'a@b.co' });

      expect(session).toEqual({
        accessToken: 'signed-token',
        refreshToken: 'refresh-1',
        refreshExpiresAt,
      });
      expect(sign).toHaveBeenCalledWith({ email: 'a@b.co', sub: 9 });
      expect(issue).toHaveBeenCalledWith(9);
    });
  });

  describe('refresh', () => {
    it('spends the token and continues its family with a new pair', async () => {
      consume.mockResolvedValue({ userId: 9, familyId: 'family-1' });
      getProfile.mockResolvedValue({ id: 9, email: 'a@b.co' });
      issue.mockResolvedValue({
        token: 'refresh-2',
        expiresAt: refreshExpiresAt,
      });
      sign.mockReturnValue('access-2');

      const session = await service.refresh('refresh-1');

      expect(consume).toHaveBeenCalledWith('refresh-1');
      expect(issue).toHaveBeenCalledWith(9, 'family-1');
      expect(session).toEqual({
        accessToken: 'access-2',
        refreshToken: 'refresh-2',
        refreshExpiresAt,
      });
    });

    it('issues nothing when the token is rejected', async () => {
      consume.mockRejectedValue(new Error('invalid'));

      await expect(service.refresh('bad')).rejects.toThrow('invalid');
      expect(issue).not.toHaveBeenCalled();
      expect(sign).not.toHaveBeenCalled();
    });
  });

  it('revokes the refresh family on logout', async () => {
    revokeByToken.mockResolvedValue(undefined);

    await service.logout('refresh-1');

    expect(revokeByToken).toHaveBeenCalledWith('refresh-1');
  });

  it('returns the profile of the current user', async () => {
    getProfile.mockResolvedValue({ id: 5 });

    expect(await service.me(5)).toEqual({ id: 5 });
    expect(getProfile).toHaveBeenCalledWith(5);
  });

  describe('register', () => {
    const dto = { name: 'A', email: 'a@b.co', password: 'password-123' };

    it('creates the user and emails a confirmation link', async () => {
      createUser.mockResolvedValue({ id: 1, email: 'a@b.co' });
      issueToken.mockResolvedValue('raw-token');

      expect(await service.register(dto)).toEqual({ id: 1, email: 'a@b.co' });

      expect(createUser).toHaveBeenCalledWith(dto);
      expect(issueToken).toHaveBeenCalledWith(1, 'EMAIL_VERIFICATION');
      expect(enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'a@b.co',
          // In the fragment, so the secret is never sent to a server or in a Referer header.
          text: expect.stringContaining(
            'https://app.example/verify-email#token=raw-token',
          ),
        }),
      );
    });

    it('still succeeds when the confirmation email cannot be prepared', async () => {
      createUser.mockResolvedValue({ id: 1, email: 'a@b.co' });
      issueToken.mockRejectedValue(new Error('db down'));

      await expect(service.register(dto)).resolves.toEqual({
        id: 1,
        email: 'a@b.co',
      });
      expect(enqueue).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('emails a reset link to a known address', async () => {
      findByEmailForAuth.mockResolvedValue({ id: 3, email: 'a@b.co' });
      issuedRecently.mockResolvedValue(false);
      issueToken.mockResolvedValue('reset-token');

      await service.forgotPassword('a@b.co');

      expect(issueToken).toHaveBeenCalledWith(3, 'PASSWORD_RESET');
      expect(enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'a@b.co',
          text: expect.stringContaining(
            'https://app.example/reset-password#token=reset-token',
          ),
        }),
      );
    });

    it('does nothing, and says nothing, for an unknown address', async () => {
      findByEmailForAuth.mockResolvedValue(null);

      await expect(service.forgotPassword('who@x.co')).resolves.toBeUndefined();
      expect(issueToken).not.toHaveBeenCalled();
      expect(enqueue).not.toHaveBeenCalled();
    });

    it('sends at most one email a minute per account', async () => {
      findByEmailForAuth.mockResolvedValue({ id: 3, email: 'a@b.co' });
      issuedRecently.mockResolvedValue(true);

      await service.forgotPassword('a@b.co');

      expect(issueToken).not.toHaveBeenCalled();
      expect(enqueue).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('sets the new password in the transaction that spends the token, and proves the email', async () => {
      hashPassword.mockResolvedValue('new-hash');

      await service.resetPassword('reset-token', 'new-password');

      expect(redeem).toHaveBeenCalledWith(
        'reset-token',
        'PASSWORD_RESET',
        expect.any(Function),
      );
      expect(applyNewPassword).toHaveBeenCalledWith(tx, 7, 'new-hash', {
        proveEmail: true,
      });
    });

    it('changes nothing when the token is refused', async () => {
      hashPassword.mockResolvedValue('new-hash');
      redeem.mockRejectedValue(new Error('invalid link'));

      await expect(
        service.resetPassword('bad', 'new-password'),
      ).rejects.toThrow('invalid link');
      expect(applyNewPassword).not.toHaveBeenCalled();
    });
  });

  describe('email verification', () => {
    it('marks the address of the token as confirmed', async () => {
      await service.verifyEmail('verify-token');

      expect(redeem).toHaveBeenCalledWith(
        'verify-token',
        'EMAIL_VERIFICATION',
        expect.any(Function),
      );
      expect(markEmailVerified).toHaveBeenCalledWith(tx, 7);
    });

    it('sends the link again to an unconfirmed address', async () => {
      getProfile.mockResolvedValue({
        id: 4,
        email: 'a@b.co',
        emailVerifiedAt: null,
      });
      issuedRecently.mockResolvedValue(false);
      issueToken.mockResolvedValue('t');

      await service.resendVerification(4);

      expect(enqueue).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['an already confirmed address', { emailVerifiedAt: new Date() }, false],
      ['a link that was sent a moment ago', { emailVerifiedAt: null }, true],
    ])('does nothing for %s', async (_name, profile, recent) => {
      getProfile.mockResolvedValue({ id: 4, email: 'a@b.co', ...profile });
      issuedRecently.mockResolvedValue(recent);

      await service.resendVerification(4);

      expect(enqueue).not.toHaveBeenCalled();
    });
  });
});

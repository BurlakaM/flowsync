import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { RefreshTokensService } from './refresh-tokens.service';

describe('AuthService', () => {
  const findByEmailForAuth = vi.fn();
  const createUser = vi.fn();
  const getProfile = vi.fn();
  const sign = vi.fn();
  const issue = vi.fn();
  const consume = vi.fn();
  const revokeByToken = vi.fn();
  let service: AuthService;

  const refreshExpiresAt = new Date('2026-12-01T00:00:00.000Z');

  beforeEach(() => {
    vi.resetAllMocks();
    service = new AuthService(
      { findByEmailForAuth, createUser, getProfile } as unknown as UsersService,
      { sign } as unknown as JwtService,
      { issue, consume, revokeByToken } as unknown as RefreshTokensService,
    );
  });

  describe('validateUser', () => {
    it('returns null for an unknown email', async () => {
      findByEmailForAuth.mockResolvedValue(null);

      expect(
        await service.validateUser({ email: 'x@y.co', password: 'pw' }),
      ).toBeNull();
    });

    it('returns null for a wrong password', async () => {
      findByEmailForAuth.mockResolvedValue({
        id: 1,
        email: 'a@b.co',
        password: await bcrypt.hash('right', 4),
      });

      expect(
        await service.validateUser({ email: 'a@b.co', password: 'wrong' }),
      ).toBeNull();
    });

    it('returns the user without the password hash for valid credentials', async () => {
      findByEmailForAuth.mockResolvedValue({
        id: 1,
        email: 'a@b.co',
        password: await bcrypt.hash('right', 4),
      });

      const user = await service.validateUser({
        email: 'a@b.co',
        password: 'right',
      });

      expect(user).toEqual({ id: 1, email: 'a@b.co' });
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

  it('registers through the users service', async () => {
    const dto = { name: 'A', email: 'a@b.co', password: 'password-123' };
    createUser.mockResolvedValue({ id: 1 });

    expect(await service.register(dto)).toEqual({ id: 1 });
    expect(createUser).toHaveBeenCalledWith(dto);
  });

  it('returns the profile of the current user', async () => {
    getProfile.mockResolvedValue({ id: 5 });

    expect(await service.me(5)).toEqual({ id: 5 });
    expect(getProfile).toHaveBeenCalledWith(5);
  });
});
